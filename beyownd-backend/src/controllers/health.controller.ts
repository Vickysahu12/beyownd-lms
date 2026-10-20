// src/controllers/health.controller.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Do alag health checks - yeh distinction production mein important hai:
//
// /health (liveness)  → "process zinda hai?" Koi DB call nahi, instant.
//                       Fail ho to Docker container RESTART karta hai.
// /health/ready       → "traffic serve kar sakta hai?" Mongo + Redis check.
//                       Fail ho to load balancer is instance ko traffic
//                       bhejna band karta hai - RESTART nahi karta (agar
//                       Atlas 30 sec ke liye down hai, restart se kuch
//                       fix nahi hoga, bas restart loop banega).
// ────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis';

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export const liveness = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
};

export const readiness = async (_req: Request, res: Response) => {
  const mongo = mongoose.connection.readyState === mongoose.ConnectionStates.connected ? 'up' : 'down';

  const redis = await withTimeout(redisClient.ping(), 1000)
    .then(() => 'up' as const)
    .catch(() => 'down' as const);

  const healthy = mongo === 'up' && redis === 'up';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { mongo, redis },
    uptime: Math.round(process.uptime()),
  });
};
