# Lesson Renderer — frontend brief

**For:** the frontend session (`beyownd-frontend/`).
**Backend status:** ✅ done and tested (Oct 26). Nothing here needs a backend change; if something does, write it in [backend-requests.md](backend-requests.md).
**Format contract:** [../content/LESSON_FORMAT.md](../content/LESSON_FORMAT.md) — read §1 and §7 first.
**Visual reference:** the owner's HTML note the format was built from (ask the owner for "Redis Beyond Caching.html"): numbered sections with a sidebar, quiz cards, code with file name + copy, step flows, callouts. Match its *structure*, use our design system ([BRIEF.md](BRIEF.md)) for the look.
**Test content:** [../content/redis-course/lessons/](../content/redis-course/lessons/) — 8 real lessons. Import it (`npm run import:course -- ../docs/content/redis-course/course.json --publish` in the backend) and build against it.

---

## 1. What the API sends

`GET /api/enrollments/:id/lessons/:lessonId` (enrolled) and `GET /api/courses/:slug/preview/lessons/:lessonId` (free preview) return `lesson`:

```ts
interface LessonContent {
  id: string; courseId: string; moduleId: string;
  title: string;                // render as the page H1
  order: number;
  type: 'text' | 'video';
  content: string;              // Markdown + blocks; asset refs already turned into URLs
  sections: { id: string; title: string; subtitle: string | null; line: number }[];
  formatVersion: 1;
  videoYoutubeId: string | null;
  estimatedMinutes: number;
}
```

- `sections` = every `## ` heading in order. Use it for the sidebar; put `id={sections[i].id}` on the i-th `##` you render (match by order, not by re-slugging).
- `sections` can be `[]` (short lessons, or old lessons written before this format) → no sidebar, just the article.
- Old lessons may contain a `# ` heading → render it as an `h2`, never a second `h1`.

## 2. Pipeline

```
react-markdown
  remarkPlugins: [remark-gfm, remark-directive, beyowndBlocks]
  rehypePlugins: [rehype-sanitize (schema extended for our components + code meta)]
  components: { h2, pre/code, table, img, a, ... }
```

`beyowndBlocks` (a ~40-line remark plugin): for `containerDirective` nodes named `callout | quiz | steps | details | interactive`, set `data.hName` / `data.hProperties` so react-markdown maps them to your components. **Every other directive** (`textDirective`, `leafDirective`, unknown names) → turn back into its original text: `:name` + `[label]` + `{attrs}`. Without this, Redis keys like `session:abc` vanish from the page. Test: `"Keys like user:profile"` must render exactly that.

Never enable raw HTML (`rehype-raw`). The backend already rejects dangerous HTML; the renderer must still drop all of it.

## 3. Components

| Block | Build |
| --- | --- |
| `##` section | Big number (01, 02…), title, subtitle (from `sections[].subtitle`, don't render the italic line twice — skip the first paragraph after the heading if it equals the subtitle). `scroll-margin-top` for the sticky header. |
| Code block | Header bar: file name (`title` from the code node's `meta`, e.g. `js title="lib/redis.js"`) or the language; **Copy** button (copies the raw code, shows "Copied" 2 s, works without HTTPS fallback). Syntax highlight with **shiki at build time is not possible** (content is runtime) → use a light highlighter (e.g. `prism-react-renderer`), lazy-load languages. Horizontal scroll inside the block, never the page. |
| `mermaid` code | Render as a diagram; lazy-load mermaid **only** when a lesson has one (it's large). Fallback: show the code. |
| `:::callout` | `type` → note / tip / warning / danger styling + icon; optional title from the label. |
| `:::quiz` | Card "Quiz · 03" (count per lesson). Question (may include code), options as buttons (≥ 44 px). Single right answer → pick one; several `[x]` → checkboxes + "Check". Show right/wrong, then the `>` explanation. "Try again" resets. Practice only: nothing sent to the server; state can live in memory. Keyboard + screen reader friendly (`role="radiogroup"` / `aria-live` for the result). |
| `:::steps` | Vertical timeline: dot + line + bold title + description per list item. |
| `:::details` | Native `<details><summary>` styled. |
| `:::interactive` | See §4. |
| Table | Wrapped in a horizontal scroller with a visible edge shadow on phones. |
| Image | `loading="lazy"`, `decoding="async"`, max-width 100%, alt from Markdown. Tap to open full size. |
| Link | External → `target="_blank" rel="noopener noreferrer"`. `#id` → smooth scroll. |

## 4. Interactive widgets (security matters here)

```tsx
<iframe
  src={src}
  title={label}
  sandbox="allow-scripts"        // NEVER add allow-same-origin
  loading="lazy"
  referrerPolicy="no-referrer"
  style={{ height }}             // from {height} attr, default 420
/>
```

- Widgets are served from `/api/assets/…` with their own CSP (`sandbox`, `connect-src 'none'`, `frame-ancestors` = our frontend origins). They can't read cookies, call the API, or touch the page.
- Resize: listen for `message` events where `event.source === iframe.contentWindow` and `event.data?.type === 'beyownd:resize'`; set height to `clamp(160, Number(event.data.height), 1200)`. Ignore everything else.
- Show the label above and the caption (the block's text) below. Until it loads: a skeleton at the starting height (no layout jump).
- Below 360 px wide, keep it full-bleed inside the article gutter.

## 5. Layout

- **Desktop (≥ 1024 px):** left sticky sidebar = lesson's sections (number + title), active one highlighted via `IntersectionObserver`; article max ~720 px; reading progress bar at the top.
- **Phone:** no sidebar. A sticky "Sections" button opens a bottom sheet with the same list (tap → scroll + close). Progress bar stays.
- Remember the scroll position per lesson (sessionStorage) so going back doesn't lose the place.
- "Mark as complete" stays where it is today (end of article) — this brief doesn't change progress rules.

## 6. Performance budget (₹8k Android, 4G)

- Lesson route JS: highlighter + markdown pipeline lazy, mermaid only when used, no widget JS in our bundle (it's in the iframe).
- Render all text immediately; widgets and images lazy.
- Long lessons (~12k characters, 4 quizzes, 7 code blocks — see `06-data-structures-and-rate-limiting.md`) must scroll smoothly on a mid phone: no re-render of the whole article on quiz clicks (keep quiz state inside the quiz component).

## 7. Admin editor (when you build the content editor)

- `POST /api/admin/lessons/check` `{ content, type? }` → `{ ok, errors[{line,message}], warnings[], sections[], stats }`. Use it for a live "Check" button (debounce ~800 ms); show errors next to line numbers.
- Saving (`POST /modules/:id/lessons`, `PATCH /lessons/:id`) with a broken lesson → `400 LESSON_FORMAT_INVALID`, `details.errors` = the same list. Success responses include `warnings`.
- Upload: `POST /api/admin/assets?filename=diagram.png`, body = raw file bytes (`fetch(url, { method: 'POST', body: file })`, not FormData). → `{ asset: { ref, url, kind, bytes } }`. Insert `ref` (`beyownd-asset:…`) into the content, not `url`. Errors: `400 ASSET_INVALID` (message says why), `413` over 2 MB.
- Saving a practice quiz that copies a graded quiz question → 400 (lesson) / `QUIZ_ANSWER_LEAK` (quiz). Show the message.

## 8. Done when

- [ ] All 8 redis-course lessons render with no missing text (compare against the `.md` files)
- [ ] `user:profile`-style text renders as-is
- [ ] Load calculator widget works and resizes; opening its URL directly can't read our cookies
- [ ] Sidebar / Sections sheet / progress work on a 360 px phone
- [ ] Quiz: single and multiple answers, keyboard only, screen reader announces the result
- [ ] Lighthouse mobile on a lesson page: Performance ≥ 85, Accessibility ≥ 95
