# How to Write a Beyownd Course

**For:** you (the owner), writing real course content (task **Y8** in [../REMAINING.md](../REMAINING.md)).
**Working example:** [example-course/](example-course/) — copy this folder and edit it.

You write the course as **one folder**: a `course.json` file for the structure, and normal **Markdown files** for the lesson notes and the project brief. One command loads it into the website. You can run the command again any time after fixing something — it updates the course, it never creates duplicates.

---

## 1. Folder layout

```text
my-course/
├── course.json          ← structure: title, price, modules, lessons, quizzes, project
├── project.md           ← final project brief
└── lessons/
    ├── m1-01-intro.md   ← one Markdown file per text lesson
    ├── m1-02-....md
    └── m2-01-....md
```

Name lesson files any way you like; the order comes from `course.json`, not from the file names. `m1-01-…` (module 1, lesson 1) just keeps the folder tidy.

## 2. `course.json` — field by field

### The course

| Field | Required | Rules / example |
| --- | --- | --- |
| `slug` | ✅ | The web address: `full-stack-web-dev` → `beyownd.in/programs/full-stack-web-dev`. Lowercase letters, numbers, hyphens. **Don't change it after launch** (old links break) |
| `title` | ✅ | 5–100 characters, e.g. "Full Stack Web Development" |
| `tagline` | | ≤ 160 characters, shown on program cards |
| `description` | ✅ | ≤ 5,000 characters, shown on the program page |
| `level` | | `beginner` or `intermediate` |
| `skills` | | Up to 15, e.g. `["HTML", "CSS", "Node.js"]` — printed on the certificate |
| `durationWeeks` | ✅ | 4–12 |
| `defaultPricePaise` | ✅ | **Price in paise**: `59900` = ₹599, `79900` = ₹799. Each batch can override it |
| `project` | ✅ | See below |
| `modules` | ✅ | At least one — see below |

### The final project

| Field | Required | Rules |
| --- | --- | --- |
| `title` | ✅ | e.g. "Job Board" |
| `briefFile` | ✅ (or `brief`) | Markdown file with the requirements, e.g. `"project.md"` |
| `rubric` | ✅ | **3–8 criteria**, each `{ "criterion": "...", "maxScore": 10 }` — what the mentor scores |
| `passScorePercent` | | Default 60. The mentor can't approve below this |

### Modules (in order — module 1 must be finished before module 2 opens)

| Field | Required | Rules |
| --- | --- | --- |
| `title` | ✅ | 3–100 characters |
| `description` | | ≤ 500 characters |
| `isFreePreview` | | `true` = anyone can read this module's lessons without paying. **Make module 1 free** — it convinces students to buy |
| `lessons` | ✅ | At least one |
| `quiz` | | Recommended for every module. Students must pass it to unlock the next module |

### Lessons

| Field | Required | Rules |
| --- | --- | --- |
| `title` | ✅ | 3–120 characters |
| `contentFile` | for text lessons | Path to the Markdown file, e.g. `"lessons/m1-01-intro.md"` (must be inside the course folder) |
| `content` | | Short text instead of a file (good for video lessons: "Watch, then …") |
| `type` | | `text` (default) or `video` |
| `videoYoutubeId` | for video lessons | The 11 characters after `v=` in a YouTube link: `youtube.com/watch?v=`**`OEV8gMkCHXQ`**. Upload as **Unlisted** if it's your own video |
| `estimatedMinutes` | | 1–120, shown to students |

### Quizzes

| Field | Rules |
| --- | --- |
| `passPercent` | Default 60 |
| `questions` | **3–30** questions |
| `questions[].prompt` | The question (Markdown and `code` allowed) |
| `questions[].type` | `single` (default, one right answer) or `multiple` (select all that apply — student must pick exactly the right set) |
| `questions[].options` | 2–6 answer choices |
| `questions[].correctOptionIndexes` | **Counting starts at 0**: first option = `0`, second = `1`. `single` → exactly one, e.g. `[1]`. `multiple` → e.g. `[0, 2]` |
| `questions[].explanation` | Shown only **after the student passes** — explain why the answer is right |
| `questions[].points` | 1–10, default 1 (harder questions can be worth more) |

## 3. Writing lessons in Markdown

Markdown is plain text with simple marks — VS Code shows a live preview (`Ctrl+Shift+V`).

````markdown
# Lesson title

Normal paragraph. **Bold**, *italic*, `inline code`.

## A sub-heading

- bullet one
- bullet two

1. step one
2. step two

```js
// code block - students get syntax highlighting
const greeting = "Hello";
```

> A tip box (quote).

[A link](https://developer.mozilla.org)
````

**Tips that work for our students**
- Short lessons (10–20 minutes). One idea per lesson.
- Simple English, short sentences. Explain every new word the first time.
- Show code, then explain it line by line.
- End text lessons with a small **"Try it"** task.
- Raw HTML in Markdown is removed for security — use Markdown only.

## 4. Load it into the website

From the `beyownd-backend` folder:

```bash
# 1. Check only - writes nothing. Fix any error it shows, run again until "Valid ✓"
npm run import:course -- ../docs/content/my-course/course.json --dry-run

# 2. Import (stays a draft - not visible on the website yet)
npm run import:course -- ../docs/content/my-course/course.json

# 3. When ready: import + publish (visible on beyownd.in)
npm run import:course -- ../docs/content/my-course/course.json --publish
```

- It imports into whichever database `MONGO_URI` in `.env` points to — check before running.
- Errors name the exact place, e.g. `module 2 ("JavaScript Essentials"), lesson 3: file "lessons/m2-03.md" not found`.
- **Running it again** updates everything to match the folder. Lessons/modules you deleted from the file are removed — **unless students are already enrolled**, in which case it refuses (content can't vanish mid-batch). Edit those through the admin panel instead.
- After importing, create a **batch** (dates, price, seats) in the admin panel before students can enroll.

## 5. Checklist before you publish

- [ ] Every module has at least one lesson and a quiz
- [ ] Module 1 is `isFreePreview: true`
- [ ] Quiz answers double-checked (indexes start at **0**!)
- [ ] Project brief says exactly what to build and how to submit
- [ ] Rubric criteria are clear enough for a mentor to score
- [ ] Videos are set to Unlisted / Public, not Private
- [ ] `--dry-run` says **Valid ✓**
- [ ] Read through the course on the website as a student before publishing
