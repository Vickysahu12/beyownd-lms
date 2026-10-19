# Beyownd — What's Left Until Launch

**Updated:** Oct 19, 2026 · **Go-live:** Nov 6, 2026 (18 days) · **Diwali:** Nov 8

**Owners:** 🤖 **Backend** = backend Claude session · 🎨 **Frontend** = frontend Claude session · 🙋 **You** = only the owner can do it

**Status:** ✅ done · 🟡 in progress · ⏳ not started · 🔴 launch blocker

**Who updates what:** backend session → §2 only · frontend session → §3 only · owner's tasks (§1) and launch (§4) → updated when the owner tells a session they're done.

---

## 0. Where we are

| Area | Progress | Notes |
| --- | --- | --- |
| Backend | **~75%** | Auth, onboarding, courses, quizzes, project, payments, documents built — 129 tests passing, all pushed |
| Frontend | **~10%** | Landing page: nav ✅ + hero ✅; rest of the landing and the whole app pending |
| Non-code (business) | **~5%** | Registration, KYC, domain, course content all pending — **the biggest launch risk** |

```text
Backend   [██████████████░░░░░░] 75%
Frontend  [██░░░░░░░░░░░░░░░░░░] 10%
Business  [█░░░░░░░░░░░░░░░░░░░]  5%
```

---

## 1. 🙋 You — business and content (start these first; they take days)

| # | Task | Status | Why it matters | Target |
| --- | --- | --- | --- | --- |
| Y1 | **Register GrewDo** (talk to a CA: Pvt Ltd vs Udyam/proprietorship first) | ⏳ 🔴 | No payments or letters without a registered entity; colleges check it | Start **today** |
| Y2 | **Razorpay live KYC** (business name GrewDo, display name Beyownd) | ⏳ 🔴 | No real money without it. Needs Y1 + a live website + policy pages | After Y1 |
| Y3 | **Buy domain** `beyownd.in` + business email (e.g. `hello@beyownd.in`) | ⏳ 🔴 | Deployment, emails, verify links all depend on it | Oct 21 |
| Y4 | **Resend:** verify the domain + move to a paid plan | ⏳ 🟡 | Free plan's daily limit could stop OTP emails on launch day | Oct 28 |
| Y5 | **Policy texts:** Terms, Privacy, Refund & Cancellation, Contact (legal party: GrewDo) | ⏳ 🟡 | Razorpay requires them; footer links to them | Oct 26 |
| Y6 | **Letter details:** GrewDo registration no., address, signatory name, `logo.png`, `signature.png` | ⏳ 🟡 | Placeholders print on PDFs until then | Oct 30 |
| Y7 | **Ask 2–3 college TPOs** what internship letter format they accept | ⏳ 🟡 | We match the PDF templates to it | Oct 24 |
| Y8 | **Real course content** for at least 1 program: 3–5 modules, 15–25 lessons, 1 quiz per module (5–10 questions), final project brief + rubric | ⏳ 🔴 | **Students pay for this.** Several days of writing — do it in Google Docs/Notion in parallel | Nov 1 |
| Y9 | **Decide batch dates + price** for the first batch (use onboarding "certificate needed by" answers) | ⏳ 🟡 | Needed to create the first cohort | Oct 30 |
| Y10 | **Illustrations** for the landing page (clouds, sun, plane/balloon, certificate) — own or licensed | 🟡 | Frontend uses placeholders until then | Oct 25 |
| Y11 | **Beta testers:** line up 10–20 students from your community | ⏳ 🟡 | Beta runs Nov 4–5 | Nov 1 |
| Y12 | **Read and understand the code** for auth + payments (interview docs + ask the backend session to walk you through) | ⏳ 🟡 | If it breaks at 2 a.m., you need to be able to debug it | Ongoing |

## 2. 🤖 Backend

| # | Task | Status | Est. | Notes |
| --- | --- | --- | --- | --- |
| B1 | **CI: GitHub Actions** (lint + typecheck + 129 tests on every push) | ⏳ | 1 h | The "Build" step — red ❌ if anything breaks |
| B2 | **ESLint** setup + fix findings | ⏳ | 30 min | Runs inside B1 |
| B3 | **Phase 3C — Mentor review:** review queue, approve / request changes, rubric scores | ⏳ | 0.5 day | Mentor role already exists |
| B4 | **Phase 3C — Course completion:** all modules + project approved → enrollment `completed` | ⏳ | 2 h | |
| B5 | **Phase 3C — Certificate + completion letter** issued after approval **and** batch end date (D2) — scheduled job | ⏳ | 3 h | Document system already built |
| B6 | **Phase 5 — Admin APIs (essentials):** create/edit course, modules, lessons, quizzes; cohorts; students list + search; revoke credential; refund marking; basic stats; audit log | ⏳ | 1–1.5 days | Needed to load Y8 content without the seed script |
| B7 | **Content import script** (fallback): load a course from a JSON/Markdown file | ⏳ | 2 h | Backup if admin UI isn't ready in time |
| B8 | **Phase 6 — Docker:** Dockerfile (API + worker), `docker-compose.yml` (api, worker, redis, nginx) | ⏳ | 3 h | Graceful shutdown finally verified on Linux here |
| B9 | **Phase 6 — Cloudflare R2** storage (swap `storage.util.ts`) | ⏳ | 2 h | Needs a Cloudflare account (🙋) |
| B10 | **Phase 6 — Deploy:** VPS + Nginx + HTTPS for `api.beyownd.in`; separate **production** Atlas database; Razorpay webhook URL; production `.env` | ⏳ | 0.5 day | Needs Y3 + a VPS (🙋 buys it) |
| B11 | **Phase 6 — Staging environment** (copy of production with test keys) | ⏳ | 2 h | Real Razorpay test payments + real emails end-to-end |
| B12 | **Phase 6 — Monitoring:** Sentry, uptime monitor, Atlas backups, Redis persistence | ⏳ | 2 h | |
| B13 | **Phase 6 — Load test (k6):** 300 req/s, login burst, quiz burst, webhook replay | ⏳ | 3 h | **Proves** the 1,000-user claim |
| B14 | **Phase 6 — Security pass:** OWASP checklist, secrets, headers, rate limits, issuer placeholders gone | ⏳ | 2 h | |
| B15 | **CD:** auto-deploy when CI is green | ⏳ | 1 h | After B8–B10 |

**Backend total remaining: ~5–6 working days.**

## 3. 🎨 Frontend

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| F1 | Landing: nav | ✅ | |
| F2 | Landing: hero | ✅ | |
| F3 | Landing: problem, how it works, programs, what you get, verify demo, pricing, FAQ, final CTA, footer (GrewDo line) | ⏳ | BRIEF §5.3–5.11 |
| F4 | Policy pages (Terms, Privacy, Refund, Contact) | ⏳ | Needs Y5 text |
| F5 | App setup: API client, single-flight token refresh, TanStack Query, auth context | ⏳ | BRIEF §10.1 |
| F6 | Signup / login / OTP / Google / forgot + reset password | ⏳ | APIs ready ✅ |
| F7 | Onboarding (2 steps, college autocomplete) | ⏳ | APIs ready ✅ |
| F8 | Program page + free preview + batch picker | ⏳ | APIs ready ✅ |
| F9 | Checkout (Razorpay Checkout + verify) | ⏳ | APIs ready ✅ |
| F10 | Dashboard, program dashboard, lesson player | ⏳ | APIs ready ✅ |
| F11 | Quiz + project submission | ⏳ | APIs ready ✅ |
| F12 | My documents + public verify page `/verify/:id` | ⏳ | APIs ready ✅ |
| F13 | Profile | ⏳ | APIs ready ✅ |
| F14 | Admin UI (minimal): content editor, cohorts, review queue, students | ⏳ | Needs B3, B6 |
| F15 | Deploy on Vercel (`beyownd.in` + `classroom.beyownd.in`) | ⏳ | Needs Y3 |
| F16 | Performance + accessibility pass (Lighthouse ≥ 90, 360 px, reduced motion) | ⏳ | BRIEF §8 |

## 4. 🚀 Launch

| # | Task | Owner | Target |
| --- | --- | --- | --- |
| L1 | Load real course (Y8) + create first batch (Y9) | You + Backend | Nov 2 |
| L2 | Full end-to-end run on staging: signup → pay (test) → learn → quiz → project → review → certificate → verify | All | Nov 3 |
| L3 | Switch Razorpay to **live** keys, final security check | You + Backend | Nov 4 |
| L4 | **Beta** with 10–20 students (real payments or coupons) | You | Nov 4–5 |
| L5 | Fix beta issues | All | Nov 5 |
| L6 | 🚀 **Go-live** | You | **Nov 6** |

---

## 5. Timeline

```text
Oct 19     Backend: B1-B2 (CI + lint) · B3-B5 (Phase 3C)          | Frontend: landing sections   | You: Y1 CA call, Y3 domain
Oct 20-21  Backend: B6-B7 (admin APIs + import)                    | Frontend: landing done, F5-F7 | You: Y7 TPOs, Y8 content
Oct 22-24  Backend: B8-B12 (Docker, R2, deploy, staging, monitor)  | Frontend: F8-F11             | You: Y5 policies, Y8 content
Oct 25-27  Backend: B13-B15 (load test, security, CD)              | Frontend: F12-F14            | You: Y2 KYC, Y4 Resend
Oct 28-Nov 1  Connect frontend ↔ backend on staging, fix bugs      | Frontend: F15-F16            | You: Y6, Y9, Y11, finish Y8
Nov 2-3    L1-L2 real content + full end-to-end test
Nov 4-5    L3-L5 live keys, beta, fixes
Nov 6      🚀 L6 launch
```

## 6. Biggest risks (honest)

| Risk | Impact | What reduces it |
| --- | --- | --- |
| GrewDo registration / Razorpay KYC not done in time | 🔴 Can't take money | Start Y1 today; ask CA for the fastest valid route |
| Course content not ready | 🔴 Nothing to sell | Write Y8 in parallel from now; one program is enough for launch |
| Frontend app (F5–F14) is large | 🟡 Launch slip | APIs are ready and documented; frontend session works screen by screen |
| 1,000-user claim unproven | 🟡 Slow site on launch day | B13 load test before launch |
| Owner can't debug in production | 🟡 Long outages | Y12 + monitoring (B12) |

**Not in launch scope** (after Diwali): leaderboard, streaks & badges, Judge0 code execution, lesson comments, notifications, portfolio page, search, coupons, certificate grades.
