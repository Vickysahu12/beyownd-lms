// src/controllers/payment.controller.ts
// Checkout verify, payment history, aur Razorpay webhook.

import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import * as paymentService from '../services/payment.service';
import { isValidWebhookSignature } from '../utils/razorpay.util';
import { AppError } from '../utils/AppError';

export const verify = async (req: Request, res: Response) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = matchedData(req, { locations: ['body'] }) as {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };
  const result = await paymentService.verifyCheckout(req.user!.id, razorpayOrderId, razorpayPaymentId, razorpaySignature);
  res.status(200).json({ success: true, ...result });
};

export const listMine = async (req: Request, res: Response) => {
  const payments = await paymentService.listMyPayments(req.user!.id);
  res.status(200).json({ success: true, payments });
};

// req.body yahan Buffer hai (express.raw) - signature RAW bytes pe check
// hota hai. Signature galat → 400 (fake request). Processing mein DB error →
// errorHandler 500 → Razorpay automatically retry karega.
export const razorpayWebhook = async (req: Request, res: Response) => {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !isValidWebhookSignature(raw, req.get('x-razorpay-signature'))) {
    req.log?.warn('Rejected Razorpay webhook with invalid signature');
    throw AppError.badRequest('Invalid signature', 'WEBHOOK_SIGNATURE_INVALID');
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    throw AppError.badRequest('Malformed webhook body', 'MALFORMED_JSON');
  }

  const result = await paymentService.handleWebhookEvent(event, req.get('x-razorpay-event-id') ?? undefined);
  req.log?.info({ event: event?.event, result }, 'Razorpay webhook handled');
  res.status(200).json({ received: true });
};
