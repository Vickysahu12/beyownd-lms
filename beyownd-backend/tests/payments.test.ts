// tests/payments.test.ts
// Phase 3A: enrollment checkout, Razorpay signature verification, webhook
// handling, idempotent activation (transaction), seat races, refunds.
// Only the network call that creates a Razorpay order is mocked - both
// signature checks run for real against test secrets.

import request from 'supertest';
import { createHmac, randomBytes } from 'crypto';
import { Types } from 'mongoose';
import app from '../src/app';
import Payment from '../src/models/payment.model';
import Enrollment from '../src/models/enrollment.model';
import Cohort from '../src/models/cohort.model';
import { createOrder } from '../src/utils/razorpay.util';
import { AppError } from '../src/utils/AppError';
import { createCourse, createCohort, createStudent, createEnrollment } from './helpers/fixtures';

jest.mock('../src/utils/razorpay.util', () => ({
  ...jest.requireActual('../src/utils/razorpay.util'),
  createOrder: jest.fn(),
}));
const mockedCreateOrder = createOrder as jest.MockedFunction<typeof createOrder>;

const KEY_SECRET = 'test-razorpay-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';
const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;
const rand = () => randomBytes(7).toString('hex');

const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

// Sends exactly what Razorpay sends: raw JSON + HMAC of the raw body
const sendWebhook = (event: object, { eventId = `evt_${rand()}`, signature }: { eventId?: string; signature?: string } = {}) => {
  const body = JSON.stringify(event);
  return request(app)
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature ?? createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex'))
    .set('X-Razorpay-Event-Id', eventId)
    .send(body);
};

const capturedEvent = (orderId: string, paymentId: string, amount: number) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, method: 'upi', status: 'captured' } } },
});

// Published course + open batch + onboarded student
const setup = async (cohortOptions: Parameters<typeof createCohort>[1] = {}) => {
  const { course } = await createCourse();
  const cohort = await createCohort(oid(course), { pricePaise: 59900, ...cohortOptions });
  const student = await createStudent('student', { onboarded: true });
  return { course, cohort, student, auth: student.auth };
};

const startCheckout = (auth: Record<string, string>, cohortId: unknown) =>
  request(app).post('/api/enrollments').set(auth).send({ cohortId: String(cohortId) });

// Start checkout and return what the frontend would get
const checkout = async (auth: Record<string, string>, cohortId: unknown) => {
  const res = await startCheckout(auth, cohortId).expect(201);
  return { orderId: res.body.checkout.orderId as string, enrollmentId: res.body.enrollment.id as string, body: res.body };
};

const verify = (auth: Record<string, string>, orderId: string, paymentId: string, signature = checkoutSignature(orderId, paymentId)) =>
  request(app).post('/api/payments/verify').set(auth).send({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });

beforeEach(() => {
  mockedCreateOrder.mockReset();
  mockedCreateOrder.mockImplementation(async (amountPaise) => ({ id: `order_${rand()}`, amount: amountPaise, currency: 'INR' }));
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/enrollments (start checkout)', () => {
  it('requires onboarding', async () => {
    const { cohort } = await setup();
    const fresh = await createStudent();
    const res = await startCheckout(fresh.auth, cohort._id).expect(403);
    expect(res.body.code).toBe('ONBOARDING_REQUIRED');
  });

  it('creates a pending enrollment, a Razorpay order and a payment with a price snapshot', async () => {
    const { cohort, auth } = await setup();
    const { body, orderId, enrollmentId } = await checkout(auth, cohort._id);

    expect(body.enrollment.status).toBe('pending_payment');
    expect(body.checkout).toMatchObject({ keyId: 'rzp_test_dummykey', amountPaise: 59900, currency: 'INR', name: 'Beyownd' });
    expect(mockedCreateOrder).toHaveBeenCalledWith(59900, `enr_${enrollmentId}`, expect.objectContaining({ enrollmentId }));

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    expect(payment).toMatchObject({ status: 'created', amountPaise: 59900 });

    // Admin changes the price later - the old payment keeps its snapshot
    await Cohort.updateOne({ _id: cohort._id }, { pricePaise: 99900 });
    expect((await Payment.findOne({ razorpayOrderId: orderId }))?.amountPaise).toBe(59900);
  });

  it('retrying checkout reuses the same enrollment', async () => {
    const { cohort, auth } = await setup();
    const a = await checkout(auth, cohort._id);
    const b = await checkout(auth, cohort._id);
    expect(b.enrollmentId).toBe(a.enrollmentId);
    expect(await Enrollment.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(2); // one order per attempt
  });

  it('rejects closed, full and unknown batches', async () => {
    const closed = await setup({ enrollClosesInDays: -1 });
    expect((await startCheckout(closed.auth, closed.cohort._id).expect(409)).body.code).toBe('ENROLLMENT_CLOSED');

    const scheduled = await setup({ status: 'scheduled' });
    expect((await startCheckout(scheduled.auth, scheduled.cohort._id).expect(409)).body.code).toBe('ENROLLMENT_CLOSED');

    const full = await setup({ capacity: 5, seatsTaken: 5 });
    expect((await startCheckout(full.auth, full.cohort._id).expect(409)).body.code).toBe('COHORT_FULL');

    await startCheckout(full.auth, new Types.ObjectId()).expect(404);
    await startCheckout(full.auth, 'not-an-id').expect(400);
  });

  it('blocks enrolling twice in the same program', async () => {
    const { course, cohort, student, auth } = await setup();
    await createEnrollment(oid(student.user), oid(course), oid(cohort), 'active');
    const other = await createCohort(oid(course));
    const res = await startCheckout(auth, other._id).expect(409);
    expect(res.body.code).toBe('ALREADY_ENROLLED');
  });

  it('returns 502 if Razorpay is down, without leaving a payment behind', async () => {
    const { cohort, auth } = await setup();
    mockedCreateOrder.mockRejectedValueOnce(new AppError(502, 'down', 'PAYMENT_PROVIDER_ERROR'));
    const res = await startCheckout(auth, cohort._id).expect(502);
    expect(res.body.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(await Payment.countDocuments()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/payments/verify (checkout callback)', () => {
  it('a valid signature activates the enrollment and claims one seat', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);

    const res = await verify(auth, orderId, `pay_${rand()}`).expect(200);
    expect(res.body).toMatchObject({ outcome: 'activated', enrollment: { id: enrollmentId, status: 'active' } });
    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(1);
    expect((await Payment.findOne({ razorpayOrderId: orderId }))?.status).toBe('paid');
  });

  it('a forged signature is rejected and nothing changes', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);

    const res = await verify(auth, orderId, `pay_${rand()}`, 'a'.repeat(64)).expect(400);
    expect(res.body.code).toBe('PAYMENT_SIGNATURE_INVALID');
    expect((await Enrollment.findById(enrollmentId))?.status).toBe('pending_payment');
    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(0);
  });

  it("can't verify someone else's order", async () => {
    const { cohort, auth } = await setup();
    const { orderId } = await checkout(auth, cohort._id);
    const stranger = await createStudent('student', { onboarded: true });
    await verify(stranger.auth, orderId, `pay_${rand()}`).expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Razorpay webhook', () => {
  it('rejects a bad signature', async () => {
    const res = await sendWebhook(capturedEvent('order_x', 'pay_x', 100), { signature: 'b'.repeat(64) }).expect(400);
    expect(res.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('payment.captured activates the enrollment even if the student closed the tab', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);

    await sendWebhook(capturedEvent(orderId, `pay_${rand()}`, 59900)).expect(200);
    expect((await Enrollment.findById(enrollmentId))?.status).toBe('active');
    expect((await Payment.findOne({ razorpayOrderId: orderId }))?.method).toBe('upi');
  });

  it('verify + webhook + repeated webhooks → activated once, one seat', async () => {
    const { cohort, auth } = await setup();
    const { orderId } = await checkout(auth, cohort._id);
    const paymentId = `pay_${rand()}`;

    await verify(auth, orderId, paymentId).expect(200);
    const again = await verify(auth, orderId, paymentId).expect(200);
    expect(again.body.outcome).toBe('already_processed');
    await sendWebhook(capturedEvent(orderId, paymentId, 59900), { eventId: 'evt_same' }).expect(200);
    await sendWebhook(capturedEvent(orderId, paymentId, 59900), { eventId: 'evt_same' }).expect(200);

    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(1);
  });

  it('5 parallel deliveries of the same payment → exactly one seat', async () => {
    const { cohort, auth } = await setup();
    const { orderId } = await checkout(auth, cohort._id);
    const paymentId = `pay_${rand()}`;

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map(() => sendWebhook(capturedEvent(orderId, paymentId, 59900)))
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(1);
    expect(await Payment.countDocuments({ status: 'paid' })).toBe(1);
  });

  it('never activates when the captured amount differs from our order', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);
    await sendWebhook(capturedEvent(orderId, `pay_${rand()}`, 100)).expect(400);
    expect((await Enrollment.findById(enrollmentId))?.status).toBe('pending_payment');
  });

  it('acknowledges unknown orders and unrelated events with 200 (no pointless retries)', async () => {
    await sendWebhook(capturedEvent('order_notours', 'pay_x', 100)).expect(200);
    await sendWebhook({ event: 'order.paid', payload: {} }).expect(200);
  });

  it('payment.failed then a successful retry on the same order still activates', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);

    await sendWebhook({ event: 'payment.failed', payload: { payment: { entity: { id: `pay_${rand()}`, order_id: orderId, amount: 59900 } } } }).expect(200);
    expect((await Payment.findOne({ razorpayOrderId: orderId }))?.status).toBe('failed');

    await sendWebhook(capturedEvent(orderId, `pay_${rand()}`, 59900)).expect(200);
    expect((await Enrollment.findById(enrollmentId))?.status).toBe('active');
  });

  it('last-seat race: second payer is flagged for refund, not enrolled', async () => {
    const { cohort, auth } = await setup({ capacity: 1 });
    const other = await createStudent('student', { onboarded: true });
    const a = await checkout(auth, cohort._id);
    const b = await checkout(other.auth, cohort._id); // both started while 1 seat was left

    await sendWebhook(capturedEvent(a.orderId, `pay_${rand()}`, 59900)).expect(200);
    await sendWebhook(capturedEvent(b.orderId, `pay_${rand()}`, 59900)).expect(200);

    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(1);
    expect((await Enrollment.findById(a.enrollmentId))?.status).toBe('active');
    expect((await Enrollment.findById(b.enrollmentId))?.status).toBe('cancelled');
    expect(await Payment.findOne({ razorpayOrderId: b.orderId })).toMatchObject({ status: 'paid', refundRequired: true });
  });

  it('refund.processed refunds the enrollment and releases the seat - only once', async () => {
    const { cohort, auth } = await setup();
    const { orderId, enrollmentId } = await checkout(auth, cohort._id);
    const paymentId = `pay_${rand()}`;
    await verify(auth, orderId, paymentId).expect(200);

    const refund = { event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_${rand()}`, payment_id: paymentId, amount: 59900 } } } };
    await sendWebhook(refund).expect(200);
    await sendWebhook(refund).expect(200);

    expect((await Enrollment.findById(enrollmentId))?.status).toBe('refunded');
    expect((await Payment.findOne({ razorpayOrderId: orderId }))?.status).toBe('refunded');
    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('GET /api/payments', () => {
  it('shows only real payments (paid/refunded), not abandoned checkouts', async () => {
    const { cohort, auth } = await setup();
    const { orderId } = await checkout(auth, cohort._id);
    await checkout(auth, cohort._id); // abandoned second attempt
    await verify(auth, orderId, `pay_${rand()}`).expect(200);

    const res = await request(app).get('/api/payments').set(auth).expect(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({ status: 'paid', amountPaise: 59900 });
  });
});
