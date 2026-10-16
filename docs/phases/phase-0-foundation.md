# Phase 0 — Foundation & Hardening

**Dates:** Oct 15 – 16, 2026
**Status:** 🟡 In progress — Part 1 (shared plumbing) done
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

- [ ] A1–A14 implemented
- [ ] B1–B6 implemented
- [ ] Tests: signup, verify-otp (incl. wrong-OTP lockout), login (incl. unverified, Google-only account), Google linking (incl. unverified-password clear), forgot/reset password, refresh rotation, logout revocation, onboarding + `requireOnboarding`
- [ ] C1, C2 written and approved
- [ ] "How it works" section below filled in
- [ ] Interview doc filled in

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
