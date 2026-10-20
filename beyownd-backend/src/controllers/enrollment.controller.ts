// src/controllers/enrollment.controller.ts
// Thin layer - ownership + access rules sab enrollment.service mein.

import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as enrollmentService from '../services/enrollment.service';
import * as quizService from '../services/quiz.service';
import * as projectService from '../services/project.service';
import * as paymentService from '../services/payment.service';

type LessonParams = { id: string; lessonId: string };

export const listMine = async (req: Request, res: Response) => {
  const enrollments = await enrollmentService.listMyEnrollments(req.user!.id);
  res.status(200).json({ success: true, enrollments });
};

export const startEnrollment = async (req: Request, res: Response) => {
  const { cohortId } = matchedData<{ cohortId: string }>(req, { locations: ['body'] });
  const result = await paymentService.startEnrollment(req.user!.id, cohortId);
  res.status(201).json({ success: true, ...result });
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

// ---- Quiz (Phase 2) ----

type ModuleParams = { id: string; moduleId: string };

export const getQuiz = async (req: Request<ModuleParams>, res: Response) => {
  const quiz = await quizService.getQuiz(req.params.id, req.user!.id, req.params.moduleId);
  res.status(200).json({ success: true, quiz });
};

export const submitQuizAttempt = async (req: Request<ModuleParams>, res: Response) => {
  const { answers } = matchedData<{ answers: quizService.AnswerInput[] }>(req, { locations: ['body'] });
  const result = await quizService.submitAttempt(req.params.id, req.user!.id, req.params.moduleId, answers);
  res.status(200).json({ success: true, ...result });
};

export const listQuizAttempts = async (req: Request<ModuleParams>, res: Response) => {
  const attempts = await quizService.listAttempts(req.params.id, req.user!.id, req.params.moduleId);
  res.status(200).json({ success: true, attempts });
};

// ---- Project (Phase 2) ----

export const getProject = async (req: Request<{ id: string }>, res: Response) => {
  const project = await projectService.getProject(req.params.id, req.user!.id);
  res.status(200).json({ success: true, ...project });
};

export const submitProject = async (req: Request<{ id: string }>, res: Response) => {
  const input = matchedData<projectService.SubmissionInput>(req, { locations: ['body'] });
  const result = await projectService.submitProject(req.params.id, req.user!.id, input);
  res.status(201).json({ success: true, ...result });
};
