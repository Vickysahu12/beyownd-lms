// src/utils/otp.util.ts
// OTP generate, store (Redis mein 10-min auto-expiry ke saath), verify.
// auth.service.ts yeh functions use karega signup aur resend-otp ke time.

import { redisClient } from '../config/redis';

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOtp = async (email: string, otp: string): Promise<void> => {
  await redisClient.set(`otp:${email}`, otp, 'EX', OTP_EXPIRY_SECONDS);
};

// Match hote hi Redis se OTP delete kar dete hai - one-time use, dobara
// same OTP se verify nahi ho sakta, replay attack se bachaव ke liye.
export const verifyOtp = async (email: string, otp: string): Promise<boolean> => {
  const storedOtp = await redisClient.get(`otp:${email}`);
  if (!storedOtp || storedOtp !== otp) return false;
  await redisClient.del(`otp:${email}`);
  return true;
};