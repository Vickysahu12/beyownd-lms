# Interview — Phase 5b: Rich Lessons

**Status:** ✅ Backend built and tested (71 tests, 232 total). The renderer is frontend work. Don't claim it until it exists. Only 1 of the 20 Redis simulators is rebuilt so far.

## One-line summary

A lesson format (Markdown plus five blocks) checked by a line-precise validator shared by the importer, the admin editor and a CLI, with sandboxed HTML simulators, so a new course is content only, with no new code.

## Stories to tell

**1. Why not just store the HTML notes?** "The owner had beautiful hand-made HTML notes with quizzes and simulators. Storing raw HTML means running arbitrary scripts on our site, and every course would need a developer. I split it in two. The text is Markdown with five blocks in the standard remark-directive syntax, so writers, Claude and the frontend library all already understand it. The interactive parts are self-contained HTML files that run in a sandbox. To check the design I converted the real 76,000-character note: 32 quizzes, 16 sections, all text preserved. It's imported in a test, so the reference course can never silently break."

**2. Errors with line numbers, all at once.** "The first importer stopped at the first problem. With a generated 8-lesson course that means fix, rerun, fix, rerun. Now the validator walks each file line by line, collects everything, and prints `lessons/04.md line 37: Quiz has no correct option`. It's a pure function with no database, so the same code runs in the CLI, the importer and the editor's 'Check' button, and it has 49 unit tests."

**3. The answer-leak bug that couldn't happen.** "Practice quizzes are checked in the browser, so their answers are in the page. If a writer, or an AI, reused a graded module-quiz question as practice, students would see the graded answer. The importer, the lesson save and the quiz save all compare the two sets (ignoring case, spaces and Markdown) and refuse a match."

**4. Sandboxing simulators properly.** "A sandboxed iframe isn't enough on its own. If someone opens the widget URL directly, it would run on our API's origin. So the server sends a CSP `sandbox` header on the file itself: the document gets an opaque origin wherever it's opened, with `connect-src 'none'` and `frame-ancestors` limited to our frontend. I also had to undo two helmet defaults, `X-Frame-Options` and same-origin CORP, which would have blocked our own frontend from embedding it. The tests assert every header."

**5. Bugs found by thinking about real users.**
- A 50,000-character Hindi lesson is about 140 KB of UTF-8, and our global JSON limit was 100 KB. So the limit was in characters for the writer and bytes for the server. Admin routes now get 512 KB.
- `Diagram.png` vs `diagram.png` works on Windows and 404s on Linux, so the importer compares the exact directory entry.
- `remark-directive` reads `session:abc` as a directive, and Redis keys would vanish. The frontend contract says unknown directives render as text.

**6. Content-addressed assets.** "Files are stored by the hash of their bytes. Re-importing writes nothing new, two lessons share one file, and the URL never changes, so it can be cached for a year. I write assets before the database transaction. If the transaction fails, the worst case is an unused file, never a lesson pointing at a missing one."

## Decisions & trade-offs

- **Standard syntax over a custom one.** remark-directive is slightly more verbose than a home-made `[quiz]` tag, but nobody has to write or maintain a parser on the frontend.
- **No nesting.** Allowing callouts inside steps inside details makes validation and rendering much harder for little teaching value.
- **Validate on change only.** Old lessons can still be renamed; the rules apply when content is edited. Delivery never fails.
- **Public assets by hash.** Images and simulators aren't the paid value; lesson text and credentials are. Signed URLs would break long-term caching. Revisit if a course's widgets become the product.
- **Limits (50k characters, 5 widgets) are product decisions.** They push a big note into a module of short lessons, which suits phone reading and progress tracking.

## Likely questions

**Q: Isn't regex-based parsing fragile?** It's a line-based state machine (fence, block, prose), not one big regex. It deliberately follows CommonMark's rules where they matter, such as fence length and character, and indented blocks. The frontend uses the real remark parser to render. The backend checker is stricter, so anything it accepts renders.

**Q: How would you scale asset serving?** Switch storage to R2 behind a CDN. `ASSET_PUBLIC_URL` changes, and stored lessons don't, because they hold `beyownd-asset:` references, not URLs.

**Q: How do you trust AI-generated content?** I don't trust it, I check it. The same validator runs on AI output, and a repo skill tells Claude the format and makes it run `check:lesson` and a dry-run import before it reports done. Facts still need a human read; the checklist says so.
