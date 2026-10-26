## Enter Redis

*An in-memory data structure store that every server can share*

:::callout[Key Concept]{type="note"}
**Redis** (REmote DIctionary Server) is a server that keeps data **in RAM** and lets you read and write it over the network by **key**. Picture a giant JavaScript `Map` running in its own process, which every one of your Node servers can talk to.
:::

:::callout{type="tip"}
**The chai tapri analogy.** Brewing a fresh cup for every customer takes four minutes: boil water, add leaves, milk, sugar. That's a database query. A smart chaiwala keeps a big kettle of ready chai on the counter and pours in seconds. That's a **cache**. After half an hour the kettle chai goes cold and he makes a new batch (that's **TTL**, Section 6). If he changes the recipe but the kettle still has the old batch, customers get the old taste (that's **stale data**, Section 7).
:::

### Where Redis sits

<!-- TODO widget: story diagram "diagram" (animated in the original note) -->

### Why Redis is so fast

- **Data lives in RAM.** No disk seek on the read path. A main-memory reference is around 100 ns, while an SSD random read is around 100 µs, roughly a thousand times slower.
- **Simple structures with known cost.** `GET` is a hash-table lookup, O(1). There's no query parser or planner deciding what to do.
- **One thread runs the commands.** Commands execute one at a time, so there are no locks, and every single command is **atomic**. That property powers rate limiters and leaderboards later.
- **Event-loop networking.** Like Node.js, one thread handles thousands of client connections with I/O multiplexing. A single small instance can usually serve tens of thousands to over a hundred thousand simple operations per second.

### "Why not just use a JavaScript Map?"

Every student asks this. A `Map` inside your Node process works on your laptop and then falls apart in production.

| What | In-process `Map` | Redis |
| --- | --- | --- |
| Shared across servers | No. Each PM2 worker or Kubernetes pod has its own copy. | Yes. One store that every instance reads ✓ |
| Survives an app restart / deploy | No. It's gone on every deploy. | Yes. Redis is a separate process ✓ |
| Expiry | DIY with `setTimeout` | Built in: `EX`, `EXPIRE`, `TTL` ✓ |
| Memory limits | Grows the Node heap and causes GC pauses | `maxmemory` + eviction policies ✓ |
| Atomic counters across servers | Impossible | `INCR`, `ZINCRBY`, `MULTI` ✓ |
| Data structures | Whatever you code yourself | Strings, hashes, lists, sets, sorted sets, streams, Pub/Sub ✓ |

:::callout{type="warning"}
RAM is expensive and limited. Used as a cache, **Redis is not your source of truth**. Keep the real data in MongoDB or Postgres and treat Redis as a fast copy you can afford to lose. Redis can persist to disk (RDB snapshots, AOF logs), but caching code should still work if the cache comes back empty.
:::

:::callout{type="tip"}
In production you'll often use a managed service such as AWS ElastiCache, Redis Cloud or Upstash. **Valkey** is an open-source fork of Redis that speaks the same protocol. ioredis works with all of them.
:::

:::quiz
Redis runs commands one at a time on a single thread. What does that give us?

- [x] Commands never interleave, so each one is atomic without any locks
- [ ] Node.js can only connect to single-threaded servers

> Two servers running `INCR` on the same key at the same moment will always get 1 and 2, never 1 and 1.
:::

:::quiz
You run 4 Express instances with PM2 and cache posts in a JS `Map`. Post 42 is cached in instance 1, and the next request lands on instance 3. What happens?

- [x] Cache miss. Instance 3 has its own empty Map and queries the DB again
- [ ] Instance 3 reads instance 1's Map automatically

> Processes don't share memory. That's the main reason a shared cache like Redis exists.
:::

## Setting up Redis with ioredis

*Run Redis in Docker, create one shared client, and learn the first commands*

**Step 1 — Run Redis locally**

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker exec -it redis redis-cli ping
# PONG
```

| Flag | Value used | What it does |
| --- | --- | --- |
| `-d` | — | Runs the container in the background (detached). |
| `--name` | `redis` | Gives the container a name so `docker exec redis …` works. |
| `-p` | `6379:6379` | Maps host port → container port. 6379 is Redis's default port. |
| `image` | `redis:7-alpine` | Official Redis 7 image on a small Alpine base. |

**Step 2 — Install ioredis**

```bash
npm install ioredis
```

**Step 3 — Create one shared client**

Create the connection **once** in its own module and import it everywhere, the same way you connect Mongoose once in `db.js`.

```js title="lib/redis.js"
import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 2,      // fail a command after 2 retries instead of waiting forever
  // enableOfflineQueue: false, // fail instantly while disconnected (see Section 10)
});

redis.on("ready", () => console.log("✅ Redis ready"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));
redis.on("reconnecting", () => console.log("↻ Redis reconnecting…"));
```

| Option | Value used | What it does |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Connection string. Managed services give you `rediss://user:pass@host:port` (double "s" = TLS). |
| `maxRetriesPerRequest` | `2` | How many reconnect attempts a pending command waits through before it rejects. The default is 20, which can leave HTTP requests hanging. |
| `enableOfflineQueue` | `true (default)` | While disconnected, ioredis queues commands and sends them after reconnecting. Set it to `false` to fail fast instead. |
| `"error" listener` | `required` | Without it, connection errors become unhandled error events and get noisy in your logs. |

**Step 4 — First commands**

ioredis method names are the Redis command names in lowercase, with the arguments in the same order you'd type in `redis-cli`. Learn a command once and you can use it from both.

```js title="playground.js"
import { redis } from "./lib/redis.js";

await redis.set("greeting", "namaste");               // "OK"
await redis.get("greeting");                          // "namaste"
await redis.get("missing");                           // null   ← not undefined
await redis.set("otp:9876543210", "4821", "EX", 300); // expires in 5 minutes
await redis.incr("post:42:views");                    // 1, then 2, 3 …  (a number)
await redis.del("greeting");                          // 1  (how many keys were removed)

// Redis stores strings. Objects must be serialised.
await redis.set("post:42", JSON.stringify({ caption: "Hello Bhopal" }));
const post = JSON.parse(await redis.get("post:42"));
```

### Naming keys

Redis has no tables. The convention is colon-separated names that read from general to specific, so keys group nicely and you can find them by pattern.

| Key | Holds | Used in |
| --- | --- | --- |
| `post:42` | Cached JSON of post 42 | Caching (§5) |
| `post:42:views` | View counter | Counters (§11) |
| `lock:post:42` | "Someone is rebuilding post 42" | Stampede protection (§8) |
| `rl:login:203.0.113.7` | Login attempts from one IP | Rate limiting (§12) |
| `online:users` | Set of online user IDs | Presence (§14) |
| `lb:weekly:2026-W43` | This week's scores | Leaderboards (§15) |

**Verify — Watch commands live**

Open a second terminal and run `MONITOR`. Every command your app sends shows up as it happens, which is the best way to see your caching logic working.

```bash
docker exec -it redis redis-cli monitor
# 1729500000.123 [0 172.17.0.1:52144] "GET" "post:42"
# 1729500000.161 [0 172.17.0.1:52144] "SET" "post:42" "{...}" "EX" "60"
```

:::callout{type="warning"}
**Never write `new Redis()` inside a route handler.** It opens a new TCP connection per request and you'll run out of connections under load. It's the same mistake as connecting to MongoDB on every request. Also keep `MONITOR` for local debugging only. On a busy production server it slows Redis down.
:::

:::quiz
`await redis.get("post:999")` for a key that doesn't exist returns…

- [ ] undefined
- [x] null

> Redis replies "nil" and ioredis turns that into `null`. So `if (cached)` is the usual cache-hit check.
:::

:::quiz
Where should you create the ioredis client?

- [x] Once, in a shared module that every file imports
- [ ] Inside each route handler, so every request gets a fresh connection

> One long-lived client per process handles many concurrent commands over one connection. The exception is Pub/Sub subscribers, which need their own connection (Section 14).
:::
