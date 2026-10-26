// src/controllers/admin.controller.ts
// Thin layer - admin rules + audit logging services/admin/* mein.
// matchedData() se sirf validated fields aage jaate hai.

import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as content from '../services/admin/content.service';
import * as ops from '../services/admin/operations.service';
import * as stats from '../services/admin/stats.service';
import { checkStoredLesson } from '../services/content/lessonContent.service';

type IdParams = { id: string };

// Remove undefined values (and objects left empty) - only what the admin
// actually sent reaches the service. Without this, a PATCH { status } also
// carried project: { title: undefined, ... } and wiped the project brief.
const compact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v);
      if (c !== undefined && !(c && typeof c === 'object' && !Array.isArray(c) && !(c instanceof Date) && Object.keys(c).length === 0)) {
        out[k] = c;
      }
    }
    return out;
  }
  return value;
};

const body = <T extends object>(req: Request<any>) => compact(matchedData<T>(req, { locations: ['body'] })) as T;
const query = <T extends object>(req: Request<any>) => matchedData<T>(req, { locations: ['query'] });

// ---- Content ----
export const listCourses = async (_req: Request, res: Response) => {
  res.json({ success: true, courses: await content.listCourses() });
};
export const createCourse = async (req: Request, res: Response) => {
  res.status(201).json({ success: true, course: await content.createCourse(req.user!.id, body(req)) });
};
export const getCourse = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await content.getCourseStructure(req.params.id)) });
};
export const updateCourse = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, course: await content.updateCourse(req.user!.id, req.params.id, body(req)) });
};
export const addModule = async (req: Request<IdParams>, res: Response) => {
  res.status(201).json({ success: true, module: await content.addModule(req.params.id, body(req)) });
};
export const reorderModules = async (req: Request<IdParams>, res: Response) => {
  await content.reorderModules(req.params.id, body<{ moduleIds: string[] }>(req).moduleIds);
  res.json({ success: true });
};
export const updateModule = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, module: await content.updateModule(req.params.id, body(req)) });
};
export const deleteModule = async (req: Request<IdParams>, res: Response) => {
  await content.deleteModule(req.user!.id, req.params.id);
  res.json({ success: true });
};
export const addLesson = async (req: Request<IdParams>, res: Response) => {
  res.status(201).json({ success: true, ...(await content.addLesson(req.params.id, body(req))) });
};
export const reorderLessons = async (req: Request<IdParams>, res: Response) => {
  await content.reorderLessons(req.params.id, body<{ lessonIds: string[] }>(req).lessonIds);
  res.json({ success: true });
};
export const getLesson = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, lesson: await content.getLesson(req.params.id) });
};
export const updateLesson = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await content.updateLesson(req.params.id, body(req))) });
};
// Editor's "Check" button - same rules as save, nothing is written
export const checkLesson = async (req: Request, res: Response) => {
  const { content: text, type } = body<{ content: string; type?: 'text' | 'video' }>(req);
  res.json({ success: true, ...(await checkStoredLesson(text ?? '', type ?? 'text')) });
};
export const deleteLesson = async (req: Request<IdParams>, res: Response) => {
  await content.deleteLesson(req.user!.id, req.params.id);
  res.json({ success: true });
};
export const getQuiz = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, quiz: await content.getQuiz(req.params.id) });
};
export const upsertQuiz = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, quiz: await content.upsertQuiz(req.params.id, body(req)) });
};
export const deleteQuiz = async (req: Request<IdParams>, res: Response) => {
  await content.deleteQuiz(req.params.id);
  res.json({ success: true });
};

// ---- Cohorts ----
export const listCohorts = async (req: Request, res: Response) => {
  res.json({ success: true, cohorts: await ops.listCohorts(query<{ courseId?: string }>(req).courseId) });
};
export const createCohort = async (req: Request, res: Response) => {
  res.status(201).json({ success: true, cohort: await ops.createCohort(req.user!.id, body(req)) });
};
export const updateCohort = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, cohort: await ops.updateCohort(req.user!.id, req.params.id, body(req)) });
};

// ---- Students ----
export const listStudents = async (req: Request, res: Response) => {
  res.json({ success: true, ...(await ops.listStudents(query(req))) });
};
export const getStudent = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await ops.getStudent(req.params.id)) });
};

// ---- Operations ----
export const refundEnrollment = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await ops.refundEnrollment(req.user!.id, req.params.id, body<{ reason: string }>(req).reason)) });
};
export const reissueDocuments = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await ops.reissueDocuments(req.user!.id, req.params.id)) });
};
export const revokeCredential = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, ...(await ops.revokeCredential(req.user!.id, req.params.id, body<{ reason: string }>(req).reason)) });
};
export const setRole = async (req: Request<IdParams>, res: Response) => {
  res.json({ success: true, user: await ops.setRole(req.user!.id, req.params.id, body<{ role: 'student' | 'mentor' | 'admin' }>(req).role) });
};

// ---- Stats ----
export const overview = async (_req: Request, res: Response) => {
  res.json({ success: true, stats: await stats.overview() });
};
export const funnel = async (req: Request, res: Response) => {
  res.json({ success: true, funnel: await stats.funnel(query<{ courseId?: string }>(req).courseId ?? '') });
};
export const colleges = async (req: Request, res: Response) => {
  res.json({ success: true, colleges: await stats.colleges(query<{ limit?: number }>(req).limit) });
};
