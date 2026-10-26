// src/services/admin/courseImport.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Poora course EK folder se load: course.json (structure) + Markdown files
// (lesson notes, project brief). Owner content Google Docs / VS Code mein
// likhta hai, ek command se DB mein. Format: docs/content/COURSE_FORMAT.md
//
// RULES:
// - PEHLE sab validate (har course/module/lesson/quiz Mongoose rules se),
//   PHIR likho - aadha course kabhi DB mein nahi jaata. --dry-run = sirf check.
// - IDEMPOTENT: slug se course, position se module/lesson upsert. Dobara
//   chalao (typo fix ke baad) to update hota hai, duplicate nahi.
// - File mein jo modules/lessons NAHI hai woh DB se hata diye jaate hai
//   (file = source of truth) - lekin agar course mein students hai to
//   delete REFUSE (beech batch mein content gayab nahi hona chahiye).
// - Markdown file paths course folder ke BAHAR nahi ja sakte (../../ blocked).
// - Course status nahi badalta jab tak `publish: true` na ho (naya = draft).
// - Sab ek MongoDB transaction mein.
// - Rich lessons (docs/content/LESSON_FORMAT.md): har lesson ka format check
//   hota hai - SAARI galtiyan ek saath (file + line), pehli pe ruk ke nahi.
//   Images/widgets course ke assets/ folder se padhe, check, store
//   (content-addressed) aur lesson mein "beyownd-asset:<hash>" se replace.
// ────────────────────────────────────────────────────────────────────────

import fs from 'fs/promises';
import path from 'path';
import mongoose, { Types } from 'mongoose';
import Course from '../../models/course.model';
import Module from '../../models/module.model';
import Lesson from '../../models/lesson.model';
import Quiz from '../../models/quiz.model';
import Enrollment from '../../models/enrollment.model';
import { AppError } from '../../utils/AppError';
import { invalidateCourseCache } from '../catalog.service';
import { analyzeLesson, findQuizLeaks, rewriteAssetPaths } from '../content/lessonFormat';
import { ASSET_LIMITS, assetNameFor, assetRef, extOf, inspectAsset, putAsset } from '../../utils/assetStore.util';

export interface QuestionDef {
  prompt: string;
  type?: 'single' | 'multiple';
  options: string[];
  correctOptionIndexes: number[];
  explanation?: string;
  points?: number;
}

export interface LessonDef {
  title: string;
  type?: 'text' | 'video';
  content?: string;
  contentFile?: string;
  videoYoutubeId?: string;
  estimatedMinutes?: number;
}

export interface ModuleDef {
  title: string;
  description?: string;
  isFreePreview?: boolean;
  lessons: LessonDef[];
  quiz?: { passPercent?: number; questions: QuestionDef[] };
}

export interface CourseDef {
  slug: string;
  title: string;
  tagline?: string;
  description: string;
  thumbnailUrl?: string;
  level?: 'beginner' | 'intermediate';
  skills?: string[];
  durationWeeks: number;
  defaultPricePaise: number;
  project: {
    title: string;
    brief?: string;
    briefFile?: string;
    rubric: { criterion: string; maxScore: number }[];
    passScorePercent?: number;
  };
  modules: ModuleDef[];
}

export interface ImportOptions {
  publish?: boolean;
  dryRun?: boolean;
  createdBy?: Types.ObjectId | string;
}

export interface ImportResult {
  courseId: string | null;
  slug: string;
  created: boolean;
  modules: number;
  lessons: number;
  quizzes: number;
  removedModules: number;
  removedLessons: number;
  status: string;
  dryRun: boolean;
  assets: number;
  warnings: ImportIssue[];
}

// One problem in one lesson file - "lessons/m1-01.md line 14: ..."
export interface ImportIssue {
  where: string;
  file: string | null;
  line: number | null;
  message: string;
}

export const formatIssue = (i: ImportIssue) => `${i.where}${i.file ? ` - ${i.file}` : ''}${i.line ? ` line ${i.line}` : ''}: ${i.message}`;

// Asset file inside the course folder: no escaping via symlink, exact
// filename case (Windows ignores case, the Linux server doesn't)
const readAssetFile = async (baseDir: string, relative: string): Promise<{ bytes?: Buffer; error?: string }> => {
  const root = await fs.realpath(path.resolve(baseDir)).catch(() => path.resolve(baseDir));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) return { error: `"${relative}" points outside the course folder` };
  try {
    // Case check FIRST, from the directory listing: on Linux a wrong-case name
    // makes realpath fail, which would hide the real reason ("not found")
    const names = await fs.readdir(path.dirname(file));
    if (!names.includes(path.basename(file))) {
      const actual = names.find((n) => n.toLowerCase() === path.basename(file).toLowerCase());
      if (!actual) return { error: `file "${relative}" not found (paths start from the folder that has course.json)` };
      return { error: `"${relative}" - the file is named "${actual}" (capital letters must match exactly)` };
    }
    const real = await fs.realpath(file);
    if (!real.startsWith(root + path.sep)) return { error: `"${relative}" is a link to a file outside the course folder` };
    const stat = await fs.stat(real);
    if (!stat.isFile()) return { error: `"${relative}" is not a file` };
    return { bytes: await fs.readFile(real) };
  } catch {
    return { error: `file "${relative}" not found (paths start from the folder that has course.json)` };
  }
};

// Markdown file padho - sirf course folder ke andar se
const readInside = async (baseDir: string, relative: string, where: string): Promise<string> => {
  const root = path.resolve(baseDir);
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) {
    throw AppError.badRequest(`${where}: "${relative}" points outside the course folder`, 'IMPORT_INVALID');
  }
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    throw AppError.badRequest(`${where}: file "${relative}" not found`, 'IMPORT_INVALID');
  }
};

const fail = (where: string, message: string): never => {
  throw AppError.badRequest(`${where}: ${message}`, 'IMPORT_INVALID');
};

// Mongoose validation chala ke pehla error readable form mein
const validateDoc = async (doc: mongoose.Document, where: string) => {
  try {
    await doc.validate();
  } catch (err: any) {
    const first = err?.errors ? Object.values(err.errors)[0] : err;
    fail(where, (first as { message?: string })?.message ?? 'invalid');
  }
};

export const importCourse = async (def: CourseDef, baseDir: string, options: ImportOptions = {}): Promise<ImportResult> => {
  // ---- 1. Resolve files + validate EVERYTHING before writing ----
  if (!def || typeof def !== 'object') fail('course.json', 'not an object');
  if (!Array.isArray(def.modules) || def.modules.length === 0) fail('course.json', 'needs at least one module');

  const brief = def.project?.briefFile ? await readInside(baseDir, def.project.briefFile, 'project') : def.project?.brief;
  const placeholderId = new Types.ObjectId();
  const courseDraft = new Course({
    ...def,
    project: { ...def.project, brief },
    status: 'draft',
    createdBy: options.createdBy ?? placeholderId,
  });
  await validateDoc(courseDraft, 'course');

  const issues: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  // Collect instead of stopping at the first problem
  const collect = async (where: string, check: () => Promise<unknown>) => {
    try {
      await check();
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      issues.push({ where, file: null, line: null, message: err.message.startsWith(`${where}: `) ? err.message.slice(where.length + 2) : err.message });
    }
  };

  // assets/x.png → stored name; read + checked once even if many lessons use it
  const assetFiles = new Map<string, { name: string; bytes: Buffer } | { error: string }>();

  const modules: { def: ModuleDef; lessons: (LessonDef & { content: string })[] }[] = [];
  for (const [i, m] of def.modules.entries()) {
    const where = `module ${i + 1} ("${m?.title ?? '?'}")`;
    if (!Array.isArray(m?.lessons) || m.lessons.length === 0) fail(where, 'needs at least one lesson');
    await collect(where, () => validateDoc(new Module({ ...m, courseId: placeholderId, order: i + 1 }), where));
    const gradedPrompts = Array.isArray(m.quiz?.questions) ? m.quiz.questions.map((q) => String(q?.prompt ?? '')) : [];

    const lessons: (LessonDef & { content: string })[] = [];
    for (const [j, l] of m.lessons.entries()) {
      const lw = `${where}, lesson ${j + 1} ("${l?.title ?? '?'}")`;
      const file = l?.contentFile ?? null;
      let raw: unknown;
      try {
        raw = file ? await readInside(baseDir, file, lw) : (l?.content ?? '');
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        issues.push({ where: lw, file, line: null, message: err.message.slice(lw.length + 2) });
        continue;
      }
      if (typeof raw !== 'string') {
        issues.push({ where: lw, file, line: null, message: 'content must be text' });
        continue;
      }

      const analysis = analyzeLesson(raw, { mode: 'import', lessonType: l?.type === 'video' ? 'video' : 'text' });
      for (const e of analysis.errors) issues.push({ where: lw, file, line: e.line, message: e.message });
      for (const w of analysis.warnings) warnings.push({ where: lw, file, line: w.line, message: w.message });
      for (const e of findQuizLeaks(analysis.quizQuestions, gradedPrompts)) issues.push({ where: lw, file, line: e.line, message: e.message });

      const mapping = new Map<string, string>();
      for (const ref of analysis.assets) {
        if (!assetFiles.has(ref.path)) {
          const read = await readAssetFile(baseDir, ref.path);
          const ext = extOf(ref.path);
          const problem = read.error ?? (ext && read.bytes ? inspectAsset(read.bytes, ext) : 'unsupported file type');
          assetFiles.set(ref.path, problem || !read.bytes || !ext ? { error: problem ?? 'unreadable' } : { name: assetNameFor(read.bytes, ext), bytes: read.bytes });
        }
        const stored = assetFiles.get(ref.path)!;
        if ('error' in stored) {
          issues.push({ where: lw, file, line: ref.line, message: stored.error });
          continue;
        }
        mapping.set(ref.path, assetRef(stored.name));
        if (ref.kind === 'image' && stored.bytes.length > ASSET_LIMITS.imageWarnBytes) {
          warnings.push({ where: lw, file, line: ref.line, message: `"${ref.path}" is ${Math.round(stored.bytes.length / 1024)} KB - slow on mobile data, aim for under ${ASSET_LIMITS.imageWarnBytes / 1024} KB` });
        }
      }

      // Same normalization the parser used (BOM, CRLF) so line numbers match
      const content = rewriteAssetPaths(raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), mapping);
      await collect(lw, () => validateDoc(new Lesson({ ...l, content, courseId: placeholderId, moduleId: placeholderId, order: j + 1 }), lw));
      lessons.push({ ...l, content });
    }
    if (m.quiz) {
      await collect(`${where}, quiz`, () => validateDoc(new Quiz({ ...m.quiz, courseId: placeholderId, moduleId: placeholderId }), `${where}, quiz`));
    }
    modules.push({ def: m, lessons });
  }

  if (issues.length) {
    const more = issues.length > 1 ? ` (+${issues.length - 1} more - see the full list)` : '';
    throw new AppError(400, `${formatIssue(issues[0])}${more}`, 'IMPORT_INVALID', {
      errors: issues.map(formatIssue),
      warnings: warnings.map(formatIssue),
    });
  }
  const storedAssets = [...assetFiles.values()].filter((a): a is { name: string; bytes: Buffer } => 'name' in a);

  const existing = await Course.findOne({ slug: def.slug });
  const status = options.publish ? 'published' : (existing?.status ?? 'draft');

  // Removals: file mein kam modules/lessons → students hai to refuse
  let removedModules = 0;
  let removedLessons = 0;
  if (existing) {
    const dbModules = await Module.find({ courseId: existing._id }).select({ order: 1 });
    const extraModules = dbModules.filter((m) => m.order > modules.length);
    let extraLessonCount = 0;
    for (const [i, m] of modules.entries()) {
      const dbModule = dbModules.find((d) => d.order === i + 1);
      if (dbModule) extraLessonCount += await Lesson.countDocuments({ moduleId: dbModule._id, order: { $gt: m.lessons.length } });
    }
    if (extraModules.length) extraLessonCount += await Lesson.countDocuments({ moduleId: { $in: extraModules.map((m) => m._id) } });
    removedModules = extraModules.length;
    removedLessons = extraLessonCount;

    if ((removedModules || removedLessons) && (await Enrollment.exists({ courseId: existing._id, status: { $in: ['active', 'completed'] } }))) {
      fail('course', `the file has fewer modules/lessons than the live course, and students are enrolled - content can't be removed mid-batch (${removedModules} modules, ${removedLessons} lessons would be deleted)`);
    }
  }

  const summary: ImportResult = {
    courseId: existing ? String(existing._id) : null,
    slug: def.slug,
    created: !existing,
    modules: modules.length,
    lessons: modules.reduce((n, m) => n + m.lessons.length, 0),
    quizzes: modules.filter((m) => m.def.quiz).length,
    removedModules,
    removedLessons,
    status,
    dryRun: Boolean(options.dryRun),
    assets: new Set(storedAssets.map((a) => a.name)).size,
    warnings,
  };
  if (options.dryRun) return summary;

  // Assets first: content-addressed, so writing them is harmless even if the
  // transaction below fails (an unused file, never a broken lesson)
  for (const a of storedAssets) await putAsset(a.name, a.bytes);

  // ---- 2. Write (one transaction) ----
  const session = await mongoose.startSession();
  let courseId: Types.ObjectId;
  try {
    courseId = await session.withTransaction(async () => {
      const course = await Course.findOneAndUpdate(
        { slug: def.slug },
        {
          $set: {
            title: def.title,
            tagline: def.tagline,
            description: def.description,
            thumbnailUrl: def.thumbnailUrl,
            level: def.level ?? 'beginner',
            skills: def.skills ?? [],
            durationWeeks: def.durationWeeks,
            defaultPricePaise: def.defaultPricePaise,
            project: { ...def.project, brief, briefFile: undefined },
            status,
          },
          $setOnInsert: { createdBy: options.createdBy ?? placeholderId },
        },
        { upsert: true, returnDocument: 'after', session, runValidators: true }
      );
      const cid = course._id;

      for (const [i, m] of modules.entries()) {
        const module = await Module.findOneAndUpdate(
          { courseId: cid, order: i + 1 },
          { $set: { title: m.def.title, description: m.def.description, isFreePreview: Boolean(m.def.isFreePreview) } },
          { upsert: true, returnDocument: 'after', session, runValidators: true }
        );
        for (const [j, l] of m.lessons.entries()) {
          await Lesson.findOneAndUpdate(
            { moduleId: module._id, order: j + 1 },
            {
              $set: {
                courseId: cid,
                title: l.title,
                type: l.type ?? 'text',
                content: l.content,
                estimatedMinutes: l.estimatedMinutes ?? 10,
                ...(l.videoYoutubeId ? { videoYoutubeId: l.videoYoutubeId } : {}),
              },
              ...(l.videoYoutubeId ? {} : { $unset: { videoYoutubeId: 1 } }),
            },
            { upsert: true, returnDocument: 'after', session, runValidators: true }
          );
        }
        await Lesson.deleteMany({ moduleId: module._id, order: { $gt: m.lessons.length } }, { session });

        if (m.def.quiz) {
          await Quiz.findOneAndUpdate(
            { moduleId: module._id },
            { $set: { courseId: cid, passPercent: m.def.quiz.passPercent ?? 60, questions: m.def.quiz.questions } },
            { upsert: true, returnDocument: 'after', session, runValidators: true }
          );
        } else {
          await Quiz.deleteOne({ moduleId: module._id }, { session });
        }
      }

      const extra = await Module.find({ courseId: cid, order: { $gt: modules.length } }, { _id: 1 }, { session });
      if (extra.length) {
        const ids = extra.map((m) => m._id);
        await Lesson.deleteMany({ moduleId: { $in: ids } }, { session });
        await Quiz.deleteMany({ moduleId: { $in: ids } }, { session });
        await Module.deleteMany({ _id: { $in: ids } }, { session });
      }
      return cid;
    });
  } finally {
    await session.endSession();
  }

  // Cache: catalog + outline + har lesson + har quiz
  const [lessonIds, moduleIds] = await Promise.all([
    Lesson.find({ courseId }).distinct('_id'),
    Module.find({ courseId }).distinct('_id'),
  ]);
  await invalidateCourseCache({ id: String(courseId), slug: def.slug }, lessonIds.map(String), moduleIds.map(String));

  return { ...summary, courseId: String(courseId) };
};
