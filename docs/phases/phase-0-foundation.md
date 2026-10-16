# Phase 0 — Foundation & Hardening

**Dates:** Oct 15 – 16, 2026
**Status:** 🟡 In progress — Parts 1–3 (plumbing, auth, onboarding) done; design docs (C1, C2) next
**Interview doc:** [../interview/phase-0-foundation.md](../interview/phase-0-foundation.md)

## Goal

Make the existing auth module safe for real users and real money, put the shared plumbing (errors, logging, security headers) in place once, and design every schema + API route before writing more features.

## Work items

Each item: **what** → **why**. The "how" section gets filled in as each item is built.

### A. Auth bug fixes

| # | What | Why |
| --- | --- | --- |
| A1 | OTP: `crypto.randomInt`, max 5 wrong attempts per OTP, rate-limit `/verify-otp` | Today a 6-digit OTP can be brute-forced — no attempt limit, and `Math.random` is not cryptographically secure |
| A2 | `AppError(statusCode, message)` used by all services | Today "Invalid credentials" returns HTTP 500; clients and monitoring can't tell user errors from server crashes |
| A3 | Name rule aligned in validator + model (2–60 chars) | Validator says 5–20, model says 3–20; "Ravi" can't sign up and long Google names crash signup |
| A4 | Refresh token rotation + stored in Redis; logout deletes it | Today logout only clears a cookie — a stolen refresh token stays valid for 7 days |
| A5 | `protect` checks `isVerified` and uses a short Redis cache for user lookup | Unverified users shouldn't hit protected routes; avoids a DB read on every request |
| A6 | Signup re-sends OTP for an existing unverified account; OTP email failure doesn't leave a broken user | Today an unverified user who retries signup is stuck with "already registered" |
| A7 | Google login on an existing unverified local account → mark verified + link `googleId` | Consistent account state, no duplicate accounts |
| A8 | CORS with explicit `origin` + `credentials: true`; cookie `sameSite`/`path` set for the deployed domains | Refresh cookie silently won't be sent cross-origin otherwise |
| A9 | Rate-limit key = IP + email; `app.set('trust proxy', 1)` | Whole college labs share one IP; behind Nginx every user looks like one IP |

### A+. Auth & onboarding additions (decided Oct 15 — see [../design/user-flow.md](../design/user-flow.md))

| # | What | Why |
| --- | --- | --- |
| A10 | `authProviders` array replaces single `authProvider`; account-linking rules (incl. clearing an unverified password on Google link) | One account per email, either login method works, no pre-registration takeover |
| A11 | Forgot / reset password via purpose-scoped OTP; reset revokes all sessions | Password login needs a recovery path; signup OTP can't be reused for reset |
| A12 | `profile` sub-document + `onboardingCompleted`; `GET /users/me`, `PUT /users/me/onboarding`, `PATCH /users/me/profile` | Collect college/year/goal once, right after first login |
| A13 | `requireOnboarding` middleware; `certificateName` locked after a credential is issued | Enforce on the server, not just with a frontend redirect; certificate name can't be changed after the fact |
| A14 | College autocomplete endpoint, Redis-cached | Fast suggestions on slow networks, consistent college names for stats |

### B. Shared plumbing

| # | What | Why |
| --- | --- | --- |
| B1 | `helmet`, `compression`, `express.json({ limit: '100kb' })` | Security headers, smaller responses on mobile data, block oversized payloads |
| B2 | `pino` structured logger + request ID | Searchable logs in production; trace one request across api → worker |
| B3 | `/health` checks Mongo + Redis | Docker/Nginx can restart an unhealthy container (NFR8) |
| B4 | Graceful shutdown (close server, Mongo, Redis on SIGTERM) | Deploys don't cut off in-flight requests or payment webhooks |
| B5 | Remove `bcryptjs` (keep `bcrypt`), drop redundant controller try/catch (Express 5 forwards async errors) | Less code, one hashing lib |
| B6 | Fill `.env.example`; Jest + Supertest + `mongodb-memory-server`; tests in `beyownd-backend/tests/` | Anyone can run the project; tests don't get compiled into `dist/` |

### C. Design (docs only, no code)

| # | What | Why |
| --- | --- | --- |
| C1 | `docs/design/schemas.md` — every model field-by-field + indexes | The data model is the hardest thing to change later (one-way door) |
| C2 | `docs/design/api-routes.md` — every endpoint, auth level, request/response | Frontend and backend can be built in parallel against one contract |

## Done checklist

- [x] A1–A14 implemented
- [x] B1–B6 implemented
- [x] Tests: signup, verify-otp (incl. wrong-OTP lockout), login (incl. unverified, Google-only account), Google linking (incl. unverified-password clear), forgot/reset password, refresh rotation, logout revocation, onboarding + `requireOnboarding`
- [ ] C1, C2 written and approved — ✍️ written ([schemas.md](../design/schemas.md), [api-routes.md](../design/api-routes.md)), **awaiting approval of decisions D1–D9**
- [x] "How it works" section below filled in
- [x] Interview doc filled in (Parts 1–3)

## How it works

### Part 1 — Shared plumbing ✅ (Oct 15)

**Built:** B1, B2, B3, B4, `AppError` class (A2 groundwork), `bcryptjs` removed, `.env.example` filled. Controller try/catch removal and services switching to `AppError` happen in Part 2 together with the auth fixes.

**Middleware order** ([app.ts](../../beyownd-backend/src/app.ts)) — a request passes top to bottom:

```text
trust proxy → requestLogger → helmet → cors → compression → json(100kb) → cookies → routes → 404 → errorHandler
```

Logging goes first so even rejected requests (bad CORS, oversized body) get a request ID and a log line.

| File | What it does | Key detail |
| --- | --- | --- |
| [config/env.ts](../../beyownd-backend/src/config/env.ts) | Loads + validates all env vars | New: `CORS_ORIGINS`, `TRUST_PROXY`, `LOG_LEVEL`, `MONGO_MAX_POOL_SIZE`; numbers are validated |
| [utils/logger.ts](../../beyownd-backend/src/utils/logger.ts) | pino JSON logger (pretty in dev) | Redacts `authorization`, cookies, `password`, `otp`, tokens — secrets never reach logs |
| [middlewares/requestLogger.middleware.ts](../../beyownd-backend/src/middlewares/requestLogger.middleware.ts) | Request ID + one log line per request | Reuses Nginx's `x-request-id` if present, returns it in the response header; skips `/health` noise |
| [utils/AppError.ts](../../beyownd-backend/src/utils/AppError.ts) | Expected errors with status + machine code | `AppError.conflict(...)`, `.unauthorized(...)` etc. |
| [middlewares/errorHandler.middleware.ts](../../beyownd-backend/src/middlewares/errorHandler.middleware.ts) | One place that turns any error into `{ success, message, code }` | Maps Mongoose validation/cast/duplicate-key, JWT, oversized/malformed body. Unknown errors → 500 with a generic message in production |
| [controllers/health.controller.ts](../../beyownd-backend/src/controllers/health.controller.ts) | `/health` (liveness) + `/health/ready` (readiness) | Liveness never touches the DB (restart signal); readiness pings Mongo + Redis with a 1 s timeout (stop-routing signal) |
| [config/db.ts](../../beyownd-backend/src/config/db.ts) | Mongo connect/disconnect | `maxPoolSize` 20 per instance, 5 s server-selection timeout |
| [server.ts](../../beyownd-backend/src/server.ts) | Startup + graceful shutdown | SIGTERM → stop accepting → finish in-flight → close Mongo + Redis → exit; 10 s force-exit; `keepAliveTimeout` 65 s (> Nginx) |

**Verified (smoke test, no DB):**

| Check | Result |
| --- | --- |
| `GET /health` | 200, `x-request-id` set, HSTS + nosniff present, `x-powered-by` absent |
| `GET /health/ready` with Mongo + Redis down | 503 `{ mongo: down, redis: down }` |
| Unknown route | 404 `ROUTE_NOT_FOUND` |
| Malformed JSON | 400 `MALFORMED_JSON` |
| 200 KB body | 413 `PAYLOAD_TOO_LARGE` |
| CORS from `localhost:3000` | allowed, `credentials: true` |
| CORS from `evil.com` | no allow-origin header |
| Startup with Atlas unreachable | fatal log with the reason, process exits (no half-alive server) |
| Startup with real Atlas + Redis (Oct 16) | Redis connected → MongoDB connected → server running; `/health/ready` 200 `{ mongo: up, redis: up }` |
| Wrong-password login | Still 500 `INTERNAL_ERROR` — services throw plain `Error`; fixed in Part 2 (A2) |
| Graceful shutdown | **Not yet verified** — Windows can't deliver SIGTERM to another process. Verify in Phase 6 with `docker stop` on Linux |

Dev-environment note: Atlas access list is per-IP and the dev machine is on a mobile network whose IP changes — re-add the current IP when Mongo fails to connect. Production will only allow the VPS's static IP.

**Scalability notes:** stateless (nothing in process memory), pool sized so 2–4 instances stay under Atlas connection limits, compression for mobile data, body limit protects memory, keep-alive tuned to avoid 502s behind Nginx, readiness lets a load balancer drain a bad instance instead of restart-looping it.

### Part 2 — Auth fixes ✅ (Oct 16)

**Built:** A1–A4, A6–A11 (A5 changed by decision, see below), B5, B6 (tests), plus 5 extra bugs found while fixing.

#### Bugs found while working (not in the original list)

| Bug | Impact | Fix |
| --- | --- | --- |
| All rate limiters shared the default Redis prefix `rl:` | Signup, login and resend-OTP ate from **one** counter per IP — resending an OTP twice used up login attempts | Each limiter has its own prefix (`rl:login-email:`, …) |
| Resend SDK returns `{ error }` instead of throwing; we never checked it | Signup said "OTP sent" even when the email failed | Check `error`, throw `AppError(503, EMAIL_FAILED)` |
| Google `email_verified` never checked | Linking an account to a Google login is only safe if Google verified the email | Reject unless `email_verified === true` |
| `normalizeEmail()` strips Gmail dots | `john.doe@gmail.com` stored as `johndoe@gmail.com`; Google login (with dots) wouldn't match → duplicate accounts | Only `trim` + `toLowerCase` |
| `.escape()` on name | `Anita D'Souza` stored as `Anita D&#x27;Souza` — would print on certificates | Removed; XSS is prevented at output (React escapes), not by corrupting input |

#### Decision change: A5 (`protect`)

Planned: `protect` checks `isVerified` with a Redis cache. **Built instead:** `protect` is pure JWT verification — no DB, no Redis. Access tokens are only ever issued to verified users (verify-otp, login and Google all require it), so the check is guaranteed by construction. Every authenticated request saves a network round trip. Trade-off: a role change or account deletion takes effect at the next refresh (≤ 15 min). Refresh reloads the user from the DB.

#### How each piece works

| Area | Files | How |
| --- | --- | --- |
| OTP | [utils/otp.util.ts](../../beyownd-backend/src/utils/otp.util.ts) | `crypto.randomInt`; stored as SHA-256 hash in a Redis hash `otp:<purpose>:<email>` with `attempts`; `HINCRBY` (atomic) → 6th attempt burns the OTP; `timingSafeEqual`; deleted on success; `SET NX EX 60` cooldown per purpose+email |
| Sessions | [services/session.service.ts](../../beyownd-backend/src/services/session.service.ts) | Refresh JWT carries `sid` + `jti`. Redis `session:<sid>` = `{ userId, jti, prevJti, rotatedAt }`, `user_sessions:<userId>` = set of sids. Refresh → new `jti` (rotation). Old `jti` within 10 s → treated as two tabs refreshing together; after 10 s → reuse = theft → session revoked. Logout deletes the session; password reset deletes all sessions |
| Tokens | [utils/generateTokens.ts](../../beyownd-backend/src/utils/generateTokens.ts) | Separate secrets for access/refresh; JWT expiry, Redis TTL and cookie `maxAge` derived from the same `JWT_REFRESH_EXPIRY` |
| Account rules | [services/auth.service.ts](../../beyownd-backend/src/services/auth.service.ts) | One account per email; rules from [user-flow.md §3](../design/user-flow.md). Takeover fix: Google linking an unverified account clears its password. Dummy bcrypt compare when the email doesn't exist (no timing-based enumeration) |
| Cookie | [controllers/auth.controller.ts](../../beyownd-backend/src/controllers/auth.controller.ts) | `httpOnly`, `secure` in prod, `sameSite: strict`, `path: /api/auth` (only sent to auth routes); cleared on failed refresh |
| Rate limits | [middlewares/rateLimiter.middleware.ts](../../beyownd-backend/src/middlewares/rateLimiter.middleware.ts) | Two layers per route: strict per IP+email, loose per IP (campus Wi-Fi). IPv6 grouped by /56 |
| Validation | [validators/auth.validator.ts](../../beyownd-backend/src/validators/auth.validator.ts) | Name 2–60, Unicode letters + `. ' -`; password 8–64 (bcrypt reads only 72 bytes) |
| Model | [models/user.model.ts](../../beyownd-backend/src/models/user.model.ts) | `authProvider` → `authProviders[]`; migration [001-auth-providers.ts](../../beyownd-backend/scripts/migrations/001-auth-providers.ts) (idempotent, run on dev DB: 1 user migrated, second run 0) |

#### Endpoints

| Route | Limiter | Notes |
| --- | --- | --- |
| `POST /api/auth/signup` | 5/h per IP+email, 100/h per IP | 201; unverified re-signup overwrites; 409 `EMAIL_TAKEN` / `GOOGLE_ACCOUNT` |
| `POST /api/auth/verify-otp` | 15/15m per IP+email, 300/15m per IP | Sets cookie, returns `accessToken` |
| `POST /api/auth/resend-otp` | 5/h per IP+email, 100/h per IP | Generic message; 429 `OTP_COOLDOWN` within 60 s |
| `POST /api/auth/login` | 10/15m per IP+email, 200/15m per IP | 401 `INVALID_CREDENTIALS`, 403 `EMAIL_NOT_VERIFIED`, 400 `USE_GOOGLE_SIGNIN` |
| `POST /api/auth/google` | 300/15m per IP | Create / link |
| `POST /api/auth/refresh` | 300/15m per IP | Rotates; 401 `SESSION_INVALID` / `SESSION_REUSED` |
| `POST /api/auth/logout` | — | Revokes session |
| `POST /api/auth/forgot-password` | same as resend | Generic message |
| `POST /api/auth/reset-password` | same as verify | Revokes all sessions |

#### Tests

[tests/auth.test.ts](../../beyownd-backend/tests/auth.test.ts) — real app + in-memory MongoDB + local Redis (DB 15); only email sending and Google verification are mocked. Run: `npm test` (Redis container must be running).

**Result (Oct 16):** 35 / 35 passing in ~15 s.

| Group | Tests | What they prove |
| --- | --- | --- |
| Signup | 7 | Hashing, OTP sent, 2-char + apostrophe names stored unescaped, Gmail dots kept, unverified re-signup, 409 on verified, 503 on email failure + retry works |
| OTP | 6 | Cookie flags (HttpOnly, Path, SameSite), wrong OTP 400, **burned after 5 wrong attempts even for the right code**, one-time use, 60 s cooldown, no enumeration |
| Login | 3 | 401 (not 500) with identical message for wrong password vs unknown email, 403 unverified, success |
| Sessions | 5 | Rotation, two-tab grace window, **reuse after 10 s kills the whole session**, logout revokes server-side |
| Google | 4 | New account, linking keeps both methods, **takeover fix**, Google-only guidance |
| Reset | 4 | No enumeration, verify-OTP can't reset, reset revokes all sessions, Google user can set a password |
| Rate limits | 2 | 11th attempt on one account blocked while **another student on the same IP still logs in**; separate counters per limiter |
| Middleware | 4 | No token, `TOKEN_EXPIRED`, refresh token rejected as access token, roles |

#### Bugs the tests caught

| Bug | Fix |
| --- | --- |
| Linking Google to an existing **verified** account returned 500: the user is loaded without `password` (`select: false`), so the "local accounts need a password" hook saw `undefined` | Hook only checks when `isSelected('password')` |
| All tests hung: MongoDB driver 7 loads `os` via dynamic `import()`, which Jest's vm sandbox rejects → handshake sent no `driver` metadata → server refused ("Missing required sub-document 'driver'") | Test setup passes `runtimeAdapters: { os }` to the driver. Production unaffected |

Safety: test setup refuses to run unless MongoDB and Redis URIs are local (`127.0.0.1`/`localhost`) — the cleanup step deletes all collections, so it must never touch Atlas. Tests use Redis DB 15, not the dev DB 0.

Dev note: `mongodb-memory-server` downloads an ~800 MB MongoDB zip once (cached in `node_modules/.cache`, zip removed after extract). Expect this on a fresh `npm install`.

### Part 3 — Onboarding ✅ (Oct 16)

**Built:** A12, A13, A14. Flow and field list: [design/user-flow.md](../design/user-flow.md) §4–5.

#### How each piece works

| Area | Files | How |
| --- | --- | --- |
| Options | [constants/profile.ts](../../beyownd-backend/src/constants/profile.ts) | Every dropdown list (degree, year, goal, state, interests…) in one file; model enums and validators both import it, so they can't drift apart |
| Profile storage | [models/user.model.ts](../../beyownd-backend/src/models/user.model.ts) | Embedded `profile` sub-document + `onboardingCompleted` + `onboardedAt`. 1:1 with the user and always read together → `/me` is one indexed read. Index on `profile.collegeId` for admin stats |
| Colleges | [models/college.model.ts](../../beyownd-backend/src/models/college.model.ts), [services/college.service.ts](../../beyownd-backend/src/services/college.service.ts) | Student-built list. Name normalized (lowercase, no punctuation, single spaces) → unique `normalizedName`. Atomic upsert (+ retry on the duplicate-key race). `words[]` multikey index → every query word must prefix-match a word in the name ("eng pune" finds "Government College of Engineering Pune"). Sorted by `studentCount`. Results cached in Redis 5 min; cache failure falls back to DB. Regex characters in queries are escaped |
| Endpoints | [services/user.service.ts](../../beyownd-backend/src/services/user.service.ts), [controllers/user.controller.ts](../../beyownd-backend/src/controllers/user.controller.ts) | `GET /me`; `PUT /me/onboarding` (once → second call 409 `ALREADY_ONBOARDED`); `PATCH /me/profile` (only sent fields change; college change moves the student count; `certificateName` blocked with 403 `CERTIFICATE_NAME_LOCKED` once `certificateNameLockedAt` is set) |
| Validation | [validators/user.validator.ts](../../beyownd-backend/src/validators/user.validator.ts) | One field list builds both the PUT (all required) and PATCH (all optional) rules. Phone normalized to E.164 (`+91…`, must start 6–9). `degreeOther` / `heardFromOther` required when "other" is picked. Interests deduped |
| Mass assignment | controllers | `matchedData()` passes only validated fields to the service — `role`, `isVerified`, `certificateNameLockedAt` in a request body are dropped |
| Guard | [middlewares/requireOnboarding.middleware.ts](../../beyownd-backend/src/middlewares/requireOnboarding.middleware.ts) | 403 `ONBOARDING_REQUIRED`. Reads one boolean from the DB. Only for low-frequency routes (enroll, payment), so not put in the JWT — that would force a token refresh right after onboarding |
| Login response | [services/auth.service.ts](../../beyownd-backend/src/services/auth.service.ts) | `user.onboardingCompleted` in every auth response → frontend redirects to `/onboarding` or `/dashboard` without an extra `/me` call |

#### Response shape

`GET /api/users/me`, `PUT /me/onboarding` and `PATCH /me/profile` all return:

```json
{
  "success": true,
  "user": {
    "id": "…", "name": "Ravi Kumar", "email": "ravi@example.com", "role": "student",
    "isVerified": true, "authProviders": ["local"], "onboardingCompleted": true,
    "profile": {
      "certificateName": "Ravi Kumar", "certificateNameLocked": false,
      "phone": "+919876543210", "collegeId": "…", "collegeName": "Govt. College of Engg, Pune",
      "degree": "btech", "degreeOther": null, "branch": "CSE", "currentYear": "4", "graduationYear": 2027,
      "city": "Pune", "state": "Maharashtra", "goal": "internship_certificate", "certificateNeededBy": "2027-03",
      "interestedTracks": ["web_dev", "backend"], "skillLevel": "basics",
      "heardFrom": "instagram", "heardFromOther": null, "referralCode": "FRIEND-123"
    }
  }
}
```

`GET /api/colleges?q=pune` → `{ success, colleges: [{ id, name, studentCount }] }` (max 10).

The profile response is an explicit field list (`toProfileResponse`), so a field added to the model later is never sent to the client by accident.

#### Tests

[tests/onboarding.test.ts](../../beyownd-backend/tests/onboarding.test.ts) — 20 tests. Full suite: **55 / 55 passing** (~60 s).

| Group | Tests | What they prove |
| --- | --- | --- |
| `/me` | 2 | Auth required; new user shows `onboardingCompleted: false` in both login response and `/me` |
| Onboarding | 6 | Normalized phone (4 formats), deduped interests, uppercased referral; field-level errors; "other" needs text; Indian mobile rule; mass assignment ignored; only once; login reflects completion |
| Colleges | 5 | Different formatting → one college; word-prefix search in any order, popular first; regex characters safe; Redis cache; auth required |
| Profile update | 6 | Onboarding first; partial update; empty/invalid rejected; college change moves counts; "other" text cleared; certificate name lock |
| Guard | 1 | `requireOnboarding` blocks until onboarding is done |

**Scalability notes:** `/me` = one indexed read by `_id`; college search = indexed prefix query + Redis cache (autocomplete fires on every keystroke — frontend should debounce ~300 ms); the guard costs one tiny read and only on rare routes; `protect` still touches nothing.

**Known limits (fine for launch):** students can create junk college names — admin merge tool can come in Phase 5. `studentCount` is updated outside the user save (approximate stat, not money). At much larger scale, Atlas Search would replace regex prefix search.
