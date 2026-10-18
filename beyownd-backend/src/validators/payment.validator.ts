// src/validators/payment.validator.ts
// Enrollment start + checkout verify ki FORMAT validation. Signature ka
// asli check (HMAC) service mein hota hai.

import { body } from 'express-validator';

export const startEnrollmentValidator = [
  body('cohortId').isMongoId().withMessage('Select a valid batch'),
];

export const verifyPaymentValidator = [
  body('razorpayOrderId').isString().matches(/^order_[A-Za-z0-9]{6,40}$/).withMessage('Invalid order'),
  body('razorpayPaymentId').isString().matches(/^pay_[A-Za-z0-9]{6,40}$/).withMessage('Invalid payment'),
  body('razorpaySignature').isString().matches(/^[a-f0-9]{64}$/i).withMessage('Invalid signature'),
];
