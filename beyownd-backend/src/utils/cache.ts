// src/utils/cache.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// "Read-through cache": pehle Redis mein dekho, mila to wahi do; nahi mila
// to DB se laao (loader), Redis mein TTL ke saath rakho, phir do.
//
// Rule: cache sirf SPEED ke liye hai, correctness ke liye nahi. Redis down
// ho to error nahi - seedha DB se serve (thoda slow, lekin site chalti rahe).
//
// Kya cache hota hai: course catalog, outline, lesson content - jo bahut
// padha jaata hai aur kabhi-kabhi badalta hai. Admin edit pe `invalidate()`
// se turant delete. Per-student progress KABHI cache nahi hota.
//
// Values JSON mein store hoti hai - loader ko plain objects (string IDs)
// return karne chahiye, Mongoose documents nahi.
// ────────────────────────────────────────────────────────────────────────

import { redisClient } from '../config/redis';
import { logger } from './logger';

export const getOrSet = async <T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> => {
  try {
    const cached = await redisClient.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch (err) {
    logger.warn({ err, key }, 'Cache read failed, falling back to DB');
  }

  const value = await loader();

  // null/undefined cache nahi karte - "nahi mila" ko 10 min yaad rakhna
  // matlab admin ke publish karne ke baad bhi 404 dikhta
  if (value !== null && value !== undefined) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, 'Cache write failed');
    }
  }
  return value;
};

export const invalidate = async (...keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  try {
    await redisClient.del(...keys);
  } catch (err) {
    // Delete fail hua to TTL ke baad apne aap expire hoga - log karke aage badho
    logger.error({ err, keys }, 'Cache invalidation failed');
  }
};

// Saari cache keys ek jagah - spelling mismatch se "invalidate kiya lekin
// kuch hua nahi" wala bug na aaye
export const cacheKeys = {
  publishedCourses: () => 'cache:courses:published',
  courseBySlug: (slug: string) => `cache:course:slug:${slug}`,
  outline: (courseId: string) => `cache:outline:${courseId}`,
  courseCohorts: (courseId: string) => `cache:course:${courseId}:cohorts`,
  lesson: (lessonId: string) => `cache:lesson:${lessonId}`,
  // Answers ke saath - sirf server-side, kabhi client ko as-is nahi
  quiz: (moduleId: string) => `cache:quiz:${moduleId}`,
};
