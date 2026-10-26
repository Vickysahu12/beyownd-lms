## The brief

You get a small Express + MongoDB blog API. Under a load test, the `GET /posts/:id` route falls over at a few hundred requests per second. Make it survive viral traffic, and prove it with numbers.

## What to build

1. **Cache-aside** for `GET /posts/:id` with ioredis, a TTL with jitter, and cache invalidation when a post is updated (update the database first, then delete the key).
2. **Stampede protection**: when a hot key expires, only one request rebuilds it (a lock with `SET NX PX`, or single-flight).
3. **Penetration protection**: requests for posts that don't exist must not reach the database every time.
4. **Rate limiting** that holds across two running instances of the API (use `rate-limit-redis` or `rate-limiter-flexible`).
5. **A leaderboard**: `POST /posts/:id/like` updates a sorted set; `GET /leaderboard` returns the top 10 posts with titles, without 10 separate database queries.

## What to submit

- GitHub repository link
- A README with:
  - how to run it (`docker compose up` is ideal)
  - a before/after table from a load test (k6 or autocannon): requests per second, p95 latency, error rate
  - one paragraph on what you would change for 10× more traffic

## How it's reviewed

Each rubric line is scored out of 10. You need 60% overall to pass. Reviewers run your README steps, so make sure they work on a fresh machine.
