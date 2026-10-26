## Real-time leaderboards with sorted sets

*Millions of scores, always ranked, updated in O(log N)*

Kodr runs a weekly coding contest: 50,000 participants, scores changing every few seconds, and everyone refreshing to see the **top 10** and **"my rank"**. In SQL, "my rank" is `SELECT COUNT(*) + 1 FROM scores WHERE score > :myScore`. That runs on every refresh, for every participant, while scores keep changing underneath it. It's fine for 500 users and painful for 50,000.

:::callout[Key Concept]{type="note"}
A **sorted set** keeps unique members ordered by score *at all times*. Internally it pairs a skip list (for ordering) with a hash table (for member → score lookups). Redis never "sorts" when you ask for the leaderboard, because it's already sorted.

`ZINCRBY` · `ZREVRANK` · `ZSCORE` cost O(log N) or better. Top-10 with `ZRANGE … REV` costs O(log N + 10). With 50,000 members, log₂ N is about 16 steps.
:::

<!-- TODO widget: Kodr weekly contest · `lb:contest:42` -->

### The commands a leaderboard needs

| Command | Leaderboard job | Returns (ioredis) | Cost |
| --- | --- | --- | --- |
| `ZADD lb 120 aarav` | Set a score (create or overwrite) | 1 if new member, 0 if updated | O(log N) |
| `ZINCRBY lb 60 rohan` | Add points atomically | new score as a **string**: "410" | O(log N) |
| `ZRANGE lb 0 9 REV WITHSCORES` | Top 10, highest first | flat array: [m1, s1, m2, s2, …] | O(log N + 10) |
| `ZREVRANK lb rohan` | My position (0 = first) | number, or null if absent | O(log N) |
| `ZSCORE lb rohan` | My score | string, or null | O(1) |
| `ZCARD lb` | Number of participants | number | O(1) |
| `ZREM lb cheater` | Remove someone | 1 or 0 | O(log N) |

:::callout{type="tip"}
`ZRANGE … REV` needs Redis 6.2+. On older servers, use `ZREVRANGE lb 0 9 WITHSCORES`, which still works but is marked deprecated. Members with **equal scores** are ordered by member name (lexicographically, and reversed with `REV`). If "whoever got there first wins" matters, fold a time component into the score.
:::

### The API

```js title="routes/leaderboard.routes.js"
import { Router } from "express";
import { redis } from "../lib/redis.js";

const router = Router();
const LB = "lb:contest:42";

// flat [member, score, member, score…] → [{ rank, userId, score }]
const toRows = (flat, startRank = 1) => {
  const rows = [];
  for (let i = 0; i < flat.length; i += 2) {
    rows.push({ rank: startRank + i / 2, userId: flat[i], score: Number(flat[i + 1]) });
  }
  return rows;
};

// a user solved a problem
router.post("/score", async (req, res) => {
  const { userId, points } = req.body;
  const total = await redis.zincrby(LB, points, userId);      // "410" (a string)
  res.json({ userId, total: Number(total) });
});

// top N, highest first
router.get("/top", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const flat = await redis.zrange(LB, 0, limit - 1, "REV", "WITHSCORES");
  res.json(toRows(flat));
});

// my rank + the 2 people above and below me
router.get("/me/:userId", async (req, res) => {
  const { userId } = req.params;
  const rank = await redis.zrevrank(LB, userId);              // 0-based, or null
  if (rank === null) return res.json({ rank: null });

  const start = Math.max(0, rank - 2);
  const [flat, score] = await Promise.all([
    redis.zrange(LB, start, rank + 2, "REV", "WITHSCORES"),
    redis.zscore(LB, userId),
  ]);
  res.json({ rank: rank + 1, score: Number(score), around: toRows(flat, start + 1) });
});

export default router;
```

### Names for the top 10 without 10 DB queries

The sorted set only stores user IDs. Keep display names in hashes and fetch them all in one round trip with a **pipeline**, which batches commands without making them a transaction.

```js title="routes/leaderboard.routes.js"
const top = toRows(await redis.zrange(LB, 0, 9, "REV", "WITHSCORES"));

const pipe = redis.pipeline();
top.forEach((row) => pipe.hget(`user:${row.userId}`, "name"));
const replies = await pipe.exec();               // [[null, "Kabir"], [null, "Aarav"], …]

top.forEach((row, i) => (row.name = replies[i][1] ?? "Unknown"));
```

### Weekly and monthly boards that clean themselves up

```js title="services/score.service.js"
export async function addPoints(userId, points, week /* e.g. "2026-W43" */) {
  const key = `lb:weekly:${week}`;
  await redis
    .multi()
    .zincrby(key, points, userId)
    .zincrby("lb:all-time", points, userId)
    .expire(key, 60 * 60 * 24 * 14, "NX")   // weekly board deletes itself after 2 weeks
    .exec();
}

// combine weeks into a monthly board (sums scores by default)
await redis.zunionstore("lb:month:2026-10", 4,
  "lb:weekly:2026-W40", "lb:weekly:2026-W41", "lb:weekly:2026-W42", "lb:weekly:2026-W43");
```

:::callout{type="tip"}
To make it truly live, emit a `leaderboard:update` event over Socket.IO after each `ZINCRBY`, throttled to about once a second. With the Redis adapter from Section 14, it reaches viewers on every server.
:::

:::quiz
`ZREVRANK lb kabir` returns `0`. What is Kabir's position?

- [ ] Last place
- [x] 1st place. Ranks are 0-based and REV puts the highest score first

> Always add 1 before showing a rank to humans. `ZRANK` (no REV) would count from the lowest score.
:::

:::quiz
Why is a sorted set better than `SELECT COUNT(*)` for "my rank" at scale?

- [x] Redis keeps members sorted as scores change, so a rank lookup is O(log N) instead of counting rows every time
- [ ] Sorted sets store data on disk, so they're more durable

> The sorting work happens once per update (O(log N)), not on every read.
:::

## Cheat sheet & production checklist

*Which structure for which job, and what to check before you ship*

| Use case | Structure | Key pattern | Commands |
| --- | --- | --- | --- |
| Cache an object | String | `post:{id}` | `SET … EX` · `GET` · `DEL` |
| Stampede lock | String | `lock:{key}` | `SET … NX PX` · Lua compare-and-DEL |
| Counters (views, likes) | String | `post:{id}:views` | `INCR` · `INCRBY` |
| Rate limit, fixed window | String | `rl:{scope}:{ip}` | `MULTI` · `INCR` · `EXPIRE NX` |
| Rate limit, sliding window | Sorted set | `rl:{scope}:{id}` | `ZREMRANGEBYSCORE` · `ZADD` · `ZCARD` |
| Object with fields | Hash | `user:{id}` | `HSET` · `HGET` · `HGETALL` · `HINCRBY` |
| Recent activity feed | List | `feed:{userId}` | `LPUSH` · `LTRIM` · `LRANGE` |
| Likers / online users | Set | `post:{id}:likers` | `SADD` · `SISMEMBER` · `SCARD` |
| Leaderboard | Sorted set | `lb:{period}` | `ZINCRBY` · `ZRANGE REV` · `ZREVRANK` |
| Messages between servers | Pub/Sub | channel names | `PUBLISH` · `SUBSCRIBE` |

### Housekeeping commands

```redis title="redis-cli"
127.0.0.1:6379> INFO stats            # keyspace_hits / keyspace_misses → hit ratio
127.0.0.1:6379> INFO memory           # used_memory_human, maxmemory
127.0.0.1:6379> SLOWLOG GET 10        # the slowest recent commands
127.0.0.1:6379> TYPE user:42          # which structure is this key?
127.0.0.1:6379> SCAN 0 MATCH post:* COUNT 100   # iterate keys safely
127.0.0.1:6379> UNLINK post:42        # delete without blocking (frees memory in the background)
```

```js title="scripts/clearPostCache.js"
// Never run KEYS * on production: it blocks Redis while it walks every key.
const stream = redis.scanStream({ match: "post:*", count: 100 });
stream.on("data", async (keys) => {
  if (keys.length) await redis.unlink(...keys);
});
stream.on("end", () => console.log("post cache cleared"));
```

### Production checklist

:::steps
1. **One client per process** — Import it everywhere. Create a `duplicate()` only for subscribers.
2. **Every cache key has a TTL, with jitter** — No "forever" cache entries. A plain `SET` wipes the TTL.
3. **Set `maxmemory` and a policy** — Keep pure cache separate from counters, sessions and leaderboards.
4. **Invalidate on write: update the DB, then `DEL`** — Know which keys each write affects.
5. **Protect hot keys** — Lock with `SET NX PX`, single-flight, optional L1 cache.
6. **Fail fast, fall back** — `commandTimeout`, `enableOfflineQueue: false`, try/catch around cache calls.
7. **Atomic multi-step logic** — `MULTI`/`EXEC` or Lua for anything like "INCR then EXPIRE".
8. **No `KEYS *`, no huge values** — Use `SCAN`. Big values (hundreds of KB) block the single thread for everyone.
9. **Real client IPs** — `app.set("trust proxy", 1)` before any IP-based limiter.
10. **Lock it down** — Password/ACL, TLS on managed services, never exposed to the internet (security groups).
11. **Watch it** — Hit ratio, memory, evictions (`evicted_keys`) and the slow log.
:::

:::quiz
You need to delete all `post:*` keys on a production Redis. Which approach is right?

- [ ] `KEYS post:*`, then DEL them all
- [x] SCAN in batches (ioredis `scanStream`) and UNLINK each batch

> `KEYS` walks the entire keyspace in one blocking command. `SCAN` does it a little at a time, so other clients keep getting served.
:::

:::quiz
Which `INFO` fields give you the cache hit ratio?

- [x] `keyspace_hits` and `keyspace_misses`
- [ ] `used_memory` and `maxmemory`

> Hit ratio = hits ÷ (hits + misses), counted across all lookups since the server started.
:::
