# Tech Stack Decisions — "Why did you choose X?"

## How I chose (say this first — it shows a process, not a preference)

"I followed the same questions companies use: what the team already knows, what the problem actually needs, proven ('boring') technology over trendy, build vs buy, and how reversible each decision is. I spent the innovation budget on the product — verifiable credentials — not on infrastructure."

The ideas behind this: **"Choose Boring Technology"** (Dan McKinley), Amazon's **one-way vs two-way doors**, and **monolith first** (Shopify and Stack Overflow still run large monoliths).

## Each decision with its trade-off

| Choice | Why | Trade-off I accepted | Alternative considered |
| --- | --- | --- | --- |
| **Node.js + Express + TypeScript** | Ship fast in a stack I know, huge ecosystem, TS catches bugs at compile time | Single-threaded → CPU-heavy work (PDFs) must go to a worker | NestJS (more structure, slower to start), Go (faster, but I'd be learning while shipping) |
| **Layered architecture** (routes → validators → controllers → services → models) | Each layer has one job; services are testable without HTTP; features are added without touching others | More files per feature | Fat controllers (faster at first, unmaintainable later) |
| **MongoDB (Atlas)** | Flexible content documents (lessons, quizzes), managed backups, team familiarity | Data is fairly relational (users ↔ enrollments ↔ payments ↔ credentials) → I design references + indexes carefully and use transactions where money is involved | **PostgreSQL** — honestly a slightly better fit for relational data; I kept Mongo because auth was already built on it and switching cost days before a hard deadline |
| **Redis** | One tool, five jobs: OTP with TTL, rate-limit counters, cache, refresh-token sessions, BullMQ queue | In-memory → not the source of truth; anything important is also in Mongo | Memcached (cache only), DB tables for OTPs (needs a cleanup job) |
| **BullMQ worker** | PDF generation and emails are slow; moving them off the request path keeps API latency flat; retries built in | One more process to deploy and monitor | Generating PDFs inside the request (blocks the event loop) |
| **JWT access (15 min) + refresh (7 d, httpOnly cookie, rotated)** | Stateless auth for every request, refresh token unreachable from JS (XSS), rotation + Redis lets me revoke | Slightly more complex than sessions | Server sessions only (simpler, but a DB/Redis hit every request); one long-lived token in localStorage (insecure) |
| **Email OTP + Google sign-in** | Google is the natural login on Android phones; OTP proves email ownership | Email OTP depends on deliverability → verified domain | SMS OTP (costs per message) |
| **Razorpay** | Standard in India, UPI support (what our students actually use) | Webhooks must be verified and idempotent | Stripe (weaker for UPI-first Indian users) |
| **Next.js** | Server rendering → fast first page on cheap phones and slow networks; SEO for landing + verify pages | Framework complexity | Plain React SPA (slow first load on 4G) |
| **YouTube embeds, Cloudflare R2 for PDFs** | Buy, don't build: free adaptive video; cheap object storage with no egress fees | Less control over video | Self-hosting video (expensive, slow on mobile) |
| **Docker Compose on a VPS + Vercel** | Reproducible environments, simple ops for one developer, cheap | Single VPS is a single machine → mitigated with Atlas (managed DB) and quick redeploy | Kubernetes (premature at 1k users) |

## Likely questions

**"Why not microservices?"**
"At 1,000 users and one developer, microservices add network calls, deployment and debugging cost with no benefit. I kept a modular monolith with clear domain boundaries (auth, learning, assessment, payments, credentials) and pulled out only the one piece with different resource needs — the PDF/email worker. If a domain needs to scale independently later, the boundaries already exist."

**"Mongo for payments — isn't that risky?"**
"The risk is double-processing, not the database itself. I prevent it with a unique index on the payment ID and idempotent webhook handling, and I use a Mongo transaction when activating an enrollment and recording the payment together."

**"Why both JWT and Redis — isn't JWT supposed to be stateless?"**
"Access tokens are stateless, so most requests never touch Redis for auth. Refresh tokens are stored so I can rotate and revoke them — pure stateless JWT can't do logout properly. It's a deliberate hybrid."
