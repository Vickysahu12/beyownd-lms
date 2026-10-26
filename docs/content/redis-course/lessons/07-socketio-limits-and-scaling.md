## Rate limiting Socket.IO events

*Express middleware never sees socket events, so limit them per user in Redis*

The viral post has live comments over Socket.IO. A WebSocket is one long-lived connection. The HTTP rate limiter runs once, at the handshake, and after that every `socket.emit("comment:new", …)` flows through the open socket without touching Express. One script can open a socket and emit 1,000 comments a second, flooding every viewer in the room.

- **Limit events, not just connections.** Use `socket.use()`, which runs for every incoming packet on that socket.
- **Key by user, store in Redis.** The same user can open three tabs, and the load balancer may send each tab to a different server. Per-process counters would let them send three times the limit.
- **Also limit handshakes** per IP with `io.use()`, so nobody can open thousands of sockets.

### Try it: two tabs, two servers, one user

<!-- TODO widget: simulator -->

### With rate-limiter-flexible (recommended)

```js title="socket/limits.js"
// npm i rate-limiter-flexible
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "../lib/redis.js";

const commentLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:socket:comment",
  points: 5,       // 5 comments…
  duration: 4,     // …per 4 seconds, per user
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;            // set by your auth middleware in io.use()

  socket.use(async ([event], next) => {
    if (event !== "comment:new") return next();  // only limit what needs it
    try {
      await commentLimiter.consume(userId);       // rejects when out of points
      next();
    } catch (rej) {
      if (rej instanceof Error) return next();    // Redis error → let it through
      socket.emit("rate_limited", { event, retryAfterMs: rej.msBeforeNext });
      // not calling next() drops this packet
    }
  });

  socket.on("comment:new", (comment) => {
    io.to(`post:${comment.postId}`).emit("comment:added", comment);
  });
});
```

### The same idea with plain ioredis

```text title="socket/limits.js · no library"
async function allow(key, limit, windowSec) {
  const [[, count]] = await redis.multi().incr(key).expire(key, windowSec, "NX").exec();
  return count <= limit;
}

socket.use(async ([event], next) => {
  if (await allow(`rl:socket:${socket.data.userId}:${event}`, 5, 4)) return next();
  socket.emit("rate_limited", { event });
});
```

### Limit connection attempts too

```js title="socket/limits.js"
const connectLimiter = new RateLimiterRedis({
  storeClient: redis, keyPrefix: "rl:socket:connect", points: 10, duration: 60,
});

io.use(async (socket, next) => {
  const ip = socket.handshake.headers["x-forwarded-for"]?.split(",")[0] ?? socket.handshake.address;
  try {
    await connectLimiter.consume(ip);
    next();
  } catch (rej) {
    if (rej instanceof Error) return next();
    next(new Error("Too many connection attempts"));   // client receives "connect_error"
  }
});
```

```js title="client.js"
socket.on("rate_limited", ({ retryAfterMs }) => {
  toast(`Slow down! Try again in ${Math.ceil((retryAfterMs ?? 1000) / 1000)}s`);
});
socket.on("connect_error", (err) => console.warn(err.message));
```

:::quiz
Why doesn't `express-rate-limit` protect against a client spamming `socket.emit("comment:new")`?

- [x] Socket events travel over the already-open WebSocket and never pass through Express middleware
- [ ] express-rate-limit only works with GET requests

> Only the initial HTTP handshake goes through Express. Per-event limits belong in `socket.use()`.
:::

:::quiz
A user opens 3 tabs, and each tab connects to a different Socket.IO server. Where should the comment counter live so the limit holds?

- [ ] In each server's memory, keyed by socket.id
- [x] In Redis, keyed by user ID

> socket.id changes per tab and memory is per server. A user-ID key in Redis covers every tab on every server.
:::

## Socket.IO across many servers

*Redis Pub/Sub carries broadcasts between servers, and sets and hashes store presence*

One Socket.IO server can't hold every live viewer of a viral post, so you run two or more. Here's the catch: **each server only knows the sockets connected to it.** `io.to("post:42").emit(…)` on server 1 reaches server 1's sockets and nobody else.

<!-- TODO widget: story diagram "A live comment that only half the room sees" (animated in the original note) -->
:::steps
1. **Two servers, one room** — The load balancer put Alice and Bob on server 1, and Charlie and Dia on server 2. All four joined the room `post:42` for live comments.
2. **Alice comments, and half the room misses it** — Server 1 runs `io.to("post:42").emit(…)`. The default in-memory adapter only knows local sockets, so Bob gets it and Charlie and Dia don't.
3. **Plug in the Redis adapter** — Each server opens two Redis connections: one to **publish** and one to **subscribe**. Both subscribe to the adapter's channels.
4. **Server 1 delivers locally and publishes** — Alice comments again. Server 1 sends it to Bob as before, *and* publishes the packet to Redis.
5. **Redis fans it out** — Redis pushes the message to every subscribed server. Server 2 receives it and emits to its own sockets in `post:42`, Charlie and Dia. Everyone sees the comment, and your `emit` code didn't change.
:::

:::callout[Key Concept]{type="note"}
**Pub/Sub**: `PUBLISH channel message` delivers the message instantly to every connection that ran `SUBSCRIBE channel`. It's fire-and-forget. Nothing is stored, so a server that's offline at that moment misses the message.

A connection in subscribe mode can only run Pub/Sub commands. That's why the adapter needs a **second client**, made with `pubClient.duplicate()`.
:::

### Pub/Sub in ioredis, by itself

```js title="pubsub-demo.js"
const sub = redis.duplicate();                 // dedicated subscriber connection
await sub.subscribe("post:42:events");
sub.on("message", (channel, message) => {
  console.log(channel, JSON.parse(message));   // post:42:events { type: 'like', by: 'user:7' }
});

await redis.publish("post:42:events", JSON.stringify({ type: "like", by: "user:7" }));
// returns the number of subscribers that received it
```

### The Socket.IO Redis adapter

```js title="server.js"
// npm i socket.io @socket.io/redis-adapter ioredis
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import app from "./app.js";

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();       // subscriber mode needs its own connection

const httpServer = createServer(app);
const io = new Server(httpServer, {
  adapter: createAdapter(pubClient, subClient),
});

io.on("connection", (socket) => {
  socket.on("post:join", (postId) => socket.join(`post:${postId}`));
  socket.on("comment:new", (c) => {
    io.to(`post:${c.postId}`).emit("comment:added", c); // now reaches EVERY server
  });
});

httpServer.listen(process.env.PORT ?? 3000);
```

:::callout{type="warning"}
**You still need sticky sessions.** Socket.IO can start with HTTP long-polling before upgrading to WebSocket, and those polling requests must reach the same server, or you'll see HTTP 400 "Session ID unknown". Enable stickiness on the load balancer (ALB target-group stickiness, nginx `ip_hash`), or connect with `io(url, { transports: ["websocket"] })`.
:::

:::callout{type="tip"}
On Redis 7+, the Socket.IO docs recommend the **sharded adapter** (`createShardedAdapter`, built on sharded Pub/Sub) for new projects, especially with Redis Cluster. With an adapter in place, `io.fetchSockets()` and `io.in(room).fetchSockets()` work across servers too. A background worker without a Socket.IO server can emit events through Redis with `@socket.io/redis-emitter`.
:::

### Central storage: who's online right now?

The adapter only *relays* messages. It doesn't give your REST API an answer to "how many people are watching?" or "is user 9 online?". Keep that state in Redis yourself with a **hash** (sockets per user, since one user can have several tabs) and a **set** (online users).

```js title="socket/presence.js"
io.on("connection", async (socket) => {
  const userId = socket.data.userId;

  // count this user's open sockets (tabs, phone + laptop…)
  const tabs = await redis.hincrby("presence:sockets", userId, 1);
  if (tabs === 1) await redis.sadd("online:users", userId);   // first socket → online

  socket.on("disconnect", async () => {
    const left = await redis.hincrby("presence:sockets", userId, -1);
    if (left <= 0) {
      await redis.multi()
        .hdel("presence:sockets", userId)
        .srem("online:users", userId)
        .exec();
    }
  });
});

// anywhere: a REST route, another server, a cron job
const onlineCount = await redis.scard("online:users");              // 1284
const isOnline = await redis.sismember("online:users", userId);     // 1 or 0
```

:::callout{type="warning"}
If a server crashes, its `disconnect` handlers never run, and those users look online forever ("ghost users"). Production setups add a heartbeat: each server refreshes a key like `presence:server:` with a short TTL and cleans up users belonging to servers whose key expired. Or each user gets `presence:user:` with `EX 60`, refreshed by a client ping.
:::

:::quiz
Why does the Redis adapter need two ioredis clients (pub and sub)?

- [x] A connection in SUBSCRIBE mode can only run Pub/Sub commands, so publishing needs a separate connection
- [ ] One client is a backup in case the other fails

> Hence `pubClient.duplicate()`: same config, separate connection.
:::

:::quiz
With the Redis adapter set up, does Redis store the list of rooms and sockets?

- [ ] Yes, Redis keeps all room membership permanently
- [x] No. It only relays messages through Pub/Sub, so you store presence yourself with sets and hashes

> Room membership stays in each server's memory. Redis is the message bus between servers.
:::
