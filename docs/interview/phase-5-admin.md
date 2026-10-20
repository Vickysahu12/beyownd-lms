# Interview — Phase 5: Admin APIs and Course Import

**Status:** ✅ Built and tested (19 tests, 161 total). The admin UI is frontend work — don't claim it until it exists.

## One-line summary

An admin API to run the business — content, batches, students, refunds, certificates, roles and stats — where every action that touches money or trust is audited, plus a validated, transactional importer that loads a whole course from Markdown files.

## Stories to tell

**1. Tests found that "validation" errors were 500s.** "Several Mongoose hooks validated with `throw new Error(...)`. The global handler, correctly, treats an unknown error as a server bug — so a video lesson without a YouTube ID came back as a 500. I switched them to `this.invalidate()`, which produces a proper ValidationError and a 400 with a clear message. The integrity guards — audit log immutability, credential immutability — still throw, because if those fire it *is* a bug."

**2. A PATCH that silently destroyed data.** "Publishing a course is `PATCH { status: 'published' }`. The validator has rules for nested `project.*` fields, and `matchedData()` returned them as `undefined`. Setting that on the document replaced the project brief with an empty object. Validation rejected it, so nothing was lost — but only because the schema was strict. Now the controller strips `undefined` and empty objects before anything reaches the service."

**3. Reordering under a unique index.** "Module order is unique per course. Swapping 1 and 2 directly hits a duplicate-key error halfway. I move every item to a temporary negative order, then to its final 1..N, both inside one transaction."

**4. Content as files, not forms.** "Writing 25 lessons in an admin form is painful. The course lives in a folder — `course.json` plus Markdown — and one command imports it. Everything is validated with the real models first, errors point at the exact module and lesson, file paths can't escape the folder, and the write is a single transaction, so a bad file never leaves half a course. It's idempotent, so you fix a typo and run it again. If the file has fewer lessons than the live course and students are enrolled, it refuses — content can't disappear mid-batch."

**5. One refund path, not two.** "Refunds can arrive from the Razorpay webhook or from an admin button. Both call the same transactional function, so there's no second implementation to drift."

## Decisions & trade-offs

- **Admin-only routes, mentors separate.** Mentors can review projects (`/api/review`) but can't touch content, money or roles — least privilege.
- **Role changes revoke sessions.** The role is inside the access token; ending sessions forces a fresh login. The trade-off: an old access token stays valid up to 15 minutes, which is acceptable here.
- **Aggregations for stats.** Counting happens in MongoDB, not by loading documents into Node.
- **Audit log is append-only at the model level** — updates throw, so even buggy code can't rewrite history.

## Likely questions

**Q: How do you stop an admin from breaking a live course?** Publishing requires a complete course; modules can't be deleted once students are enrolled; the importer refuses removals mid-batch; every destructive action is audited.

**Q: How does the first admin get created?** A CLI script (`make-admin`) on the server, because the role-changing API itself requires an admin — the classic bootstrap problem.

**Q: Why not a CMS?** A headless CMS adds another service to run and pay for. Our content model (modules → lessons → quizzes → unlock rules) is specific, and Markdown in Git gives versioning and review for free.
