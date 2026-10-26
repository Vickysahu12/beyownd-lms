## Redis data structures

*Redis isn't just key → string. Pick the right shape for the job*

Caching only needed strings. But a Redis value can be a richer structure, and each one comes with its own commands that run **inside Redis, atomically, with a known cost**. That's why the same Redis can also run rate limiters, presence tracking and leaderboards, which the rest of these notes cover.

| Type | Think of it as | Use it for | Key commands | Cost |
| --- | --- | --- | --- | --- |
| String | One value or a counter | Cached JSON, view counts, OTPs, locks, fixed-window limits | `SET` `GET` `INCR` | O(1) |
| Hash | A flat JS object | User profile, per-socket info, post stats | `HSET` `HGET` `HGETALL` `HINCRBY` | O(1) per field |
| List | An array you push and pop at both ends | Recent activity, latest N comments, simple queues | `LPUSH` `LRANGE` `LTRIM` | O(1) push/pop |
| Set | A bag of unique strings | Who liked a post, online users, tags | `SADD` `SISMEMBER` `SCARD` | O(1) add/check |
| Sorted set | Unique members, each with a score, always sorted | Leaderboards, sliding-window limits, trending | `ZADD` `ZINCRBY` `ZRANGE` `ZREVRANK` | O(log N) |

### Playground

This is a small Redis running in your browser, preloaded with sample keys. Pick a type, click a command chip (or type your own), and watch the keyspace on the right change. Every command also shows the matching **ioredis** call and what it returns in JavaScript.

<!-- TODO widget: Redis playground -->

:::callout{type="tip"}
**ioredis return types to remember:** integer replies (`INCR`, `SADD`, `ZREVRANK`) come back as JS numbers. `HGETALL` comes back as a plain object. But scores from `ZSCORE` and `ZINCRBY` come back as **strings**, so wrap them in `Number()`. Try `GET user:42` to see the `WRONGTYPE` error you get when you use the wrong command for a key's type.
:::

### More types worth knowing

| Type | One-line idea | Typical use |
| --- | --- | --- |
| `Pub/Sub` | `PUBLISH` a message and every `SUBSCRIBE`d connection receives it instantly. Fire-and-forget: nothing is stored. | Socket.IO across servers (Section 14), cache-invalidation broadcasts |
| `Streams` | An append-only log with consumer groups and acknowledgements | Event pipelines and job queues that must not lose messages |
| `HyperLogLog` | Approximate unique counts using about 12 KB, however many items | Unique visitors per day |
| `Bitmaps` | One bit per user ID | Daily active flags, streaks |
| `Geo` | Members with latitude/longitude, searchable by radius | "Restaurants within 3 km" |

:::quiz
You need to check "has user:7 already liked post 42?" instantly, with no duplicate likes. Which structure fits?

- [x] Set: `SADD` to like, `SISMEMBER` to check
- [ ] List: `LPUSH` to like, `LRANGE` to check

> Sets reject duplicates on their own and check membership in O(1). A list would allow duplicate likes and needs a scan to check.
:::

:::quiz
Which structure keeps members ordered by a number and can tell you a member's rank in O(log N)?

- [ ] Hash
- [x] Sorted set

> Under the hood it's a skip list plus a hash table, so updates and rank queries are both fast. Section 15 builds a leaderboard on it.
:::

## Rate limiting Express APIs

*One shared counter for every server, so the limit actually holds*

The app survived the viral post. Now someone writes a script that hits `POST /auth/login` 500 times a second trying passwords, or scrapes `/posts/:id` for every ID. We need a rule like **"at most N requests per time window per IP (or per user)"**, and anything over the limit gets `429 Too Many Requests`.

### The first version everyone writes

```text title="middleware/naiveLimit.js · don't ship this"
const hits = new Map(); // ip -> { count, resetAt }

export function naiveLimit(req, res, next) {
  const now = Date.now();
  const entry = hits.get(req.ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count++;
  hits.set(req.ip, entry);
  if (entry.count > 5) return res.status(429).send("Too many requests");
  next();
}
```

It works on your laptop, then production runs three copies of your server behind a load balancer.

<!-- TODO widget: story diagram "Why an in-memory counter breaks with more than one server" (animated in the original note) -->
:::steps
1. **The rule: 5 requests per minute per IP** — Each server runs the naive middleware, so each one counts in its own memory.
2. **The load balancer spreads traffic** — Round-robin sends request 1 to A, 2 to B, 3 to C, 4 to A… Each server only sees a third of this IP's requests.
3. **The limit silently triples** — After 15 requests, every server has counted only 5, so all 15 were allowed. With 10 servers the attacker gets 50. Every deploy or restart also resets the counters to zero.
4. **Fix: one counter in Redis** — Every server runs `INCR rl:203.0.113.7` on the same key. Redis runs commands one at a time, so concurrent increments never get lost.
5. **The limit holds everywhere** — The 6th request gets `6` back from `INCR`, whichever server it lands on, so the answer is `429`. The key's TTL resets the window.
:::

### Try it: in-memory vs Redis counter

Limit: **5 requests per 10 seconds**. Hit *Spam ×12* in each mode and compare how many get through.

<!-- TODO widget: simulator -->

### Fixed window with `INCR` + `EXPIRE`

:::steps
1. **`INCR rl:login:`** — Creates the key at 1 if it doesn't exist and returns the new count.
2. **`EXPIRE key 60 NX`** — Starts the 60 s window, but only if the key has no TTL yet (first request). Needs Redis 7+.
3. **count > limit → 429, else next()** — When the key expires, the next request starts a fresh window at 1.
:::

```js title="middleware/rateLimit.js"
import { redis } from "../lib/redis.js";

export function rateLimit({ limit = 100, windowSec = 60, prefix = "rl" } = {}) {
  return async (req, res, next) => {
    const key = `${prefix}:${req.ip}`;
    try {
      const [[, count], , [, ttl]] = await redis
        .multi()
        .incr(key)                        // +1 for this request
        .expire(key, windowSec, "NX")     // start the window only on the first hit
        .ttl(key)
        .exec();                          // → [[null, 3], [null, 0], [null, 42]]

      res.set("RateLimit-Limit", String(limit));
      res.set("RateLimit-Remaining", String(Math.max(0, limit - count)));

      if (count > limit) {
        res.set("Retry-After", String(ttl));
        return res.status(429).json({ message: "Too many requests. Slow down." });
      }
      next();
    } catch (err) {
      next(); // Redis down: fail open here. For /login you may prefer to fail closed.
    }
  };
}

// usage
app.post("/auth/login", rateLimit({ limit: 5, windowSec: 60, prefix: "rl:login" }), login);
app.use("/api", rateLimit({ limit: 300, windowSec: 60, prefix: "rl:api" }));
```

:::callout{type="warning"}
**Why `MULTI`?** If you send `INCR` and `EXPIRE` as two separate calls and the server crashes (or the connection drops) between them, the key exists with **no TTL**. That counter never resets and the user is blocked forever. `MULTI … EXEC` sends them as one transaction that runs together. On Redis older than 7 (no `NX` flag on `EXPIRE`), use a small Lua script instead.
:::

:::callout{type="warning"}
**Behind Nginx, an AWS ALB or a Kubernetes ingress, `req.ip` is the proxy's IP** unless you set `app.set("trust proxy", 1)`. Without it, every user shares a single counter and you'll block everyone at once.
:::

### The weakness of fixed windows, and the sliding window

<!-- TODO widget: story diagram "The boundary burst" (animated in the original note) -->
:::steps
1. **Fixed window** — The limit is 100 per minute. The counter belongs to a clock window (0:00–1:00, 1:00–2:00) and resets when a new one starts.
2. **A burst just before the boundary** — A client sends 100 requests at 0:59. All allowed, count = 100. One second later the window ends and the count goes back to 0.
3. **…and another just after** — 100 more at 1:01, a fresh window, so all are allowed. That's 200 requests in about 2 seconds under a "100 per minute" rule.
4. **Sliding window** — Instead of clock windows, count the requests in the **last 60 seconds from now**. At 1:01 that window holds 200 requests, so the second burst is blocked. A sorted set does this neatly.
:::

A **sliding window log** stores each request's timestamp as a sorted-set member, with the timestamp as its score. Each request removes entries older than the window, adds itself, and counts what's left.

```js title="lib/slidingWindow.js"
import { randomUUID } from "node:crypto";
import { redis } from "./redis.js";

export async function slidingWindow(key, limit, windowMs) {
  const now = Date.now();
  const results = await redis
    .multi()
    .zremrangebyscore(key, 0, now - windowMs)   // 1. drop requests older than the window
    .zadd(key, now, `${now}:${randomUUID()}`)    // 2. record this request (unique member)
    .zcard(key)                                  // 3. how many are inside the window?
    .pexpire(key, windowMs)                      // 4. idle keys clean themselves up
    .exec();

  const count = results[2][1];
  return { allowed: count <= limit, count };
}

// usage: strict limit for OTP requests
const { allowed } = await slidingWindow(`rl:otp:${phone}`, 3, 10 * 60_000);
if (!allowed) return res.status(429).json({ message: "Too many OTP requests" });
```

:::callout{type="tip"}
This version also records rejected attempts, so a client that keeps hammering stays blocked. That's usually what you want for login and OTP. It stores one entry per request, so use it for small, strict limits and keep the fixed window for high-volume API limits.
:::

### Production shortcut: express-rate-limit + rate-limit-redis

For everyday API limits, use the well-tested `express-rate-limit` middleware and point its store at Redis. Every server then shares the same counters.

```js title="app.js"
// npm i express-rate-limit rate-limit-redis
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "./lib/redis.js";

app.set("trust proxy", 1); // real client IP behind a load balancer

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  limit: 300,                    // per IP per window (older versions call this `max`)
  standardHeaders: "draft-7",    // send RateLimit-* headers
  legacyHeaders: false,
  store: new RedisStore({
    prefix: "rl:api:",
    sendCommand: (command, ...args) => redis.call(command, ...args),
  }),
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { message: "Too many login attempts. Try again in a minute." },
  store: new RedisStore({
    prefix: "rl:login:",         // each limiter needs its own prefix
    sendCommand: (command, ...args) => redis.call(command, ...args),
  }),
});

app.use("/api", apiLimiter);
app.post("/auth/login", loginLimiter, loginController);
```

| Option | Value used | What it does |
| --- | --- | --- |
| `windowMs` | `15 * 60 * 1000` | Length of the window in milliseconds. |
| `limit` | `300` | Requests allowed per key (IP by default) per window. |
| `standardHeaders` | `"draft-7"` | Tells clients their limit and remaining requests through standard headers. |
| `store` | `new RedisStore(…)` | Moves the counters from process memory to Redis. This is what makes the limit hold across servers. |
| `sendCommand` | `redis.call(…)` | How the store talks to Redis. `call()` is ioredis's "run any raw command" method. |
| `prefix` | `"rl:login:"` | Keeps the login limiter's keys separate from the general API limiter's. |

:::quiz
3 Express servers behind a round-robin load balancer each count requests in memory with a limit of 10/min. How many requests can one IP really make per minute?

- [ ] 10
- [x] Up to 30

> Each server only sees its share of the traffic, so the real limit is limit × number of servers.
:::

:::quiz
Why wrap `INCR` and `EXPIRE` in `MULTI`?

- [x] So a crash between the two can't leave a counter with no expiry, blocking the user forever
- [ ] Because INCR doesn't work outside a transaction

> Both commands run together inside `EXEC`, so you never end up with a counter that has no TTL.
:::
