// tests/credentials.test.ts
// Phase 3B: offer letter on payment, PDF worker (processor called directly),
// immutability, my documents + signed download, public verify, revoke on refund.

import fs from 'fs';
import request from 'supertest';
import { createHmac, randomBytes } from 'crypto';
import { Types } from 'mongoose';
import app from '../src/app';
import Credential from '../src/models/credential.model';
import User from '../src/models/user.model';
import { createOrder } from '../src/utils/razorpay.util';
import { sendDocumentReadyEmail } from '../src/utils/email.util';
import { processDocumentJob } from '../src/jobs/document.processor';
import { getDocumentsQueue } from '../src/jobs/queue';
import { issueCredential } from '../src/services/credential.service';
import { renderCredentialPdf, pdfSafe } from '../src/services/document.service';
import { normalizeCredentialId, generateCredentialId } from '../src/utils/credentialId.util';
import { CERTIFICATE_NAME_PATTERN } from '../src/constants/profile';
import { issuer } from '../src/config/issuer';
import { createCourse, createCohort, createStudent } from './helpers/fixtures';

jest.mock('../src/utils/razorpay.util', () => ({
  ...jest.requireActual('../src/utils/razorpay.util'),
  createOrder: jest.fn(),
}));
jest.mock('../src/utils/email.util', () => ({
  ...jest.requireActual('../src/utils/email.util'),
  sendDocumentReadyEmail: jest.fn(),
}));
const mockedCreateOrder = createOrder as jest.MockedFunction<typeof createOrder>;
const mockedDocEmail = sendDocumentReadyEmail as jest.MockedFunction<typeof sendDocumentReadyEmail>;

const KEY_SECRET = 'test-razorpay-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';
const rand = () => randomBytes(7).toString('hex');
const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;

beforeEach(() => {
  mockedCreateOrder.mockReset();
  mockedCreateOrder.mockImplementation(async (amountPaise) => ({ id: `order_${rand()}`, amount: amountPaise, currency: 'INR' }));
  mockedDocEmail.mockReset();
  mockedDocEmail.mockResolvedValue(undefined);
});

// Onboarded student pays for a batch → returns their offer letter credential
const paidStudent = async () => {
  const { course } = await createCourse();
  const cohort = await createCohort(oid(course), { pricePaise: 59900 });
  const student = await createStudent('student', { onboarded: true });
  const start = await request(app).post('/api/enrollments').set(student.auth).send({ cohortId: String(cohort._id) }).expect(201);
  const orderId = start.body.checkout.orderId as string;
  const paymentId = `pay_${rand()}`;
  const signature = createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  await request(app)
    .post('/api/payments/verify')
    .set(student.auth)
    .send({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature })
    .expect(200);
  const credential = await Credential.findOne({ userId: student.user._id, type: 'offer_letter' });
  return { course, cohort, student, auth: student.auth, paymentId, credential: credential!, enrollmentId: start.body.enrollment.id as string };
};

const runPdfJob = (credentialId: string) => processDocumentJob({ name: 'generate-pdf', data: { credentialId } });

// ─────────────────────────────────────────────────────────────────────────
describe('Credential IDs and PDF rendering (pure)', () => {
  it('generates readable, unguessable IDs and normalizes user input', () => {
    const id = generateCredentialId(new Date('2026-11-01'));
    expect(id).toMatch(/^BYD-26-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeCredentialId(` ${id.toLowerCase()} `)).toBe(id);
    expect(normalizeCredentialId('BYD-26-0OIL-AAAA')).toBeNull(); // confusable chars never issued
    expect(normalizeCredentialId('not-an-id')).toBeNull();
  });

  it('renders all three document types as real PDFs', async () => {
    const snapshot = {
      studentName: 'Anita D’Souza', collegeName: 'Govt College', courseTitle: 'Web Dev', skills: ['React'],
      cohortName: 'Nov 2026', cohortCode: 'FSWD-NOV26', startDate: new Date(), endDate: new Date(), durationWeeks: 8,
      issuedAt: new Date(), issuer: { ...issuer },
    };
    for (const type of ['offer_letter', 'completion_letter', 'completion_certificate'] as const) {
      const bytes = await renderCredentialPdf(type, snapshot, 'BYD-26-AAAA-BBBB');
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('never crashes on text the PDF fonts cannot draw', async () => {
    expect(pdfSafe('राहुल – “Pune”')).toBe('????? - "Pune"');
    const snapshot = {
      studentName: 'Ravi', collegeName: 'शासकीय महाविद्यालय', courseTitle: 'Web Dev', skills: [],
      cohortName: 'Nov', cohortCode: 'X-1', startDate: new Date(), endDate: new Date(), durationWeeks: 8,
      issuedAt: new Date(), issuer: { ...issuer },
    };
    await expect(renderCredentialPdf('completion_certificate', snapshot, 'BYD-26-AAAA-BBBB')).resolves.toBeDefined();
  });

  it('certificate names must be in English letters', () => {
    expect(CERTIFICATE_NAME_PATTERN.test("Anita D'Souza")).toBe(true);
    expect(CERTIFICATE_NAME_PATTERN.test('José Núñez')).toBe(true);
    expect(CERTIFICATE_NAME_PATTERN.test('राहुल कुमार')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Offer letter on payment', () => {
  it('paying issues an offer letter with a snapshot, queues the PDF and locks the certificate name', async () => {
    const { credential, cohort, student } = await paidStudent();

    expect(credential).toBeTruthy();
    expect(credential.status).toBe('generating');
    expect(credential.snapshot).toMatchObject({
      studentName: 'Ravi Kumar',
      collegeName: 'Govt College of Engineering, Pune',
      cohortCode: cohort.code,
      issuer: { legalName: 'GrewDo', brand: 'Beyownd', programName: 'Beyownd Virtual Internship Program' },
    });
    expect(await getDocumentsQueue().getJob(`pdf-${credential.credentialId}`)).toBeTruthy();

    const user = await User.findById(student.user._id);
    expect(user?.profile?.certificateNameLockedAt).toBeInstanceOf(Date);
  });

  it('the worker renders the PDF, marks it issued and queues the email - and is idempotent', async () => {
    const { credential } = await paidStudent();

    expect(await runPdfJob(credential.credentialId)).toBe('issued');
    const issued = await Credential.findById(credential._id);
    expect(issued).toMatchObject({ status: 'issued', pdfKey: `offer-letter/${credential.credentialId}.pdf` });
    expect(await getDocumentsQueue().getJob(`email-${credential.credentialId}`)).toBeTruthy();

    const file = `${process.env.STORAGE_LOCAL_DIR}/offer-letter/${credential.credentialId}.pdf`;
    expect(fs.readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-');

    expect(await runPdfJob(credential.credentialId)).toBe('already_issued');

    expect(await processDocumentJob({ name: 'send-document-email', data: { credentialId: credential.credentialId } })).toBe('sent');
    expect(mockedDocEmail).toHaveBeenCalledWith(expect.any(String), 'Ravi Kumar', 'offer_letter', credential.credentialId, expect.any(String));
  });

  it('issuing twice (or in parallel) never creates a second document', async () => {
    const { enrollmentId, credential } = await paidStudent();
    const results = await Promise.all([1, 2, 3].map(() => issueCredential(enrollmentId, 'offer_letter')));
    expect(new Set(results.map((c) => c.credentialId))).toEqual(new Set([credential.credentialId]));
    expect(await Credential.countDocuments({ enrollmentId })).toBe(1);
  });

  it('issued documents are immutable - only status / pdf / revocation can change', async () => {
    const { credential } = await paidStudent();
    await expect(Credential.updateOne({ _id: credential._id }, { $set: { 'snapshot.studentName': 'Someone Else' } })).rejects.toThrow(/immutable/);
    await expect(Credential.updateOne({ _id: credential._id }, { type: 'completion_certificate' })).rejects.toThrow(/immutable/);

    const doc = await Credential.findById(credential._id);
    doc!.snapshot.courseTitle = 'Hacked';
    await expect(doc!.save()).rejects.toThrow(/immutable/);

    await expect(Credential.updateOne({ _id: credential._id }, { $set: { status: 'issued' } })).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('My documents and download', () => {
  it('lists my documents and gives a short-lived download link once ready', async () => {
    const { credential, auth } = await paidStudent();

    const list = await request(app).get('/api/credentials').set(auth).expect(200);
    expect(list.body.credentials).toEqual([expect.objectContaining({ credentialId: credential.credentialId, type: 'offer_letter', status: 'generating' })]);

    const early = await request(app).get(`/api/credentials/${credential.credentialId}/download`).set(auth).expect(409);
    expect(early.body.code).toBe('CREDENTIAL_NOT_READY');

    await runPdfJob(credential.credentialId);
    const link = await request(app).get(`/api/credentials/${credential.credentialId}/download`).set(auth).expect(200);
    expect(link.body.url).toContain(`/api/files/offer-letter/${credential.credentialId}.pdf?expires=`);

    const path = link.body.url.replace('http://localhost:5000', '');
    const file = await request(app).get(path).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect((file.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects tampered or expired download links', async () => {
    const { credential, auth } = await paidStudent();
    await runPdfJob(credential.credentialId);
    const link = await request(app).get(`/api/credentials/${credential.credentialId}/download`).set(auth).expect(200);
    const path: string = link.body.url.replace('http://localhost:5000', '');

    await request(app).get(path.replace(/sig=[a-f0-9]+/, `sig=${'0'.repeat(64)}`)).expect(403);
    await request(app).get(path.replace(/offer-letter/, 'completion-letter')).expect(403);

    const realNow = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 6 * 60 * 1000);
    try {
      const expired = await request(app).get(path).expect(403);
      expect(expired.body.code).toBe('DOWNLOAD_LINK_EXPIRED');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("can't download someone else's document", async () => {
    const { credential } = await paidStudent();
    await runPdfJob(credential.credentialId);
    const stranger = await createStudent();
    await request(app).get(`/api/credentials/${credential.credentialId}/download`).set(stranger.auth).expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Public verify', () => {
  it('shows the document without login, never exposing email or phone', async () => {
    const { credential } = await paidStudent();
    await runPdfJob(credential.credentialId);

    const res = await request(app).get(`/api/verify/${credential.credentialId.toLowerCase()}`).expect(200);
    expect(res.body.credential).toMatchObject({
      valid: true,
      status: 'issued',
      credentialId: credential.credentialId,
      studentName: 'Ravi Kumar',
      issuedBy: 'GrewDo',
      programName: 'Beyownd Virtual Internship Program',
    });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/@example\.com|\+91|userId|enrollmentId/);
  });

  it('returns 404 for unknown or malformed IDs', async () => {
    await request(app).get('/api/verify/BYD-26-AAAA-BBBB').expect(404);
    const res = await request(app).get('/api/verify/<script>').expect(404);
    expect(res.body.code).toBe('CREDENTIAL_NOT_FOUND');
  });

  it('a document still being generated is not shown as valid yet', async () => {
    const { credential } = await paidStudent();
    const res = await request(app).get(`/api/verify/${credential.credentialId}`).expect(200);
    expect(res.body.credential).toMatchObject({ valid: false, status: 'generating' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Refund revokes documents', () => {
  it('after a refund the verify page says revoked, downloads stop, and the worker never re-issues', async () => {
    const { credential, auth, paymentId } = await paidStudent();
    await runPdfJob(credential.credentialId);
    // Warm the verify cache first - revocation must invalidate it
    await request(app).get(`/api/verify/${credential.credentialId}`).expect(200);

    const refund = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_${rand()}`, payment_id: paymentId, amount: 59900 } } } });
    await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', createHmac('sha256', WEBHOOK_SECRET).update(refund).digest('hex'))
      .send(refund)
      .expect(200);

    const verify = await request(app).get(`/api/verify/${credential.credentialId}`).expect(200);
    expect(verify.body.credential).toMatchObject({ valid: false, status: 'revoked' });
    expect(verify.body.credential.revokedAt).toBeTruthy();

    const dl = await request(app).get(`/api/credentials/${credential.credentialId}/download`).set(auth).expect(403);
    expect(dl.body.code).toBe('CREDENTIAL_REVOKED');

    // A retried PDF job must never bring a revoked document back
    expect(await runPdfJob(credential.credentialId)).toBe('revoked');
    expect((await Credential.findById(credential._id))?.status).toBe('revoked');
  });
});
