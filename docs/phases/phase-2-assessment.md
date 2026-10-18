# Phase 2 — Assessment (Quizzes + Final Project)

**Dates:** Oct 18, 2026
**Status:** ✅ Done (backend). Mentor review comes in Phase 3.
**Interview doc:** [../interview/phase-2-assessment.md](../interview/phase-2-assessment.md)
**Design followed:** [schemas.md](../design/schemas.md) §3.4, §4.3, §4.4 · [api-routes.md](../design/api-routes.md) §6 · decision D3

## Goal

Proof of work exists in the database: a student can't finish a module by tapping "Mark complete" alone — they must pass its quiz — and can't get a certificate without a final project that a mentor reviews (review itself is Phase 3).

## What was built

| Area | Files | What it does |
| --- | --- | --- |
| Models | [quiz](../../beyownd-backend/src/models/quiz.model.ts), [quizAttempt](../../beyownd-backend/src/models/quizAttempt.model.ts), [projectSubmission](../../beyownd-backend/src/models/projectSubmission.model.ts) | As designed. Quiz validates itself: correct indexes in range, exactly one for single-choice, 3–30 questions |
| Quiz | [services/quiz.service.ts](../../beyownd-backend/src/services/quiz.service.ts) | Get quiz (shuffled, no answers), grade on the server, cooldown, attempts list |
| Project | [services/project.service.ts](../../beyownd-backend/src/services/project.service.ts) | Brief + rubric + history; submit with an atomic "one pending at a time" gate |
| Shared helpers | [services/enrollment.service.ts](../../beyownd-backend/src/services/enrollment.service.ts) | Refactored: `resolveModule`, `ensureProgressEntry`, `settleModuleCompletion` now shared by lessons and quizzes — one implementation of "did this module just complete?" |
| Outline | [services/catalog.service.ts](../../beyownd-backend/src/services/catalog.service.ts) | `hasQuiz` now filled from the quizzes collection (one extra query per course, cached) |
| Errors | [utils/AppError.ts](../../beyownd-backend/src/utils/AppError.ts), [errorHandler](../../beyownd-backend/src/middlewares/errorHandler.middleware.ts) | Errors can carry `details` (e.g. `retryAfterSeconds`); handler also sets the standard `Retry-After` header |
| Validation | [validators/learning.validator.ts](../../beyownd-backend/src/validators/learning.validator.ts) | Answer shape; GitHub-only repo URL; https-only live URL |
| Seed | [scripts/seed/dev-course.ts](../../beyownd-backend/scripts/seed/dev-course.ts) | Quizzes for modules 1 and 2 (single + multiple choice) |

## How it works

### Module completion now

```text
complete(module) = all lessons done  AND  (module has no quiz  OR  quiz passed)
```

The next module unlocks the moment this becomes true — whether the last step was a lesson or the quiz — through the same `settleModuleCompletion` helper.

### Quiz flow

```text
GET  .../quiz            → access rules (Phase 1) → all lessons done? (LESSONS_INCOMPLETE)
                         → questions in random order, NO correct answers / explanations
POST .../quiz/attempts   → same checks → claim 60 s cooldown (Redis SET NX EX)
                         → grade on the server → save attempt
                         → enrollment: $max best score, quizPassed = true if passed
                         → module complete? → unlock next
```

| Rule | Implementation | Why |
| --- | --- | --- |
| Pass at 60% (configurable per quiz) | `scorePercent >= passPercent` | D3 |
| Unlimited attempts, best score counts | `$max` on `bestQuizScorePercent`; `quizPassed` only ever set to `true` | A later bad attempt never undoes a pass |
| 60 s between attempts | `SET quiz_cooldown:<enrollment>:<module> NX EX 60` | Makes trying every combination impractical; the atomic `NX` also means parallel submits can't create duplicate attempt numbers |
| Multiple-choice = exact set | sorted, de-duplicated comparison | No credit for "select everything" |
| Score from the server only | client sends selected options; fake question IDs ignored; missing answers = wrong | Client can't claim a score |
| **Answer-leak rule** | fail → `{ questionId, correct }` only; pass → also `correctOptionIndexes` + `explanation` | With unlimited attempts, revealing answers on a fail turns the quiz into "fail once, copy, pass" |

Quiz content (with answers) is cached server-side in Redis (`cache:quiz:<moduleId>`); answers are stripped before any response.

### Project flow

```text
GET  .../project              → brief, rubric, unlocked (all modules complete), canSubmit, history
POST .../project/submissions  → active? → all modules complete? (MODULES_INCOMPLETE)
                              → GATE: updateOne({ projectStatus ∈ [not_submitted, changes_requested] },
                                                { projectStatus: 'pending_review' })
                                 matched → create submission (version = last + 1)
                                 not matched → 409 SUBMISSION_PENDING / PROJECT_ALREADY_APPROVED
                              → if the insert fails, the gate is reopened (never stuck "pending")
```

Mentor review (approve / request changes) is Phase 3; it moves `projectStatus` to `approved` or `changes_requested`. `changes_requested` reopens the gate, and the next submission becomes version 2. The student sees review feedback and rubric scores but not who reviewed.

## Tests

[tests/assessment.test.ts](../../beyownd-backend/tests/assessment.test.ts) — 18 tests (2 pure grading + 10 quiz + 6 project). Seed test updated for quizzes.

| Group | What they prove |
| --- | --- |
| Grading | Multiple-choice needs the exact set; points weighting; duplicates ignored; missing / fake answers = wrong |
| Quiz | Lessons alone don't complete a quiz module; quiz locked until lessons done; questions never include answers or explanations; failed attempt reveals only right/wrong; cooldown returns 429 + `retryAfterSeconds` + `Retry-After`; pass completes module + unlocks next + reveals answers; best score / pass never lost; **3 parallel submits → 1 graded, 2 × 429, 1 attempt stored**; malformed answers 400 |
| Project | Locked until all modules done; second submit while pending → 409; GitHub-only + https rules (incl. `github.com.evil.com`); changes requested → version 2; approved → 409; **3 parallel submits → exactly 1 created**; review feedback visible without reviewer ID |

**Result (Oct 18):** 18 / 18 passing. **Full suite: 95 / 95 passing** (~85 s) — Phase 0 and Phase 1 tests still green after the enrollment-service refactor.

Dev-experience fix: the test teardown no longer hangs when Redis was never reachable.

## Known limits / next

- Mentor review queue + decision → Phase 3 (together with certificates, since approval triggers certificate scheduling).
- Changing a quiz must call `invalidateCourseCache(course, [], [moduleId])` (admin, Phase 5) — clears both the quiz and the outline's `hasQuiz`.
- Questions are shuffled, options are not (answers reference option positions).
