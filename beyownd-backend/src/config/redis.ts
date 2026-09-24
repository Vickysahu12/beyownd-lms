// src/config/redis.ts
// Redis client - OTP storage (with auto-expiry) aur baad mein leaderboard,
// caching, rate-limiting sab isi client se hoga. Ek hi connection, poore
// app mein reuse hota hai.

import Redis from 'ioredis';
import { env } from './env';

export const redisClient = new Redis(env.redisUrl);

redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('error', (err) => console.error('Redis error:', err));