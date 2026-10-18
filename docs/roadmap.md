# Beyownd — Roadmap to Launch (Diwali 2026)

**Launch target:** before Diwali (Nov 8, 2026). Go-live **Nov 6**, Nov 7 is buffer.
**Today's starting point (Oct 14):** auth module built (needs hardening), Course/Module models started, no frontend.

The work is split into **phases**. Each phase has: a goal, a fixed scope, a "done" checklist, and two docs:

- `docs/phases/phase-N-*.md` — **build doc**: what we built, why, how it works (written as we go)
- `docs/interview/phase-N-*.md` — **interview doc**: how to explain it, trade-offs, likely questions + answers

A phase is **done** only when its checklist is green *and* both docs are written. No skipping ahead.

---

## Priority shift because of the business model

Revenue now comes from the paid internship program ([business-model.md](business-model.md)). So the critical path is:

**Sign up → pay → get offer letter → learn + quizzes → submit project → mentor approves → certificate + completion letter → public verify.**

Anything not on that path (leaderboard, streaks, Judge0, comments) is **not a launch blocker**.

---

## Phase overview

| Phase | Name | Dates | Output |
| --- | --- | --- | --- |
| 0 ✅ | Foundation & hardening | Oct 15 – 16 | Auth bugs fixed, error/logging/security base, all schemas + API routes designed |
| 1 ✅ | Learning core (backend) | Oct 16 – 17 | Tracks, cohorts, modules, lessons, enrollment, sequential unlock, caching |
| 2 | Assessment (backend) | Oct 20 – 22 | Quizzes, auto-grading, progress, project submission |
| 3 | Payments & credentials (backend) | Oct 22 – 27 | Razorpay, offer letter, mentor review, certificate + letter PDFs (BullMQ), verify API |
| 4 | Frontend (Next.js) | Oct 18 – Nov 1 (parallel) | Landing, auth, dashboard, course player, quiz, payment, verify page |
| 5 | Admin panel | Oct 28 – Nov 1 | Content CRUD, review queue, students, revoke |
| 6 | Production readiness | Nov 1 – 4 | Docker, deploy, Sentry, backups, load test (1000 users), security pass |
| 7 | Beta & launch | Nov 4 – 7 | Real content loaded, 10–20 student beta, fixes, go-live Nov 6 |
| 8 | Post-launch | after Diwali | Leaderboard, streaks, Judge0, comments, emails, portfolio |

---

## Phase 0 — Foundation & hardening (Oct 15 – 16)

**Goal:** a base that won't crack under real users or real money.

- Fix auth bugs (OTP brute force, error status codes, name validation, CORS/cookies, refresh rotation + logout revocation, `isVerified` in `protect`, signup edge cases)
- `AppError` + consistent API response shape
- Security + performance middleware: `helmet`, `compression`, body size limit, `trust proxy`, rate-limit key = IP + email
- Structured logging (`pino`), graceful shutdown, `/health` that checks Mongo + Redis
- `.env.example` filled, test setup (Jest + Supertest), move tests to `tests/`
- **Design (no code):** every Mongoose schema field-by-field + indexes, full API route list

**Done when:** auth has passing tests for the happy path + the attack cases; schema + routes doc approved by you.

## Phase 1 — Learning core (Oct 17 – 20)

**Goal:** a student can enroll in a track and move through it in order.

- Models: `Track` (course), `Cohort` (batch with start/end dates), `Module`, `Lesson`, `Enrollment`
- Sequential unlock logic in `enrollment.service`
- Public catalog endpoints cached in Redis (TTL + invalidate on admin edit)
- Pagination + `.lean()` + projections on every list endpoint

**Done when:** an enrolled student can only open unlocked modules (tested), catalog served from cache.

## Phase 2 — Assessment (Oct 20 – 22)

**Goal:** proof of work exists in the database.

- `Quiz` (per module) + `Submission` with server-side grading (answers never sent to client)
- Module completion = lessons read + quiz passed → unlocks next module
- `ProjectSubmission` (GitHub link + live link + notes), status `pending / approved / changes_requested`

**Done when:** a student can complete a whole track except final approval.

## Phase 3 — Payments & credentials (Oct 22 – 27)

**Goal:** money in, trustworthy documents out.

- Razorpay order → checkout → **webhook signature verification** → enrollment activated (idempotent)
- BullMQ worker (separate process): generate offer letter PDF on payment; certificate + completion letter PDF on approval
- PDFs stored in Cloudflare R2; unique `credentialId` + QR code
- `Credential` model: immutable, revocable
- Public `GET /verify/:credentialId`
- Emails via queue (offer letter, certificate issued)

**Done when:** full paid flow works end to end in Razorpay test mode, duplicate webhooks don't double-enroll.

## Phase 4 — Frontend (Oct 18 – Nov 1, parallel)

**Goal:** fast on a ₹8k Android phone on 4G.

- Next.js App Router + Tailwind, mobile-first
- Pages: landing + pricing, signup/login (Google first), dashboard, track page, lesson player, quiz, project submit, payment, my documents, public verify page, policy pages
- Access token in memory, silent refresh via httpOnly cookie
- Performance budget: small JS bundle, server-rendered public pages, lazy-load YouTube embeds

## Phase 5 — Admin panel (Oct 28 – Nov 1)

- Create/edit tracks, cohorts, modules, lessons, quizzes (draft/publish)
- Project review queue with rubric → approve / request changes
- Students list + search, payment status, revoke credential
- Basic stats: enrollments, paid, completion funnel

## Phase 6 — Production readiness (Nov 1 – 4)

- Dockerfiles + root `docker-compose.yml` (api, worker, redis, nginx)
- Deploy: frontend on Vercel, API + worker + Redis on a VPS, MongoDB Atlas (paid tier)
- HTTPS, Sentry, uptime monitor, Atlas backups
- **Load test with k6** — target in [scalability.md](scalability.md)
- Security pass: OWASP top 10 checklist, webhook verification, rate limits, secrets

## Phase 7 — Beta & launch (Nov 4 – 7)

- Load real content for launch tracks
- 10–20 students from the community run the full flow (with Razorpay test → live switch)
- Fix what breaks, then go live **Nov 6**

## Phase 8 — Post-launch (after Diwali)

Leaderboard (Redis sorted set), streaks & badges, Judge0 code execution, lesson comments, reminder emails, public portfolio page, search.

---

## Cut line if we fall behind

Cut in this order (last = never cut):
1. Admin stats (use Atlas UI temporarily)
2. Lesson read-tracking (complete module by quiz only)
3. Email notifications (documents still downloadable from dashboard)
4. Admin content editor (seed content via script)
5. ~~Payments, credentials, verify page, auth~~ — never cut, these *are* the business
