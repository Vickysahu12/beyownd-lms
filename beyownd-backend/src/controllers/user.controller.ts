// src/controllers/user.controller.ts
// Thin layer - matchedData() se SIRF validated fields lete hai (mass-
// assignment protection), service ko dete hai, response bhejte hai.

import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as userService from '../services/user.service';

export const getMe = async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.id);
  res.status(200).json({ success: true, user });
};

export const completeOnboarding = async (req: Request, res: Response) => {
  const data = matchedData(req, { locations: ['body'] }) as userService.ProfileInput;
  const user = await userService.completeOnboarding(req.user!.id, data);
  res.status(200).json({ success: true, user });
};

export const updateProfile = async (req: Request, res: Response) => {
  const data = matchedData(req, { locations: ['body'] }) as Partial<userService.ProfileInput>;
  const user = await userService.updateProfile(req.user!.id, data);
  res.status(200).json({ success: true, user });
};
