# Phase 3 — Payments & Credentials

**Dates:** Oct 18 – , 2026
**Status:** 🟡 In progress — Part A (payments) ✅ · Part B (credentials) ✅ · Part C (mentor review + completion) next
**Interview doc:** [../interview/phase-3-payments-credentials.md](../interview/phase-3-payments-credentials.md)
**Design followed:** [schemas.md](../design/schemas.md) §5–6 · [api-routes.md](../design/api-routes.md) §6–9 · decisions D2, D5, D7

## Goal

Money in, trustworthy documents out: a student pays with Razorpay and is enrolled exactly once; their offer letter, certificate and completion letter are generated automatically and can be verified by anyone.

| Part | Scope | Status |
| --- | --- | --- |
| A | Checkout, signature verification, webhooks, idempotent activation, seat race, refunds | ✅ Oct 18 |
| B | Credential model, PDF worker (BullMQ), offer letter on payment, verify endpoint, my documents | ✅ Oct 18 |
| C | Mentor review queue + decision, course completion, certificate after batch end | ⏳ |

---

## Part A — Payments

### What was built

| Area | Files | What it does |
| --- | --- | --- |
| Config | [config/env.ts](../../beyownd-backend/src/config/env.ts), [.env.example](../../beyownd-backend/.env.example) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (required) |
| Model | [models/payment.model.ts](../../beyownd-backend/src/models/payment.model.ts) | One document per checkout attempt; price snapshot; unique order + payment IDs; `processedEventIds`; `refundRequired` |
| Razorpay wrapper | [utils/razorpay.util.ts](../../beyownd-backend/src/utils/razorpay.util.ts) | Only file that knows the SDK: create order, checkout signature, webhook signature (HMAC-SHA256, timing-safe) |
| Logic | [services/payment.service.ts](../../beyownd-backend/src/services/payment.service.ts) | Start enrollment, activation transaction, verify, webhook events, refunds, history |
| Routes | [routes/payment.routes.ts](../../beyownd-backend/src/routes/payment.routes.ts), [routes/webhook.routes.ts](../../beyownd-backend/src/routes/webhook.routes.ts), [enrollment.routes.ts](../../beyownd-backend/src/routes/enrollment.routes.ts) | `POST /enrollments`, `POST /payments/verify`, `GET /payments`, `POST /webhooks/razorpay` |
| App wiring | [app.ts](../../beyownd-backend/src/app.ts) | Webhook router mounted **before** `express.json()` with `express.raw()` |

### The flow

```text
1. POST /api/enrollments { cohortId }            (login + onboarding required)
   → checks: batch open, enrollment window, seats (soft), not already enrolled in this program
   → enrollment { status: pending_payment }  (reused on retry; unique per user+batch)
   → Razorpay order (amount = cohort price)  → Payment { status: created, amountPaise snapshot }
   → returns checkout config { keyId, orderId, amountPaise, prefill }

2. Browser opens Razorpay Checkout → student pays (UPI / card / net banking)

3a. Browser → POST /api/payments/verify { orderId, paymentId, signature }
     signature = HMAC(key_secret, "orderId|paymentId")  → must match
3b. Razorpay → POST /api/webhooks/razorpay   (header X-Razorpay-Signature = HMAC(webhook_secret, raw body))
     events: payment.captured → activate · payment.failed → mark failed · refund.processed → refund

   Both 3a and 3b call the same activatePayment()
```

### `activatePayment()` — one MongoDB transaction

```text
(a) Payment: status created|failed → paid          ← conditional update; only the FIRST caller matches
(b) Cohort:  seatsTaken < capacity → seatsTaken+1   ← $expr compare of two fields, atomic
(c) Enrollment: pending_payment → active
Commit all three, or none.
```

| Situation | Result |
| --- | --- |
| Verify arrives, then webhook (or the reverse) | First one activates; second returns `already_processed` |
| Webhook delivered 5 times (or in parallel) | One activation, one seat — the conditional update in (a) matches once; `withTransaction` retries write conflicts |
| Same webhook event ID again | Ignored (`processedEventIds`) |
| Captured amount ≠ our order amount | Rejected, logged as error, never activates |
| Last seat: two students paid | First gets the seat; second → payment `paid` + `refundRequired: true`, enrollment `cancelled` → admin refunds manually (decision D7) |
| Student closed the tab after paying | Webhook activates anyway — it's the source of truth |
| Payment failed, then retried on the same order | `failed` → later `payment.captured` still activates |
| Refund processed | Payment `refunded`, enrollment `refunded`, seat released — once (transaction + conditional update). Credential revocation hooks in with Part B |
| Razorpay API down when creating the order | 502 `PAYMENT_PROVIDER_ERROR`, no payment record left behind |

### Security notes

- The **client never decides** whether a payment succeeded: only a valid HMAC signature (checkout or webhook) can activate.
- A student can only verify **their own** order (`{ razorpayOrderId, userId }` lookup → 404 otherwise).
- The webhook needs the **raw** body: `express.json()` would re-serialize it and the signature would never match, so the webhook route is mounted before the JSON parser with `express.raw()`.
- Unknown orders / unrelated events get **200** (Razorpay would otherwise retry for days); real processing errors get **500** so Razorpay retries.
- `KEY_ID` is public (sent to the browser for checkout); `KEY_SECRET` and the webhook secret never leave the server.

### Setup notes (owner)

- Razorpay **Settings → Payment capture → Automatic** must stay on (the default). Activation relies on the payment being captured.
- Webhook (Phase 6, needs a public URL): Razorpay Dashboard → Webhooks → URL `https://api.beyownd.in/api/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `refund.processed`.

### Tests

[tests/payments.test.ts](../../beyownd-backend/tests/payments.test.ts) — 19 tests. Only the network call that creates an order is mocked; both signature checks run for real. The test MongoDB now starts as a **single-node replica set** (transactions don't work on a standalone server — Atlas is always a replica set).

| Group | What they prove |
| --- | --- |
| Start checkout (6) | Onboarding required; pending enrollment + order + price snapshot (survives a later price change); retry reuses the enrollment; closed / scheduled / full / unknown batches; no double enrollment in a program; Razorpay down → 502 with nothing left behind |
| Verify (3) | Valid signature activates + one seat; forged signature changes nothing; can't verify someone else's order |
| Webhook (9) | Bad signature 400; activates without the browser; verify + repeated webhooks → one seat; **5 parallel deliveries → one seat**; amount mismatch never activates; unknown orders / events → 200; failed then captured; **last-seat race → refund flag**; refund releases the seat once |
| History (1) | Only paid/refunded payments listed |

**Result (Oct 18):** 19 / 19 passing. **Full suite: 114 / 114 passing** (~68 s).

Dev-environment fix found on the way: MongoDB refused to start the test replica set because the system drive (C:) had < 500 MB free; ~400 MB of it was leftover data from earlier interrupted test runs (removed). Test database files now live in `beyownd-backend/.tmp/mongo-tests/` on the project drive (gitignored) and are deleted after every run (verified: 0 leftovers).

---

## Part B — Credentials (documents + verify)

### What was built

| Area | Files | What it does |
| --- | --- | --- |
| Issuer config | [config/issuer.ts](../../beyownd-backend/src/config/issuer.ts) | GrewDo legal details from `.env` (placeholders until real ones arrive), program name, verify URL, optional logo/signature PNGs in `assets/branding/` |
| Model | [models/credential.model.ts](../../beyownd-backend/src/models/credential.model.ts) | Public `credentialId`, type, snapshot (incl. issuer), status, revocation. **Immutable by code**: hooks block any update to snapshot/type/IDs |
| IDs | [utils/credentialId.util.ts](../../beyownd-backend/src/utils/credentialId.util.ts) | `BYD-26-7KQ4-M9XA` — crypto-random, 31-char alphabet without 0/O/1/I/L (~850 billion combinations); input normalized (case, spaces) |
| PDFs | [services/document.service.ts](../../beyownd-backend/src/services/document.service.ts) | pdf-lib templates: offer letter, completion letter (A4 portrait), certificate (A4 landscape). GrewDo letterhead, "Beyownd is a product of GrewDo", QR → verify URL |
| Storage | [utils/storage.util.ts](../../beyownd-backend/src/utils/storage.util.ts) | Local folder in dev; signed 5-minute download URLs (HMAC); key pattern blocks path traversal. One file to swap for R2 |
| Queue | [jobs/queue.ts](../../beyownd-backend/src/jobs/queue.ts) | BullMQ `documents` queue: 5 attempts, exponential backoff, `jobId` = credential (no duplicate jobs) |
| Worker | [jobs/document.processor.ts](../../beyownd-backend/src/jobs/document.processor.ts), [worker.ts](../../beyownd-backend/src/worker.ts) | Separate process (`npm run worker`): render → store → mark issued → email job. Idempotent. Re-queues stuck `generating` documents on startup |
| Logic | [services/credential.service.ts](../../beyownd-backend/src/services/credential.service.ts) | Issue (idempotent, locks certificate name), revoke, my documents, download link, public verify (cached) |
| Wiring | [payment.service.ts](../../beyownd-backend/src/services/payment.service.ts) | Activation → offer letter (after commit; never fails the payment). Refund → all documents of the enrollment revoked |
| Routes | [routes/credential.routes.ts](../../beyownd-backend/src/routes/credential.routes.ts) | `GET /credentials`, `GET /credentials/:id/download`, `GET /verify/:id` (public), `GET /files/:folder/:file` (signed) |

### Flow

```text
payment activated ──► issueCredential(enrollment, 'offer_letter')
                        snapshot { name, college, course, batch dates, issuer=GrewDo }
                        status: generating · certificate name locked · job queued
                                   │
                    worker (separate process, BullMQ)
                        render PDF (pdf-lib) → store → status: issued → email job
                                   │
student: GET /credentials/:id/download → 5-min signed link → PDF
anyone:  GET /verify/BYD-26-XXXX-XXXX  → name, college, course, dates, issuer, status
refund ──► all documents of the enrollment: revoked (verify shows "revoked")
```

### Guarantees

| Guarantee | How |
| --- | --- |
| One document per enrollment per type | Unique `{ enrollmentId, type }`; `issueCredential` returns the existing one; 3 parallel calls tested |
| Documents never change after issue | Mongoose hooks reject updates/saves touching snapshot, type or IDs (tested); issuer stored in the snapshot, so a future issuer change doesn't rewrite history |
| A revoked document never comes back | Worker only moves `generating → issued`; revoked is final (tested) |
| Payment never fails because of a PDF | Offer letter is issued after the transaction commits, inside try/catch; worker retries with backoff; startup recovery re-queues stuck ones |
| Shared links die | Download URLs are HMAC-signed and expire in 5 minutes (tampered / expired → 403, tested) |
| Privacy | Verify returns only name, college, course, dates, issuer and status — never email, phone or internal IDs (tested) |
| PDF can't crash on unusual text | Certificate name must be English letters (fonts are Latin-only; colleges want English names); every other string goes through `pdfSafe()` (tested with Devanagari) |

### Bugs found while building

| Bug | Fix |
| --- | --- |
| Jest never exited after tests: BullMQ doesn't close a Redis connection you pass in when the queue closes | Keep a reference and `quit()` it in `closeQueues()`; same for the worker's connection; API shutdown now closes the queue too |
| A very long college name would overflow the certificate border | Centered certificate lines shrink their font until they fit (min 8 pt) |
| `dotenv` v17 prints a banner on every start (looked like an error in test output) | `dotenv.config({ quiet: true })` |

### Running it locally

```bash
docker start beyownd-redis
npm run dev       # terminal 1 - API
npm run worker    # terminal 2 - PDF + email worker
```

Documents are written to `beyownd-backend/.tmp/documents/` (gitignored). Put `logo.png` and `signature.png` in `beyownd-backend/assets/branding/` and set the `ISSUER_*` values in `.env` when the real GrewDo details are ready.

### Tests

[tests/credentials.test.ts](../../beyownd-backend/tests/credentials.test.ts) — 15 tests (4 pure + 4 issuing + 3 download + 3 verify + 1 refund). **Full suite: 129 / 129 passing**, Jest exits cleanly, no leftover test data.

Worker process smoke test: starts, connects to Redis; MongoDB Atlas refused because the dev machine's mobile IP changed (fail-fast worked as designed — add the new IP in Atlas → Network Access).
