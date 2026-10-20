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
}

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

  const modules: { def: ModuleDef; lessons: (LessonDef & { content: string })[] }[] = [];
  for (const [i, m] of def.modules.entries()) {
    const where = `module ${i + 1} ("${m?.title ?? '?'}")`;
    if (!Array.isArray(m?.lessons) || m.lessons.length === 0) fail(where, 'needs at least one lesson');
    await validateDoc(new Module({ ...m, courseId: placeholderId, order: i + 1 }), where);

    const lessons: (LessonDef & { content: string })[] = [];
    for (const [j, l] of m.lessons.entries()) {
      const lw = `${where}, lesson ${j + 1} ("${l?.title ?? '?'}")`;
      const content = l.contentFile ? await readInside(baseDir, l.contentFile, lw) : (l.content ?? '');
      await validateDoc(new Lesson({ ...l, content, courseId: placeholderId, moduleId: placeholderId, order: j + 1 }), lw);
      lessons.push({ ...l, content });
    }
    if (m.quiz) {
      await validateDoc(new Quiz({ ...m.quiz, courseId: placeholderId, moduleId: placeholderId }), `${where}, quiz`);
    }
    modules.push({ def: m, lessons });
  }

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
  };
  if (options.dryRun) return summary;

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
        { upsert: true, new: true, session, runValidators: true }
      );
      const cid = course._id;

      for (const [i, m] of modules.entries()) {
        const module = await Module.findOneAndUpdate(
          { courseId: cid, order: i + 1 },
          { $set: { title: m.def.title, description: m.def.description, isFreePreview: Boolean(m.def.isFreePreview) } },
          { upsert: true, new: true, session, runValidators: true }
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
            { upsert: true, new: true, session, runValidators: true }
          );
        }
        await Lesson.deleteMany({ moduleId: module._id, order: { $gt: m.lessons.length } }, { session });

        if (m.def.quiz) {
          await Quiz.findOneAndUpdate(
            { moduleId: module._id },
            { $set: { courseId: cid, passPercent: m.def.quiz.passPercent ?? 60, questions: m.def.quiz.questions } },
            { upsert: true, new: true, session, runValidators: true }
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
