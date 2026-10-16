# Interview — Phase 0: Auth & Foundation

**Status:** 🟡 Prepared before building. Finalize after Phase 0 is done; keep only what's actually built.

## One-line summary

Email + OTP and Google sign-in with short-lived access tokens, rotated refresh tokens, and protection against brute force, all on a shared base of consistent errors, logging, and security middleware.

## How it works (whiteboard version)

```text
Signup ──► validate ──► create user (isVerified=false, bcrypt hash in pre-save hook)
                      └► OTP (crypto) → Redis, TTL 10 min ──► email (Resend)
Verify OTP ──► compare + attempt counter ──► delete OTP (one-time) ──► isVerified=true
           └► access token (15 min, response body) + refresh token (7 d, httpOnly cookie, stored in Redis)
Request ──► protect: verify access JWT ──► req.user
Refresh ──► cookie token must match the one in Redis ──► issue new pair, old one invalid (rotation)
Logout ──► delete refresh token from Redis + clear cookie
```

## Problems I found and fixed (the strongest part — tell these as stories)

1. **OTP brute force.** "While reviewing my own auth I noticed `/verify-otp` had no rate limit and no attempt counter. A 6-digit OTP is a million combinations — scriptable in 10 minutes. I added a per-OTP attempt counter in Redis (5 tries, then the OTP is burned), a rate limit on the endpoint, and switched generation from `Math.random` to `crypto.randomInt`."
2. **Every error was a 500.** "Services threw plain `Error`s, so 'invalid credentials' came back as an internal server error. That breaks the frontend and pollutes monitoring. I introduced an `AppError` with a status code, and the global handler hides internal details on real 500s."
3. **Campus Wi-Fi vs rate limiting.** "My users are college students — a whole lab shares one public IP. A 5-attempts-per-IP limit would lock out a classroom. And behind Nginx every request looked like it came from Nginx. I set `trust proxy` and keyed the limiter on IP + email, with a looser per-IP ceiling."
4. **Logout that didn't log out.** "Logout only cleared the cookie; a stolen refresh token stayed valid for 7 days. I store the current refresh token in Redis, rotate it on every refresh, and delete it on logout — so revocation actually works, and reuse of an old token is detectable."

5. **Account pre-registration takeover.** "Users can sign up with email + password or Google, and both map to one account per email. I noticed a gap: an attacker could sign up with a victim's email and their own password, leaving it unverified. If the victim later signed in with Google and I simply linked the accounts, the attacker's password would now work on a verified account. So when Google links to an unverified account, I clear its password."

## Production plumbing (Part 1 — built and smoke-tested)

**Q: How do you handle errors across the API?**
A: One central error handler. Services throw an `AppError` with a status and a machine-readable code for expected cases — wrong password, duplicate email. Library errors (Mongoose validation, duplicate key, JWT expiry, oversized body) are mapped to proper 4xx codes. Anything else is a bug: it's logged with the stack and the client gets a generic 500 in production, so internals never leak. Express 5 forwards async errors automatically, so controllers have no try/catch boilerplate.

**Q: Why two health endpoints?**
A: Liveness (`/health`) answers "is the process alive" and never touches the database — if it fails, Docker restarts the container. Readiness (`/health/ready`) checks Mongo and Redis — if it fails, the load balancer stops sending traffic but doesn't restart, because restarting won't fix an Atlas outage, it would just cause a restart loop.

**Q: What happens to in-flight requests when you deploy?**
A: Graceful shutdown. On SIGTERM the server stops accepting connections, lets running requests finish — important for payment webhooks — closes Mongo and Redis, then exits, with a 10 second force-exit so it can never hang.

**Q: Anything specific about running Node behind Nginx?**
A: Two things. `trust proxy` set to the number of hops, not `true`, so I get the real client IP for rate limiting but clients can't spoof it with a fake `X-Forwarded-For`. And Node's `keepAliveTimeout` set above Nginx's, otherwise Node closes reused connections first and you get intermittent 502s under load.

**Q: How do you debug a production issue a student reports?**
A: Every request gets an ID, returned in the `x-request-id` header and present in every JSON log line. Ask for the ID (or find it by time/route) and you see that request's full path. Logs redact passwords, OTPs, tokens and cookies by path, so even an accidental full-body log is safe.

## Decisions & trade-offs

- **OTP in Redis, not Mongo** — temporary, high-frequency, auto-expiring data; TTL replaces a cleanup cron.
- **Access token in memory on the frontend, refresh in httpOnly cookie** — XSS can't read the refresh token; CSRF limited by `sameSite` + the refresh endpoint only issuing tokens.
- **Password hashing in a Mongoose pre-save hook** — no code path can save a plaintext password by accident.
- **Validation before the controller** (express-validator) — bad input never reaches business logic.

## Likely questions + answers

**Q: Why not keep the user in a session instead of JWT?**
A: Access JWTs let the API verify most requests without a lookup, which suits a stateless multi-instance API. I still keep refresh tokens server-side so I get revocation — the usual weakness of pure JWT.

**Q: What if Redis goes down?**
A: OTP verification, rate limiting, and refresh fail closed (users can't log in fresh) but already-issued access tokens keep working until expiry. Redis runs with AOF persistence, and its health is part of `/health`. At larger scale I'd use managed Redis with a replica.

**Q: How do you stop someone signing up with another person's email?**
A: The account stays unverified and can't log in until the OTP sent to that inbox is entered. If the real owner later uses Google sign-in, the account gets verified and linked to their Google ID.

**Q: bcrypt cost factor?**
A: 10 salt rounds — a balance between brute-force cost and login latency on a small VPS. I'd raise it as hardware allows.

## At 100× scale I would…

Move to managed Redis with replication, add device/session management (list + revoke sessions), add bot protection (CAPTCHA) on signup, and consider a dedicated auth provider if we needed SSO for colleges.
