// src/middlewares/auth.middleware.ts
// Access token verify karta hai (Authorization: Bearer <token> header se),
// aur req.user attach karta hai. Baad ke modules (courses, quizzes) iska
// `protect` middleware use karenge apne routes secure karne ke liye.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import User from '../models/user.model';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtAccessSecret) as { userId: string; role: string };

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    req.user = { id: String(user._id), role: user.role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Role-based access - e.g. router.get('/admin-stats', protect, restrictTo('admin'), ...)
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
};