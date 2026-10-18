# Beyownd — Auth Module: Complete Technical Walkthrough

This doc explains exactly what got built, and specifically **how Redis + Docker actually worked today** — written so you can explain it confidently in an interview, not just recite that it "works."

---

## Part 1: Redis + Docker — what actually happened, step by step

### What is Redis, really?

Redis is an **in-memory data store** — meaning it keeps data in RAM instead of on disk like MongoDB does. RAM reads/writes are dramatically faster than disk reads/writes. The trade-off: RAM is more expensive and data can be lost if the process restarts (unless configured to persist) — so Redis is used for **fast, often-temporary data**, not your permanent source of truth. That's exactly why OTPs live in Redis and not MongoDB: an OTP is inherently temporary (10-minute life), accessed extremely frequently during that window, and totally fine to lose if the server restarts (user just requests a new one).

### What is Docker, concretely (now that you've actually run it)

A **container** is an isolated, pre-packaged environment — like a lightweight virtual machine, but much faster to start, that bundles an application with everything it needs to run (its own tiny filesystem, dependencies, config) so it behaves identically no matter what computer it runs on.

An **image** is the "recipe" — a read-only template. A **container** is a running instance of that image — like a class vs. an object in programming, if that comparison helps: `redis` (the image) is the blueprint; `beyownd-redis` (your container) is the actual running thing.

### What your exact command did, line by line

```bash
docker run -d -p 6379:6379 --name beyownd-redis redis
```

Walking through what you actually watched happen in your terminal:

1. **`redis` at the end** — Docker looked for an image called `redis` locally first. It wasn't there (`Unable to find image 'redis:latest' locally`), so Docker automatically went to **Docker Hub** (a public registry of images, think of it like npm but for container images) and downloaded the official Redis image. Those `Pull complete` lines you saw were Docker downloading the different filesystem layers that make up that image.
2. **`-d`** (detached) — once the container starts, don't block your terminal waiting for it; run it in the background so you can keep using that terminal window for other commands.
3. **`-p 6379:6379`** — this is **port mapping**, and it's one of the most important Docker concepts to understand properly. The container has its own isolated network — by default, nothing outside the container can reach into it. This flag says: "take port 6379 on my actual laptop, and forward any traffic on it into port 6379 inside the container" (Redis's default port). Without this flag, Redis would be running *inside* the container, completely unreachable from your Node.js app running *outside* the container.
4. **`--name beyownd-redis`** — Docker would otherwise assign a random name like `nostalgic_turing`. Naming it lets you reference it later with simple commands instead of hunting for a random ID.
5. **The long hash printed at the end** (`9031067c2ac2...`) — that's the unique **container ID**, Docker's internal identifier for this specific running instance.

### `docker ps` — what you confirmed

This lists all **currently running** containers. You saw:

```
CONTAINER ID   IMAGE   STATUS          PORTS
9031067c2ac2   redis   Up 44 seconds   0.0.0.0:6379->6379/tcp
```

The `PORTS` column is confirming the mapping from step 3 above actually worked — your machine's `6379` is genuinely wired to the container's `6379`.

### How your Node.js app actually talks to it

In `config/redis.ts`, this line:

```typescript
export const redisClient = new Redis(env.redisUrl);
```

where `REDIS_URL=redis://localhost:6379` in your `.env`. Your Node process is running **outside** Docker, directly on your machine — it connects to `localhost:6379`, which (because of the port mapping) transparently reaches into the container. Your app has no idea Redis is "in a box" — as far as it's concerned, it's just talking to a normal Redis server on your machine.

### `docker start` vs `docker run` — the distinction that will save you confusion later

- `docker run` → creates a **brand new** container from an image. Running it again creates a *second, separate* Redis instance (and would fail here since the name `beyownd-redis` is already taken).
- `docker start beyownd-redis` → resumes the **existing** container you already created, after it stopped (e.g., because you closed Docker Desktop). This is what you'll use on any future day once the container already exists.

### How this connects to what's coming (system design doc, revisited)

This exact same pattern — image, container, port mapping — is what your `Dockerfile` and `docker-compose.yml` will do for your **own** API and worker services later, except instead of pulling a public image like `redis`, Docker will *build* an image from your own code. Same underlying mechanism, just building instead of pulling.

---

## Part 2: Auth Module — is it actually complete? Yes, with one honest caveat

**Status: functionally complete and testable end-to-end**, except Google OAuth, which is *code-complete* but can only be *verified* once the frontend exists (explained below — this is correct engineering practice, not a shortcut).

### The full flow, in plain words (this is your interview answer)

**Signup (local):**

1. User submits name/email/password → `express-validator` checks format (email pattern, password complexity) *before* any of this reaches business logic
2. `auth.service.ts` checks if the email already exists in MongoDB
3. New `User` document created with `authProvider: 'local'`, `isVerified: false` — the `pre('save')` hook on the model hashes the password automatically before it's stored
4. A 6-digit OTP is generated, stored in **Redis** with a 10-minute auto-expiry (`SET key value EX 600`), and emailed via **Resend**

**OTP verification:** 5. User submits the OTP → looked up in Redis, compared, and deleted immediately on match (one-time use — can't be replayed) 6. On success, `User.isVerified` flips to `true`, and the server issues **two JWTs**: a short-lived access token (15 min) returned in the response body, and a long-lived refresh token (7 days) set as an **httpOnly cookie** (unreachable by JavaScript, protecting it from XSS)

**Login:** 7. Email + password checked against the stored bcrypt hash via the model's `comparePassword` method 8. Blocked if `isVerified` is still `false` — can't log in without completing OTP 9. Same token pair issued again on success

**Token refresh (silent, background):** 10. When the 15-minute access token expires, the frontend calls `/refresh`, which reads the refresh token from the httpOnly cookie, verifies it, and issues a *new* access token — no re-login needed until the 7-day refresh token itself expires

**Protecting future routes:** 11. `auth.middleware.ts`'s `protect` function will guard every future route that needs a logged-in user (courses, quizzes, leaderboard) — it verifies the access token from the `Authorization: Bearer <token>` header and attaches the real user to `req.user` 12. `restrictTo('admin')` will guard admin-only routes later (e.g., viewing the cohort dashboard)

**Google OAuth — why "code-complete, not test-complete" is the correct status:** `googleAuth.util.ts` is written and structurally correct — it calls Google's own verification library to check a token's authenticity. But that token can *only* be produced by Google's Sign-In button running in an actual browser with a real `GOOGLE_CLIENT_ID` — something that doesn't exist until the Next.js frontend is built. Marking this "done" before that would mean claiming something works that was never actually run. The honest, correct status is: **built, wired, pending real-environment verification** — that's a legitimate distinction to make in an interview too, and shows you understand the difference between "written" and "verified."

### Why this design choices are defensible in an interview

- **Layered architecture** (routes → validators → controllers → services → models) means every piece has exactly one job — you can point to any file and say precisely what it does and why it's not doing something else
- **Redis for OTPs** instead of MongoDB — shows you picked the right tool for a temporary, high-frequency-access, auto-expiring piece of data instead of defaulting to your main database for everything
- **Access + refresh token split** with httpOnly cookie for the refresh token — a real security-conscious pattern, not the common beginner mistake of one long-lived token stored in localStorage
- **OTP one-time-use enforcement** (deleted from Redis immediately on match) — shows awareness of replay-attack prevention, a detail many tutorials skip

---

## What's genuinely left before this module is "done done"

- Rate limiting on `/login` and `/signup` (brute-force protection) — not yet built
- Google OAuth real-environment test — waits on frontend
- Automated tests (`tests/auth.test.ts`) — not yet written