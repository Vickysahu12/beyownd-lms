// src/controllers/enrollment.controller.ts
// Thin layer - ownership + access rules sab enrollment.service mein.

import { Request, Response } from 'express';
import * as enrollmentService from '../services/enrollment.service';

type LessonParams = { id: string; lessonId: string };

export const listMine = async (req: Request, res: Response) => {
  const enrollments = await enrollmentService.listMyEnrollments(req.user!.id);
  res.status(200).json({ success: true, enrollments });
};

export const getDashboard = async (req: Request<{ id: string }>, res: Response) => {
  const enrollment = await enrollmentService.getDashboard(req.params.id, req.user!.id);
  res.status(200).json({ success: true, enrollment });
};

export const getLesson = async (req: Request<LessonParams>, res: Response) => {
  const lesson = await enrollmentService.getLesson(req.params.id, req.user!.id, req.params.lessonId);
  res.status(200).json({ success: true, lesson });
};

export const completeLesson = async (req: Request<LessonParams>, res: Response) => {
  const result = await enrollmentService.completeLesson(req.params.id, req.user!.id, req.params.lessonId);
  res.status(200).json({ success: true, ...result });
};
