## The first new problem: stale data

*Every cache is a copy, and copies go out of date*

Every solution in tech brings its own problems. Caching fixed the crash, but now the same data lives in **two places**, MongoDB and Redis, and nothing forces them to agree. When the author edits the post, MongoDB has the new caption while Redis keeps serving the old one. Readers get **stale data**.

<!-- TODO widget: story diagram "How a cache goes stale, and the fix" (animated in the original note) -->
:::steps
1. **Everything is in sync** — The post is cached with a 300-second TTL. Redis and MongoDB both say "Hello Bhopal". Readers get fast cache hits.
2. **The author edits the caption** — `PATCH /posts/42` updates MongoDB to "Hello Indore". Our update code only touches the database.
3. **Readers get the old copy** — The next `GET post:42` is still a **hit**. The old JSON is in Redis with 247 seconds left, and Redis has no way to know the database changed.
4. **Stale until the TTL runs out** — For up to 5 minutes, every reader sees the old caption. On a viral post that's tens of thousands of wrong responses. The TTL is the *maximum* staleness, which is why it should never be "forever".
5. **Fix: delete the key when you write** — After updating MongoDB, the server runs `DEL post:42`. The stale copy is gone right away.
6. **The next read refills with fresh data** — The next reader misses, the server reads the new document from MongoDB and caches it again. Everyone sees "Hello Indore".
:::

### Try it: edit the post and watch readers

Send a few requests so the post gets cached, then edit the caption in the DB. With **TTL only**, responses stay stale until the key expires. Switch to **DEL on write** and edit again.

<!-- TODO widget: simulator -->

### Invalidation strategies

| Strategy | How | Freshness | The catch |
| --- | --- | --- | --- |
| TTL only | Do nothing on writes. Let keys expire. | Stale for up to the TTL | Simplest. Fine for counts, feeds and trending lists. |
| Delete on write | Update DB → `DEL key` | Fresh on the next read ✓ | You must know every key that holds that data. |
| Write-through | Update DB → `SET key newValue` | Fresh immediately | Two concurrent writers can SET out of order and leave the older value cached. |
| Versioned keys | Key includes a version: `post:42:v7` | Fresh as soon as the version bumps | Needs somewhere to store the version. Old versions take memory until they expire. |

### Order matters: update the DB, *then* delete the cache

It looks harmless to delete the cache first. Here's the race that bites you when a reader slips in between:

:::steps
1. **Writer: `DEL post:42`** — Cache is empty. The DB update hasn't happened yet.
2. **Reader: `GET post:42` → miss** — Goes to the database…
3. **Reader: reads the **old** document from MongoDB** — The writer's update is still in flight.
4. **Writer: `updateOne(...)` finishes** — The DB now has the new caption.
5. **Reader: `SET post:42 EX 300`** — The old value is cached for 5 minutes, even though we "invalidated".
:::

Updating the DB first and deleting afterwards shrinks this window to almost nothing. Keep a TTL anyway, as a safety net for the rare race that still slips through.

```js title="services/post.service.js"
export async function updatePost(postId, changes) {
  // 1. Source of truth first
  const post = await Post.findByIdAndUpdate(postId, changes, { new: true }).lean();
  if (!post) return null;

  // 2. Then remove every cached copy that contains this post
  await redis.del(`post:${postId}`, `user:${post.author}:posts`);
  return post;
}

export async function deletePost(postId) {
  await Post.findByIdAndDelete(postId);
  await redis.del(`post:${postId}`);
}
```

:::callout{type="tip"}
Phil Karlton's famous line: *"There are only two hard things in Computer Science: cache invalidation and naming things."* In practice, ask a product question for each kind of data: **how stale can this be before someone notices or gets hurt?** A like count 10 s behind is fine. A caption 5 minutes old after an edit is annoying. A wallet balance stale at checkout is unacceptable, so don't cache it at all.
:::

:::quiz
An author edits a post. With cache-aside, what's the safest order?

- [x] Update the DB first, then DEL the cache key
- [ ] DEL the cache key first, then update the DB

> Deleting first leaves a gap where a reader can re-cache the old value from the not-yet-updated DB.
:::

:::quiz
Why do teams usually `DEL` the key on write instead of `SET`-ing the new value?

- [ ] DEL is faster than SET
- [x] Concurrent writers can SET out of order and leave an old value. DEL just makes the next read fetch fresh data

> A delete can't be "out of order" in a harmful way. The next reader always rebuilds from the database.
:::

## Cache stampede: when the hot key expires

*Thousands of requests miss at the same moment and run the same query together*

Back to our viral post, cached with a 60-second TTL. At second 60 the key disappears, and thousands of requests are in flight at that instant. They all check Redis, all get `nil`, and all run the same DB query. It's the exact crash from Section 1, triggered by our own TTL. This is called a **cache stampede** (also thundering herd or dog-piling).

<!-- TODO widget: A hot key expires under viral traffic -->

Click **Expire the hot key** with no protection and watch the DB counter jump. Then switch to the mutex lock and expire it again: one request rebuilds while the others wait a few milliseconds and then read the fresh copy.

### Fix 1 — Let only one request rebuild (mutex lock)

Redis can act as a lock because `SET … NX` ("only set if the key does Not eXist") is atomic. Out of thousands of simultaneous requests, exactly one gets `"OK"`. Everyone else gets `null`.

```text title="services/post.service.js · stampede-safe"
import { randomUUID } from "node:crypto";
import { redis } from "../lib/redis.js";
import Post from "../models/post.model.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Delete the lock only if WE still own it (compare-and-delete, atomic in Lua)
const RELEASE_LOCK = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

export async function getPostSafe(postId, attempt = 0) {
  const key = `post:${postId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const token = randomUUID();
  const gotLock = await redis.set(lockKey, token, "PX", 5000, "NX"); // "OK" or null

  if (gotLock === "OK") {
    try {
      const post = await Post.findById(postId).lean();      // only ONE request does this
      if (post) await redis.set(key, JSON.stringify(post), "EX", 60);
      return post;
    } finally {
      await redis.eval(RELEASE_LOCK, 1, lockKey, token);
    }
  }

  // Someone else is rebuilding: wait a little, then read the cache again
  if (attempt >= 20) return Post.findById(postId).lean();   // give up after ~1 s
  await sleep(50);
  return getPostSafe(postId, attempt + 1);
}
```

| Part | Value used | Why it's there |
| --- | --- | --- |
| `lockKey` | `lock:post:42` | One lock per cache key, so different posts rebuild in parallel. |
| `token` | `randomUUID()` | Marks who owns the lock, so we never delete a lock someone else took after ours expired. |
| `"PX", 5000` | `5 s` | If the owner crashes, the lock frees itself instead of blocking everyone forever. |
| `"NX"` | — | Set only if absent. This is what makes it a lock. |
| `redis.eval` | `Lua script` | GET + compare + DEL run as one atomic step inside Redis. |

### Fix 2 — Merge duplicate misses inside one server (single-flight)

Within one Node process you don't even need Redis for this. Keep the in-progress Promise and let concurrent callers wait on it. That turns 1,000 identical misses on one server into one DB query. Combine it with the Redis lock to also cover requests on *other* servers.

```js title="lib/singleFlight.js"
const inflight = new Map(); // key -> Promise

export function singleFlight(key, loader) {
  if (inflight.has(key)) return inflight.get(key);         // join the request already running
  const p = loader().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// usage
const post = await singleFlight(`post:${id}`, () => getPostSafe(id));
```

### Fix 3 — Refresh before it expires (stale-while-revalidate)

For the hottest keys, never let readers see a miss. Store a "fresh until" time inside the value and give the Redis key a longer real TTL. When a reader finds data that's past its fresh time, it still returns that slightly old copy right away and starts one background refresh, protected by the same lock.

```text title="services/post.service.js · soft expiry"
const FRESH_MS = 60_000;   // logical freshness
const HARD_TTL = 300;      // real Redis TTL (seconds): the safety net

export async function getPostSWR(postId) {
  const key = `post:${postId}`;
  const raw = await redis.get(key);
  if (raw) {
    const { data, freshUntil } = JSON.parse(raw);
    if (Date.now() > freshUntil) refreshInBackground(postId);  // don't await
    return data;                                                // instant, maybe a bit old
  }
  return refresh(postId);                                       // truly cold: load now
}

async function refresh(postId) {
  const data = await Post.findById(postId).lean();
  const value = JSON.stringify({ data, freshUntil: Date.now() + FRESH_MS });
  await redis.set(`post:${postId}`, value, "EX", HARD_TTL);
  return data;
}

async function refreshInBackground(postId) {
  const ok = await redis.set(`lock:post:${postId}`, "1", "PX", 5000, "NX");
  if (ok === "OK") refresh(postId).catch(console.error);      // only one refresher
}
```

| Fix | Protects against | Cost |
| --- | --- | --- |
| Mutex lock (SET NX PX) | Many servers rebuilding the same key | Waiters add a few ms of latency |
| Single-flight | Duplicate misses inside one process | Almost free ✓ |
| Stale-while-revalidate | Readers ever seeing a miss on hot keys | Serves data up to one refresh cycle old |

:::quiz
`SET lock:post:42 abc NX PX 5000` returns `null`. What does that mean for this request?

- [x] Someone else holds the lock, so wait briefly and re-read the cache
- [ ] Redis is down, so query the DB immediately

> `NX` returns `null` when the key already exists, meaning another request is rebuilding. A Redis outage would throw an error instead.
:::

:::quiz
Why does the lock itself have an expiry (`PX 5000`)?

- [x] If the lock owner crashes, the lock frees itself instead of blocking everyone forever
- [ ] Redis requires every key to have a TTL

> Redis keys don't need a TTL. A lock without one turns a single crashed process into a permanent outage for that key.
:::
