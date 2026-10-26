// scripts/content/check-lesson.ts
//
// Ek ya zyada lesson .md files ka format check - bina database ke.
// Lesson likhte waqt (ya AI se generate karwane ke baad) yahi chalao.
// Rules: docs/content/LESSON_FORMAT.md
//
// Run (beyownd-backend folder se):
//   npm run check:lesson -- ../docs/content/redis-course/lessons/*.md
//
// Paths for images/widgets (assets/...) start from the course folder - this
// script only checks their format; `import:course --dry-run` also checks
// the files exist and are safe.

import fs from 'fs';
import path from 'path';
import { analyzeLesson } from '../../src/services/content/lessonFormat';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('Usage: npm run check:lesson -- <lesson.md> [more.md ...]');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    console.error(`✗ ${file}: can't read the file`);
    failed++;
    continue;
  }
  const r = analyzeLesson(content, { mode: 'import' });
  const name = path.relative(process.cwd(), file);
  const s = r.stats;
  const summary = `${r.sections.length} sections · ${s.quizzes} quizzes · ${s.codeBlocks} code · ${s.steps} steps · ${s.callouts} callouts · ${s.interactives} widgets · ${content.length.toLocaleString('en-IN')} chars`;
  if (content.length > 50_000) r.errors.push({ line: 1, message: `Lesson is ${content.length.toLocaleString('en-IN')} characters - max 50,000 (split it)` });
  console.log(`${r.errors.length ? '✗' : '✓'} ${name}  (${summary})`);
  for (const e of r.errors) console.log(`    error   line ${e.line}: ${e.message}`);
  for (const w of r.warnings) console.log(`    warning line ${w.line}: ${w.message}`);
  if (r.errors.length) failed++;
}
if (failed) {
  console.log(`\n${failed} file(s) have errors.`);
  process.exitCode = 1;
}
