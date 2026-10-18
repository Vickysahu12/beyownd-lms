// src/controllers/catalog.controller.ts
// Public catalog - bina login ke. Sab data catalog.service se (Redis cached).

import { Request, Response } from 'express';
import * as catalogService from '../services/catalog.service';

export const listCourses = async (_req: Request, res: Response) => {
  const courses = await catalogService.listPublishedCourses();
  res.status(200).json({ success: true, courses });
};

export const getCourse = async (req: Request<{ slug: string }>, res: Response) => {
  const course = await catalogService.getCourseBySlug(req.params.slug);
  res.status(200).json({ success: true, course });
};

export const getCohorts = async (req: Request<{ slug: string }>, res: Response) => {
  const cohorts = await catalogService.getCourseCohorts(req.params.slug);
  res.status(200).json({ success: true, cohorts });
};

export const getPreviewLesson = async (req: Request<{ slug: string; lessonId: string }>, res: Response) => {
  const lesson = await catalogService.getPreviewLesson(req.params.slug, req.params.lessonId);
  res.status(200).json({ success: true, lesson });
};
