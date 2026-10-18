// src/models/payment.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Har checkout attempt = ek Payment (status 'created' + Razorpay order ID).
//   Payment confirm hone pe 'paid', aur usi TRANSACTION mein enrollment
//   active + cohort seat claim (services/payment.service.ts).
// - `amountPaise` SNAPSHOT hai - order bante waqt ka cohort price. Admin baad
//   mein price badle to purane payments nahi badalte.
// - IDEMPOTENCY: paid karna = updateOne({ razorpayOrderId, status: created|failed }).
//   Checkout callback pehle aaye ya webhook, ya webhook 5 baar aaye - sirf
//   pehla kuch badalta hai. `razorpayPaymentId` unique - ek payment do baar count nahi.
// - `refundRequired` - paise aa gaye lekin seat nahi bachi (last-seat race):
//   admin ko manually refund karna hai (decision: launch pe automation nahi).
// - Design: docs/design/schemas.md §5.1
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const PAYMENT_STATUSES = ['created', 'paid', 'failed', 'refunded'] as const;

export interface IPayment extends Document {
  userId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  cohortId: Types.ObjectId;
  amountPaise: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: (typeof PAYMENT_STATUSES)[number];
  method?: string;
  processedEventIds: string[];
  refundRequired: boolean;
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'created' },
    method: { type: String },
    // Webhook event IDs jo process ho chuke - repeat event ignore
    processedEventIds: { type: [String], default: [] },
    refundRequired: { type: Boolean, default: false },
    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

// "Meri payments"
paymentSchema.index({ userId: 1, createdAt: -1 });
// Admin: status ke hisaab se (e.g. refundRequired wale)
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
