# Phase 1 — Learning Core

**Dates:** Oct 16 – 17, 2026
**Status:** ✅ Done (backend). `POST /enrollments` (create + pay) comes with payments in Phase 3.
**Interview doc:** [../interview/phase-1-learning-core.md](../interview/phase-1-learning-core.md)
**Design followed:** [schemas.md](../design/schemas.md) §3–4 · [api-routes.md](../design/api-routes.md) §5–6

## Goal

A student who is enrolled in a batch can open their course, read lessons in order, and unlock the next module by finishing the current one — and anyone can browse the catalog and read free-preview lessons without logging in.

## What was built

| Area | Files | What it does |
| --- | --- | --- |
| Models | [course](../../beyownd-backend/src/models/course.model.ts), [module](../../beyownd-backend/src/models/module.model.ts), [lesson](../../beyownd-backend/src/models/lesson.model.ts), [cohort](../../beyownd-backend/src/models/cohort.model.ts), [enrollment](../../beyownd-backend/src/models/enrollment.model.ts) | Exactly as designed. Draft `course.modules[]` / `module.lessons[]` arrays removed — children point to parents only |
| Roles | [user.model.ts](../../beyownd-backend/src/models/user.model.ts) | `mentor` role added (D6) |
| Cache helper | [utils/cache.ts](../../beyownd-backend/src/utils/cache.ts) | `getOrSet(key, ttl, loader)` read-through cache; Redis failure falls back to DB; `null` never cached; all keys in one `cacheKeys` object |
| Catalog | [services/catalog.service.ts](../../beyownd-backend/src/services/catalog.service.ts) | Course list, detail + outline, open batches, free-preview lessons — all Redis-cached; `invalidateCourseCache()` for the admin panel |
| Learning | [services/enrollment.service.ts](../../beyownd-backend/src/services/enrollment.service.ts) | My enrollments, dashboard, lesson access rules, mark complete, module completion |
| Routes | [catalog.routes.ts](../../beyownd-backend/src/routes/catalog.routes.ts), [enrollment.routes.ts](../../beyownd-backend/src/routes/enrollment.routes.ts) | `/api/courses/*` (public, rate-limited), `/api/enrollments/*` (login) |
| Rate limit | [rateLimiter.middleware.ts](../../beyownd-backend/src/middlewares/rateLimiter.middleware.ts) | `publicLimiter` — 1,000/min per IP (a lab sharing one IP can browse freely; stops scrapers) |
| Seed | [scripts/seed/dev-course.ts](../../beyownd-backend/scripts/seed/dev-course.ts) | Idempotent sample course (3 modules, 7 lessons, 1 started batch); `--enroll <email>` creates an active enrollment |

## How it works

### Access rules for a lesson (checked on the server, every request)

```text
GET /api/enrollments/:id/lessons/:lessonId
  1. Enrollment loaded by { _id, userId }        → not yours / bad ID → 404 NOT_FOUND
  2. Lesson belongs to this enrollment's course  → else 404
  3. Enrollment status active | completed        → else 403 ENROLLMENT_NOT_ACTIVE
  4. Batch started (or module is free preview)   → else 403 COHORT_NOT_STARTED   (D10)
  5. Module unlocked                             → else 403 MODULE_LOCKED
```

The same rules guard `POST .../complete`, so a locked lesson can't be "completed" by calling the API directly.

### Unlock rule — computed, never stored

`computeModuleStates(outline, enrollment)` walks the modules in order: module 1 is unlocked; each next module is unlocked only if the previous one is complete. A module is complete when every lesson is in `completedLessonIds` and (if it has a quiz — Phase 2) the quiz is passed. Because it's computed from the progress data on each request, there's no stored "current module" that could disagree with reality.

### Marking a lesson complete (safe under parallel requests)

1. `updateOne({ _id, 'progress.moduleId': { $ne: m } }, { $push: newEntry })` — creates the module's progress entry only if it doesn't exist. Two parallel requests can't both create it: a single-document update is atomic and the second no longer matches.
2. `$addToSet` the lesson ID — marking twice changes nothing.
3. If the module just became complete, set `completedAt` with an `arrayFilters` update that only matches when it isn't set yet.

Response: `{ lessonId, moduleCompleted, nextModuleUnlocked: { id, title } | null, percentComplete }` — enough for the frontend to show "Module 2 unlocked 🎉" without another request.

### What hits the database vs Redis

| Request | MongoDB | Redis |
| --- | --- | --- |
| `GET /courses`, `/courses/:slug`, `/cohorts` | only on cache miss (TTL 10 min / 1 min for seats) | ✅ |
| Lesson content | only on cache miss (TTL 30 min) | ✅ |
| Course outline (modules + lesson titles) | only on cache miss | ✅ |
| Enrollment (student's own progress) | always — 1 read by `_id` + `userId` | ❌ never cached |
| Cohort (dates for D10) | 1 read by `_id` | ❌ |

A lesson open for an enrolled student = 2 small indexed reads; everything else from Redis. The outline is built with 2 queries for the whole course (no N+1), and "my enrollments" loads all courses and cohorts with one `$in` query each.

## Tests

[tests/learning.test.ts](../../beyownd-backend/tests/learning.test.ts) — 20 tests · [tests/seed.test.ts](../../beyownd-backend/tests/seed.test.ts) — 2 tests. **Full suite: 77 / 77 passing.**

| Group | What they prove |
| --- | --- |
| Catalog (7) | Only published courses; cheapest open batch price; default price fallback; ordered outline without lesson content or project rubric; 404 for drafts and bad slugs; only open/unclosed batches with correct seats and `enrollable`; free preview only for preview modules and only for this course's lessons; Redis cache serves stale until invalidated, then fresh |
| Ownership (5) | Login required; my list with progress; someone else's enrollment → 404; module 1 open, rest locked; community link hidden from unpaid enrollments |
| Lessons (8) | Prev/next navigation; locked module blocks read **and** complete; finishing module 1 unlocks module 2; marking twice is harmless; **3 parallel completions → one progress entry**; unpaid → `ENROLLMENT_NOT_ACTIVE`; batch not started → `COHORT_NOT_STARTED` but free preview open; another course's lesson → 404 |
| Seed (2) | Running twice creates no duplicates; enrolls a real user; refuses unknown emails |

Dev-experience fix: tests now check Redis first and stop with *"Redis is not running. Start it with: docker start beyownd-redis"* instead of hundreds of retry errors.

## How to try it locally

```bash
docker start beyownd-redis
cd beyownd-backend
npm run seed:dev -- --enroll <your-signup-email>
npm run dev
```

Then: `GET /api/courses` → `GET /api/courses/full-stack-web-dev` → log in → `GET /api/enrollments` → open a lesson → `POST .../complete`.

## Known limits / next

- Module `hasQuiz` is always `false` until Phase 2 fills it from the quizzes collection — modules complete on lessons alone until then.
- Creating enrollments (with payment) is Phase 3; until then use the seed script's `--enroll`.
- Content editing is Phase 5 (admin). It must call `invalidateCourseCache()` after every edit.
