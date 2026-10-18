# Interview — Phase 3: Payments & Credentials

**Status:** 🟡 Part A (payments) built and tested (19 tests, 114 total). Credentials (Part B) and mentor review (Part C) not built yet — don't claim them.

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
