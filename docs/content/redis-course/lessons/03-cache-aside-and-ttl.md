## Caching with the cache-aside pattern

*Check Redis first, fall back to the database, keep a copy for the next reader*

The most common caching pattern is **cache-aside**, also called lazy loading. Your application sits in the middle and talks to both Redis and the database. Redis never talks to the database itself. Data only goes into the cache after somebody actually asks for it.

<!-- TODO widget: story diagram "One miss, then hits for everyone else" (animated in the original note) -->
:::steps
1. **A request arrives** — A reader opens `/posts/42`. Express calls our `getPost(42)` function.
2. **Ask Redis first** — Before touching the database, the server sends `GET post:42` to Redis. That's a hash lookup in RAM.
3. **Cache miss** — Nobody has asked for this post since the cache was last empty, so Redis replies `(nil)`. ioredis gives us `null`.
4. **Fall back to the database** — The server runs the normal query `Post.findById(42)`. This is the slow, expensive path.
5. **Keep a copy, with an expiry** — When MongoDB returns the document, the server stores it in Redis: `SET post:42 EX 60`. The `EX 60` means "delete this copy in 60 seconds" (Section 6).
6. **Respond (the slow path happens once)** — The first reader waited ~41 ms. That's the full cost, paid by just one request.
7. **The next reader gets a cache hit** — Another user opens the same post. `GET post:42` now returns the JSON. That's a **cache hit**.
8. **Fast response, idle database** — The response takes ~2 ms and MongoDB isn't touched. One DB query now serves every reader until the key expires. That's how a viral post stops being a DB problem.
:::

### The code

```js title="services/post.service.js"
import { redis } from "../lib/redis.js";
import Post from "../models/post.model.js";

const POST_TTL = 60; // seconds

export async function getPost(postId) {
  const key = `post:${postId}`;

  // 1. Try the cache first
  const cached = await redis.get(key);
  if (cached) return { post: JSON.parse(cached), source: "HIT" };

  // 2. Miss → ask the database
  const post = await Post.findById(postId).lean();
  if (!post) return { post: null, source: "MISS" };

  // 3. Keep a copy for the next reader, with an expiry
  await redis.set(key, JSON.stringify(post), "EX", POST_TTL);
  return { post, source: "MISS" };
}
```

```js title="routes/post.routes.js"
router.get("/posts/:id", async (req, res) => {
  const { post, source } = await getPost(req.params.id);
  res.set("X-Cache", source);              // handy while debugging: HIT or MISS
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
});
```

| Argument | Value used | What it does |
| --- | --- | --- |
| `key` | ```post:${postId}``` | One key per post. The same ID always maps to the same key. |
| `value` | `JSON.stringify(post)` | Redis stores strings, so serialise objects. `.lean()` gives a plain object instead of a Mongoose document. |
| `"EX"` | `60` | Expire after 60 seconds. Use `"PX"` for milliseconds. |

### Try it: watch the hit ratio climb

Send requests one at a time, then fire a viral burst. Switch the cache off to feel what the database went through in Section 1.

<!-- TODO widget: simulator -->

:::callout{type="tip"}
Fire a burst while the cache is **empty** and count the misses. Several requests miss before the first one finishes writing to Redis. That's a small **cache stampede**, and Section 8 is about stopping it.
:::

:::callout[Key Concept]{type="note"}
**Hit ratio** = hits ÷ (hits + misses). At 95%, only 5 out of every 100 reads reach the database. For a hot key like our viral post, the hit ratio gets close to 100% after the first request.
:::

### What's worth caching?

| Good candidates | Think twice |
| --- | --- |
| Read often, changes rarely: post content, product details, public profiles | Changes on almost every request (live stock count at checkout) |
| Expensive to compute: trending list, aggregation results, recommendations | Read once, never again (one-off reports) |
| Same answer for many users: config, feature flags, category trees | Money or permissions where a stale answer causes harm (wallet balance, role checks) |

#### Other caching patterns you'll hear about

| Pattern | Who loads from the DB? | When is the cache updated? |
| --- | --- | --- |
| Cache-aside (this section) | Your app, on a miss | Lazily on read, plus delete on write ✓ most common |
| Read-through | A cache library or layer, on a miss | Same idea, hidden behind a library |
| Write-through | — | On every write, the app writes the DB and the cache together |
| Write-behind | — | Writes go to Redis first and get flushed to the DB later (e.g. like counters) |

:::quiz
In cache-aside, who loads data from the database on a cache miss?

- [ ] Redis fetches it from MongoDB automatically
- [x] Your application code, which then writes the result to Redis

> Redis knows nothing about MongoDB. The cache sits "aside" while your code moves data between the two.
:::

:::quiz
Out of 1,000 reads, 950 were served from Redis. What's the hit ratio, and how many reads reached the DB?

- [x] 95% hit ratio, 50 DB reads
- [ ] 5% hit ratio, 950 DB reads

> Hits ÷ total = 950 ÷ 1,000 = 95%. Only the 50 misses reach the database.
:::

## TTL: giving data an expiry date

*How Redis forgets things on its own, and how to choose how long to remember*

**TTL (time to live)** is a countdown attached to a key. When it reaches zero, Redis deletes the key. TTL does two jobs at once: it **caps how stale** a cached copy can get, and it **frees memory** automatically so the cache doesn't grow forever. Back at the chai tapri, it's the rule "make a fresh kettle every 30 minutes".

<!-- TODO widget: TTL lab -->

### The commands

```redis title="redis-cli"
127.0.0.1:6379> SET post:42 "{...}" EX 60       # set value + expiry together (seconds)
OK
127.0.0.1:6379> TTL post:42                      # seconds left
(integer) 57
127.0.0.1:6379> EXPIRE post:42 300               # change the expiry of an existing key
(integer) 1
127.0.0.1:6379> PERSIST post:42                  # remove the expiry: lives forever
(integer) 1
127.0.0.1:6379> TTL post:42
(integer) -1
127.0.0.1:6379> TTL post:999
(integer) -2
```

```text title="The same in ioredis"
await redis.set("post:42", json, "EX", 60);   // seconds
await redis.set("lock:post:42", id, "PX", 5000); // milliseconds
await redis.expire("post:42", 300);           // 1 if the key exists, 0 if not
await redis.ttl("post:42");                   // 57  |  -1 no expiry  |  -2 no such key
await redis.pttl("post:42");                  // same thing in milliseconds
await redis.persist("post:42");               // remove the expiry
await redis.set("post:42", newJson, "KEEPTTL"); // overwrite value, keep the old countdown
```

| Command / option | Example | What it does |
| --- | --- | --- |
| `SET … EX` | `EX 60` | Value and expiry in one atomic command. Prefer this over a separate `SET` + `EXPIRE`. |
| `SET … PX` | `PX 5000` | Expiry in milliseconds, useful for short locks. |
| `EXPIRE / PEXPIRE` | `EXPIRE k 300` | Set or change the TTL on an existing key. Redis 7 adds `NX`, `XX`, `GT` and `LT` flags. |
| `TTL / PTTL` | `TTL k` | Remaining time. `-1` = key exists with no expiry, `-2` = key doesn't exist. |
| `PERSIST` | `PERSIST k` | Removes the expiry. |
| `KEEPTTL` | `SET k v KEEPTTL` | Overwrite the value without resetting the countdown. |

:::callout{type="warning"}
**A plain `SET` wipes the TTL.** If `post:42` had `EX 60` and you run `SET post:42 newValue` without `EX`, the key now lives *forever* (`TTL` → `-1`). Always pass `EX` again, or use `KEEPTTL`. `INCR` is different: it keeps the existing TTL.
:::

:::callout{type="tip"}
**How Redis actually expires keys:** lazily (it checks the expiry whenever you access a key) and actively (a background job samples keys that have TTLs about 10 times a second and deletes expired ones). An expired key is never returned to you, but it may take a moment to leave memory.
:::

### Choosing a TTL

There's no magic number. A short TTL keeps data fresher but sends more traffic to the DB. A long TTL protects the DB but shows older data. Decide per kind of data:

| Data | Typical TTL | Why |
| --- | --- | --- |
| Viral post body | `60 – 300 s` | Rarely edited. Even 60 s turns lakhs of reads into one query a minute. |
| Like / view counts | `5 – 10 s` | Nobody notices if a count is a few seconds behind. |
| Public user profile | `10 – 30 min` | Changes rarely. Delete it on edit (Section 7). |
| Feature flags / config | `30 s – 5 min` | Read on every request. Short enough that a change rolls out quickly. |
| OTP | `5 min` | Here the TTL is a security rule, not a performance setting. |
| Rate-limit window | `= window` | The TTL *is* the window (Section 12). |

:::quiz
`TTL post:42` returns `-1`. What does that mean?

- [x] The key exists but has no expiry. It lives until deleted or evicted
- [ ] The key has already expired

> `-2` means the key doesn't exist (or already expired). `-1` is the one to watch for: a cache key that will never refresh.
:::

:::quiz
A key was set with `EX 60`. Ten seconds later you run `SET post:42 newValue` with no options. What's its TTL now?

- [ ] Still about 50 seconds
- [x] -1, because the plain SET removed the expiry

> Try it in the lab above: `SET` replaces the whole key, expiry included, unless you pass `EX` or `KEEPTTL`.
:::
