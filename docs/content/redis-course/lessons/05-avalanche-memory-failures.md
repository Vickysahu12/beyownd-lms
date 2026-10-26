## Cache avalanche & cache penetration

*Many keys expiring together, and requests for data that doesn't exist*

### Avalanche: thousands of keys expire in the same second

A stampede is about *one* hot key. An **avalanche** is many keys expiring at once. Say a deploy (or a midnight cron job) warms the cache for 10,000 products, all with `EX 60`. Exactly 60 seconds later, all 10,000 vanish together and the database gets hit with 10,000 queries in a single second. Then again at 120 s. A Redis restart that empties the whole cache (a **cold cache**) does the same thing.

<!-- TODO widget: DB queries per second after warming 10,000 keys at t = 0 -->

The fix is almost embarrassingly simple: add a little **randomness (jitter)** to every TTL so keys written together don't expire together.

```js title="lib/ttl.js"
// base TTL + up to `spread` (default 20%) random extra seconds
export const withJitter = (baseSeconds, spread = 0.2) =>
  baseSeconds + Math.floor(Math.random() * baseSeconds * spread);

await redis.set(`product:${id}`, JSON.stringify(product), "EX", withJitter(3600));
// expires somewhere between 60 and 72 minutes, not all at 60:00
```

- **Cold cache after a Redis restart?** Turn on persistence (RDB/AOF) or use a managed service with replicas, so a restart doesn't wipe everything. Warm the most important keys before sending traffic.
- **Protect the DB anyway.** The stampede lock from Section 8 and rate limiting from Section 12 both limit how much load can reach MongoDB at once.

### Penetration: asking for data that doesn't exist

Cache-aside only caches things it finds. If a bot (or a bug) keeps requesting `/posts/`, every request is a miss and every miss goes to the database, which finds nothing. Nothing gets cached, so the cache never helps. That's **cache penetration**.

<!-- TODO widget: story diagram "Requests that slip straight through the cache" (animated in the original note) -->
:::steps
1. **A bot requests IDs that don't exist** — A scraper loops over random IDs, or a buggy client keeps asking for a deleted post.
2. **Redis misses every time** — Nothing was ever stored for these keys, because our code only caches posts it actually finds.
3. **Every request reaches MongoDB** — The DB does a full lookup, finds nothing, and the result is thrown away. As far as the database is concerned, the cache isn't there.
4. **Fix: cache the "not found" and validate input** — Store a small placeholder like `__nil__` with a short TTL so repeats are absorbed by Redis. Reject IDs that aren't even valid ObjectIds before they reach the DB. Rate-limit clients that rack up 404s (Section 12).
:::

```text title="services/post.service.js · penetration-safe"
import mongoose from "mongoose";
import { withJitter } from "../lib/ttl.js";

const NIL = "__nil__";

export async function getPost(postId) {
  if (!mongoose.isValidObjectId(postId)) return null;     // garbage never reaches the DB

  const key = `post:${postId}`;
  const cached = await redis.get(key);
  if (cached === NIL) return null;                         // known "doesn't exist"
  if (cached) return JSON.parse(cached);

  const post = await Post.findById(postId).lean();
  if (!post) {
    await redis.set(key, NIL, "EX", 30);                   // short TTL for negatives
    return null;
  }
  await redis.set(key, JSON.stringify(post), "EX", withJitter(60));
  return post;
}
```

:::callout{type="tip"}
Keep the negative TTL short. If the post gets created a few seconds later, you don't want "not found" cached for an hour. For huge ID spaces, teams also use a **Bloom filter** (included in Redis 8, or Redis Stack on older versions). It answers "definitely doesn't exist" without storing every ID.
:::

| Problem | What happens | Fix |
| --- | --- | --- |
| Stampede | One hot key expires and many requests rebuild it together | Lock (SET NX), single-flight, early refresh |
| Avalanche | Many keys expire at once, or the cache restarts empty | TTL jitter, persistence/replicas, warm-up |
| Penetration | Requests for missing data always miss | Cache nulls briefly, validate IDs, Bloom filter, rate limit |

:::quiz
10,000 product keys were all cached at 00:00 with `EX 3600`. What's the best quick fix to avoid an avalanche at 01:00?

- [x] Add random jitter to each key's TTL
- [ ] Use a longer TTL of 7,200 for all of them

> A longer identical TTL only moves the spike to 02:00. Jitter spreads expiries out so they never line up.
:::

:::quiz
A bot requests `/posts/` for IDs that never exist. Why doesn't a plain cache-aside setup help?

- [x] Nothing gets cached for missing data, so every request misses and goes to the DB
- [ ] Redis can't store keys that contain random strings

> Caching the empty result (`__nil__` with a short TTL) turns repeat misses into hits.
:::

## Memory limits, eviction, and when Redis fails

*RAM runs out, servers go down, and one key can get too hot*

### When memory is full: maxmemory and eviction

RAM is finite. You tell Redis how much it may use with `maxmemory`, and what to do when it's full with `maxmemory-policy`. For a pure cache, the usual choice is to let Redis evict the keys that matter least.

```bash title="Terminal · run Redis with a memory cap"
docker run -d --name redis -p 6379:6379 redis:7-alpine \
  redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

# or change it on a running server
docker exec -it redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

<!-- TODO widget: Eviction at maxmemory -->

| Policy | Evicts | Use when |
| --- | --- | --- |
| `noeviction` | Nothing. Writes fail with an OOM error. | The default. Right when Redis holds data you can't lose (queues, sessions). |
| `allkeys-lru` | Least **recently** used key, from all keys | Pure cache. The best general default. |
| `allkeys-lfu` | Least **frequently** used key | A few keys are always hot (our viral post) and must survive bursts of one-off keys. |
| `volatile-lru / volatile-lfu` | Same, but only keys that **have a TTL** | One Redis holds both cache keys (with TTL) and permanent keys (without). |
| `volatile-ttl` | Key closest to expiring | Rarely the best choice. |
| `allkeys-random / volatile-random` | A random key | When every key matters equally. |

:::callout{type="tip"}
Redis LRU is **approximate**. It samples a handful of keys (`maxmemory-samples`, default 5) and evicts the best candidate among them. That's cheap and very close to true LRU. Real LFU also gives brand-new keys a small starting count and lets counts decay over time, so yesterday's hot key doesn't stay protected forever.
:::

:::callout{type="warning"}
If the same Redis also stores **rate-limit counters, sessions or leaderboards**, an `allkeys-*` policy may evict them to make room for cache entries. Either run a separate Redis for the cache, or use a `volatile-*` policy and give TTLs only to cache keys.
:::

### When Redis goes down

A cache should make the app faster, not become a new single point of failure. If Redis is unreachable, a well-written read **treats it as a miss** and goes to the database, and it fails fast instead of hanging.

```js title="lib/cache.js"
import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL, {
  enableOfflineQueue: false,   // don't queue commands while disconnected; reject immediately
  maxRetriesPerRequest: 1,
  commandTimeout: 200,         // a cache read slower than 200 ms counts as a miss
});
redis.on("error", (err) => console.warn("redis:", err.message));

export async function cacheGet(key) {
  try {
    return await redis.get(key);
  } catch {
    return null;               // Redis down or slow → behave like a miss
  }
}

export async function cacheSet(key, value, ttl) {
  try {
    await redis.set(key, value, "EX", ttl);
  } catch {
    /* losing a cache write is fine; the DB still has the data */
  }
}
```

:::callout{type="warning"}
Falling back to the DB is right, but think it through: if Redis dies *during* viral traffic, all of that load lands on MongoDB, which is the Section 1 crash again. Production setups add replicas with automatic failover (Sentinel, Redis Cluster or a managed service), plus rate limiting and timeouts on the DB path.
:::

### Hot keys: one key, too much traffic

Even Redis has limits. A single viral key always lives on one Redis node, and lakhs of `GET post:42` calls per second all hit that one node's CPU and network. The fix is a tiny **in-process cache** (L1) with a 1–2 second TTL in front of Redis (L2). Each server then asks Redis for that key about once a second, instead of thousands of times.

```js title="lib/hotCache.js"
const local = new Map(); // key -> { value, until }   (use the `lru-cache` package in production)

export async function getHot(key, ttlMs = 1000) {
  const hit = local.get(key);
  if (hit && hit.until > Date.now()) return hit.value;   // L1: process memory, ~0 ms

  const value = await cacheGet(key);                      // L2: Redis
  local.set(key, { value, until: Date.now() + ttlMs });
  return value;
}
```

:::quiz
Redis hits `maxmemory` with the default `noeviction` policy. What happens on the next `SET`?

- [x] Redis returns an OOM error and refuses the write
- [ ] Redis silently deletes the oldest key

> Try it in the simulator: `(error) OOM command not allowed when used memory > 'maxmemory'`. Reads still work.
:::

:::quiz
Redis is down. What should a well-written cache-aside read do?

- [ ] Return a 500 error to the user
- [x] Treat it as a miss and read from the DB, using fail-fast timeouts

> The cache is an optimisation. The app should get slower without it, not break.
:::
