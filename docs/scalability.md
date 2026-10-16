# Beyownd — Scalability Plan (first 1,000 users)

Goal: **1,000 registered students, ~300–500 active at the same time at peak** (result day, cohort start, deadline night) — handled with p95 latency < 300 ms and zero lost payments. Architecture must grow to 10k by adding containers, not rewriting.

---

## 1. Capacity math

| Assumption | Value |
| --- | --- |
| Registered students | 1,000 |
| Peak concurrent (worst case) | 500 |
| Requests per active user | 1 every 5 s |
| **Peak load** | **~100 req/s** |
| Load-test target (with 3× headroom) | **300 req/s** |

One Node.js process handles a few hundred light req/s. We run **2 API instances** behind Nginx → headroom + no single point of failure on the app tier. The real risks at this size are not CPU — they are **slow queries, N+1 queries, oversized responses, and the database connection limit**. The rules below target exactly those.

## 2. Design rules (apply to every module)

**Stateless API**
- No in-memory state in the Node process. Sessions, rate limits, cache, queues → Redis. So scaling = `replicas: 2 → 4`.

**Database**
- Every query path has an index (designed in Phase 0, checked with `.explain()`).
- `.lean()` + field projections on reads; never return whole documents "just in case".
- Paginate every list endpoint (cursor or `limit` ≤ 50).
- No N+1: fetch related data in one query (`$in`) or one aggregation.
- Connection pool sized per instance (`maxPoolSize`), total stays under the Atlas tier's connection limit.
- Launch on a **paid Atlas tier** — the free tier has hard connection/throughput caps (check current limits before choosing).

**Caching (Redis)**
- Track catalog, track structure (modules/lessons list) → cached, TTL + invalidated on admin edit.
- Lesson content is read-heavy and rarely changes → cache-friendly.
- Per-user progress is **not** cached long — correctness > speed there.

**Slow work goes to the queue (BullMQ worker, separate process)**
- PDF generation, emails, any 3rd-party call that isn't needed for the response.
- Retries with backoff; jobs are idempotent (re-running never creates a second certificate).

**Payments are correctness-critical**
- Webhook signature verified, processing idempotent (unique `razorpayPaymentId` index), so retries/duplicates are safe.

**Network (our users are on budget phones + mobile data)**
- gzip/brotli compression, small JSON payloads, server-rendered public pages, images optimized, videos are YouTube embeds (adaptive bitrate for free), PDFs served from R2/CDN, never through the API.

**Rate limiting that doesn't punish campuses**
- Many students share one college Wi-Fi IP. Auth limits are keyed on **IP + email**, with a looser per-IP ceiling. `trust proxy` set so we see the real client IP behind Nginx.

## 3. Deployment shape at launch

```
Browser ──► Vercel (Next.js frontend)
        └─► Nginx (VPS, HTTPS) ──► api ×2 (Docker) ──► MongoDB Atlas
                                    │                 └► Redis (Docker, AOF on)
                                    └► worker ×1 ──► Cloudflare R2 (PDFs), Resend (email)
Razorpay ──webhook──► Nginx ──► api
```

## 4. How we prove it (Phase 6 load test)

Tool: **k6**. Scenarios:
1. Browse catalog + open lessons (read-heavy) — 300 req/s for 5 min
2. Login burst — 200 logins in 1 min (rate limiter must not block legit users)
3. Quiz submission burst — 200 concurrent submits
4. Webhook replay — same payment webhook ×5 → exactly one enrollment

Pass criteria: p95 < 300 ms on reads, < 800 ms on writes, error rate < 0.5%, zero duplicate enrollments/certificates. Results get recorded in `docs/phases/phase-6-production.md` — **real numbers are what you quote in interviews**.

## 5. What changes at 10k+ (not now — just know the path)

More API replicas; managed Redis; Atlas tier up + read preference for analytics; CDN in front of API GET endpoints; separate worker queues per job type; move leaderboard snapshots to a cron.
