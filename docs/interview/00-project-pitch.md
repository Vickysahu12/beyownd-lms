# Project Pitch — "Tell me about your project"

> Update the numbers in brackets with real ones after launch. Never say a number you didn't measure.

## 30-second version

"I built **Beyownd**, a virtual internship platform for tier 3 and 4 college students. Final-year students need an internship certificate for their degree but rarely get access to real internships. On Beyownd they pay ₹599–799, join a cohort, go through a structured track with quizzes, build a project that a mentor reviews, and only then get a certificate that anyone can verify on a public URL. I built the full stack: a Node/TypeScript API, MongoDB, Redis for caching, rate limiting, and queues, a background worker for PDF generation, Razorpay payments, and a Next.js frontend. It launched in [Nov 2026] with [N] students."

## 2-minute version (add these on top)

**The core insight:** the business only works if the credential is trustworthy. So trust is enforced by the system, not by policy: modules unlock in order, quiz answers are graded on the server, a certificate is generated only after mentor approval, every certificate is immutable with a public verify page, and admins can revoke.

**The architecture:** a stateless Express API (2 instances behind Nginx), so scaling is adding containers. Redis holds everything shared: OTPs with TTL, rate limits, cached catalog, refresh-token sessions, and the BullMQ queue. Slow work like PDF generation and emails runs in a separate worker process so a burst of completions never slows down the API. Payments go through Razorpay with webhook signature verification and idempotent processing, so a retried webhook can never enroll someone twice.

**What I'd highlight:** [pick one real story from a phase doc, e.g. finding the OTP brute-force hole, or the campus-shared-IP rate-limit problem].

**Result:** [load-test numbers from Phase 6], [students / paid enrollments / certificates issued].

## Questions this pitch invites (be ready)

- "Why would a college accept your certificate?" → public verification + real project + mentor review + registered business; see `business-model.md` §3.
- "What was the hardest part?" → pick a real one after building; candidates: idempotent payment webhooks, sequential unlock logic, auth hardening.
- "How does it scale?" → see `docs/scalability.md`; give the capacity math, then the load-test result.
- "What would you do differently?" → have one honest answer ready (e.g. "I'd consider Postgres for the relational parts").
