# Interview — Phase 0: Auth & Foundation

**Status:** ✅ Parts 1–3 built and tested — plumbing, auth, onboarding (55 automated tests passing).

## One-line summary

Email + password with OTP email verification and Google sign-in on one account per email, short-lived access tokens, rotating refresh-token sessions with theft detection, and brute-force protection that doesn't lock out a whole college lab — on a base of consistent errors, structured logging and security middleware.

## How it works (whiteboard version)

```text
Signup ──► rate limit ──► validate ──► user (isVerified=false, bcrypt in pre-save hook)
                                   └► OTP: crypto.randomInt → SHA-256 hash in Redis (TTL 10 min, 5 attempts) → email
Verify OTP ──► HINCRBY attempts ──► timing-safe compare ──► delete OTP ──► isVerified=true
           └► access JWT (15 min, body) + refresh JWT {sid, jti} (7 d, httpOnly cookie)
                                          └► Redis session:<sid> = { userId, jti }
Request ──► protect: verify access JWT signature only (no DB, no Redis) ──► req.user
Refresh ──► jti must match Redis ──► new jti (rotation)
        └► old jti after 10 s ──► reuse = theft ──► kill the session
Logout ──► delete session:<sid>      Password reset ──► delete ALL sessions of the user
```

## Problems I found and fixed (tell these as stories)

**1. OTP brute force.** "Reviewing my own auth, I saw `/verify-otp` had no rate limit and no attempt counter. A 6-digit OTP is a million combinations — scriptable inside the 10-minute window. Now each OTP has an attempt counter in Redis incremented with `HINCRBY`, which is atomic, so even 10 parallel guesses each get a distinct count. The 6th attempt burns the OTP. I also switched from `Math.random` to `crypto.randomInt`, store only a SHA-256 hash of the OTP, and compare with `timingSafeEqual`. There's a test that sends 5 wrong codes and then proves the correct code no longer works."

**2. Every error was a 500.** "Services threw plain `Error`s, so 'invalid credentials' came back as an internal server error. I added an `AppError` with a status and a machine-readable code like `EMAIL_NOT_VERIFIED`, so the frontend branches on codes, not message text."

**3. Campus Wi-Fi vs rate limiting.** "My users are tier 3/4 college students — a whole lab shares one public IP. Rate limiting by IP alone would let one student lock out the class. Every auth route has two limiters: strict per IP + email, loose per IP. I have a test where one account gets blocked after 10 failed logins while another student on the same IP logs in fine."

**4. Rate limiters sharing one counter.** "While fixing that, I noticed all limiters used the library's default Redis prefix, so signup, login and resend-OTP all incremented the same per-IP key — resending an OTP twice ate your login attempts. Each limiter now has its own prefix, and a test proves OTP requests don't consume login attempts."

**5. Logout that didn't log out.** "Logout only cleared the cookie; a stolen refresh token stayed valid for 7 days. Now each login is a session in Redis. The refresh token carries a session ID and a token ID; every refresh issues a new token ID and invalidates the old one. If an old one comes back, someone has a copy — so the whole session is revoked, attacker and user both out, and only the real user can log back in."

**6. Two tabs vs theft detection.** "Rotation created a new problem: two browser tabs refreshing at the same moment send the same token, and the second looked like theft — logging the student out. I keep the previous token ID with a timestamp; within 10 seconds it's treated as a race and gets the current token. After 10 seconds it's reuse. Both cases are tested."

**7. Account pre-registration takeover.** "One account per email, either login method. The gap: an attacker signs up with a victim's email and their own password and never verifies. If the victim later uses Google and I just link accounts, the attacker's password now works on a verified account. So when Google links an unverified account, its password is cleared. There's a test that plays the attacker."

**8. Silent email failures.** "The email SDK doesn't throw on failure — it returns an `{ error }` object we never checked. Signup said 'code sent' when nothing was sent. Now it returns 503 `EMAIL_FAILED`, the user stays unverified, and retrying works — no stuck accounts."

**9. Input 'sanitizers' that corrupted data.** "The validator escaped names — 'D'Souza' was stored as `D&#x27;Souza` and would have printed that way on certificates. And `normalizeEmail` strips dots from Gmail addresses, so `john.doe@gmail.com` became `johndoe@gmail.com` and wouldn't match the same person's Google login — a duplicate account. I removed both: store data as entered, escape at output."

**10. A bug my tests caught.** "Linking Google to an existing verified account returned a 500. The password field is excluded from queries by default, so my 'local accounts need a password' hook saw `undefined` on save. Fixed by checking only when the field was actually loaded."

**11. Debugging a test hang.** "All tests hung on connect. Outside Jest the same code worked. I narrowed it down — the raw MongoDB driver failed too, with 'Missing required sub-document driver'. The driver loads Node's `os` module with a dynamic `import()`, which Jest's vm sandbox doesn't support, so the handshake metadata was never built. The driver has a `runtimeAdapters` option to inject `os` directly; that fixed it. Test-only — production Node is fine."

## Production plumbing (Part 1)

**Q: How do you handle errors across the API?**
A: One central handler. Expected cases are `AppError`s with a status and code. Library errors (Mongoose validation, duplicate key, JWT expiry, oversized or malformed body) are mapped to proper 4xx. Anything else is a bug: logged with the stack, generic 500 in production. Express 5 forwards async errors, so controllers have no try/catch.

**Q: Why two health endpoints?**
A: `/health` is liveness — no DB call; failing means restart the container. `/health/ready` checks Mongo and Redis; failing means stop routing traffic here, but don't restart — restarting doesn't fix an Atlas outage, it just causes a restart loop.

**Q: What happens to in-flight requests on deploy?**
A: Graceful shutdown on SIGTERM: stop accepting, finish running requests, close Mongo and Redis, exit; 10 s force-exit. (Built; verified on Linux in Phase 6 — Windows can't deliver SIGTERM in dev.)

**Q: Anything specific about Node behind Nginx?**
A: `trust proxy` set to the hop count, not `true`, so I get the real client IP but clients can't spoof `X-Forwarded-For`. And `keepAliveTimeout` above Nginx's, otherwise Node closes reused connections first and you get random 502s.

**Q: How do you debug a production issue a student reports?**
A: Every request has an ID in the `x-request-id` header and in every JSON log line. Logs redact passwords, OTPs, tokens and cookies.

## Onboarding (Part 3)

**What it is (one line):** after first login, a 2-step form collects certificate name, phone, college, degree, year, goal and interests; the backend blocks enroll and payment until it's done.

**Q: Why embed the profile in the user document instead of a separate collection?**
A: It's strictly 1:1 with the user, small, and always read together. Embedding makes `/me` a single read by `_id`, no join. A separate collection would only make sense if profiles were large, shared, or queried independently — none of those apply.

**Q: How does the college autocomplete work, and why not a fixed list of colleges?**
A: There's no clean, complete list of tier 3/4 colleges, so students build it. When a student types a college, I normalize the name — lowercase, strip punctuation, collapse spaces — and do an atomic upsert on that normalized name, so "Govt. College of Engg, Pune" and "govt college of engg pune" become one college. For search, each name is split into words with a multikey index; every word the student types must be a prefix of some word in the name, so "eng pune" finds "Government College of Engineering Pune". The first word uses the index, results are sorted by how many students picked that college, and each query is cached in Redis for 5 minutes because the same prefixes get typed constantly.

**Q: Two students submit the same new college at the same moment — what happens?**
A: Both upserts see "not found" and try to insert; the unique index on the normalized name lets one win and the other gets a duplicate-key error. I catch that specific error and retry the upsert once, which now finds the existing document. One college, no error to the user.

**Q: How do you stop a user from setting fields they shouldn't, like `role: admin`?**
A: The controller passes only `matchedData()` — the fields that went through a validator — to the service. Anything else in the body is dropped. I have a test that sends `role: 'admin'` and a fake certificate-lock date with an otherwise valid onboarding and checks neither was saved.

**Q: Why lock the certificate name?**
A: Once a certificate or letter is issued, the name on it is fixed and publicly verifiable. If the profile name could change afterwards, the verify page and the profile would disagree — a trust problem for a credential business. So the first issued document sets a lock date, and any change after that is a 403. Re-sending the same name is allowed so a full-form resubmit doesn't break.

**Q: Why check onboarding with a DB read instead of putting a flag in the JWT?**
A: The check only guards rare routes — enroll and payment. A flag in the token would be stale right after onboarding, forcing a token refresh in the middle of the flow. One tiny read on a rare route is the simpler correct option; the hot path (`protect` on every request) still touches nothing.

**Q: How do you handle phone numbers?**
A: Students type them every possible way — with 0, +91, 91, spaces, dashes. A sanitizer normalizes all of them to E.164 (`+91XXXXXXXXXX`) before validation, which also requires an Indian mobile prefix (6–9). E.164 is what WhatsApp and SMS APIs expect, so later notifications need no cleanup.

## Decisions & trade-offs

- **`protect` is stateless.** Access tokens are only ever issued to verified users, so `protect` only verifies the JWT signature — no DB or Redis call on any authenticated request. Trade-off: a role change or deleted account takes effect at the next refresh (≤ 15 min), where the user is reloaded from the DB. Right call for 1,000 students; I'd add a Redis denylist if instant bans mattered.
- **Sessions in Redis, access tokens stateless** — a deliberate hybrid: most requests touch nothing, but I still get logout, rotation and "log out everywhere" on password reset.
- **OTP in Redis** — temporary, high-frequency, auto-expiring; TTL replaces a cleanup job. Purpose-scoped keys, so a signup OTP can't reset a password.
- **Refresh cookie: httpOnly, `SameSite=Strict`, `Path=/api/auth`** — unreadable by JavaScript, never sent cross-site, and only sent to auth routes. Works because `classroom.beyownd.in` and `api.beyownd.in` are the same site.
- **Enumeration resistance** — same message for wrong password and unknown email; a dummy bcrypt compare when the email doesn't exist so response time doesn't leak it; generic messages on resend and forgot-password. "Email not verified" is revealed only after the correct password.
- **Schema migration as a script** — `authProvider` → `authProviders[]` via an idempotent aggregation-pipeline update, run twice to prove it.

## Testing approach

**Q: How did you test auth?**
A: 55 integration tests (35 auth, 20 onboarding) with Jest and Supertest against the real Express app, an in-memory MongoDB, and a real Redis. Only the two external services are mocked — the email provider and Google token verification — so hashing, OTPs, sessions and rate limits run for real. Each test starts from a wiped database. The setup refuses to run unless both databases are local, because the cleanup deletes everything.

## Likely questions + answers

**Q: Why not plain server sessions instead of JWT?**
A: With server sessions every request needs a lookup. Access JWTs need no lookup, which suits a stateless API running as multiple instances. Refresh tokens are server-side sessions, so I still have revocation — the usual weakness of pure JWT.

**Q: What if Redis goes down?**
A: Login, OTP, refresh and rate limiting fail, but already-issued access tokens keep working until expiry, so logged-in students can keep studying for up to 15 minutes. `/health/ready` reports it. For production, Redis gets persistence and a restart policy (Phase 6); at larger scale, managed Redis with a replica.

**Q: How do you stop someone signing up with another person's email?**
A: The account can't log in until the OTP sent to that inbox is entered. If the real owner signs up again, the unverified account's password is overwritten. If they use Google, the attacker's password is cleared.

**Q: bcrypt cost factor?**
A: 10 rounds — tens of milliseconds per hash on a small VPS: expensive for offline cracking, cheap for a login. Passwords capped at 64 characters because bcrypt only reads 72 bytes.

## At 100× scale I would…

Managed Redis with replication; a "your devices" page to list and revoke sessions; CAPTCHA on signup and forgot-password; a Redis denylist for instant bans; a transactional email queue (BullMQ) so a slow email provider never slows signup; and an identity provider if colleges needed SSO.
