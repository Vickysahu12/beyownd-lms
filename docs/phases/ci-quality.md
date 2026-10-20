# CI & Code Quality — ESLint + GitHub Actions

**Dates:** Oct 20, 2026
**Status:** ✅ Built (first CI run happens on the next push)
**Tasks:** B1, B2 in [../REMAINING.md](../REMAINING.md)

## Why

Until now the 129 tests only ran when someone ran them by hand. A broken change could reach GitHub unnoticed. In the Plan → Code → **Build** → Test → Ship cycle, this is the "Build" stage: every push is checked automatically, by a machine, the same way every time.

## What was built

| Piece | File | What it does |
| --- | --- | --- |
| ESLint | [beyownd-backend/eslint.config.mjs](../../beyownd-backend/eslint.config.mjs) | Reads the code without running it. Type-aware rules (uses the TypeScript compiler) |
| Scripts | [beyownd-backend/package.json](../../beyownd-backend/package.json) | `npm run lint`, `npm run lint:fix`, `npm run check` (lint + typecheck + tests) |
| CI pipeline | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | On every push/PR touching `beyownd-backend/`: Node 20 + Redis service → `npm ci` → lint → typecheck → tests |
| Badge | [docs/README.md](../README.md) | Green/red CI status at the top of the repo page |

### ESLint rules — what's on and why

| Rule | Catches |
| --- | --- |
| `no-floating-promises` | An `async` call without `await` — its errors vanish and steps run out of order (the most expensive bug class for payments and emails) |
| `no-misused-promises` | A promise used where a boolean/void is expected, e.g. `if (asyncFn())` (always true) |
| `await-thenable` | `await` on something that isn't a promise |
| `no-unused-vars` | Dead code and leftover imports |
| `eqeqeq` | `==` instead of `===` |
| `no-console` (warn) | `console.log` instead of the structured logger |
| `typescript-eslint` recommended-type-checked | Unnecessary casts, unsafe string conversions, redundant types, etc. |

Deliberately off: the `no-unsafe-*` family and `no-explicit-any` — third-party payloads (Razorpay webhooks, Mongo errors) are untyped at the edges, and these rules would be noise, not bug-finders, for this codebase.

### The pipeline

```text
git push ──► GitHub Actions (ubuntu-latest, fresh machine each time)
               ├─ Redis 7 service container (health-checked)
               ├─ Node 20, npm cache
               ├─ MongoDB test binary cache (mongodb-memory-server, ~100 MB, downloaded once)
               ├─ npm ci            (exact versions from package-lock.json)
               ├─ npm run lint
               ├─ npm run typecheck
               └─ npm test -- --ci  (129 tests, in-memory MongoDB replica set + real Redis)
             ──► ✅ / ❌ on the commit, details in the Actions tab
```

- Runs only when backend files or the workflow change (frontend-only pushes don't trigger it).
- A newer push cancels an older run still in progress on the same branch.
- `permissions: contents: read` — the job can't write to the repo.
- "Run workflow" button available (`workflow_dispatch`) for manual re-runs.

## What the first lint run found (26 problems → 0)

| Finding | Real issue? | Fix |
| --- | --- | --- |
| `startServer()` called without handling its promise (`server.ts`) | Yes (minor — errors were handled inside, but it was invisible to readers) | `void startServer()` — explicit and documented |
| A variable typed `unknown` converted with `String()` (`payment.service.ts`, refund path) | Yes — type unsafety; worked only because the value happened to be an ObjectId | Typed as `Types.ObjectId \| null` |
| **Invisible Unicode characters** inside the PDF text-sanitizer regex (`document.service.ts`) — a no-break space and smart quotes written as literal characters | Yes — correct at runtime but unreadable and fragile in review | Rewritten as ASCII escape codes (`‘`, ` `, …) |
| Health check assigned a value that was never read; compared `readyState` with a magic number | Code smell | Promise `.then/.catch` form; `mongoose.ConnectionStates.connected` |
| Redundant union type `DocumentJobName \| string`; unused imports | Cleanup | Removed |
| 13 unnecessary type assertions (`matchedData(...) as X`) | Cleanup | Typed generics: `matchedData<X>(...)` (auto-fix + manual) |

Lint ✅ · typecheck ✅ · **129 / 129 tests passing** after the fixes (`npm run check`, Oct 20) — the cleanup changed no behaviour.

## How to use it

```bash
cd beyownd-backend
npm run lint        # check
npm run lint:fix    # auto-fix what can be fixed
npm run check       # everything CI runs (needs Redis: docker start beyownd-redis)
```

On GitHub: each commit shows 🟡 (running) → ✅ / ❌. Click it → **Details** to see the failing step and test. The full history is in the **Actions** tab.

## Next (Phase 6)

- Add **CD**: when CI is green on `main`, build the Docker image and deploy.
- Add a **frontend job** (lint + typecheck + build) once the frontend session is ready.
- Optional: branch protection on `main` so a red build can't be merged.
