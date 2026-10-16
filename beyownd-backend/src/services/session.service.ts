// src/services/session.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Refresh-token SESSIONS Redis mein manage karta hai. Ek "session" = ek
// device/browser pe ek login.
//
// Redis keys:
//   session:<sid>          → { userId, jti }   (TTL = refresh expiry, 7d)
//   user_sessions:<userId> → SET of sids       (password reset pe sab revoke)
//
// ROTATION: har /refresh pe naya jti banta hai aur purana invalid ho jaata
// hai. Agar koi PURANA refresh token dobara use kare (jti match nahi kare),
// matlab token chori hua ho sakta hai - us poore session ko revoke kar dete
// hai (attacker aur asli user dono logout - asli user dobara login karega,
// attacker nahi kar payega). Isse "refresh token reuse detection" kehte hai.
// ────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import {
  generateRefreshToken,
  verifyRefreshToken,
  durationToSeconds,
} from '../utils/generateTokens';

export const REFRESH_TTL_SECONDS = durationToSeconds(env.jwtRefreshExpiry);

const sessionKey = (sid: string) => `session:${sid}`;
const userSessionsKey = (userId: string) => `user_sessions:${userId}`;

interface StoredSession {
  userId: string;
  jti: string;
  // Pichla jti + kab rotate hua - "do tabs ne ek saath refresh kiya" case
  // ke liye (neeche REUSE_GRACE_MS dekho)
  prevJti?: string;
  rotatedAt?: number;
}

// Do browser tabs ek hi second mein refresh karein to dono same purana
// token bhejte hai - doosra reuse jaisa dikhega. 10s ke andar pichla jti
// aaye to theft nahi, race maante hai aur current token de dete hai.
const REUSE_GRACE_MS = 10_000;

// Login/verify/Google ke baad naya session + refresh token
export const createSession = async (userId: string): Promise<string> => {
  const sid = randomUUID();
  const jti = randomUUID();
  await redisClient
    .multi()
    .set(sessionKey(sid), JSON.stringify({ userId, jti }), 'EX', REFRESH_TTL_SECONDS)
    .sadd(userSessionsKey(userId), sid)
    .expire(userSessionsKey(userId), REFRESH_TTL_SECONDS)
    .exec();
  return generateRefreshToken({ userId, sid, jti });
};

// Purana refresh token do → naya refresh token lo (same session, naya jti).
// Returns userId taaki caller fresh access token bana sake.
export const rotateSession = async (
  refreshToken: string
): Promise<{ userId: string; refreshToken: string }> => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');
  }

  const raw = await redisClient.get(sessionKey(decoded.sid));
  if (!raw) {
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');
  }

  const session = JSON.parse(raw) as StoredSession;
  if (session.userId !== decoded.userId) {
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');
  }

  const isConcurrentRefresh =
    session.prevJti === decoded.jti &&
    session.rotatedAt !== undefined &&
    Date.now() - session.rotatedAt < REUSE_GRACE_MS;
  if (isConcurrentRefresh) {
    return {
      userId: decoded.userId,
      refreshToken: generateRefreshToken({ userId: decoded.userId, sid: decoded.sid, jti: session.jti }),
    };
  }

  if (session.jti !== decoded.jti) {
    // Purana (already-rotated) token wapas aaya - reuse = possible theft
    logger.warn({ userId: decoded.userId, sid: decoded.sid }, 'Refresh token reuse detected');
    await revokeSession(decoded.sid, decoded.userId);
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_REUSED');
  }

  const newJti = randomUUID();
  // XX = sirf tab set karo jab key abhi bhi exist kare (beech mein logout
  // ho gaya ho to session wapas zinda na ho jaye). KEEPTTL nahi - har
  // refresh pe 7 din ka window aage badhta hai (active user logout nahi hota).
  const updated = await redisClient.set(
    sessionKey(decoded.sid),
    JSON.stringify({
      userId: decoded.userId,
      jti: newJti,
      prevJti: decoded.jti,
      rotatedAt: Date.now(),
    } satisfies StoredSession),
    'EX',
    REFRESH_TTL_SECONDS,
    'XX'
  );
  if (!updated) {
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');
  }
  await redisClient.expire(userSessionsKey(decoded.userId), REFRESH_TTL_SECONDS);

  return {
    userId: decoded.userId,
    refreshToken: generateRefreshToken({ userId: decoded.userId, sid: decoded.sid, jti: newJti }),
  };
};

export const revokeSession = async (sid: string, userId: string): Promise<void> => {
  await redisClient.multi().del(sessionKey(sid)).srem(userSessionsKey(userId), sid).exec();
};

// Logout: token se session nikaalo aur revoke karo. Token invalid/expired
// ho to bhi logout "successful" hai - user ka goal (logged out hona) poora hai.
export const revokeSessionByToken = async (refreshToken: string): Promise<void> => {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    await revokeSession(decoded.sid, decoded.userId);
  } catch {
    // ignore - nothing to revoke
  }
};

// Password reset ke baad: har device se logout (attacker ke sessions bhi)
export const revokeAllSessions = async (userId: string): Promise<void> => {
  const sids = await redisClient.smembers(userSessionsKey(userId));
  const pipeline = redisClient.multi();
  for (const sid of sids) pipeline.del(sessionKey(sid));
  pipeline.del(userSessionsKey(userId));
  await pipeline.exec();
};
