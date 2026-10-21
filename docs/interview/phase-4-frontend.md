# Interview — Phase 4: Frontend (Next.js)

**Status:** 🟡 Landing, marketing/SEO pages, the whole student app (auth, onboarding, checkout, learning, quiz, project, documents, profile), mentor review and admin are built. Everything was clicked through against a mock API with the backend's real error codes, not yet against the real backend, a real Google client ID or Razorpay test mode, so say exactly that. No Lighthouse numbers yet.

## One-line summary

A server-rendered Next.js landing page built for budget Android phones: animations that run in CSS or outside React's render loop, accessible primitives for menus, and real API data with an honest empty state instead of fake content.

## Why it looks and behaves this way (the business reason)

The product sells trust to anxious final-year students and their parents. So the page avoids anything that smells fake (no invented student counts, a "Sample data" label on the product preview, no placeholder programs when the API is down), and every section answers a real worry. Performance matters because the audience is on ₹8–15k phones and mobile data.

## Stories to tell

**1. Animation without slowing the phone.** "Most motion is plain CSS: the hero entrance, the highlighter, the clouds, the menu. CSS animations run off the main thread and start before React hydrates, so they never delay the first paint. Where I needed per-frame values, like pointer parallax or the frame tilting as you scroll, I used motion values, which update the DOM directly without re-rendering React. The ambient loops pause when the hero is off-screen."

**2. A performance bug I caught by reasoning, not by profiling.** "The dashboard frame had a frosted-glass blur and it also tilts as you scroll. A blur behind something that moves gets recomputed every frame, which is expensive on a cheap GPU. The rim was only 8 px, so the blur added almost nothing visually. I removed it and used a translucent white instead." (Say it was caught in review; it wasn't measured on a device.)

**3. A hydration bug from reduced motion.** "The frame tilt read `prefers-reduced-motion` in JavaScript. The server can't know that, so it rendered the tilt and the client rendered nothing, and React flagged a mismatch. I moved the reduced-motion case into CSS (`motion-reduce:transform-none!`), so server and client always render the same HTML."

**4. Reveals that never hide content.** "Scroll reveals usually start with content hidden, which breaks without JavaScript and can make things blink on hydration. My `InView` component only arms sections still below the fold when the page loads, by setting a data attribute. The server HTML has no hidden state at all, and CSS plays the reveal once."

**5. Honest data from the API.** "The nav's Programs menu comes from `GET /api/courses`, cached on the server with Next's `use cache` and about a 10-minute revalidate, so the page stays static. If the API is down it returns an empty list and the menu says 'New batches are being announced'. I'd rather show nothing than a fake program."

**6. Accessibility through primitives.** "I didn't hand-roll the dropdown or the mobile menu. Radix NavigationMenu gives keyboard navigation and hover-intent; Radix Dialog gives the focus trap, Esc to close and scroll lock. I only styled and animated them. One detail: tapping a section link closes the menu first and scrolls after the scroll lock is released, otherwise the jump doesn't happen."

**7. Knowing when to stop animating.** "I built the problem section twice with ambitious animation: first a scroll-pinned story, then parachute drops. Both looked impressive in isolation, but the first broke on phones and the owner felt both distracted from the message. We agreed on a rule for the whole page: one consistent theme and only small interactions (hover lifts, a press scale, one-time reveals). The rest of the landing was built on a shared section wrapper, heading component and card style, which is also why it could be finished in a day."

**8. A demo that can't mislead.** "The landing page has a verify widget, but the real verification API isn't public yet. So the demo only recognises a clearly labelled sample ID. Any other ID gets a message explaining where real certificates are checked. It shows the experience without pretending to check something it can't."

**9. Product as the hero, honestly.** "Following monday.com's pattern, the landing shows the product itself: classroom boards built in real HTML with status pills, not screenshots. Every board is labelled 'Sample data', and where monday shows customer logos we show what each internship includes, because we have no partner logos and inventing them would undercut the whole trust pitch."

**10. Token refresh without a stampede.** "The access token lives only in memory, so a page reload or XSS can't read it from storage. When it expires, five queries might fail at once. If each one refreshed on its own, the refresh-token rotation would treat the second refresh as reuse and log the user out. So `refreshSession()` keeps one shared promise: the first failure starts the refresh, the others wait on the same promise, then each retries once."

**11. Destructive admin actions.** "Refund, revoke and role change can't be undone and affect a real student's documents. Every one goes through the same confirm dialog, which names the consequence ('the verify page will show this as revoked to everyone'). Where the API logs a reason, the dialog requires one before the button enables. If the API refuses, say `NO_PAID_PAYMENT`, the error appears inside the dialog with a plain explanation, mapped from the error code, not the message text."

**12. Reorder without a library.** "Admins reorder modules and lessons. Instead of adding a drag-and-drop package, I used native HTML drag events plus up/down buttons. The buttons matter: native drag doesn't work on touch or with a keyboard, and the buttons give both, with an `aria-live` line announcing the new position. The new order shows immediately and is sent as one request; if it fails, the list snaps back."

**13. Payment status that never lies.** "After Razorpay closes, the browser calls verify. If verify can't confirm (signature mismatch, network), the money may still have moved, and the backend's webhook will activate the enrollment. So the status page never says 'failed' there: it says 'Confirming your payment, don't pay again' and polls the enrollments list for 90 seconds, then tells the student it can take a few minutes. The worst UX bug in payments is a student paying twice."

**14. A logo that vanished on phones.** "On mobile the header logo was blank. The SVG used fixed gradient ids, and the page had two logos: one in the desktop sidebar, hidden with display:none on phones, and one in the mobile header. Both pointed at the first gradient, and a gradient inside a display:none subtree doesn't paint. Fix: `useId()` per instance. It was also a latent bug on the marketing pages, which have a logo in both nav and footer."

**15. One app, two hosts.** "beyownd.in and classroom.beyownd.in are one Next.js project. `proxy.ts` rewrites `classroom…/dashboard` to the `/app/dashboard` route, and each host redirects paths that belong to the other. Locally it's one origin with an `/app` prefix, so the proxy is a no-op and every link goes through one `CLASSROOM_URL` constant. Testing it surfaced a second bug: links were absolute in production, but `usePathname()` returns only the path, so the active tab never highlighted."

**16. Not inventing facts.** "While writing copy I caught myself promising things the system doesn't do: 'refunds in 5-7 days', 'money is returned automatically', 'access for the batch duration'. I checked each against the backend and removed them. Legal pages show a clearly marked placeholder, are noindex and stay out of the sitemap until the owner's text arrives, controlled by one list in `lib/legal.ts`."

## Decisions & trade-offs

- **Client-rendered app behind login, server-rendered marketing**: app pages need the in-memory token and aren't indexed anyway, so there's nothing to gain from server rendering them.
- **Razorpay and Google scripts load on demand** (Pay button, auth pages), not on every page.
- **OTP email in sessionStorage, not the URL**, so it doesn't land in history or logs; pages still work without it.
- **Error handling by `code`**: messages can change wording; codes are the contract with the backend.

- **CSS-first motion, `motion` only where needed**, loaded through `LazyMotion` with the smaller `domAnimation` feature set to keep JavaScript down.
- **Generated SVG art** instead of images: no image tool was available, the files are a few KB, and they're swappable for commissioned art later.
- **Poppins only**: the final direction (monday.com-inspired) uses one geometric family, light 300 for big headlines. Earlier iterations used Fraunces and Geist.
- **Radix directly instead of the shadcn CLI**: same primitives, and it avoided pulling in a second icon library.
- **Morphicons pinned to an older version**: the newest release was three days old when installed, so I pinned the last version that had been out for weeks.

## Likely questions

- *"Why Next.js and not a plain React SPA?"* Server rendering gives a fast first paint on 4G and makes the landing and verify pages crawlable. The app shares the same project through route groups.
- *"How do you keep the landing fast?"* Server components by default, client code only for interactive leaves, CSS animations, cached API data, fixed-size SVG art. Real Lighthouse numbers come in the performance pass; don't quote any before then.
- *"How did you test it?"* Screenshots at six widths with Playwright, keyboard-only and reduced-motion passes, computed contrast ratios, and lint/type checks. No automated UI tests yet.
