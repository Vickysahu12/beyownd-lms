# Interview — Phase 4: Frontend (Next.js)

**Status:** 🟡 Landing page built. The student app isn't built yet, so don't claim it. Lighthouse and bundle numbers aren't measured yet, so don't quote any.

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

## Decisions & trade-offs

- **CSS-first motion, `motion` only where needed**, loaded through `LazyMotion` with the smaller `domAnimation` feature set to keep JavaScript down.
- **Generated SVG art** instead of images: no image tool was available, the files are a few KB, and they're swappable for commissioned art later.
- **Poppins only**: the final direction (monday.com-inspired) uses one geometric family, light 300 for big headlines. Earlier iterations used Fraunces and Geist.
- **Radix directly instead of the shadcn CLI**: same primitives, and it avoided pulling in a second icon library.
- **Morphicons pinned to an older version**: the newest release was three days old when installed, so I pinned the last version that had been out for weeks.

## Likely questions

- *"Why Next.js and not a plain React SPA?"* Server rendering gives a fast first paint on 4G and makes the landing and verify pages crawlable. The app shares the same project through route groups.
- *"How do you keep the landing fast?"* Server components by default, client code only for interactive leaves, CSS animations, cached API data, fixed-size SVG art. Real Lighthouse numbers come in the performance pass; don't quote any before then.
- *"How did you test it?"* Screenshots at six widths with Playwright, keyboard-only and reduced-motion passes, computed contrast ratios, and lint/type checks. No automated UI tests yet.
