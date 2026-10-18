# Interview — Phase 1: Learning Core

**Status:** ✅ Built and tested (22 tests for this phase, 77 total). Payments and quizzes are not built yet — don't claim them.

## One-line summary

A course is ordered modules of lessons, sold in batches with real dates; enrolled students unlock modules strictly in order, with every access rule enforced on the server, and the public catalog served almost entirely from Redis.

## How it works (whiteboard version)

```text
Course ──< Module (order) ──< Lesson (order)
   └──< Cohort (real dates, seats, price)
             └──< Enrollment { userId, status, progress[ per module ] }

GET lesson:  own enrollment? → paid? → batch started? → module unlocked? → content (Redis)
unlocked(N) = N == 1  OR  complete(N-1)
complete(M) = all lessons done AND (no quiz OR quiz passed)
```

## Stories to tell

**1. "The lock icon is not security."** "On the frontend a locked module just shows a lock. The real check is on the server for every lesson read *and* every 'mark complete' call — I have tests that try to read and complete a locked lesson directly through the API and get 403. Otherwise anyone could skip to the last module with a REST client."

**2. Computed state instead of stored state.** "My first draft stored a `currentModuleOrder` on the enrollment. I dropped it: it's derived data, and derived data stored separately eventually disagrees with the source — say, after an admin adds a lesson. Unlock state is computed from the progress array on each request. It's a loop over ~10 modules, so it costs nothing."

**3. Race conditions in 'mark complete'.** "A student double-tapping 'Complete', or three tabs, could create two progress entries for the same module. I made each step atomic: the entry is pushed with a filter that only matches when it doesn't exist yet, the lesson is added with `$addToSet`, and `completedAt` is set with an `arrayFilters` condition so only the first completion writes it. There's a test that fires three completions in parallel and checks there's exactly one entry with three lessons."

**4. 404 vs 403 for someone else's data.** "If you put another student's enrollment ID in the URL you get 404, not 403. A 403 would confirm the ID exists. The query is always `{ _id, userId }`, so ownership is part of the lookup itself — there's no separate check to forget."

**5. Real dates are a product requirement.** "Certificates state real internship dates, so paid content opens on the batch start date, and the certificate only issues after the end date. Free-preview modules stay open so students can judge quality before and after paying."

## Decisions & trade-offs

- **Reference vs embed.** Lessons are separate documents (large content, read one at a time); progress is embedded in the enrollment (bounded — about 10 entries — and always read with it). Children point to parents; parents don't keep child arrays, so there's a single source of truth for the relationship.
- **Denormalized `courseId` on lessons.** Redundant with the module, but it lets the whole outline load in one query instead of one per module.
- **Read-through cache with explicit invalidation.** Catalog, outline and lesson content are read constantly and edited rarely: cached with a TTL, deleted on admin edit. Redis failure falls back to MongoDB — cache is for speed, never correctness. Student progress is never cached because it must always be exact.
- **Seats as a counter, not a count.** `seatsTaken` is incremented atomically with a `$lt: capacity` condition (Phase 3) instead of counting enrollments, which would be both slow and racy.
- **Money in paise.** Integers, never floats.

## Likely questions + answers

**Q: How many database queries does opening a lesson take?**
A: Two small indexed reads — the student's enrollment and the batch. The lesson content and the course outline come from Redis.

**Q: How does the catalog stay fast under load?**
A: The course list and detail pages are cached in Redis with a TTL; after the first request MongoDB isn't touched until the TTL expires or an admin edits the course. Seat counts use a 1-minute TTL because they change. A public rate limit of 1,000 requests a minute per IP stops scrapers but lets a whole college lab on one IP browse.

**Q: What if an admin adds a lesson to a module a student already completed?**
A: The module keeps its `completedAt`, so the student isn't suddenly locked out of later modules. The new lesson shows as not done, and the percentage updates.

**Q: Why not use MongoDB transactions here?**
A: Each step is a single-document atomic update, which MongoDB guarantees without a transaction, and every step is idempotent. Transactions come in Phase 3, where a payment, a seat and an enrollment must change together.

**Q: How do you test this?**
A: Integration tests against the real app, an in-memory MongoDB and Redis, with fixture builders that create a course, batch and student in one call. They cover the access rules, the unlock sequence, idempotency, parallel requests, and cache invalidation.

## At 100× scale I would…

Put a CDN in front of the public catalog endpoints, pre-warm the cache when a course is published, move lesson content to object storage with signed URLs, and add a `progress` summary field (lessons done per module) maintained on write if the dashboard ever became a hotspot.
