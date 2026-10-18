# Interview — Phase 2: Quizzes & Final Project

**Status:** ✅ Built and tested (18 tests for this phase, 95 total). Mentor review and certificates are Phase 3 — don't claim them yet.

## One-line summary

Every module ends in a server-graded quiz that gates the next module, and the course ends in a GitHub project submission with a one-pending-at-a-time guarantee — so a certificate always represents real work.

## Why this exists (the business reason)

The product is a certificate that colleges trust. Without quizzes, "Mark complete" × 30 would earn a certificate. Without a reviewed project, there's nothing to show a recruiter. This phase is the "proof of work" link in the chain.

## Stories to tell

**1. The answer-leak problem.** "We allow unlimited quiz attempts so students can learn. But if I show the correct answers after a failed attempt, the quiz is worthless: fail once on purpose, copy the answers, pass. So a failed attempt only shows which questions were wrong; correct answers and explanations appear only after you pass. Learning still happens, but there's no shortcut."

**2. Unlimited attempts without brute force.** "Unlimited attempts also invites trying every combination. A 60-second cooldown per module makes that impractical. I implemented it as a Redis `SET NX EX` — atomic, so if a student double-clicks submit, exactly one attempt is graded and the others get a 429 with `retryAfterSeconds` and a standard `Retry-After` header. There's a test that fires three submits at once and checks there's exactly one stored attempt."

**3. The client never decides the score.** "The client sends only which options were selected. Grading happens on the server against answers that are never sent to the browser — the response is built by explicitly removing them. Unknown question IDs are dropped and unanswered questions count as wrong. Multiple-choice needs the exact set, so 'select all' gets zero."

**4. A pass can't be lost.** "Best score uses MongoDB's `$max` operator, so a later bad attempt can't lower it, and `quizPassed` is only ever set to true. Otherwise a student could pass, unlock the next module, retake out of curiosity, and lock themselves out."

**5. One pending project at a time — as an atomic gate.** "Instead of 'check if there's a pending submission, then insert' — which races — I flip the enrollment's `projectStatus` to `pending_review` with a conditional update that only matches from `not_submitted` or `changes_requested`. Only one concurrent request can win. If the insert after it fails, I reopen the gate so the student is never stuck. A unique index on `(enrollmentId, version)` backs it up."

**6. Refactoring before duplicating.** "Both 'complete a lesson' and 'pass a quiz' can finish a module and unlock the next one. Rather than copy that logic, I extracted `settleModuleCompletion` into the enrollment service and made both use it — one place decides 'did this module just complete', so the two paths can never disagree."

## Decisions & trade-offs

- **Questions shuffled, options not.** Answers reference option positions; shuffling options would need a per-attempt mapping stored server-side. Question order shuffling already stops "copy the answer key by position".
- **Quiz content cached with answers in Redis.** Redis is internal-only; responses are built from an explicit field list without answers. Caching avoids a DB read on every quiz open.
- **Attempts in their own collection, summary in the enrollment.** Attempts grow without limit and are listed rarely; the dashboard only needs `quizPassed` and the best score, which live on the enrollment.
- **GitHub-only repo links.** Mentors review in one place, and it blocks arbitrary or phishing links. The regex anchors the host, so `github.com.evil.com` is rejected (tested).
- **Reviewer identity hidden from students.** They see feedback and rubric scores, not which mentor reviewed — avoids pressure on individual mentors.

## Likely questions + answers

**Q: Couldn't a student just read the answers from the network tab?**
A: The answers never reach the browser before a pass. The GET response is built without them, and there's a test asserting no correct indexes or explanation text appear anywhere in the response body.

**Q: What stops someone scripting attempts?**
A: The per-module 60-second cooldown in Redis. Five questions with a few options each is hundreds of combinations; at one attempt per minute that's hours of obvious, logged activity, and the attempts are stored for review.

**Q: Why is the score a percentage of points rather than a count?**
A: Questions carry points (1–10), so harder questions can weigh more. The pass threshold is per quiz.

**Q: What happens if the admin edits a quiz after students attempted it?**
A: Past attempts keep their stored score. Progress (`quizPassed`) isn't revoked. The admin edit invalidates the quiz cache and the outline so new attempts use the new questions.

## At 100× scale I would…

Use question pools with random selection per attempt, randomize options with a server-side per-attempt mapping, add plagiarism checks on project repos (commit history, similarity), and auto-run project test suites before a mentor sees them.
