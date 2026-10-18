# Phase 3 — Payments & Credentials

**Dates:** Oct 18 – , 2026
**Status:** 🟡 In progress — Part A (payments) ✅ done; Part B (credentials) and Part C (mentor review) next
**Interview doc:** [../interview/phase-3-payments-credentials.md](../interview/phase-3-payments-credentials.md)
**Design followed:** [schemas.md](../design/schemas.md) §5–6 · [api-routes.md](../design/api-routes.md) §6–9 · decisions D2, D5, D7

## Goal

Money in, trustworthy documents out: a student pays with Razorpay and is enrolled exactly once; their offer letter, certificate and completion letter are generated automatically and can be verified by anyone.

| Part | Scope | Status |
| --- | --- | --- |
| A | Checkout, signature verification, webhooks, idempotent activation, seat race, refunds | ✅ Oct 18 |
| B | Credential model, PDF worker (BullMQ), offer letter on payment, verify endpoint, my documents | ⏳ |
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
