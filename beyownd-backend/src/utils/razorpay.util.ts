// src/utils/razorpay.util.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Razorpay se baat karne wala EK hi file. Baaki app ko Razorpay SDK ka pata
// nahi - provider badalna pade (ya tests mein mock karna ho) to sirf yeh file.
//
// Do signatures verify hote hai (dono HMAC-SHA256, timing-safe compare):
// 1. CHECKOUT signature - browser checkout ke baad { order_id, payment_id,
//    signature } bhejta hai. HMAC(key_secret, "order_id|payment_id").
//    Isse pata chalta hai payment sach mein Razorpay se aaya, frontend ne
//    fake nahi kiya.
// 2. WEBHOOK signature - Razorpay server humein POST karta hai. HMAC(webhook
//    secret, RAW request body). Raw body chahiye (parsed JSON nahi) - isliye
//    webhook route express.json() se PEHLE express.raw() ke saath mount hai.
// ────────────────────────────────────────────────────────────────────────

import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { AppError } from './AppError';
import { logger } from './logger';

const razorpay = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });

const safeEqualHex = (expectedHex: string, receivedHex: string): boolean => {
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  // Length alag ho to timingSafeEqual throw karta hai - pehle check
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export interface CreatedOrder {
  id: string;
  amount: number;
  currency: string;
}

export const createOrder = async (
  amountPaise: number,
  receipt: string,
  notes: Record<string, string>
): Promise<CreatedOrder> => {
  try {
    const order = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  } catch (err) {
    logger.error({ err }, 'Razorpay order creation failed');
    throw new AppError(502, 'Payment service is unavailable. Please try again in a minute.', 'PAYMENT_PROVIDER_ERROR');
  }
};

export const isValidCheckoutSignature = (orderId: string, paymentId: string, signature: string): boolean => {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
};

export const isValidWebhookSignature = (rawBody: Buffer, signature: string | undefined): boolean => {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
};
