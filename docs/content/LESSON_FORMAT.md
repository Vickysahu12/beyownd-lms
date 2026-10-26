# Lesson Format (rich lessons)

**For:** anyone writing lesson notes (you, or Claude generating them), and the frontend renderer.
**This file is the contract.** The backend checks every lesson against it ([lessonFormat.ts](../../beyownd-backend/src/services/content/lessonFormat.ts)); the frontend renders exactly what is described here. If they ever disagree, this file wins and the code gets fixed.
**Real example:** [redis-course/](redis-course/) — a full 8-lesson course converted from a hand-made HTML note. Every block below is used there.

A lesson is **Markdown** (GitHub style: tables, task lists) plus a few **blocks** written as `:::name … :::`. The syntax is the standard [remark-directive](https://github.com/remarkjs/remark-directive) syntax, so it isn't a custom format the frontend has to invent a parser for.

---

## 1. Quick reference

````markdown
Intro paragraph. **Bold**, *italic*, `code`, [link](https://redis.io).

## Section title
*Optional one-line subtitle — the first line under a section, fully in italics*

### Sub-heading (not in the sidebar)

```js title="lib/redis.js"
export const redis = new Redis(process.env.REDIS_URL);
```

:::callout[Analogy]{type="note"}
A bank with a fixed number of counters…
:::

:::steps
1. **Reader asks for post 42** — cache miss
2. **Server reads MongoDB** — and stores a copy in Redis
3. **Next reader** — served from Redis
:::

:::quiz
What does `redis.get()` return for a missing key?

- [x] `null`
- [ ] `undefined`

> Redis replies "nil", which ioredis turns into `null`.
:::

:::details[Why not just use a Map?]
A Map lives in one server's memory…
:::

:::interactive[Load calculator]{src="assets/load-calculator.html" height=460}
Move the slider, then switch the cache on.
:::

| Command | What it does |
| --- | --- |
| `GET key` | reads a value |

![Cache-aside flow](assets/cache-aside.png)
````

Check a lesson any time, without a database:

```bash
cd beyownd-backend
npm run check:lesson -- ../docs/content/my-course/lessons/*.md
```

---

## 2. Structure rules

| Rule | Why |
| --- | --- |
| **No `# ` (H1).** Start with text or a `## ` section. | The lesson title is shown automatically from `course.json`. |
| `## ` = a **section**. Each one appears in the sidebar (desktop) and the "Sections" menu (phone), numbered 01, 02, … | Long lessons stay navigable. |
| The first line under a `## `, if it is *fully italic*, becomes the section **subtitle**. | Matches the note design (title + grey subtitle). |
| `###` and `####` are sub-headings inside a section (not in the sidebar). | |
| Max **40 sections**, **30 quizzes**, **5 interactive widgets**, **50,000 characters** per lesson. | Phones. A note bigger than this is a module: split it into lessons (the Redis note became 8). |
| Blocks can't be nested and can't contain headings. | Keeps the sidebar and the renderer simple. |
| Raw HTML is **not rendered**. `<script>`, `<iframe>`, `<style>`, event handlers (`onclick=`) are **errors**; other tags are warnings. Write HTML *about* HTML in backticks: `` `<div>` ``. | Security: lessons never run code in the page. Widgets are the only way to run code, and they're sandboxed (§5). |
| One-line `<!-- comments -->` are allowed as notes to yourself (e.g. `<!-- TODO widget: TTL lab -->`). They are never shown. | |
| Everything inside a code block is ignored by the checker — writing `:::` or `<script>` in code is fine. | |

Line endings (Windows/Mac) and a UTF-8 BOM don't matter.

---

## 3. Blocks

A block starts with `:::name`, optional `[label]` and optional `{attributes}`, and ends with `:::` on its own line. Exactly three colons. Attributes: `key="value"`, `key='value'`, `key=value`.

### `:::callout` — a highlighted box

```markdown
:::callout[Optional title]{type="tip"}
Text, lists, code - anything except headings.
:::
```

`type`: `note` (default) · `tip` · `warning` · `danger`. Must not be empty. Title ≤ 80 characters.

### `:::quiz` — a practice question inside the notes

```markdown
:::quiz
Question text (can include `code`, a code block, or a > quote).

- [ ] wrong option
- [x] right option
- [x] another right option (more than one is allowed)

> Explanation shown after answering. Can span
> several lines.
:::
```

- Question first, then **2–6 options** as task items: `- [ ]` wrong, `- [x]` right. Then an optional explanation starting with `>`.
- At least one right **and** one wrong option. No empty or duplicate options.
- No explanation → warning (students learn more when told *why*).
- **Practice only — not graded.** The answer is in the page. Graded questions live in the module quiz in `course.json`, and **a practice question must not copy a graded one** — the importer and admin editor block it (the student would see the graded answer).
- `[label]` is ignored (quizzes are numbered automatically).

### `:::steps` — a numbered flow

```markdown
:::steps
1. **Short title** — one line of explanation
2. **Next step** — …
:::
```

A numbered list with **at least 2** non-empty steps, and the list must come first (intro text goes above the block). `1)` also works.

### `:::details` — click to expand

```markdown
:::details[The question or summary shown closed]
Hidden until the student opens it.
:::
```

Needs a summary (≤ 120 characters) and content.

### `:::interactive` — a "Try it" widget

```markdown
:::interactive[Title shown above the widget]{src="assets/ttl-lab.html" height=480}
Optional one-line caption / instructions (≤ 500 characters).
:::
```

- `src` must be an `.html` file in the course's `assets/` folder. Never a URL.
- `height` (optional): 160–900 px, the starting height (default 420). Widgets can resize themselves (§5).
- Max 5 per lesson.

---

## 4. Code, images, links, tables

**Code blocks** — always give a language; optionally a file name:

````markdown
```js title="routes/posts.js"
app.get("/posts/:id", getPost);
```
````

- Only `title="…"` (≤ 80 chars) is allowed after the language.
- Known languages: `js ts jsx tsx json bash sh shell powershell html css scss sql python java c cpp go yaml dockerfile redis text markdown diff http nginx ini env graphql mermaid` (+ aliases). Unknown → warning, shown without highlighting.
- `mermaid` code blocks are rendered as diagrams.

**Images** — `![alt text](assets/diagram.png)` or an `https://` URL.
- Files go in `assets/` (paths start from the folder with `course.json`, **not** from the lesson file — so `assets/x.png`, never `../assets/x.png`).
- png, jpg, webp, gif, svg. **Max 2 MB; aim for < 400 KB** (warning above that — students are on mobile data).
- Always write alt text (warning if empty).
- `http://`, `data:` and `javascript:` images are errors.
- File names are **case-sensitive** (`Diagram.png` ≠ `diagram.png`). Windows doesn't care, the server does — the importer catches it.

**Links** — `[text](https://…)`. `javascript:`/`data:` links are errors; `http://` is a warning.

**Tables** — GitHub tables. Wide tables scroll sideways on phones.

---

## 5. Widgets (`assets/*.html`)

A widget is **one self-contained HTML file**: inline `<style>` and `<script>`, images as `data:` URLs. Look at [redis-course/assets/load-calculator.html](redis-course/assets/load-calculator.html).

| Allowed | Not allowed (upload is rejected or the browser blocks it) |
| --- | --- |
| Inline JS and CSS, `data:`/`blob:` images and fonts, canvas, SVG, animations | `<script src>`, `<link href>`, `@import`, `<img>` from the internet |
| `parent.postMessage(...)` for the resize message below | `fetch`/XHR/WebSocket (blocked: `connect-src 'none'`) |
| | Cookies, `localStorage`, reading the page around it (the widget runs in a sandbox with its own empty origin) |
| | Forms, popups, navigating the page |

Limits: **300 KB**, UTF-8.

**Resize contract.** To fit its content, a widget posts its height:

```js
parent.postMessage({ type: 'beyownd:resize', height: document.documentElement.scrollHeight }, '*');
```

The page clamps it to 160–1,200 px.

**Make it work on a ₹8k phone:** min tap size 44 px, works at 320 px wide, respects `prefers-color-scheme` and `prefers-reduced-motion`, no work when nothing changes.

---

## 6. How assets travel (for the curious)

1. Import: `assets/flow.png` is read from the course folder, checked (real PNG? size? unsafe SVG?), stored under its content hash (`3f9a…c1.png`), and the lesson text becomes `![…](beyownd-asset:3f9a…c1.png)`.
2. Admin editor: upload the file (`POST /api/admin/assets`), paste the `beyownd-asset:` reference it returns.
3. Students: the API replaces `beyownd-asset:` with the real URL (`/api/assets/…` now, the CDN in production). Same file → same name, so browsers cache it for a year and re-imports never duplicate files.

---

## 7. Renderer rules (frontend)

Full brief: [../frontend/LESSON_RENDERER.md](../frontend/LESSON_RENDERER.md). The rules the content depends on:

- Pipeline: `react-markdown` + `remark-gfm` + `remark-directive` + a small plugin mapping the five block names to components + `rehype-sanitize`. Raw HTML is never rendered.
- `## ` headings get `id` = the `sections[].id` from the lesson API (the backend computes them: lowercase, a–z0–9 and hyphens, duplicates get `-2`, `-3`; non-Latin titles become `section`, `section-2`). Use the API's list for the sidebar; don't compute it again.
- **Unknown inline/leaf directives must render as their original text.** remark-directive reads `session:abc` in prose as a directive named `abc` — Redis keys are everywhere in our notes, so they must not disappear.
- Code block `title` comes from the code node's `meta`.
- Widgets: `<iframe sandbox="allow-scripts" src=… loading="lazy">` — **never** add `allow-same-origin`. Accept `beyownd:resize` messages only when `event.source` is that iframe's `contentWindow`.
- Practice quizzes are checked in the browser (answers are in the content); nothing is sent to the server.

---

## 8. Writing with Claude

Ask for lessons "in Beyownd lesson format (docs/content/LESSON_FORMAT.md)". In this repo, the **lesson-writer** skill (`.claude/skills/lesson-writer/`) already knows these rules, the size limits, and how to split a topic into a module. Always run `npm run check:lesson` on what comes back, then `import:course --dry-run`.
