// src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '5000',
  mongoUri: getEnvVar('MONGO_URI'),
  redisUrl: getEnvVar('REDIS_URL'),
  jwtAccessSecret: getEnvVar('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  resendApiKey: getEnvVar('RESEND_API_KEY'),
  emailFrom: getEnvVar('EMAIL_FROM'),
  googleClientId: getEnvVar('GOOGLE_CLIENT_ID'),
};