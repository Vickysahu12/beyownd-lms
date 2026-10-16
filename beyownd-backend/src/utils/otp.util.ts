// src/utils/otp.util.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// OTP generate, store, verify - Redis mein, 10-min auto-expiry ke saath.
//
// Security rules jo yahan enforce hote hai:
// 1. crypto.randomInt - Math.random predictable hai, OTP ke liye nahi chalega
// 2. PURPOSE-SCOPED keys - signup ka OTP password reset mein kaam nahi karega
//    (otp:verify:<email> vs otp:reset:<email>)
// 3. Max 5 galat attempts per OTP - phir OTP burn ho jaata hai. Bina iske
//    6-digit OTP (10 lakh combinations) 10 min mein script se guess ho sakta hai.
// 4. Redis mein OTP ka HASH store hota hai, plain OTP nahi - Redis kabhi
//    leak ho to bhi active OTPs nahi milenge.
// 5. Resend cooldown 60s - koi bar-bar "resend" daba ke humara email quota
//    (aur student ka inbox) spam na kar sake.
// ────────────────────────────────────────────────────────────────────────

import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { redisClient } from '../config/redis';
import { AppError } from './AppError';

export type OtpPurpose = 'verify' | 'reset';

export const OTP_EXPIRY_SECONDS = 600; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

const otpKey = (purpose: OtpPurpose, email: string) => `otp:${purpose}:${email}`;
const cooldownKey = (purpose: OtpPurpose, email: string) => `otp_cooldown:${purpose}:${email}`;

const hashOtp = (otp: string): Buffer => createHash('sha256').update(otp).digest();

export const generateOtp = (): string => randomInt(100000, 1000000).toString();

// Naya OTP banake store karta hai aur return karta hai (caller email bhejta hai).
// Cooldown ke andar dobara call hua to 429.
export const issueOtp = async (purpose: OtpPurpose, email: string): Promise<string> => {
  // SET NX = "sirf tab set karo jab key exist na kare" - atomic check, do
  // parallel requests dono cooldown pass nahi kar sakti.
  const allowed = await redisClient.set(
    cooldownKey(purpose, email),
    '1',
    'EX',
    OTP_RESEND_COOLDOWN_SECONDS,
    'NX'
  );
  if (!allowed) {
    throw AppError.tooMany(
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
      'OTP_COOLDOWN'
    );
  }

  const otp = generateOtp();
  const key = otpKey(purpose, email);
  // Naya OTP purane ko replace karta hai aur attempts 0 se shuru
  await redisClient
    .multi()
    .del(key)
    .hset(key, 'hash', hashOtp(otp).toString('hex'), 'attempts', '0')
    .expire(key, OTP_EXPIRY_SECONDS)
    .exec();
  return otp;
};

// Match hone pe OTP turant delete (one-time use, replay nahi ho sakta).
// Galat hone pe attempt count badhta hai; limit cross hui to OTP burn.
export const consumeOtp = async (
  purpose: OtpPurpose,
  email: string,
  otp: string
): Promise<void> => {
  const key = otpKey(purpose, email);

  const storedHash = await redisClient.hget(key, 'hash');
  if (!storedHash) {
    throw AppError.badRequest('Invalid or expired code', 'OTP_INVALID');
  }

  // HINCRBY atomic hai - 10 parallel guesses bhi bheje to har ek ko alag
  // count milega, koi bhi limit bypass nahi kar sakta.
  const attempts = await redisClient.hincrby(key, 'attempts', 1);
  if (attempts > OTP_MAX_ATTEMPTS) {
    await redisClient.del(key);
    throw AppError.tooMany('Too many wrong attempts. Please request a new code.', 'OTP_LOCKED');
  }

  // timingSafeEqual - comparison ka time match/mismatch pe same rehta hai,
  // timing se andaza nahi lagaya ja sakta
  const matches = timingSafeEqual(hashOtp(otp), Buffer.from(storedHash, 'hex'));
  if (!matches) {
    throw AppError.badRequest('Invalid or expired code', 'OTP_INVALID');
  }

  await redisClient.del(key);
};
