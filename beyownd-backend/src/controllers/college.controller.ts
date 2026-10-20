// src/controllers/college.controller.ts
import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as collegeService from '../services/college.service';

export const search = async (req: Request, res: Response) => {
  const { q } = matchedData<{ q: string }>(req, { locations: ['query'] });
  const colleges = await collegeService.searchColleges(q);
  res.status(200).json({ success: true, colleges });
};
