# Phase 4 — Frontend (Next.js)

**Dates:** Oct 18, 2026 → (in progress)
**Status:** 🟡 Landing page built (all sections). Policy pages and the app are next.
**Interview doc:** [../interview/phase-4-frontend.md](../interview/phase-4-frontend.md)
**Brief followed:** [frontend/BRIEF.md](../frontend/BRIEF.md) · **API contract:** [design/api-routes.md](../design/api-routes.md) · **Tracker:** [REMAINING.md](../REMAINING.md) §3

## Goal

A landing page that makes a final-year student on a ₹8–15k Android phone feel *"this is real, it's serious, and it's made for someone like me"*, then the student app (`classroom.beyownd.in`) built against the already-tested API.

## Stack (as installed)

| Need | Package | Version |
| --- | --- | --- |
| Framework | `next` (App Router, Turbopack, Cache Components on) | 16.4.2 |
| UI runtime | `react` / `react-dom` | 19.3 |
| Styling | `tailwindcss` v4 (tokens as CSS variables) | 4.x |
| Animation | `motion` (loaded through `LazyMotion` + `domAnimation`) | 14.3.0 |
| Accessible primitives | `@radix-ui/react-dialog`, `@radix-ui/react-navigation-menu` (what shadcn/ui wraps) | latest |
| Icons | `@hugeicons/react` + `@hugeicons/core-free-icons` | 1.1.10 / 4.3.5 |
| Icon morphs | `morphicons` (pinned to 1.7.1; 2.0.0 was 3 days old at install time) | 1.7.1 |
| Fonts | `next/font/google`: **Fraunces** (SOFT axis) for headings, **Geist** for UI, **Geist Mono** for IDs/numbers | — |

**Font change from the brief:** the brief suggested Instrument Serif. The owner asked for the best edtech face; three options were compared in the real hero (`/type-preview`, temporary page). Fraunces with the SOFT axis won: premium like a certificate, but warm, and sturdier than a condensed serif on small screens.

**shadcn CLI not used:** it was very slow on this network and its components pull in `lucide-react` (the brief allows only Hugeicons). The Radix primitives it wraps were installed directly and styled to our tokens.

## Folder layout

```text
beyownd-frontend/
  scripts/                 gen-illustrations.mjs, gen-nav-thumbs.mjs, gen-problem-art.mjs (SVG art generators)
  public/illustrations/    generated SVG art (clouds, balloon, documents, program covers, problem scenes)
  src/app/
    layout.tsx             fonts, metadata, MotionProvider
    globals.css            design tokens + all CSS animations (one place)
    (marketing)/page.tsx   the landing page
    (marketing)/type-preview/  temporary font comparison (delete after sign-off)
  src/components/
    brand/logo.tsx
    ui/                    button, highlight, section-heading
    motion/                motion-provider, in-view
    marketing/nav/         site-nav (server), nav-bar, nav-panels, mobile-menu (client)
    marketing/hero/        hero (server), hero-sky, dashboard-frame, dashboard-preview, progress-ring
    marketing/problem/     problem (server)
  src/lib/
    site.ts                links (classroom URL, anchors)
    catalog.ts             CourseCard type + formatters (client-safe)
    catalog.server.ts      getPublishedCourses() with "use cache"
```

## How it works

### Design tokens

All colours, radii, shadows and easing curves are CSS variables in `globals.css` (`--sky-1..3`, `--cream`, `--ink`, `--highlight`, `--success-ink`, `--ease-out`, …) exposed to Tailwind through `@theme inline`. Because `--ease-out` is a theme token, Tailwind's `ease-out` class uses our curve `cubic-bezier(0.23, 1, 0.32, 1)` everywhere.

### Server vs client

The page is server-rendered. Only interactive leaves are client components: the nav bar, the mobile menu, the sky parallax, the dashboard frame tilt, the progress ring, and `InView`. Section markup (hero copy, problem cards) is server HTML, so it is readable before any JavaScript runs.

### Programs data (nav dropdown, later the Programs section)

`getPublishedCourses()` in `catalog.server.ts` calls `GET /api/courses` with `"use cache"` and `cacheLife({ stale: 300, revalidate: 600, expire: 3600 })`, so the landing stays static and is refreshed about every 10 minutes. If the API is down it returns `[]` and the UI shows an honest empty state ("New batches are being announced"), never placeholder programs. The fetch has a 4 s timeout.

Client components import only the type and formatters from `catalog.ts`; the cached fetch lives in a separate server file because `cacheLife` cannot be imported into client code.

### Motion system

| Kind | Tool | Why |
| --- | --- | --- |
| Hero entrance, highlighter draw, cloud drift, balloon bob, menu sheet, nav dropdown, problem reveals | CSS keyframes / transitions | Runs off the main thread; plays before hydration so it never delays the first paint |
| Pointer parallax, frame tilt on scroll, nav scroll state, progress count-up | `motion` (`useMotionValue`, `useSpring`, `useScroll`, `animate`) | Values change every frame without React re-renders |
| "Has this section been seen?" | `InView` (one `IntersectionObserver`) sets `data-inview` | One observer per section; CSS does the animating |

Rules applied everywhere: transform and opacity only (plus `clip-path` for the menu wipe), custom ease-out curves, entrances ≤ ~520 ms, hover motion only under `(hover: hover) and (pointer: fine)`, reveals play once, and `prefers-reduced-motion` removes movement but keeps fades.

`InView` arms only sections that are still below the fold when the page loads. Server HTML carries no hidden state, so content is visible without JavaScript and nothing on screen blinks out at hydration.

### Navigation

- Floating glass pill; on scroll it becomes more opaque and (desktop) slightly shorter.
- Radix `NavigationMenu` gives keyboard support and hover-intent. The viewport animates its width/height between panels (`--radix-navigation-menu-viewport-*`) and content slides in from the side you moved toward (`data-motion`).
- A capsule follows the hovered item (one absolutely positioned element; position and width set from the item's `offsetLeft/Width`).
- Scroll-spy (`IntersectionObserver`, middle band of the viewport) marks the current section with a small highlighter.
- Mobile: Radix `Dialog` (focus trap, Esc, scroll lock). The sheet's header row sits exactly on the pill, the panel wipes down with `clip-path`, and the icon morphs ☰ → ✕ (Morphicons, Hugeicons data). Section links close the sheet first and scroll after the scroll lock is released (`onCloseAutoFocus`).

### Hero

Server-rendered headline (word-by-word rise, then the highlighter draws), sub-copy, CTAs and trust points. The sky is a client island: CSS sun, SVG clouds and the balloon, with spring-smoothed pointer parallax on fine pointers only, and loops paused while the hero is off-screen. The classroom preview is real responsive HTML (container queries), labelled "Sample data", in a frame that tilts back and settles as it scrolls into view (scroll-linked, not scroll-jacked).

### Visual language: "white workshop" (Oct 20, current)

The owner replaced the scrapbook direction with monday.com's style as the reference, adapted to Beyownd's content and palette:

- **Type:** Poppins only (300 for display headlines with tight tracking, 400 body, 500/600 UI), Geist Mono for IDs and numbers. Fraunces and Geist sans were removed.
- **Colour:** white canvas, soft grey panels (`--canvas`), one action colour (`--brand` #3157e8, in the logo's navy family), pastel tiles (sky, butter, mint, peach, lavender), saturated status pills only inside product mockups. The hero's "trust" is the page's only gradient word.
- **Shapes:** pill buttons, 24-40 px cards and panels, `.board` mockup cards with a soft 48 px shadow.
- **Product as hero:** real HTML "boards" (`components/marketing/board/board-ui.tsx`) with coloured group edges and status cells, always labelled "Sample data". On phones they switch to fewer columns (`mobileTemplate` + `hideOnMobile`).

| Section | monday pattern | Beyownd content | Interaction |
| --- | --- | --- | --- |
| Hero | headline + category chips + board | "Earn an internship your college can trust", 6 sample tracks | Chips swap the board (keyed cross-fade); floating mentor card flips Reviewing/Approved every 3.2 s (off under reduced motion) |
| Includes strip | logo wall | What every internship includes (no fake logos) | Icon lift on hover |
| Problem | (owner's earlier reference) | Certificate-only sites vs a Beyownd internship | Check bullets scale |
| How it works | pill tabs + text + board | Join, Learn, Quiz, Project, Certificate | Sliding tab indicator, arrow keys, panel cross-fade |
| Programs | grey panel | `GET /api/courses`, honest empty state | Card lift, cover zoom |
| What you get | "agent for every use case" list + preview | 3 documents, feedback, community, notes | One open item, preview swaps |
| Flow | "Let work flow" diagram | Real rules: 60% quiz with retry, mentor approve/changes, certificate after batch end | Connectors draw in once, node lift |
| Verify | "Work in context" | Giant "Checked in seconds", live demo + floating cards | Demo shimmer, check draws, copy morph |
| Trust | "Full control" | 6 rules that keep certificates meaningful, as pastel cards | Heading pinned left; cards stack one over another on scroll (`motion/stack-cards.tsx`: sticky pile, earlier cards shrink 4% and dim per card above them; no scroll-jacking; reduced motion keeps the pile, drops scaling) |
| Pricing | two split panels | Price card; dark WhatsApp preview for "Send to parents" | The two panels stack on desktop (same component, `from="lg"` so tall phone panels stay a normal list) |
| FAQ | | 8 honest answers | Accordion |
| Final CTA | big scrolling statement | "Earned, not bought / Real batch dates / Mentor-reviewed / Verified in seconds" | The page's one marquee (pauses on hover, static under reduced motion) |
| Footer | monday multi-column | Programs (from API) + student links, How it works (icons), Your documents (coloured tiles), Talk to us, Legal, Built by GrewDo; dark "Module 1 is free" banner | Icon lift, link underline, banner tiles rotate on hover |

Bug found: grids with columns only from `lg` let their implicit mobile column grow to the content's min width, so the page scrolled sideways at 390 px. Fixed with `grid-cols-1` on every such grid.

### Marketing pages and SEO (PAGES.md steps 1-3, Oct 20)

| Route | Rendering | Data | Notes |
| --- | --- | --- | --- |
| `(marketing)/layout.tsx` | static | — | Shared nav, footer, skip link for every marketing page |
| `/programs` | prerendered, cached reads (~10 min) | `GET /courses` | Shared `ProgramCard`, honest empty state, `ItemList` JSON-LD |
| `/programs/[slug]` | `generateStaticParams` for published programs; params awaited inside `<Suspense>` (Cache Components); unknown slugs render on demand | `GET /courses/:slug`, `/cohorts` | Hero facts, what you'll do, syllabus accordion (free lessons link to preview), final project, what you get, batch cards (open/full/closed, low-seat hint, enroll link to the app), certificate-timing note, FAQ, sticky mobile enroll bar. `Course` (with `hasCourseInstance` per batch, INR offers) + `FAQPage` + `BreadcrumbList`. Per-program `opengraph-image` |
| `/programs/[slug]/preview/[lessonId]` | same pattern | `GET …/preview/lessons/:id` | `react-markdown` + `rehype-sanitize` (then `rehype-highlight`), never `dangerouslySetInnerHTML`; lite YouTube facade (iframe only after tap, youtube-nocookie); `PREVIEW_NOT_AVAILABLE` → "Enroll to unlock"; prev/next; indexable |
| `/verify` | static | — | ID form normalises lowercase/spaces/missing dashes, inline error, no layout jump |
| `/verify/[credentialId]` | **per request** (`cache: "no-store"`) | `GET /verify/:id` | `noindex, nofollow`, generic title, no personal data in metadata, excluded from the sitemap. Valid (check draws), revoked (red, with date), generating, not found (tips + form), API down (neutral). Copy link + print |
| `/for-colleges` | static | — | What the program is, verify steps + live form, the three documents (illustrations, labelled), issuer GrewDo (placeholders) |
| 404 / `error` / `global-error` | — | — | Friendly, no stack traces, retry |

SEO files: `sitemap.ts` (static pages + published programs + their free preview lessons; no `/verify/*`, no app), `robots.ts` (allow; `/app/` disallowed; `/verify/*` deliberately crawlable so Google sees its `noindex`), `manifest.ts`, `opengraph-image.tsx`, `apple-icon.tsx`, `icon.svg`. Root layout: `lang="en-IN"`, title template `%s | Beyownd`, `Organization` (parent GrewDo) + `WebSite` JSON-LD. `lib/seo.tsx` gives every page the same title/description/canonical/OG/Twitter block. No ratings or reviews in structured data.

Checked against a local mock of the API (scratchpad only, shapes copied from the backend types): every route returns the right status, canonical and robots tags are correct, sitemap lists the right URLs, pages render at 1440 and 390 px.

### Student app foundation, mentor review and admin (F5, F14, Oct 21)

Everything under `/app` is client-rendered behind login, and the whole tree is `noindex` (in `app/(app)/app/layout.tsx`) and disallowed in robots.

**Foundation** (`lib/api.ts`, `components/app/*`)

- `api<T>(path, opts)` adds the bearer token, sends `credentials: "include"` only to `/auth/*` (the refresh cookie lives on path `/api/auth`), and throws `ApiError(status, code, message, errors, details)`. UI branches on `code`, never on message text. `fieldErrors()` maps the API's `VALIDATION_ERROR` list to form fields, so admins see the server's exact reason.
- Access token in memory only. On `TOKEN_EXPIRED` one shared refresh promise runs (single-flight) and the request is retried once; parallel requests wait for the same refresh.
- `AuthProvider` refreshes on load, exposes `{ user, status, login, logout }`. `RequireRole` reads `user.role` and sends logged-out users to `/app/login?next=…` (same-origin paths only).
- Shared UI: `Field` (label, hint, error wired with `aria-describedby`), inputs, `Button` with loading, `ConfirmDialog` (optional reason field, min 5 characters, shows the API error inside the dialog), toasts, `StatusPill`, `ReorderList`, `MarkdownField`.

**Mentor review** (`/app/review`, `/app/review/[submissionId]`, mentor or admin)

Queue tabs (pending / in review / done) with cursor "Load more". Detail: repo and live links, rubric with a score per criterion, live total against the pass mark, feedback required; approve and "request changes" both go through a confirm dialog. Error codes such as already-reviewed or claimed by another mentor get their own message.

**Admin** (`/app/admin/*`, admin only)

| Page | What it does |
| --- | --- |
| Overview | Stat tiles, alerts (stuck PDFs, refunds needed), per-course funnel, colleges |
| Courses list / new / edit | Draft → publish → archive (confirm). Modules and lessons reorder by drag or keyboard up/down, sent as one request, rolled back on failure. Free-preview toggle, quiz link per module |
| Lesson editor | Markdown with live preview rendered by the same sanitized renderer students see; YouTube ID pulled from any pasted link; warns before leaving with unsaved changes |
| Quiz editor | 3-30 questions, single/multiple choice, pass mark; the same rules as the API are checked before Save so the button explains what is wrong |
| Batches | Create/edit in a dialog; dates entered as IST calendar days; price change flagged as audit-logged; `CODE_TAKEN`, `CAPACITY_BELOW_SEATS` explained |
| Students list | Search (300 ms debounce) by name/email/college, batch and status filters, cursor pagination |
| Student detail | Profile, enrollments, documents, payments, submissions. **Mark refunded** (reason, after refunding in Razorpay; revokes documents), **Revoke document** (reason), **Reissue documents**, **Change role** (logs the user out; own role cannot be changed). Each behind a confirm dialog; `NO_PAID_PAYMENT`, `ALREADY_REVOKED`, `CANNOT_CHANGE_OWN_ROLE` get plain messages |

No new dependencies for reorder: native drag-and-drop plus buttons, which also cover touch and screen readers (an `aria-live` line announces the new position).

**Checked:** `tsc --noEmit` and `eslint` clean. **Not checked yet:** clicking through these pages against the real backend.

### Student app: auth, onboarding, checkout, learning, documents (F6-F13, Oct 21)

All under `app/(app)/app/`. Auth pages are public; the `(student)` route group's layout wraps everything else in `StudentShell` = `RequireRole onboarding` (logged out → `/login?next=…`, not onboarded → `/onboarding?next=…`).

| Route | What it does | Codes handled |
| --- | --- | --- |
| `/signup` | Name, email, password with live rule checklist (same rules as the validator), Google | `EMAIL_TAKEN`, `GOOGLE_ACCOUNT`, `VALIDATION_ERROR` per field |
| `/verify-email` | 6 OTP boxes: paste, autofill, auto-submit on the 6th digit; 60 s resend countdown. Email kept in sessionStorage, not the URL | `OTP_INVALID`, `OTP_LOCKED`, `OTP_COOLDOWN` |
| `/login` | Email + password or Google; forgot link; `?next=` kept to signup | `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED` (resends a code, opens the OTP screen), `USE_GOOGLE_SIGNIN`, `RATE_LIMITED` |
| `/forgot-password`, `/reset-password` | Same message whether or not the account exists; reset logs out other devices | `OTP_*` |
| `/onboarding` | 2 steps, progress bar, draft in localStorage, college combobox (debounced `GET /colleges`), choice cards and chips | API `errors[]` mapped to fields and the right step; `ALREADY_ONBOARDED` |
| `/dashboard` | Programs with progress and the right action (Start / Continue / Complete payment), documents summary, empty state | — |
| `/enroll/[slug]/[cohortId]` | Summary → `POST /enrollments` → Razorpay Checkout (script loaded on Pay) → `POST /payments/verify` | `ENROLLMENT_CLOSED`, `COHORT_FULL`, `ALREADY_ENROLLED`, `PAYMENT_PROVIDER_ERROR`, dismissed / failed payment |
| `…/status` | Success, `cohort_full_refund_required`, or "Confirming…" polling `GET /enrollments` for 90 s when verify couldn't confirm (the webhook activates it). Never says "failed" after money may have moved | `PAYMENT_SIGNATURE_INVALID` |
| `/learn/[id]` | Modules (locked / open / done, lessons, quiz row), batch-not-started banner, progress, project card, certificate timing (`completion.documentsAvailableFrom`), community link | `ENROLLMENT_NOT_ACTIVE` states |
| `…/lessons/[lessonId]` | Sanitized markdown, lite YouTube, Mark complete (toast with %), "module unlocked" moment (< 1 s, CSS, off with reduced motion), quiz CTA, prev/next | `MODULE_LOCKED`, `COHORT_NOT_STARTED` |
| `…/modules/[moduleId]/quiz` | Intro (pass mark, best score, attempts), one question per screen, fail → right/wrong only + countdown, pass → answers + explanations + unlock | `QUIZ_COOLDOWN` (`details.retryAfterSeconds`), `LESSONS_INCOMPLETE` |
| `…/project` | Brief + rubric, locked until all modules, GitHub-only repo check, submission timeline with mentor scores and feedback | `SUBMISSION_PENDING`, `MODULES_INCOMPLETE`, `PROJECT_ALREADY_APPROVED` |
| `/documents` | Status chips, download = fresh signed link each time, copy verify link, polls while generating | `CREDENTIAL_NOT_READY`, `CREDENTIAL_REVOKED` |
| `/payments`, `/profile` | Paid/refunded history; profile PATCH sends only changed fields, certificate name read-only when locked | `CERTIFICATE_NAME_LOCKED` |

**Host routing** (`src/proxy.ts`): on `classroom.beyownd.in`, `/dashboard` is rewritten to `/app/dashboard`; `/` → `/dashboard`; `/app/*` → clean URL; non-app paths → marketing host. On `beyownd.in`, `/app/*` → classroom host. When `NEXT_PUBLIC_CLASSROOM_URL` is relative (`/app`, local dev) it does nothing. Production envs: `NEXT_PUBLIC_CLASSROOM_URL=https://classroom.beyownd.in`, `NEXT_PUBLIC_MARKETING_URL=https://beyownd.in`.

**Marketing pages (PAGES.md step 4):** `/about`, `/faq` (grouped, `FAQPage` JSON-LD; landing FAQ reads the same `lib/faq-data.ts`), `/contact`, `/delivery-policy` (facts of digital delivery), and `/terms`, `/privacy`, `/refund-policy` as clearly marked placeholders. `lib/legal.ts` `LEGAL_DRAFTS` makes drafts `noindex` and drops them from the sitemap; remove a path from it when the owner's text is in.

**How it was checked:** a mock API (scratchpad, shapes and error codes copied from the backend services, including locking, cooldowns and the cookie refresh) and Playwright scripts that click through every flow at 390 px and 1440 px: signup → OTP → onboarding → checkout (stubbed Razorpay: dismiss, fail, success) → status → lessons → quiz fail with cooldown → quiz pass with unlock → project submit → documents download → profile save; plus a production build with real host names (`classroom.localhost`) tested with curl and a browser. No page errors, no horizontal scroll at 390 px. **Not checked yet:** the real backend, a real Google client ID, Razorpay test mode.

### Earlier landing iterations (superseded)

After two heavy animated versions of the problem section were rejected, the owner set the direction for the whole page: **no heavy animation, one consistent theme, small interactions, good typography.** Every section below follows the same system:

- `Section` wrapper (`components/marketing/section.tsx`): same width, padding and only two background tones (cream, soft sky tint), alternating.
- `SectionHeading`: Fraunces heading with one highlighted word that draws when the section is seen; Geist sub-copy.
- One `.card` style (white, hairline ring, soft blue shadow); `.card-hover` adds a 3 px lift on fine pointers.
- Motion is limited to: one-time fade-up reveals, hover lifts, icon tiles that tilt slightly on card hover, button press scale and arrow nudge.

| Section | Content | Interaction |
| --- | --- | --- |
| Problem | Editorial two-column comparison (owner-supplied reference): "Certificate-only sites" vs "A Beyownd internship", grouped by What you do, Dates, Proof, Support | Check bullets scale slightly on hover |
| How it works | Carousel (owner-supplied reference): heading + "Preview Module 1" link, prev/next buttons, five step cards bleeding off the right edge; native scroll-snap so it swipes on phones | Each card's mini UI changes state on hover (batch selection moves, progress fills, right answer turns green, "In review" becomes "Approved", certificate lifts with a Verified chip); arrows disable at the ends |
| Programs | `GET /api/courses` cards (cover, skills, duration, next batch, from-price); honest empty state | Card lift, cover zoom |
| What you get | Bento: certificate hero tile, offer + completion letters, mentor feedback, community, notes | Certificate tilts, card lift |
| Verify | Demo on the sample ID only; other IDs explain that real checks happen at `/verify/<id>` | Spinner + shimmer (650 ms), result card rises, check mark draws, copy icon morphs to a tick |
| Pricing | One card: ₹599–799 one-time, what's included, certificate-timing note, refund link, **Send to parents** (WhatsApp share with a plain summary) | Border light sweep on hover |
| FAQ | 8 honest answers (no promise of college acceptance) | Radix accordion, height animation, plus ↔ minus morph |
| Final CTA | Hero's sky and sun again, balloon, "Get started" | Button shine |
| Footer | Product + legal links, "Beyownd is a product of GrewDo", address placeholder | Link underline |

The verify result area reserves its height, so nothing below jumps while it changes.

### Logo

The owner shared the Beyownd logo as a small image (navy "b" whose bowl is a forward chevron, plus a red chevron). It was recreated as SVG in `brand/logo.tsx` and `app/icon.svg` (favicon). Replace with the official vector when available.

### Illustrations

No image-generation tool was available, so the art is generated SVG (`scripts/*.mjs`) in one consistent style: soft gradients, noise-displaced cloud edges, warm light from the sun side. Each file is a few KB. These are stand-ins until owner-made or licensed art exists (REMAINING Y10); file names and sizes are the contract, so swapping is a file replace.

## Checks done (per section)

| Check | Result |
| --- | --- |
| Widths | 360, 390, 430, 768, 1024, 1440 px screenshots (Playwright + local Chrome) |
| Contrast (computed) | Hero sub-copy on sky 6.5:1, nav links on sky 6.3:1, muted on white 6.0:1, success text on its tint 5.1:1. One failure found and fixed: success icon on its tint was 2.7:1, now a darker `--success-ink` |
| Keyboard | Skip link, visible focus ring, nav triggers and dropdown reachable by keyboard |
| Reduced motion | Screenshots with `prefers-reduced-motion: reduce`; found and fixed a hydration mismatch in the frame tilt (moved the reduced-motion case to CSS) |
| Lint / types | `eslint` and `tsc --noEmit` clean |
| Impeccable detector | 0 findings |

**Not measured yet:** Lighthouse, real-device performance, landing JS size. These belong to F16 and will be recorded here with real numbers.

## Bugs found while building

| Bug | Cause | Fix |
| --- | --- | --- |
| Headline words could not wrap | Words were `inline-block` spans joined with `&nbsp;` | Real spaces between spans |
| Hydration mismatch with reduced motion | Server rendered the tilt, client rendered `none` | Always render the tilt; `motion-reduce:transform-none!` in CSS |
| Frame jank risk on phones | `backdrop-filter` on a frame that transforms on scroll | Removed the blur; translucent white rim instead |
| Pill overflowed at 360 px | Logo + CTA + menu wider than the pill | Compact CTA (no arrow) below 420 px, smaller mark and padding |
| `cacheLife` imported into client code | Client components imported the catalog module | Split into `catalog.ts` (client-safe) and `catalog.server.ts` |
| Heading and falling cards overlapped on phones | Scroll-pinned stage shared one viewport between text and animation | Section redesigned without heavy animation |
| Verify input collapsed to a thin line on phones | `flex-1` in a column flex container sets the height basis to 0 | `w-full`, and `flex-1` only from `sm` up |
| Placeholder text failed contrast (2.95:1) | Light grey placeholder on a light input | Darker placeholder (4.98:1) |
| JSON-LD escape did nothing (found in backend review) | The replacement string was written as `"<"`, which JavaScript reads as `"<"` again, so `</script>` in data could close the tag (XSS) | `serializeJsonLd()` in `lib/seo.tsx` writes a real backslash (`"\u003c"`), also escapes U+2028/2029; `npm run check:jsonld [urls]` checks the rule, the source, and rendered pages |
| `next build` failed on `/app/admin/courses/[courseId]` (dev worked) | With Cache Components, `usePathname()` in the role guard ran outside any `<Suspense>`, which blocks prerendering of dynamic routes | One `<Suspense>` with a skeleton in `app/(app)/app/layout.tsx`; app routes now partially prerender. Lesson: run `next build`, not only `tsc`/lint |
| Mobile header logo rendered blank | Gradient ids in the logo SVG were fixed (`by-navy`), so the second logo on a page used the first one's gradients, which sat in the desktop sidebar (`display:none` on phones) | `useId()` per logo instance |
| Nav tab never highlighted in production | Links are absolute (`https://classroom…/dashboard`) but `usePathname()` returns `/dashboard` | Compare paths only |
| Payment / refund copy promised things the system doesn't do ("returned automatically", "5-7 days", "access for the batch duration") | Written from assumption | Reworded to what the backend actually does; timelines left to the policy text |

## What's next

1. Click through the whole app against the real backend (needs Redis running) and a Razorpay test-mode payment.
2. Real Google client ID + authorised origins, then test Google sign-in end to end.
3. Owner text for Terms, Privacy, Refund (Y5) and contact details (Y6); then remove the paths from `LEGAL_DRAFTS`.
4. Deploy (F15) with the production envs above.
5. Step 10: performance and accessibility pass (F16) with real Lighthouse numbers.
