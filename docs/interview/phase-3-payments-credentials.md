# Interview — Phase 3: Payments & Credentials

**Status:** ✅ Parts A (payments, 19 tests), B (credentials, 15 tests) and C (review + completion, 13 tests) built and tested — 142 total.

## One-line summary (Part A)

Razorpay checkout where enrollment activation is idempotent and transactional: a payment, a seat and an enrollment change together or not at all, no matter how many times or in what order the browser callback and webhooks arrive.

## How it works (whiteboard)

```text
POST /enrollments → pending enrollment + Razorpay order + Payment(created, price snapshot)
        │
   Razorpay Checkout (UPI)
        │
  ┌─────┴──────────────┐
browser verify      Razorpay webhook (source of truth)
HMAC(order|payment)  HMAC(raw body)
  └─────┬──────────────┘
   activatePayment()  ── transaction ──
     payment created→paid   (conditional: first caller only)
     seat: seatsTaken < capacity → +1
     enrollment pending→active
```

## Stories to tell

**1. Exactly-once activation without a distributed lock.** "The browser callback and Razorpay's webhook can arrive in any order, and webhooks are retried. Instead of locking, the first step is a conditional update: mark the payment paid *only if* it's still `created` or `failed`. Exactly one caller can match that. Everyone else gets 'already processed'. I test it by firing five webhook deliveries in parallel and asserting one seat was taken."

**2. Why a transaction.** "Marking paid, taking a seat and activating the enrollment must be all-or-nothing. If the server crashed between 'paid' and 'active', the student would have paid and see nothing. MongoDB transactions need a replica set — Atlas always is one, and I switched the test database to a single-node replica set so tests exercise real transactions."

**3. The last-seat race.** "Two students start checkout while one seat is left; both pay. The seat claim is a conditional increment — `seatsTaken < capacity` compared with `$expr` — so only one wins. The other payment stays 'paid' with a `refundRequired` flag and their enrollment is cancelled. Automating refunds wasn't worth it for how rare this is at launch; the admin refunds manually."

**4. Webhooks need the raw body.** "Razorpay signs the exact bytes it sends. If `express.json()` parses the body first, re-serializing it never reproduces the same bytes, so every webhook fails verification. The webhook router is mounted before the JSON parser with `express.raw()`."

**5. Never trust the client — or even the amount.** "Only a valid HMAC can activate. Signatures are compared with `timingSafeEqual`. A student can only verify their own order. And the webhook's captured amount must equal our stored price snapshot; if it doesn't, the payment is logged as an error and never activates."

**6. Choosing what to return to a webhook.** "Unknown orders and unrelated events get 200 — otherwise Razorpay retries for days for something we'll never process. Genuine processing errors get a 500 so Razorpay retries them."

## Decisions & trade-offs

- **Webhook as source of truth, browser verify for UX.** Verify gives instant feedback; the webhook covers closed tabs and flaky mobile networks.
- **Price snapshot on the payment.** Admin price changes never rewrite history or the amount check.
- **Seats counted on payment, not on checkout start.** Abandoned checkouts don't hold seats. The trade-off is the rare paid-but-full case, handled by the refund flag.
- **One Payment per checkout attempt.** Simple audit trail; abandoned attempts are just `created` records and are hidden from the student's history.

## Likely questions + answers

**Q: What if the webhook never arrives?**
A: The browser verify path activates it on the spot. If both fail (tab closed and webhook outage), Razorpay retries webhooks for up to a day; an admin can also check the payment in the Razorpay dashboard.

**Q: How do you test payments without charging money?**
A: Razorpay test keys in dev. In automated tests, only the "create order" network call is mocked; I compute real HMAC signatures with test secrets and post webhooks exactly as Razorpay does — raw JSON plus the signature header.

**Q: Can a user activate an enrollment by replaying someone else's payment signature?**
A: The verify lookup is by order ID *and* the logged-in user, and the signature binds the order to the payment. Replaying it for another order fails the HMAC; replaying it for the same order is idempotent.

## Part B — Credentials (built and tested: 15 tests)

**One line:** every offer letter, certificate and completion letter is an immutable, publicly verifiable record with a random ID and QR code, generated as a PDF by a background worker.

**Story — why a queue and a separate worker.** "Generating a PDF takes a second or two of CPU. Doing it inside the payment request would make students wait, and a burst of payments would slow the whole API. The API just records the credential and drops a job in a BullMQ queue; a separate worker process renders the PDF, stores it and emails the student. Jobs retry with exponential backoff, the job ID is the credential ID so it's never queued twice, and on startup the worker re-queues anything stuck in 'generating' — for example if Redis was down when the job was added."

**Story — immutability enforced in code.** "A certificate that can be quietly edited isn't worth anything. Each credential stores a snapshot — name, college, course, batch dates and the issuing company — at issue time, and Mongoose hooks reject any update that touches those fields. Only status, the PDF key and revocation fields can change. Because the issuer is in the snapshot, if the product later moves to a new legal entity, old certificates still truthfully say who issued them."

**Story — the verify page.** "A college can type or scan the ID and see the name, program, dates, issuer and status — never email or phone. A revoked certificate still verifies, but shows 'revoked' with the date, so it can't be passed off as genuine. Results are cached in Redis and invalidated the moment a status changes."

**Story — a library limitation turned into a product rule.** "pdf-lib's built-in fonts only cover Latin characters, so a Devanagari name would crash rendering. Colleges want English names on certificates anyway, so the certificate-name field accepts English letters only, and every other string passes through a sanitizer, so no input can crash a PDF. Embedding a Unicode font is the upgrade path."

**Story — a test that wouldn't exit.** "All tests passed but Jest hung. BullMQ doesn't close a Redis connection you hand it, because it assumes it's shared. I keep a reference and quit it explicitly — in tests, on API shutdown and in the worker."

**Decisions & trade-offs**
- **pdf-lib over Puppeteer:** no headless Chrome on a small VPS (memory, disk, cold starts); the cost is layout in code instead of HTML/CSS.
- **Signed, expiring download URLs** instead of public file links — a shared link dies in 5 minutes. With Cloudflare R2 this becomes a presigned URL; only the storage module changes.
- **Readable random IDs** (`BYD-26-7KQ4-M9XA`): 8 random characters from a 31-character alphabet with no 0/O/1/I/L — unguessable and easy to type from paper.
- **Offer letter after the transaction**, never inside it — a PDF problem must never undo a payment.

**Likely questions**
- *What if the worker is down?* Payments and enrollment still work; documents wait in the queue (or in 'generating') and are processed when the worker comes back.
- *Can someone enumerate certificates?* ~850 billion possible IDs per year prefix, the verify endpoint is rate-limited, and it returns no contact details.
- *How do you revoke?* Refunds revoke automatically; an admin revoke endpoint comes with the admin panel. Revocation invalidates the verify cache immediately.

## Part C — Mentor review and completion (built and tested: 13 tests)

**One line:** mentors score projects against a rubric in a single transaction with an audit trail; approval completes the course, and certificates are issued only after the batch's real end date — through a delayed job with an hourly safety net.

**Story — the certificate can't come early.** "The internship dates on the certificate are real, so even a student who finishes in week 3 gets the certificate after the batch ends. On approval I schedule a delayed BullMQ job for the end date. Delayed jobs live in Redis, but I don't trust a single mechanism for something students pay for, so a sweep runs at worker startup and every hour: completed, batch ended, documents missing → issue. And the issuing function re-checks the end date itself, so even a job that fires early refuses. Issuance is idempotent, so all three paths together still produce exactly one certificate."

**Story — two mentors, one submission.** "The decision is a conditional update — only from `pending` — inside a transaction with the enrollment status and the audit entry. Two mentors clicking approve at the same moment: one gets 200, the other 409. Tested."

**Story — the server computes the score.** "The mentor sends a score per rubric criterion; the server validates each one against the rubric's maximum, rejects missing or unknown criteria, computes the percentage, and refuses an approval below the pass mark — the certificate has to mean the project met the bar."

**Q: Why an audit log?** Review decisions, revocations and refunds affect money and trust. If a student or a college questions a decision, the log answers who did it and when. It's append-only — the model rejects updates.

**Q: Why email through the queue?** The decision must never fail because an email provider is slow; the job retries with backoff.
