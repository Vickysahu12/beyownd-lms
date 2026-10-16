// src/config/db.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Iska sirf EK kaam hai: MongoDB Atlas se connection banana aur band karna.
// server.ts isko startup pe call karta hai - connection fail ho to server
// start hi nahi hota (bina DB ke har request fail hogi anyway).
//
// Mongoose ek CONNECTION POOL rakhta hai - har request naya connection
// nahi banati, pool ke existing connections reuse hote hai. maxPoolSize
// decide karta hai ek API instance max kitne parallel DB operations
// chala sakta hai (1k concurrent users ke liye 20 kaafi hai, kyunki har
// query few milliseconds ki hoti hai).
// ────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  const conn = await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.mongoMaxPoolSize,
    // Atlas 5 second mein na mile to fail karo - startup pe hang na ho
    serverSelectionTimeoutMS: 5000,
  });
  logger.info({ host: conn.connection.host }, 'MongoDB connected');
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

// Runtime mein connection drop/reconnect hua to turant log mein dikhe
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
