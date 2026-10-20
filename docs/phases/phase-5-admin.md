# Phase 5 — Admin APIs (B6) + Course Import (B7)

**Dates:** Oct 20, 2026
**Status:** ✅ Backend done. Admin UI is frontend task F14.
**Interview doc:** [../interview/phase-5-admin.md](../interview/phase-5-admin.md)
**Content guide (for the owner):** [../content/COURSE_FORMAT.md](../content/COURSE_FORMAT.md)

## Goal

Run the business without touching the database: create and publish courses, open batches, find students, handle refunds and certificates, make mentors, and see the numbers — plus load a whole course from files with one command.

## What was built

| Area | Files | What it does |
| --- | --- | --- |
| Content editor | [services/admin/content.service.ts](../../beyownd-backend/src/services/admin/content.service.ts) | Courses (create, edit, publish/archive), modules, lessons, quizzes — create, edit, delete, reorder |
| Operations | [services/admin/operations.service.ts](../../beyownd-backend/src/services/admin/operations.service.ts) | Batches, student search + detail, refund, revoke, reissue documents, roles |
| Stats | [services/admin/stats.service.ts](../../beyownd-backend/src/services/admin/stats.service.ts) | Overview (students, revenue, alerts), per-course funnel, colleges — all MongoDB aggregations |
| Import | [services/admin/courseImport.service.ts](../../beyownd-backend/src/services/admin/courseImport.service.ts), [scripts/content/import-course.ts](../../beyownd-backend/scripts/content/import-course.ts) | `course.json` + Markdown files → database, validated first, one transaction |
| First admin | [scripts/admin/make-admin.ts](../../beyownd-backend/scripts/admin/make-admin.ts) | `npm run make-admin -- you@example.com` |
| Audit helper | [utils/audit.util.ts](../../beyownd-backend/src/utils/audit.util.ts) | One-line audit entries, optionally inside a transaction |
| Routes | [routes/admin.routes.ts](../../beyownd-backend/src/routes/admin.routes.ts) | `/api/admin/*` — **admin only** (mentors use `/api/review`) |
| Example course | [docs/content/example-course/](../content/example-course/) | Valid, tested example to copy |

## Rules that protect students and the business

| Rule | Why |
| --- | --- |
| **Publish only a complete course** (≥ 1 module, every module ≥ 1 lesson) → `COURSE_INCOMPLETE` | No empty modules on the live site |
| **Every content change clears that course's Redis cache** (catalog, outline, lessons, quizzes; old slug too) | Students never see stale content |
| **Modules can't be deleted once students are enrolled** → `COURSE_HAS_STUDENTS` | Deleting a module mid-batch would change the unlock sequence. Lessons can still be fixed or removed (audit-logged) |
| **Reorder in a transaction, two phases** (temporary negative orders, then 1..N) | `{ courseId, order }` is unique — a direct swap would collide halfway |
| **Quiz saved with `document.save()`** | Question-level checks (answer index in range, single = one answer) only run on save, not on update queries |
| **Capacity can't go below seats taken** → `CAPACITY_BELOW_SEATS` | Would oversell |
| **Price, publish, delete, refund, revoke, reissue, role changes → audit log** | Who did what, when, before/after |
| **Role change ends that user's sessions**; you can't change your own role | Roles live in the JWT; stops an admin locking themselves out |
| **Refund uses the same path as the Razorpay refund webhook** | One transaction: payment + enrollment + seat, then documents revoked — no second implementation to drift |
| **Student search escapes regex characters** | `?q=.*` is text, not a pattern |
| **Only validated fields reach services, with `undefined` removed** | A `PATCH { status }` can't wipe the project brief (bug found by tests, see below) |

## Course import (B7)

```text
npm run import:course -- <folder>/course.json --dry-run     check only
npm run import:course -- <folder>/course.json               import (draft)
npm run import:course -- <folder>/course.json --publish     import + publish
```

1. Read `course.json`, load Markdown files (paths can't leave the folder).
2. **Validate everything** with the real Mongoose models — errors name the exact place: `module 2 ("JavaScript Essentials"), quiz: Correct option index out of range…`.
3. Compute what would be removed; **refuse removals if students are enrolled**.
4. Write it all in **one transaction**: upsert course by slug, modules and lessons by position, quizzes per module; delete what's no longer in the file.
5. Clear the course's cache.

Idempotent: running it again updates instead of duplicating. Verified against the real Atlas database with `--dry-run` (nothing written).

## Bugs the tests found

| Bug | Impact | Fix |
| --- | --- | --- |
| Model validation hooks (`Lesson`, `Cohort`, `Quiz`, `User`) used `throw new Error` | A video lesson without a YouTube ID returned **500**, looking like a server crash | `this.invalidate(path, message)` → Mongoose `ValidationError` → **400** with a clear message. (Audit-log and credential-immutability guards still throw — those mean a bug in our code) |
| Saving a user loaded with only some fields crashed the "local accounts need a password" hook (`authProviders` undefined) | Changing a role → **500** | Hook uses `authProviders?.`; role change loads the full user |
| `matchedData()` returned the nested `project.*` fields as `undefined` on a `PATCH` that only changed `status` | Publishing a course **wiped its project brief** (validation then rejected it) | Controller strips `undefined` and empty objects before the service |
| ESLint: `String(req.query.courseId)` | `?courseId[x]=1` would become `"[object Object]"` | Use the validated value |

## Tests

[tests/admin.test.ts](../../beyownd-backend/tests/admin.test.ts) — 19 tests. **Full suite: 161 / 161 passing**, lint + typecheck clean.

| Group | What they prove |
| --- | --- |
| Access (1) | Students and mentors 403, admins 200 |
| Content (6) | Draft create, slug conflict, input validation; publish refused until complete, then visible publicly (cache refreshed); lesson edit updates the public preview immediately; video needs an ID; reorder modules/lessons; quiz rejected with a bad answer index, accepted when valid, `hasQuiz` in the outline; module delete blocked while students enrolled |
| Batches (2) | Code uppercased, duplicates rejected, price change audited with before/after; capacity can't go below seats |
| Operations (4) | Student search (incl. regex chars) and detail; refund (seat freed, documents revoked, audited, second refund refused); reissue + revoke (verify updates instantly); role change ends sessions, can't change own role |
| Stats (1) | Overview, funnel per module, colleges |
| Import (5) | Example course valid and dry run writes nothing; import → draft → idempotent → publish; removals blocked while students enrolled; exact error locations + path traversal blocked + nothing half-written; works from any folder |

## First-time setup (owner)

```bash
# 1. Sign up on the site with your email (and verify the OTP), then:
cd beyownd-backend
npm run make-admin -- you@example.com
# 2. Log in again - you're admin. Make mentors from the admin panel (or API):
#    PATCH /api/admin/users/:id/role { "role": "mentor" }
# 3. Load the course:
npm run import:course -- ../docs/content/<your-course>/course.json --dry-run
npm run import:course -- ../docs/content/<your-course>/course.json --publish
# 4. Create the first batch: POST /api/admin/cohorts
```
