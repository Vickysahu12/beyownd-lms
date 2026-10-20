// src/controllers/review.controller.ts
// Mentor/admin project review. Rules + transaction review.service mein.

import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as reviewService from '../services/review.service';

export const queue = async (req: Request, res: Response) => {
  const { status = 'pending', limit = 20, cursor } = matchedData<{
    status?: 'pending' | 'approved' | 'changes_requested';
    limit?: number;
    cursor?: string;
  }>(req, { locations: ['query'] });
  const result = await reviewService.listQueue(status, limit, cursor);
  res.status(200).json({ success: true, ...result });
};

export const getOne = async (req: Request<{ id: string }>, res: Response) => {
  const result = await reviewService.getSubmission(req.params.id);
  res.status(200).json({ success: true, ...result });
};

export const decide = async (req: Request<{ id: string }>, res: Response) => {
  const input = matchedData<reviewService.DecisionInput>(req, { locations: ['body'] });
  const result = await reviewService.decide(req.params.id, req.user!.id, input);
  res.status(200).json({ success: true, ...result });
};
