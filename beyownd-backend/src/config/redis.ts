// src/config/redis.ts
// Redis client - OTP storage (auto-expiry), rate-limiting, refresh-token
// sessions, caching aur baad mein BullMQ queue. Ek hi connection poore
// app mein reuse hota hai.

import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redisClient = new Redis(env.redisUrl);

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));

export const disconnectRedis = async (): Promise<void> => {
  await redisClient.quit();
  logger.info('Redis connection closed');
};
