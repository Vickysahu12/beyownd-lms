// src/services/payment.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Paisa: enroll start karna (Razorpay order), payment confirm karna,
// webhooks, refunds. Business ka sabse sensitive hissa.
//
// FLOW:
//   1. POST /enrollments → enrollment (pending_payment) + Razorpay order + Payment (created)
//   2. Browser mein Razorpay checkout → student UPI/card se pay karta hai
//   3a. Browser → POST /payments/verify (checkout signature)   ┐ dono same
//   3b. Razorpay → POST /webhooks/razorpay (webhook signature) ┘ activatePayment()
//   Webhook = source of truth: student ne pay karke tab band kar diya to bhi
//   enrollment activate hota hai.
//
// activatePayment() EK MongoDB TRANSACTION mein teen kaam karta hai:
//   (a) payment created|failed → paid       (conditional - sirf pehli baar match)
//   (b) cohort seat claim: seatsTaken < capacity ho to +1 (atomic)
//   (c) enrollment pending_payment → active
// Ya teeno hote hai, ya koi nahi. Verify + webhook ek saath aaye, ya webhook
// 5 baar aaye - (a) sirf ek baar match karta hai, baaki "already processed".
//
// LAST-SEAT RACE: (b) fail (seat khatam) → payment paid rehta hai (paise
// aa chuke) + refundRequired = true, enrollment cancelled. Admin manually
// refund karta hai (launch pe automation nahi - rare case).
// ────────────────────────────────────────────────────────────────────────

import mongoose, { isValidObjectId, ClientSession } from 'mongoose';
import Payment, { IPayment } from '../models/payment.model';
import Enrollment from '../models/enrollment.model';
import Cohort from '../models/cohort.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { invalidate, cacheKeys } from '../utils/cache';
import { createOrder, isValidCheckoutSignature } from '../utils/razorpay.util';
import { issueCredential, revokeForEnrollment } from './credential.service';

export type ActivationOutcome = 'activated' | 'already_processed' | 'cohort_full_refund_required';

// ---- 1. Enrollment start + order ----

export const startEnrollment = async (userId: string, cohortId: string) => {
  if (!isValidObjectId(cohortId)) throw AppError.notFound('Batch not found');
  const cohort = await Cohort.findById(cohortId);
  if (!cohort) throw AppError.notFound('Batch not found');

  const now = new Date();
  if (cohort.status !== 'open' || now < cohort.enrollOpensAt || now >= cohort.enrollClosesAt) {
    throw AppError.conflict('Enrollment for this batch is closed', 'ENROLLMENT_CLOSED');
  }
  // Soft check - asli seat claim payment ke time (activatePayment) atomically
  if (cohort.seatsTaken >= cohort.capacity) {
    throw AppError.conflict('This batch is full. Please choose another batch.', 'COHORT_FULL');
  }

  const course = await Course.findOne({ _id: cohort.courseId, status: 'published' }).select({ title: 1 });
  if (!course) throw AppError.notFound('Batch not found');

  // Same course pe pehle se active/completed (kisi bhi batch mein) → dobara nahi
  const alreadyIn = await Enrollment.findOne({
    userId,
    courseId: cohort.courseId,
    status: { $in: ['active', 'completed'] },
  }).select({ _id: 1 });
  if (alreadyIn) {
    throw AppError.conflict('You are already enrolled in this program', 'ALREADY_ENROLLED');
  }

  // Is batch ka enrollment: naya banao, ya purana pending/cancelled reuse.
  // Unique { userId, cohortId } index - parallel clicks se do enrollments nahi banti.
  let enrollment = await Enrollment.findOne({ userId, cohortId: cohort._id });
  if (!enrollment) {
    try {
      enrollment = await Enrollment.create({ userId, courseId: cohort.courseId, cohortId: cohort._id, status: 'pending_payment' });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      enrollment = await Enrollment.findOne({ userId, cohortId: cohort._id });
    }
  } else if (['cancelled', 'refunded'].includes(enrollment.status)) {
    enrollment.status = 'pending_payment';
    await enrollment.save();
  }
  if (!enrollment) throw new Error('Enrollment could not be created');

  const enrollmentId = String(enrollment._id);
  // Razorpay receipt max 40 chars
  const order = await createOrder(cohort.pricePaise, `enr_${enrollmentId}`, {
    enrollmentId,
    userId,
    cohortId: String(cohort._id),
  });

  await Payment.create({
    userId,
    enrollmentId: enrollment._id,
    cohortId: cohort._id,
    amountPaise: cohort.pricePaise, // snapshot
    razorpayOrderId: order.id,
  });

  const user = await User.findById(userId).select({ name: 1, email: 1, profile: 1 });

  return {
    enrollment: { id: enrollmentId, status: enrollment.status },
    // Frontend Razorpay Checkout ko yahi chahiye
    checkout: {
      keyId: env.razorpayKeyId,
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      name: 'Beyownd',
      description: `${course.title} — ${cohort.name}`,
      prefill: {
        name: user?.profile?.certificateName ?? user?.name ?? '',
        email: user?.email ?? '',
        contact: user?.profile?.phone ?? '',
      },
    },
  };
};

// ---- 2. Activation (shared by checkout verify + webhook) ----

interface ActivationInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  method?: string;
  eventId?: string;
  amountPaise?: number; // webhook se aata hai - tamper check
}

const runActivation = async (input: ActivationInput, session: ClientSession): Promise<ActivationOutcome> => {
  const existing = await Payment.findOne({ razorpayOrderId: input.razorpayOrderId }).session(session);
  if (!existing) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');

  if (input.amountPaise !== undefined && input.amountPaise !== existing.amountPaise) {
    // Razorpay ne jo amount liya woh humare order se alag - kabhi activate nahi
    logger.error({ orderId: input.razorpayOrderId, expected: existing.amountPaise, got: input.amountPaise }, 'Payment amount mismatch');
    throw AppError.badRequest('Payment amount mismatch', 'PAYMENT_AMOUNT_MISMATCH');
  }

  // (a) created|failed → paid. Sirf pehli call match karti hai.
  const payment = await Payment.findOneAndUpdate(
    { _id: existing._id, status: { $in: ['created', 'failed'] } },
    {
      $set: { status: 'paid', razorpayPaymentId: input.razorpayPaymentId, method: input.method, paidAt: new Date() },
      ...(input.eventId ? { $addToSet: { processedEventIds: input.eventId } } : {}),
    },
    { new: true, session }
  );
  if (!payment) return 'already_processed';

  // (b) seat claim - $expr se do fields compare: seatsTaken < capacity
  const seat = await Cohort.updateOne(
    { _id: payment.cohortId, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
    { $inc: { seatsTaken: 1 } },
    { session }
  );

  if (seat.modifiedCount === 0) {
    await Payment.updateOne({ _id: payment._id }, { $set: { refundRequired: true } }, { session });
    await Enrollment.updateOne(
      { _id: payment.enrollmentId, status: 'pending_payment' },
      { $set: { status: 'cancelled' } },
      { session }
    );
    logger.error({ paymentId: payment._id, cohortId: payment.cohortId }, 'Paid but batch full - manual refund required');
    return 'cohort_full_refund_required';
  }

  // (c) enrollment active
  await Enrollment.updateOne(
    { _id: payment.enrollmentId, status: { $in: ['pending_payment', 'cancelled'] } },
    { $set: { status: 'active', activatedAt: new Date() } },
    { session }
  );
  return 'activated';
};

export const activatePayment = async (input: ActivationInput): Promise<ActivationOutcome> => {
  const session = await mongoose.startSession();
  try {
    // withTransaction transient errors (write conflict) pe khud retry karta hai
    const outcome = await session.withTransaction(() => runActivation(input, session));
    if (outcome !== 'already_processed') {
      // Seats badli - public "seats left" cache hatao
      const payment = await Payment.findOne({ razorpayOrderId: input.razorpayOrderId }).select({ cohortId: 1, enrollmentId: 1 });
      const cohort = payment ? await Cohort.findById(payment.cohortId).select({ courseId: 1 }) : null;
      if (cohort) await invalidate(cacheKeys.courseCohorts(String(cohort.courseId)));
      logger.info({ orderId: input.razorpayOrderId, outcome }, 'Payment processed');

      // Offer letter - transaction commit hone ke BAAD. Fail ho to payment
      // fail nahi hota (paise aa chuke, enrollment active hai) - error log
      // hota hai aur admin reissue kar sakta hai.
      if (outcome === 'activated' && payment) {
        try {
          await issueCredential(payment.enrollmentId, 'offer_letter');
        } catch (err) {
          logger.error({ err, enrollmentId: payment.enrollmentId }, 'Offer letter issue failed after activation');
        }
      }
    }
    return outcome;
  } finally {
    await session.endSession();
  }
};

// ---- 3a. Checkout verify (browser) ----

export const verifyCheckout = async (
  userId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) => {
  // Payment is user ka hona chahiye - kisi aur ka order ID bhej ke kuch nahi hota
  const payment = await Payment.findOne({ razorpayOrderId, userId }).select({ enrollmentId: 1 });
  if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');

  if (!isValidCheckoutSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    logger.warn({ razorpayOrderId, userId }, 'Invalid checkout signature');
    throw AppError.badRequest(
      'We could not confirm this payment. If money was deducted, your enrollment will activate automatically within a few minutes.',
      'PAYMENT_SIGNATURE_INVALID'
    );
  }

  const outcome = await activatePayment({ razorpayOrderId, razorpayPaymentId });
  const enrollment = await Enrollment.findById(payment.enrollmentId).select({ status: 1, cohortId: 1 });

  return {
    outcome,
    enrollment: enrollment ? { id: String(enrollment._id), status: enrollment.status } : null,
  };
};

// ---- 3b. Webhook events ----

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id: string; order_id: string; amount: number; method?: string; status?: string } };
    refund?: { entity?: { id: string; payment_id: string; amount: number } };
  };
}

export const handleWebhookEvent = async (event: RazorpayWebhookEvent, eventId?: string) => {
  if (eventId) {
    const seen = await Payment.exists({ processedEventIds: eventId });
    if (seen) return 'duplicate_event';
  }

  switch (event.event) {
    case 'payment.captured': {
      const p = event.payload?.payment?.entity;
      if (!p?.order_id || !p.id) return 'ignored';
      try {
        return await activatePayment({
          razorpayOrderId: p.order_id,
          razorpayPaymentId: p.id,
          method: p.method,
          eventId,
          amountPaise: p.amount,
        });
      } catch (err) {
        // Kisi aur system ka order (humara Payment nahi) - Razorpay ko 200 do, retry ka fayda nahi
        if (err instanceof AppError && err.code === 'PAYMENT_NOT_FOUND') return 'unknown_order';
        throw err;
      }
    }

    case 'payment.failed': {
      const p = event.payload?.payment?.entity;
      if (!p?.order_id) return 'ignored';
      // Sirf 'created' ko failed - paid ko kabhi neeche nahi. Student same
      // order pe dobara try kar sakta hai; capture aaya to activation 'failed' se bhi chalta hai.
      await Payment.updateOne({ razorpayOrderId: p.order_id, status: 'created' }, { $set: { status: 'failed' } });
      return 'marked_failed';
    }

    case 'refund.processed': {
      const r = event.payload?.refund?.entity;
      if (!r?.payment_id) return 'ignored';
      return markRefunded(r.payment_id);
    }

    default:
      return 'ignored';
  }
};

// Refund: payment refunded, enrollment refunded, seat wapas (transaction -
// teeno saath). Commit ke baad us enrollment ke saare documents REVOKE -
// refund ke baad certificate/offer letter valid nahi rehna chahiye.
export const markRefunded = async (razorpayPaymentId: string) => {
  const session = await mongoose.startSession();
  let enrollmentId: unknown = null;
  try {
    const result = await session.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
        { razorpayPaymentId, status: 'paid' },
        { $set: { status: 'refunded', refundedAt: new Date(), refundRequired: false } },
        { new: true, session }
      );
      if (!payment) return 'already_processed';
      enrollmentId = payment.enrollmentId;

      const enrollment = await Enrollment.findOneAndUpdate(
        { _id: payment.enrollmentId, status: { $in: ['active', 'completed'] } },
        { $set: { status: 'refunded' } },
        { session }
      );
      // Seat sirf tab wapas jab enrollment ne sach mein seat li thi
      if (enrollment) {
        await Cohort.updateOne(
          { _id: payment.cohortId, seatsTaken: { $gt: 0 } },
          { $inc: { seatsTaken: -1 } },
          { session }
        );
      }
      return 'refunded';
    });
    if (result === 'refunded' && enrollmentId) {
      await revokeForEnrollment(String(enrollmentId), 'Payment refunded');
    }
    return result;
  } finally {
    await session.endSession();
  }
};

// ---- 4. History ----

const toPaymentResponse = (p: IPayment) => ({
  id: String(p._id),
  enrollmentId: String(p.enrollmentId),
  amountPaise: p.amountPaise,
  currency: p.currency,
  status: p.status,
  method: p.method ?? null,
  razorpayPaymentId: p.razorpayPaymentId ?? null,
  paidAt: p.paidAt ?? null,
  refundedAt: p.refundedAt ?? null,
  createdAt: p.createdAt,
});

export const listMyPayments = async (userId: string) => {
  // Abandoned checkouts (created/failed) nahi dikhate - sirf asli paise ki history
  const payments = await Payment.find({ userId, status: { $in: ['paid', 'refunded'] } })
    .sort({ createdAt: -1 })
    .limit(50);
  return payments.map(toPaymentResponse);
};

