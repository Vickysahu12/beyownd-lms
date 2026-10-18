# Beyownd Frontend — Brief for the Frontend Session

You are building the Beyownd frontend: first the marketing landing page (`beyownd.in`), then the student app (`classroom.beyownd.in`). A separate session is building the backend in `beyownd-backend/`. Read this whole brief before writing code, then read the files in §2.

---

## 1. Working rules (non-negotiable)

1. **Do not run `git commit` or `git push`.** The owner commits and pushes everything themselves. Never add `Co-Authored-By` or any Claude attribution anywhere. When a piece of work is done, list the changed files and suggest a commit message.
2. **Work section by section.** Finish one landing section to the quality bar in §6 (desktop *and* 360 px phone width, hover, focus, reduced motion) before starting the next. Show the owner each finished section.
3. **No fake data presented as real.** No invented student counts, testimonials, ratings, college logos, "as featured in", or "AICTE approved"-style claims. Use clearly marked placeholders (`[REAL TESTIMONIAL NEEDED]`) until the owner supplies real ones. The whole business sells *trust* — a fake number on the homepage undermines it.
4. **Don't copy the inspiration.** [inspo/hero-inspo.png](inspo/hero-inspo.png) (a site called "Tutor IQ") is a *style* reference only. Do not reuse its name, illustrations, airship, copy or layout pixel-for-pixel. Create Beyownd's own illustrations in the same spirit.
5. **Document as you go** — same convention as the backend (see [../README.md](../README.md)): a build doc `docs/phases/phase-4-frontend.md` (what/why/how) and a separate interview doc `docs/interview/phase-4-frontend.md` (how to explain it, decisions, trade-offs, Q&A). The owner uses these in job interviews, so only claim what was actually built and measured.
6. **The owner writes in Hinglish.** Explain things simply. The website copy itself is in clear, simple English (see §7).
7. **Stay in your folder.** Another session is working on `beyownd-backend/` at the same time. Only edit `beyownd-frontend/` and `docs/` files about the frontend. If the API is missing something or a response is awkward, don't change the backend — write it down in `docs/frontend/backend-requests.md` and tell the owner; the backend session will handle it.

## 2. Read these first

| File | Why |
| --- | --- |
| [../business-model.md](../business-model.md) | What we sell and why credentials must be earned — this shapes every piece of copy |
| [../design/user-flow.md](../design/user-flow.md) | Domains, login methods, onboarding questions and fields |
| [../design/api-routes.md](../design/api-routes.md) | Every endpoint, response shape and error code — build the app against this |
| [../design/schemas.md](../design/schemas.md) §9 | Product decisions D1–D10 (e.g. certificates issue after the batch end date) |
| [../roadmap.md](../roadmap.md) | Timeline: go-live **Nov 6, 2026** |
| [inspo/hero-inspo.png](inspo/hero-inspo.png) | Visual direction |

## 3. Who we're designing for

**Beyownd** runs paid, project-based **virtual internship programs** (₹599–799) for **final-year students at tier 3 and tier 4 colleges in India**, who need an internship certificate and letter for their degree but rarely have access to real internships.

A student joins a batch with real dates, learns module by module, passes a quiz per module, builds a final project that a mentor reviews, and receives an offer letter, completion certificate and completion letter — each **publicly verifiable** at `/verify/<id>`.

**The student:** 19–22, BCA / B.Tech / BSc / Diploma, uses a ₹8–15k Android phone on mobile data, reads English comfortably but prefers it simple, is anxious about the college deadline, and has been burned by "certificate-only" internships. Parents often pay.

**What the site must make them feel:** *"This is real, it's serious, and it's made for someone like me."* Premium but warm and approachable — never corporate-cold, never cheap-flashy.

## 4. Visual direction (from the inspiration)

What makes the reference feel premium, and what to carry over:

| Element in the reference | Carry into Beyownd |
| --- | --- |
| Soft sky-blue gradient, painterly clouds, warm glowing sun | Same atmosphere: sky = possibility, sunrise = "your career starting". Beyownd = going *beyond* |
| Large elegant serif headline, one word on a yellow highlighter block | Serif display headlines with **one highlighted word** per major heading, used consistently across sections, not only the hero |
| A playful hand-made object in the sky (airship) | Our own object: e.g. a **paper plane** or **hot-air balloon carrying a rolled certificate with a ribbon**. One recurring mascot-like object that reappears subtly (hero, How it works, final CTA) |
| Real product UI shown inside a soft rounded frame | Show the **real classroom dashboard** (module progress, quiz passed, certificate card) as the hero visual |
| Black pill primary button + translucent glass secondary | Same button system |
| Lots of air, centered composition, small muted sub-copy | Same restraint everywhere |

**Make the rest of the page as good as the hero.** The common failure is a beautiful hero followed by generic white sections with icon grids. Every section below must have a deliberate background (sky → cream → soft sky → cream rhythm), a serif heading with its highlighted word, a real visual (product UI, certificate, illustration — not stock icons), and its own small interaction.

### Starting tokens (refine them, but keep them in one place as CSS variables / Tailwind theme)

| Token | Suggested | Use |
| --- | --- | --- |
| `--sky-1 … --sky-3` | `#5DBBF0` → `#9AD6F7` → `#D9F0FC` | Hero and feature backgrounds |
| `--cream` | `#FBF8F2` | Main page background between sky sections |
| `--ink` | `#0E0F12` | Text, primary buttons |
| `--muted` | `#5B6472` | Body / secondary text |
| `--highlight` | `#FFD54A` | Highlighted headline word, small accents |
| `--sun` | `#FFB547` | Warm illustration glow, tiny accents |
| `--violet` | `#7B61FF` | Rare accent (badges, quiz "passed" moments) |
| `--success` | `#1FA971` | Verified / completed states |
| Radius | 12 / 20 / 28 px | Inputs / cards / big frames |
| Shadow | very soft, large blur, low opacity, slightly blue-tinted | Cards float on the sky |

**Fonts:** a high-contrast display serif for headings (e.g. *Instrument Serif* or similar from Google Fonts) and a clean sans for UI and body (e.g. *Inter* or *Geist*). Load with `next/font`, subset Latin, `display: swap`.

**Contrast warning:** the reference puts white sub-text on light blue — that fails WCAG AA. Keep the look, but make text pass AA (darker blue-grey text, or a subtle backing).

**Illustrations:** clouds, sun, the plane/balloon and the certificate need to be **original assets in one consistent painterly style** (commissioned, made by the owner, or AI-generated with clear rights). Export as AVIF/WebP with fixed dimensions; hero assets ideally < 120 KB each. Never hotlink.

## 5. Landing page (`beyownd.in`) — every section

Order, purpose, content and interaction. Copy is a **starting draft** — improve it, but keep it honest.

### 5.1 Navigation
- Logo left; links: **Programs · How it works · Certificates · Pricing · FAQ**; right: **Verify a certificate** (glass) + **Get started** (black pill → `classroom.beyownd.in/signup`).
- Sticky. Transparent over the sky; on scroll becomes a frosted glass bar and gets slightly shorter (smooth, ~200 ms).
- Mobile: a sheet menu that slides down, with focus trapped and body scroll locked.
- Interaction: link hover shows an underline that grows from the left; the arrow in "Get started" nudges right on hover.

### 5.2 Hero (sky, sun, clouds, the object)
- Headline draft: **"Earn an internship your college can *trust*"** (highlight *trust*). Alternatives to test: "Learn it. Build it. *Prove* it." / "An internship that goes *beyond* the certificate."
- Sub: "8-week, project-based virtual internships for final-year students. Learn step by step, build a real project reviewed by a mentor, and get a certificate anyone can verify."
- CTAs: **Explore programs** (black) · **Verify a certificate** (glass).
- Under the CTAs, three small trust points with icons: "Mentor-reviewed project" · "Publicly verifiable certificate" · "Pay with UPI from ₹599".
- Visual: the classroom dashboard in a large rounded frame, rising from below the fold.
- Interaction: the highlighter block draws in left→right once on load (~500 ms, after the headline fades in); clouds drift very slowly; the plane/balloon floats with a slow idle bob; on desktop, clouds and the object react *slightly* to pointer position (a few px of parallax). The dashboard frame tilts a few degrees and settles as it scrolls into view. Disable parallax on touch devices and under reduced motion.

### 5.3 The problem (cream)
- Heading: "The final-year internship *problem*".
- Three short cards in plain words: **No access** (most colleges don't bring internship opportunities) · **Certificate-only internships** (pay, get a PDF, learn nothing) · **Nothing to verify** (colleges and recruiters can't tell real from fake).
- Interaction: cards reveal with a small stagger; on hover each card's small illustration shifts slightly.

### 5.4 How it works (soft sky)
- Heading: "From enrolment to a certificate you *earned*".
- Five steps on a vertical (mobile) / horizontal (desktop) path: **Join a batch → Learn module by module → Pass each module's quiz → Build your final project (mentor-reviewed) → Get your letters + verifiable certificate**.
- Each step shows a tiny real UI fragment (a lesson card, a quiz-passed chip, a GitHub link field, the certificate) rather than an icon.
- Interaction: a progress line fills as the user scrolls through the steps (scroll-*linked*, not scroll-*jacked* — never take over scrolling). The recurring plane travels along the path.

### 5.5 Programs (cream)
- Heading: "Pick your *program*".
- Program cards fetched from the API (`GET /api/courses`, built with ISR / revalidate ~10 min so the page stays static and fast): title, tagline, duration, skill chips, "from ₹599", next batch start date.
- Interaction: card lifts 2–4 px with a softer, bigger shadow on hover; skill chips scroll gently on overflow; clicking goes to the program page.
- Empty state if no published programs: "New batches are being announced — get notified" (no fake cards).

### 5.6 What you get (sky-tinted bento)
- Heading: "Everything you need to *show* your work".
- Bento grid: **Offer letter** · **Completion certificate** · **Completion letter** · **Mentor feedback on your project** · **Batch community** (WhatsApp) · **Lifetime access to course notes**.
- The certificate tile shows a realistic certificate mock with QR code; it tilts toward the pointer (max ~6°) with a soft light sheen.

### 5.7 Verify — the differentiator (cream, prominent)
- Heading: "Any college can check it in *seconds*".
- A live-looking verify widget: input "BYD-26-XXXX-XXXX" + "Verify". In the landing page this is a **demo** using a sample ID (clearly labeled "Sample") that animates to a green "Verified ✓" card showing name, program, batch dates and status. Real verification lives at `/verify/<id>` (backend Phase 3).
- Copy: "Every Beyownd document has a unique ID and QR code. Colleges and recruiters can confirm it's genuine — no login, no emails."
- Interaction: typing the sample ID triggers a short "checking" shimmer (~600 ms), then the result card slides up; the check mark draws itself.

### 5.8 Pricing (soft sky)
- One clear price card: "₹599–799 per program · one-time" with everything included, the batch dates, "Pay with UPI, cards or net banking", and links to the Refund policy.
- Small honest note: "Certificates are issued after your batch ends and your project is approved."
- Interaction: the price card has a subtle animated border sheen on hover; the CTA arrow nudges.

### 5.9 FAQ (cream)
Accordion, smooth height animation, one open at a time on mobile. Honest answers:
- *Is this a real internship?* — It's a structured **virtual internship program**: real batch dates, real work, a mentor-reviewed project. The documents say exactly that.
- *Will my college accept it?* — Every document is publicly verifiable, and the letters follow the format colleges usually ask for. Requirements differ, so check with your college or TPO. (**Never promise acceptance.**)
- *How long does it take?* / *When do I get the certificate?* (after the batch end date and project approval)
- *Can I pay with UPI?* / *What if I miss a deadline?* / *Refunds?* (link the policy)
- *Do I need prior experience?* (beginner-friendly; Module 1 is free to preview)

### 5.10 Final CTA (sky + sun, callback to the hero)
- Heading: "Your internship starts *here*".
- One CTA: **Get started**. The plane/balloon flies across once when the section enters the viewport.

### 5.11 Footer (ink or cream)
- Required for Razorpay approval: **Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, Contact Us**, registered business name and address (placeholders until the owner provides them).
- Links: Programs, Verify a certificate, FAQ, Login.

## 6. Motion and micro-interactions — the quality bar

The goal is the feel of Linear, Stripe, Vercel or Raycast: lots of small, precise, *purposeful* details — not big flashy animations.

**Principles**
1. **Every animation has a job:** guide attention, give feedback, or show a change of state. If it does none of these, cut it.
2. **Fast.** UI feedback 120–200 ms; entrances 300–500 ms; nothing over ~700 ms except ambient idle loops.
3. **Natural easing.** Custom ease-out curves for entrances (e.g. `cubic-bezier(0.22, 1, 0.36, 1)`), springs for things that feel physical (tilt, drag, toggles). Never linear, never bouncy-cartoon.
4. **Small distances.** Reveals move 8–16 px, not 100 px. Opacity + transform only.
5. **Once.** Scroll reveals play once; don't re-animate when scrolling back up.
6. **Interruptible.** Hover-in/hover-out must reverse smoothly from wherever they are.
7. **Respect `prefers-reduced-motion`:** keep fades, remove movement, parallax and loops.
8. **Never scroll-jack.** No hijacked scrolling, no forced snap, no delayed content.

**The details that make it feel premium (do all of these)**
- Buttons: press scales to ~0.97 with a quick spring back; the arrow icon nudges on hover; loading state swaps the label for a small spinner without changing button width.
- Links: underline grows from the left.
- Cards: 2–4 px lift + shadow change; cursor-aware light sheen on the hero/certificate cards (desktop only).
- Inputs: smooth focus ring, floating labels or crisp labels, inline validation that appears without layout jump.
- Copy-to-clipboard (credential IDs): icon morphs to a check for 1.5 s.
- Toasts: slide + fade from the bottom on mobile, top-right on desktop; auto-dismiss; never block content.
- Skeletons that match the final layout exactly (no layout shift when content arrives).
- Numbers that change (progress %, quiz score) count smoothly to their value.
- Page transitions in the app: a quick cross-fade (~150 ms), nothing more.

**Tools:** `motion` (Framer Motion) for component animation and springs, CSS transitions for simple hovers, `IntersectionObserver` / `motion`'s `whileInView` for reveals, `useScroll` for the How-it-works line. No GSAP-heavy timelines, no Lottie unless tiny, no three.js.

## 7. Copy and tone

- **Simple, warm, confident English.** Short sentences. Talk to one student ("you"). No jargon ("synergy", "leverage", "world-class"), no hype ("revolutionary", "#1").
- **Honest about what it is:** a *virtual internship program*. Never imply an on-site job, a company placement, a guaranteed college acceptance, or government affiliation.
- **Speak to the real worry:** the college deadline and "is this legit?". Answer with specifics: real dates, mentor review, public verification.
- Microcopy examples: empty dashboard → "No programs yet. Your internship starts with one click." · quiz fail → "Not quite — you got 2 of 5. Review the lessons and try again in a minute." · module unlocked → "Module 2 unlocked. Nice work." · verify success → "Verified. This certificate was issued by Beyownd."

## 8. Performance and accessibility budget (our users are on budget phones and 4G)

| Metric | Target (mid-range Android, Slow 4G throttle) |
| --- | --- |
| LCP | < 2.5 s |
| CLS | < 0.05 |
| INP | < 200 ms |
| Landing JS (gzipped) | < 170 KB |
| Lighthouse (mobile) | Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95 |

- Server-render the landing page; ship client JS only for interactive islands.
- `next/image` with explicit sizes; preload only the hero image; lazy-load everything below the fold.
- YouTube: use a "lite" facade (thumbnail + play button) and load the iframe only on tap.
- Animations: transform/opacity only, `will-change` sparingly, pause idle loops when off-screen.
- Accessibility: WCAG 2.1 AA contrast, visible focus rings, full keyboard navigation, semantic headings, labels on every input, 44 × 44 px tap targets, `alt` text on meaningful images, accordion/menu built on accessible primitives (e.g. Radix).
- Test at 360 px width, with reduced motion on, and with the keyboard only.

## 9. Project setup

- Create `beyownd-frontend/` at the repo root (the repo `.gitignore` already covers `beyownd-frontend/node_modules`, `.next`, `.env.local`).
- **Next.js (App Router) + TypeScript + Tailwind CSS**, `motion`, Radix primitives (or shadcn/ui built on them), `react-markdown` (+ `rehype-sanitize`) for lessons.
- One Next.js project serving both surfaces with route groups — `(marketing)` for `beyownd.in` and `(app)` for `classroom.beyownd.in` — using middleware to route by host in production. In local dev both run on `http://localhost:3000` (marketing at `/`, app under a path such as `/app`) because the backend's CORS allows exactly `http://localhost:3000`.
- `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:5000/api`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…` (never commit `.env.local`).

## 10. The student app (`classroom.beyownd.in`) — after the landing page

### 10.1 Talking to the backend (get this exactly right)

- **Access token in memory only** (a React context / store) — never `localStorage`.
- **Refresh token is an httpOnly cookie** scoped to `/api/auth`. Every call to `/auth/*` must use `credentials: 'include'`.
- On app load: call `POST /auth/refresh` once. Success → logged in. 401 → logged out.
- On any `401` with `code: "TOKEN_EXPIRED"`: refresh **once** and retry the request. **Single-flight refresh** — if five requests fail at the same moment, only *one* refresh call is made and the other four wait for it. (The backend rotates refresh tokens and treats reuse of an old one as theft; parallel refreshes would log the student out.)
- Branch on the error `code`, never on `message`. Codes and meanings: [../design/api-routes.md](../design/api-routes.md) §3–6 and §11.
- After login, read `user.onboardingCompleted`: `false` → `/onboarding`, `true` → `/dashboard`.
- **Lesson content is Markdown. Never render it with `dangerouslySetInnerHTML`.** Use `react-markdown` with `rehype-sanitize`; syntax-highlight code blocks.

### 10.2 Screens (build in this order — their APIs are ready and tested)

| # | Screen | Endpoints | Key states |
| --- | --- | --- | --- |
| 1 | Sign up / Login / OTP / Forgot + reset password | `/auth/*` | `EMAIL_TAKEN`, `GOOGLE_ACCOUNT`, `EMAIL_NOT_VERIFIED` → OTP screen, `USE_GOOGLE_SIGNIN`, `OTP_INVALID`, `OTP_LOCKED`, `OTP_COOLDOWN` (show a countdown), `RATE_LIMITED` |
| 2 | Google sign-in button | `POST /auth/google` | Google Identity Services, returns `idToken` |
| 3 | Onboarding (2 steps) | `PUT /users/me/onboarding`, `GET /colleges?q=` | Debounce college search ~300 ms; inline field errors from `errors[]`; save a local draft between steps |
| 4 | Program page + free preview lessons | `GET /courses/:slug`, `/cohorts`, `/preview/lessons/:id` | `PREVIEW_NOT_AVAILABLE` → "Enroll to continue" |
| 5 | Dashboard (my programs) | `GET /enrollments` | Empty state |
| 6 | Program dashboard (modules, progress) | `GET /enrollments/:id` | Locked/unlocked/completed modules, batch-not-started banner, community link |
| 7 | Lesson player | `GET /enrollments/:id/lessons/:lessonId`, `POST …/complete` | `MODULE_LOCKED`, `COHORT_NOT_STARTED`; "Module unlocked" celebration (tasteful, < 1 s) |
| 8 | Quiz | `GET …/quiz`, `POST …/quiz/attempts`, `GET …/quiz/attempts` | One question per screen on mobile; `QUIZ_COOLDOWN` countdown from `details.retryAfterSeconds`; on fail show only right/wrong; on pass show answers + explanations |
| 9 | Final project | `GET …/project`, `POST …/project/submissions` | Locked until modules done; `SUBMISSION_PENDING`; review feedback history |
| 10 | Profile | `GET /users/me`, `PATCH /users/me/profile` | `CERTIFICATE_NAME_LOCKED` |

**Not ready yet (backend Phase 3):** checkout/payment, "my documents", the public `/verify/:id` page, mentor review. Build these only when the backend session reports them done; until then the seed script creates enrollments (`npm run seed:dev -- --enroll <email>` in `beyownd-backend/`).

Every screen needs: loading skeleton, empty state, error state with a retry, and a 360 px layout.

### 10.3 Running the backend locally

```bash
docker start beyownd-redis
cd beyownd-backend
npm run seed:dev -- --enroll <your-signup-email>
npm run dev            # http://localhost:5000
```

## 11. Definition of done for each landing section

- [ ] Matches the visual direction (sky/cream rhythm, serif + highlighted word, real visual — not stock icons)
- [ ] Honest copy, no fake numbers or testimonials
- [ ] At least one purposeful micro-interaction, following §6
- [ ] Looks deliberate at 360 px, 768 px and 1440 px
- [ ] Keyboard and screen-reader friendly; contrast AA
- [ ] Reduced-motion version checked
- [ ] No layout shift; images sized; below-the-fold assets lazy
- [ ] Shown to the owner before moving on
