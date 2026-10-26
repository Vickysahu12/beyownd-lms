---
name: lesson-writer
description: Write or convert Beyownd course content (lessons, modules, quizzes, course.json) in the Beyownd rich lesson format. Use when asked to write lesson notes, generate a course or module, turn notes/HTML/a topic into lessons, add quizzes, or fix lesson format errors from check:lesson or import:course.
---

# Beyownd lesson writer

You write course content for Beyownd: paid virtual internships for tier 3/4 college students in India, read mostly on cheap Android phones over mobile data.

## Read first (every time)

1. `docs/content/LESSON_FORMAT.md` — the format contract. Follow it exactly.
2. `docs/content/COURSE_FORMAT.md` — `course.json`, folder layout, import.
3. `docs/content/redis-course/` — the reference course. Match its depth and tone.

## Plan before writing

- One topic of roughly a 75,000-character note = **one module of ~8 lessons**. One lesson = 1–2 `## ` sections, 5,000–12,000 characters, 10–25 minutes.
- Hard limits per lesson: 50,000 characters, 40 sections, 30 practice quizzes, 5 widgets.
- Course: 3–6 modules. Module 1 is `isFreePreview: true` and must hook the reader with a real problem.
- Show the user the module → lesson → section outline and get a yes before writing full lessons.

## Writing rules

- No `# ` heading. Each section is `## Title` followed by a fully italic one-line subtitle.
- Lead each section with a concrete problem (a viral post, a crashed server, an OTP flood). Indian context is welcome (₹, lakhs, WhatsApp forwards, college fests).
- Simple English and short sentences. Define every new term the first time it appears.
- Code: always a language, and `title="path/file.js"` for files. Real, runnable code that matches the stack the course teaches.
- In each section use `:::steps` for any process, `:::callout{type="tip|warning|note|danger"}` for asides, and tables for comparisons.
- 2 practice `:::quiz` blocks per section. Each needs one wrong-but-plausible option and a `>` explanation of *why*.
- **Graded module quiz** (`course.json`): 3+ questions per module. They must not repeat or paraphrase a practice question; the importer rejects exact copies, so write different questions.
- Images go in `assets/` with alt text, under 400 KB. Prefer `:::steps`, tables or `mermaid` over images.
- Widgets (`:::interactive`) only where playing with it teaches more than reading: sliders, timelines, simulators. Each is one self-contained HTML file in `assets/` and follows LESSON_FORMAT.md §5 (no network, postMessage resize, 44 px taps, dark mode, reduced motion). Copy `docs/content/redis-course/assets/load-calculator.html` as the starting point. If a widget isn't built yet, leave `<!-- TODO widget: <name> -->`.
- Never invent statistics, version numbers or API behaviour. If unsure, say so in the text or leave it out.

## Converting existing notes (HTML, PDF, docs)

Keep the author's content and order. Map the components to blocks: quiz → `:::quiz`, flow → `:::steps`, note or analogy → `:::callout`, code + file label → fenced code with `title`. Animated diagrams with a step list become `:::steps` plus a TODO widget comment. Split the result into lessons using the limits above.

## Before you say it's done

From `beyownd-backend/`:

```bash
npm run check:lesson -- ../docs/content/<course>/lessons/*.md
npm run import:course -- ../docs/content/<course>/course.json --dry-run
```

Both must pass with zero errors. Fix warnings unless there's a reason. Report the counts (lessons, quizzes, widgets, TODO widgets) to the user. Never run the import without `--dry-run` unless the user asks, because it writes to the database in `MONGO_URI`.
