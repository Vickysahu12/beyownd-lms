# Beyownd — Day 1 Build Log

## What we built today

**1. TypeScript setup** — switched backend from plain JS to TypeScript. Fixed a chain of config mismatches: `tsconfig.json` was generated with modern ESM-style defaults (`nodenext`, `verbatimModuleSyntax`) incompatible with `ts-node-dev`; moved to `commonjs` + TS `5.6.3` (latest v7 wasn't yet compatible with ts-node); removed `"type": "module"` from `package.json` which was conflicting with the CommonJS setup.

**2. `models/User.ts`** — Mongoose schema with `authProvider` (`local` | `google`), optional `password` (required only for local signups, enforced via a `pre('validate')` hook), `isVerified` flag, and a `comparePassword` instance method. Password hashing happens automatically in a `pre('save')` hook — plaintext passwords can never reach the database from anywhere in the codebase.

**3. Foundation files** — `config/env.ts` (centralized, validated env vars), `config/db.ts` (Mongo connection with fail-fast on error), `app.ts` (Express app, health check, error handler), `server.ts` (entry point — connects DB, then starts listening). First successful boot: `MongoDB connected` + `Server running on port 5000`, confirmed via `/health`.

**4. Access + Refresh token strategy** — short-lived access token (15 min, sent per-request) + long-lived refresh token (7 days, stored in an httpOnly cookie). Built `utils/generateTokens.ts` with `generateAccessToken`, `generateRefreshToken`, `verifyRefreshToken`.

**5. Validation layer** — switched from Zod to `express-validator` per preference. `validators/auth.validator.ts` covers signup (name length, email format, password complexity — uppercase/lowercase/number/special char), login, OTP verify, and resend-OTP. Generic `validate` middleware turns failed validation into a consistent 400 response before it ever reaches a controller.

**6. Email OTP verification** — decided against plain email/password-only signup; added OTP verification using **Resend** for email delivery and **Redis** (via `ioredis`) for OTP storage with automatic 10-minute TTL expiry — no manual cleanup job needed. `utils/otp.util.ts` (generate/store/verify) + `utils/email.util.ts` (Resend wrapper).

**7. Google OAuth login** — `utils/googleAuth.util.ts` verifies the Google ID token sent from the frontend using `google-auth-library`, rather than running a full OAuth flow server-side. Google-signup users are marked `isVerified: true` immediately (Google already proved the email).

**8. Full auth module wired end to end:**

- `services/auth.service.ts` — signup, verify-OTP-and-activate, resend-OTP, login, Google login, refresh-access-token
- `controllers/auth.controller.ts` — thin request/response layer, sets refresh token as httpOnly cookie
- `routes/auth.routes.ts` — `/signup`, `/verify-otp`, `/resend-otp`, `/login`, `/google`, `/refresh`, `/logout`
- `middlewares/auth.middleware.ts` — `protect` (JWT verification for protected routes) and `restrictTo` (role-based access, for admin-only routes later)

## Key decisions made today

- **TypeScript over plain JS** for the backend
- **express-validator** over Zod for request validation
- **Resend** over other email providers for OTP delivery
- **Redis TTL** for OTP storage instead of a Mongo collection + manual cleanup cron
- **Cookie-based refresh tokens** (httpOnly) rather than storing them in frontend storage, to reduce XSS exposure

## Bugs fixed today (worth remembering)

- `tsconfig.json` had modern/experimental defaults (`nodenext`, `verbatimModuleSyntax`, even a stray `jsx` setting) that don't suit a Node backend — rebuilt it for CommonJS + Node types
- Mongoose `pre()` hook typing errors (`SaveOptions`, `Record<string, any>` overload mismatches) — resolved by dropping the manual `next` typing entirely and using Mongoose's newer callback-free async hook style
- `jsonwebtoken`'s `expiresIn` option needs a properly-typed string, not a generic `string` — fixed with a `SignOptions['expiresIn']` cast on values coming from `env.ts`

## Not done yet / next up

- Frontend (Next.js) — not started, Google login can't be fully tested end-to-end until the frontend sends a real Google ID token
- Rate limiting on auth endpoints (brute-force protection) — planned, not yet built
- Docker/docker-compose for the backend services — not yet written
- Course/Module/Enrollment models and their own service-controller-route chain — next major module after auth is fully tested