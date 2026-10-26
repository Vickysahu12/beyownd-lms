## The viral post that killed the database

*Start with the problem: lakhs of people reading the same data at the same time*

Picture a social app built with Express and MongoDB, the kind you have already built in class. Users write posts. Others read, like and comment. Every time someone opens a post, the server runs `Post.findById(id)` and sends the result back.

One evening, a student from Bhopal posts a meme about exam results. It gets forwarded on WhatsApp groups and Instagram stories. Within ten minutes, **2 lakh people** open the same post. Step through what happens to the server.

<!-- TODO widget: story diagram "From a quiet evening to a crashed database" (animated in the original note) -->
:::steps
1. **A normal evening** — About 50 people open post #42 per minute. Each view sends one request to Express, which runs one MongoDB query. The connection pool is almost empty and responses take ~20 ms.
2. **The post goes viral** — The meme gets forwarded everywhere. Suddenly 2,00,000 people open it within a minute, about 3,300 requests every second, all for the same URL: `GET /posts/42`.
3. **Same question, asked again and again** — Look at what each request asks the database: `Post.findById(42)`. The caption, image and author haven't changed, so every one of those queries returns exactly the same document. The database still does the full work every single time.
4. **Connections run out** — The pool has 100 connections. All 100 are busy, so new queries wait in a queue. Response time climbs from milliseconds to seconds. People see a spinner and hit refresh, which sends *even more* requests. This is called a **retry storm**.
5. **The database falls over** — CPU is pinned at 100%, the queue overflows and queries time out. Every feature shares this database, so login, feed and notifications go down too, not just the viral post.
6. **The real problem** — We are reading the **same unchanged data** from the most expensive place we have, lakhs of times. What we need is a ready copy kept somewhere much cheaper to read, close to our servers. That copy is called a **cache**.
:::

:::callout[Key Concept]{type="note"}
A **read-heavy hotspot** is a small piece of data that a huge number of users read at the same moment. The data barely changes, but the database pays the full price for every read. Product pages during a sale, results day, IPL live scores and trending posts are all read-heavy hotspots.
:::

:::quiz
In the viral post story, what actually crashed the database?

- [ ] The post's data was too large for MongoDB to store
- [x] Lakhs of identical read requests used up every DB connection and all the CPU

> The document was tiny. The damage came from reading it lakhs of times in a few minutes.
:::

:::quiz
Why does the whole app go down, and not just the viral post page?

- [x] Login, feed and every other feature share the same database and its connection pool
- [ ] Express automatically stops all routes when one route becomes slow

> One hot route starves a shared resource, and every other route that needs that resource starts timing out as well.
:::

## Why the database chokes

*Work per read, connection pools, and the simple math behind the crash*

### Every read is real work

A database is built to store data safely on disk and to answer *any* question you can ask about it. That flexibility costs work on every query, even a simple `findById`. Watch both pipelines run. Each lit chip is one stage of work.

<!-- TODO widget: What one read costs -->

### The connection pool is a fixed number of counters

Your Node app doesn't open a fresh database connection per request. It keeps a **pool**. The MongoDB Node driver (which Mongoose uses) defaults to `maxPoolSize: 100`, and PostgreSQL defaults to `max_connections = 100`. A query holds one connection until it finishes. When all of them are busy, the next query waits in a queue.

:::callout[Analogy]{type="note"}
Think of a bank branch with a fixed number of counters and a token machine. If customers arrive faster than counters free up, the waiting hall fills. People who give up and come back (users hitting refresh) make the line even longer.
:::

### Do the math

The rough ceiling of any pool is **connections ÷ time per query**. With 100 connections and 20 ms per query, that's `100 ÷ 0.020 = 5,000` queries per second on a good day. A post page usually needs more than one query (post, author, top comments, "did I like this?"). Move the slider to see what viral traffic does to that ceiling.

:::interactive[Load calculator: what viral traffic does to the database]{src="assets/load-calculator.html" height=460}
Move the slider, then switch the cache on.
:::

:::callout{type="tip"}
The numbers are illustrative. Real limits depend on hardware, indexes and query shape. What matters is the shape of the curve: **past 100% utilisation, waiting time doesn't grow slowly, it keeps growing until requests time out.** A 95% cache hit ratio drops the database back to a comfortable load.
:::

So we want a copy of hot data that is (1) far cheaper to read than the database, (2) shared by every server instance we run, and (3) able to forget old data on its own. That's exactly the job Redis was built for.

:::quiz
A pool has 100 connections and each query takes 50 ms. Roughly how many queries per second can it serve at best?

- [x] About 2,000
- [ ] About 5,000

> `100 ÷ 0.05 s = 2,000`. Slower queries lower the ceiling, which is why a database under load gets worse quickly.
:::

:::quiz
When database utilisation goes past 100%, what happens to response time?

- [ ] It rises a little and then levels off
- [x] Requests pile up in the queue and waiting time keeps growing until they time out

> If more work arrives per second than the system can finish, the queue never drains. Every second adds more waiting requests.
:::
