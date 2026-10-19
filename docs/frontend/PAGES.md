# Beyownd Frontend — Every Page, How to Build It, and SEO

**For:** the frontend session. Read after [BRIEF.md](BRIEF.md) (design, motion, stack, rules) — this file adds **which pages exist, what each one contains, how it renders, which API it uses, and how it's found on Google**.
**Status:** written Oct 20, 2026. The landing page (`/`) is almost done; everything below is what's left.
**APIs:** [../design/api-routes.md](../design/api-routes.md) — every endpoint, response and error code. ✅ = backend built and tested.

---

## 1. The map

```text
beyownd.in  (marketing — public, server-rendered, indexed by Google)
├── /                                   Landing                              ✅ almost done
├── /programs                           All programs
├── /programs/[slug]                    Program detail (syllabus, batches, price, enroll)
├── /programs/[slug]/preview/[lessonId] Free preview lesson
├── /for-colleges                       For TPOs / HODs: how verification works, letter format
├── /verify                             Enter a credential ID
├── /verify/[credentialId]              Public verification result         (NOT indexed — personal data)
├── /about                              About Beyownd + GrewDo
├── /faq                                Full FAQ
├── /contact                            Contact details
├── /terms · /privacy · /refund-policy · /delivery-policy     Legal (Razorpay requires these)
└── 404 · error

classroom.beyownd.in  (student app — login, client-heavy, NEVER indexed)
├── /login · /signup · /verify-email · /forgot-password · /reset-password
├── /onboarding                         2 steps
├── /dashboard                          My programs + documents
├── /enroll/[slug]/[cohortId]           Checkout (Razorpay)
├── /enroll/[slug]/[cohortId]/status    Payment result
├── /learn/[enrollmentId]               Program dashboard (modules, progress)
├── /learn/[enrollmentId]/lessons/[lessonId]
├── /learn/[enrollmentId]/modules/[moduleId]/quiz
├── /learn/[enrollmentId]/project
├── /documents                          My documents (download)
├── /payments                           Payment history / receipts
├── /profile                            Profile + certificate name
├── /review · /review/[submissionId]    Mentor review queue         (after backend B3)
└── /admin/...                          Admin panel                 (after backend B6)
```

### Routing setup (Next.js 16, one project)

- Route groups: `src/app/(marketing)/…` and `src/app/(app)/…`.
- **Local dev:** both on `http://localhost:3000`; app routes live under `/app/…` (e.g. `/app/login`) — the backend CORS allows exactly this origin. `src/lib/site.ts` `CLASSROOM_URL` already handles the prefix.
- **Production:** host-based rewrite — requests to `classroom.beyownd.in/<path>` are served by the `(app)` routes. Next.js 16 renamed `middleware.ts` to `proxy.ts`; check the version's docs before writing it. Marketing host must never serve app routes and vice versa (redirect if hit on the wrong host).
- Every link between the two surfaces goes through `src/lib/site.ts` — never hard-code a host.

---

## 2. Rendering rules (decide per page, don't default to client components)

| Kind of page | Rendering | Why |
| --- | --- | --- |
| Marketing, static content (`/`, `/about`, `/for-colleges`, legal, `/faq`) | **Static** (built at deploy) | Fastest possible on 4G; perfect for SEO |
| Marketing, API content (`/programs`, `/programs/[slug]`, preview lessons) | **ISR** — server-fetch with `revalidate: 600` (10 min), `generateStaticParams` for published programs | Static speed, but new batches/prices appear within minutes. Backend also caches these in Redis |
| `/verify/[credentialId]` | **Dynamic server render** on each request (`cache: 'no-store'`), `noindex` | Status can change (revoked) — never show a stale "valid"; personal data |
| App pages | Server shell + **client components** with TanStack Query; auth guard | Per-user data, behind login |

Server-side fetches for marketing pages call the API **from the server** (no CORS, no token). Keep that code in `*.server.ts` files (the pattern already exists: `src/lib/catalog.server.ts`).

---

## 3. Marketing pages (beyownd.in)

Every marketing page: shared nav + footer, sky/cream section rhythm, serif heading with one highlighted word (BRIEF §4), at least one purposeful interaction (BRIEF §6), full SEO block (§5 below).

### 3.1 `/` Landing — ✅ almost done
Finish per BRIEF §5 and §11. Change the nav/section anchors that should become real pages once those pages exist: "Programs" → `/programs`, "Certificates" → `/verify` (keep section anchors for in-page scroll on the landing itself).

### 3.2 `/programs` — all programs
- **Data:** `GET /api/courses` ✅ (ISR).
- **Content:** H1 "Virtual internship *programs*"; short intro; a card per program (title, tagline, duration, skills chips, "from ₹X", next batch date, seats-left hint if low); "How it works" mini-strip linking to `/#how-it-works`; FAQ teaser.
- **Empty state:** "New programs are being prepared — get notified" (no fake cards).
- **SEO:** title "Virtual Internship Programs for College Students | Beyownd"; `ItemList` JSON-LD of programs.

### 3.3 `/programs/[slug]` — program detail (the main selling page)
- **Data:** `GET /api/courses/:slug` ✅ (detail + outline), `GET /api/courses/:slug/cohorts` ✅ (batches). ISR; `notFound()` on 404.
- **Sections, in order:**
  1. Hero: title, tagline, duration, level, skill chips, "from ₹X", primary CTA **"Enroll in a batch"** (scrolls to batches), secondary **"Read Module 1 free"**.
  2. **What you'll do** — 4 steps specific to this program (learn modules → quizzes → project → documents).
  3. **Syllabus** — modules as an accordion; each shows lessons with type icon (text/video) and minutes; module 1 marked "Free preview" with links to its lessons.
  4. **Final project** — project title (from API) + what the student builds.
  5. **What you get** — offer letter, certificate, completion letter (all verifiable), mentor feedback, community.
  6. **Batches** — one card per cohort: name, start–end dates (IST), price, seats left, `enrollable` state. CTA → `classroom.beyownd.in/enroll/[slug]/[cohortId]` (signup/login first if needed — keep the target in `?next=`). Disabled state for full/closed batches; "Notify me" for none.
  7. **Certificate timing note** (honest): "Documents are issued after your batch ends and your project is approved."
  8. Program FAQ + final CTA.
- **Mobile:** sticky bottom bar with price + "Enroll" once the hero CTA scrolls away.
- **SEO:** title "`{title}` Virtual Internship | Beyownd"; description from tagline; dynamic **OG image** (`opengraph-image.tsx`) with program title + "Verifiable certificate"; JSON-LD `Course` (name, description, provider = Organization GrewDo/Beyownd, `offers` price INR, `hasCourseInstance` per batch with `courseMode: online`, `startDate`, `endDate`) + `FAQPage` + `BreadcrumbList`.

### 3.4 `/programs/[slug]/preview/[lessonId]` — free preview lesson
- **Data:** `GET /api/courses/:slug/preview/lessons/:lessonId` ✅ (403 `PREVIEW_NOT_AVAILABLE` → show "Enroll to unlock" instead of an error page).
- **Content:** lesson title, markdown body (`react-markdown` + `rehype-sanitize`, highlighted code; **never** `dangerouslySetInnerHTML`), YouTube lite facade for video lessons, prev/next within the free module, persistent "Enjoying it? Enroll" card.
- **SEO:** indexable (real educational content brings search traffic); canonical to itself; `Article`-style metadata.

### 3.5 `/for-colleges` — for TPOs, HODs and recruiters
Trust page for the people who accept the certificate.
- What the program is (honest: virtual internship program, real batch dates, mentor-reviewed project).
- **How to verify** a document: ID format, QR code, the `/verify` page — with the live verify widget from the landing.
- What the documents look like (images of the offer letter / certificate / completion letter — use real renders from the backend, no fake institutions).
- Issued by GrewDo (legal entity), registration details (from owner), contact for verification queries.
- **SEO:** "Verify Beyownd internship certificates | For colleges".

### 3.6 `/verify` and `/verify/[credentialId]`
- `/verify`: H1 "Verify a *certificate*", one input (accepts lowercase/spaces; the API normalizes), submit → `/verify/[id]`. Explainer: what's shown, that no login is needed.
- `/verify/[credentialId]`: **Data:** `GET /api/verify/:id` ✅, server-rendered per request.
  - **Valid:** green "Verified" seal (check mark draws in), document type, student name, college, program, batch dates, issued on, "Issued by GrewDo for the Beyownd Virtual Internship Program".
  - **Revoked:** clear red "Revoked" state with date — never styled like a valid result.
  - **Generating:** "This document is being issued" (neutral).
  - **Not found:** "No document found with this ID" + tips (check characters, there's no 0/O, 1/I).
  - "Copy link" and "Print" actions.
- **SEO:** `noindex, nofollow` meta + excluded from the sitemap (personal data must never appear in Google). Generic title ("Certificate verification | Beyownd") — **don't** put the student's name in `<title>` or OG tags.

### 3.7 `/about`
Mission (why Beyownd exists — the final-year internship problem), how it works in brief, **"Beyownd is a product of GrewDo"** with GrewDo's description, founder note (owner provides), contact link. No invented team members or numbers.

### 3.8 `/faq`
Full FAQ grouped (Program · Certificates & verification · Payments & refunds · Technical). Same honest answers as BRIEF §5.9, expanded. JSON-LD `FAQPage`.

### 3.9 `/contact`
Email (`ISSUER_EMAIL`), WhatsApp link, registered address (GrewDo), expected response time. **No contact form at launch** (no backend endpoint) — if one is wanted, add it to `docs/frontend/backend-requests.md`.

### 3.10 Legal: `/terms`, `/privacy`, `/refund-policy`, `/delivery-policy`
- Text comes from the owner (task Y5 in [../REMAINING.md](../REMAINING.md)); until then show a clearly marked placeholder, never invented legal text.
- Legal party is **GrewDo** (business-model.md §7). `/delivery-policy` states that the program is delivered digitally (access on payment, documents as downloadable PDFs) — Razorpay's website review usually asks for it.
- Simple readable layout: table of contents, last-updated date, anchors per section.

### 3.11 404 and error
- `not-found.tsx`: friendly sky illustration, links to Programs and Verify.
- `error.tsx` / `global-error.tsx`: "Something went wrong" + retry; never show stack traces.

---

## 4. Student app (classroom.beyownd.in)

**Every app page:** `noindex` (whole subdomain), auth guard (redirect to `/login?next=…`), onboarding guard (redirect to `/onboarding` when `user.onboardingCompleted` is false), loading skeleton matching the final layout, empty state, error state with retry, 360 px layout. API/auth rules: BRIEF §10.1 (in-memory access token, single-flight refresh, branch on `code`).

App shell: compact top bar (logo, Dashboard, Documents, profile menu) on mobile; left sidebar on desktop — like the inspiration's dashboard mock.

| Route | Purpose | API ✅ | Key states / UX |
| --- | --- | --- | --- |
| `/login` | Email + password, Google | `POST /auth/login`, `/auth/google` | `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED` → `/verify-email`, `USE_GOOGLE_SIGNIN`, `RATE_LIMITED`; honours `?next=` |
| `/signup` | Name, email, password, Google | `POST /auth/signup` | Inline password rules; `EMAIL_TAKEN`, `GOOGLE_ACCOUNT` |
| `/verify-email` | 6-digit OTP | `POST /auth/verify-otp`, `/auth/resend-otp` | 6 boxes with paste support + auto-submit; resend countdown (`OTP_COOLDOWN`); `OTP_INVALID`, `OTP_LOCKED` |
| `/forgot-password`, `/reset-password` | Reset via OTP | `/auth/forgot-password`, `/auth/reset-password` | Same message whether the email exists or not |
| `/onboarding` | 2 steps (BRIEF §10.2, user-flow.md §4) | `PUT /users/me/onboarding`, `GET /colleges?q=` | Progress indicator; draft saved locally between steps; certificate-name field explains "English letters, exactly as on your certificate"; field errors from `errors[]` |
| `/dashboard` | Home after login | `GET /enrollments`, `GET /credentials` | Program cards with % progress + "Continue"; documents summary; empty state → `/programs` |
| `/enroll/[slug]/[cohortId]` | Checkout | `GET /courses/:slug/cohorts`, `POST /enrollments`, `POST /payments/verify` | Summary (program, batch dates, price, what's included, certificate timing, refund link) → Razorpay Checkout with the returned `checkout` object; `ENROLLMENT_CLOSED`, `COHORT_FULL`, `ALREADY_ENROLLED`, `PAYMENT_PROVIDER_ERROR` |
| `/enroll/[slug]/[cohortId]/status` | After payment | `GET /enrollments` (poll a few seconds) | **Success** → "You're in" + offer-letter note; **`PAYMENT_SIGNATURE_INVALID` / pending** → "Confirming your payment…" and poll — the webhook activates it; `cohort_full_refund_required` → honest message + contact |
| `/learn/[enrollmentId]` | Program dashboard | `GET /enrollments/:id` | Modules (🔓/🔒/✅), batch-not-started banner (`started: false`), community link, project card, % progress |
| `/learn/[enrollmentId]/lessons/[lessonId]` | Lesson player | `GET …/lessons/:id`, `POST …/complete` | Markdown + lite YouTube; "Mark complete" → toast; **module-unlocked moment** (< 1 s, tasteful); prev/next; `MODULE_LOCKED`, `COHORT_NOT_STARTED` |
| `/learn/[enrollmentId]/modules/[moduleId]/quiz` | Quiz | `GET …/quiz`, `POST …/quiz/attempts`, `GET …/attempts` | One question per screen on mobile; result: fail = right/wrong only + cooldown countdown (`details.retryAfterSeconds`); pass = answers + explanations + "Next module unlocked"; `LESSONS_INCOMPLETE` |
| `/learn/[enrollmentId]/project` | Final project | `GET …/project`, `POST …/project/submissions` | Brief (markdown) + rubric; locked until modules done; form (GitHub URL, live URL, notes); status timeline (pending → changes requested → approved) with feedback; `SUBMISSION_PENDING` |
| `/documents` | My documents | `GET /credentials`, `GET /credentials/:id/download` | Status chips (generating / issued / revoked); Download opens the signed link; "Copy verify link"; `CREDENTIAL_NOT_READY` → "being prepared" |
| `/payments` | Receipts | `GET /payments` | Amount, date, method, status |
| `/profile` | Profile | `GET /users/me`, `PATCH /users/me/profile` | `CERTIFICATE_NAME_LOCKED` → field read-only with explanation |
| `/review`, `/review/[submissionId]` | Mentor queue + review | ⏳ backend B3 | Build when the backend session reports B3 done |
| `/admin/…` | Admin panel | ⏳ backend B6 | Build when B6 is done |

---

## 5. SEO — the full checklist

### 5.1 Per-page metadata (Next.js Metadata API)
- Root layout already sets `metadataBase: https://beyownd.in`. Add a **title template** `"%s | Beyownd"` and a default description.
- **Every indexable page** exports `metadata` / `generateMetadata` with: unique `title` (≤ 60 chars), unique `description` (140–160 chars, written for humans), `alternates.canonical`, `openGraph` (title, description, url, image, `locale: 'en_IN'`, `siteName: 'Beyownd'`), `twitter: { card: 'summary_large_image' }`.
- `<html lang="en-IN">`.
- **App subdomain:** `robots: { index: false, follow: false }` on the `(app)` layout, plus `robots.txt` on that host disallowing everything.
- `/verify/[id]`: `noindex, nofollow`, generic title, no personal data in metadata.

### 5.2 Files
| File | Content |
| --- | --- |
| `app/sitemap.ts` | `/`, `/programs`, every published `/programs/[slug]` and its free preview lessons (from the API), `/for-colleges`, `/verify`, `/about`, `/faq`, `/contact`, legal pages. **Exclude** `/verify/*` and all app routes. `lastModified` from data where available |
| `app/robots.ts` | Marketing host: allow all, point to the sitemap. Classroom host: `Disallow: /` |
| `app/opengraph-image.tsx` (root) + per program | Branded 1200×630 images generated with `next/og` (sky gradient, serif title, Beyownd mark) |
| `app/icon.*`, `app/apple-icon.*`, `app/manifest.ts` | Favicon set, Apple touch icon, web manifest (name, short_name, theme colour, icons) — the app should be installable on Android |

### 5.3 Structured data (JSON-LD, one `<script type="application/ld+json">` per page)
| Page | Schema |
| --- | --- |
| Root layout | `Organization` — name "Beyownd", `parentOrganization` GrewDo (legal name when available), url, logo, contact email · `WebSite` |
| `/programs` | `ItemList` of `Course` |
| `/programs/[slug]` | `Course` (provider, `offers` INR price, `hasCourseInstance` per batch: `courseMode: "online"`, `startDate`, `endDate`) · `FAQPage` · `BreadcrumbList` |
| `/faq` | `FAQPage` |
| Other marketing pages | `BreadcrumbList` |

Only describe what's true: no `aggregateRating` or reviews until real ones exist (Google penalises fake review markup).

### 5.4 Content and technical
- One `<h1>` per page; logical `h2`/`h3`; descriptive link text (not "click here").
- Every meaningful image has `alt`; decorative ones `alt=""`.
- Internal links: landing → programs → program detail → preview lessons → enroll; footer links to every marketing page.
- Core Web Vitals budget from BRIEF §8 (LCP < 2.5 s on 4G, CLS < 0.05, INP < 200 ms) — Google ranks on it.
- Clean URLs (lowercase, hyphens), trailing-slash policy consistent, `www.beyownd.in` → `beyownd.in` redirect (set in hosting).
- **After deployment (owner):** verify the domain in Google Search Console, submit the sitemap, check the Rich Results test for the program pages.

### 5.5 Analytics
Privacy-friendly, cookieless analytics (e.g. Vercel Analytics or Plausible) — page views and conversion steps (program view → enroll click → paid). No third-party ad trackers at launch. Ask the owner before adding any analytics script.

---

## 6. Build order

| Step | Pages | Depends on |
| --- | --- | --- |
| 1 | Finish `/` · 404/error · `sitemap.ts` / `robots.ts` / icons / manifest / root JSON-LD | — |
| 2 | `/programs`, `/programs/[slug]`, preview lessons | APIs ✅ |
| 3 | `/verify`, `/verify/[id]`, `/for-colleges` | APIs ✅ |
| 4 | `/about`, `/faq`, `/contact`, legal pages (placeholders until owner's text) | Owner Y5 |
| 5 | App foundation: `(app)` layout, API client, single-flight refresh, auth + onboarding guards | APIs ✅ |
| 6 | Auth pages → onboarding → dashboard | APIs ✅ |
| 7 | Enroll + status → learn dashboard → lesson → quiz → project | APIs ✅ |
| 8 | Documents, payments, profile | APIs ✅ |
| 9 | Review + admin | Backend B3, B6 |
| 10 | SEO + performance + accessibility pass across everything; Lighthouse on mobile | — |

Track progress in [../REMAINING.md](../REMAINING.md) §3 (frontend rows only). If an API is missing or awkward, write it in `docs/frontend/backend-requests.md` instead of changing the backend.
