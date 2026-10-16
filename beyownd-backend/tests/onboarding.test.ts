// tests/onboarding.test.ts
// /users/me, onboarding, profile update, college autocomplete, and the
// requireOnboarding guard. Real app + in-memory Mongo + local Redis;
// only email sending is mocked (to read the signup OTP).

import request from 'supertest';
import express from 'express';
import app from '../src/app';
import User from '../src/models/user.model';
import College from '../src/models/college.model';
import { sendOtpEmail } from '../src/utils/email.util';
import { protect } from '../src/middlewares/auth.middleware';
import { requireOnboarding } from '../src/middlewares/requireOnboarding.middleware';
import { errorHandler } from '../src/middlewares/errorHandler.middleware';
import { redisClient } from '../src/config/redis';

jest.mock('../src/utils/email.util', () => ({ sendOtpEmail: jest.fn() }));
const mockedSendOtp = sendOtpEmail as jest.MockedFunction<typeof sendOtpEmail>;

const PASSWORD = 'Str0ng@Pass';
const thisYear = new Date().getFullYear();

const validProfile = (overrides: Record<string, unknown> = {}) => ({
  certificateName: 'Ravi Kumar',
  phone: '098765 43210',
  college: 'Govt. College of Engg, Pune',
  degree: 'btech',
  branch: 'CSE',
  currentYear: '4',
  graduationYear: thisYear + 1,
  city: 'Pune',
  state: 'Maharashtra',
  goal: 'internship_certificate',
  certificateNeededBy: `${thisYear + 1}-03`,
  interestedTracks: ['web_dev', 'backend', 'web_dev'],
  skillLevel: 'basics',
  heardFrom: 'instagram',
  referralCode: 'friend-123',
  ...overrides,
});

// Signup + OTP verify → access token for a fresh verified user
const createUser = async (email = 'ravi@example.com') => {
  await request(app).post('/api/auth/signup').send({ name: 'Ravi Kumar', email, password: PASSWORD }).expect(201);
  const otp = mockedSendOtp.mock.calls[mockedSendOtp.mock.calls.length - 1][1];
  const res = await request(app).post('/api/auth/verify-otp').send({ email, otp }).expect(200);
  return { token: res.body.accessToken as string, verifyRes: res };
};

const onboard = (token: string, body: Record<string, unknown> = validProfile()) =>
  request(app).put('/api/users/me/onboarding').set('Authorization', `Bearer ${token}`).send(body);

const patchProfile = (token: string, body: Record<string, unknown>) =>
  request(app).patch('/api/users/me/profile').set('Authorization', `Bearer ${token}`).send(body);

beforeEach(() => {
  mockedSendOtp.mockReset();
  mockedSendOtp.mockResolvedValue(undefined);
});

describe('GET /api/users/me', () => {
  it('requires authentication', async () => {
    await request(app).get('/api/users/me').expect(401);
  });

  it('shows onboarding not completed for a new user - also in the login response', async () => {
    const { token, verifyRes } = await createUser();
    expect(verifyRes.body.user.onboardingCompleted).toBe(false);

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.user.onboardingCompleted).toBe(false);
    expect(me.body.user.profile).toBeNull();
  });
});

describe('PUT /api/users/me/onboarding', () => {
  it('saves the profile with normalized phone, deduped interests, uppercased referral', async () => {
    const { token } = await createUser();
    const res = await onboard(token).expect(200);
    const { user } = res.body;

    expect(user.onboardingCompleted).toBe(true);
    expect(user.profile.phone).toBe('+919876543210');
    expect(user.profile.interestedTracks).toEqual(['web_dev', 'backend']);
    expect(user.profile.referralCode).toBe('FRIEND-123');
    expect(user.profile.collegeName).toBe('Govt. College of Engg, Pune');
    expect(user.profile.certificateNameLocked).toBe(false);

    const college = await College.findById(user.profile.collegeId);
    expect(college?.studentCount).toBe(1);
  });

  it('accepts every common phone format', async () => {
    for (const [i, phone] of ['+91 98765-43210', '919876543210', '9876543210'].entries()) {
      const { token } = await createUser(`user${i}@example.com`);
      const res = await onboard(token, validProfile({ phone })).expect(200);
      expect(res.body.user.profile.phone).toBe('+919876543210');
    }
  });

  it('rejects missing and invalid fields with field-level errors', async () => {
    const { token } = await createUser();

    const empty = await onboard(token, {}).expect(400);
    const fields = empty.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['certificateName', 'phone', 'college', 'degree', 'state', 'goal']));

    await onboard(token, validProfile({ phone: '12345' })).expect(400);
    await onboard(token, validProfile({ phone: '5876543210' })).expect(400); // Indian mobiles start 6-9
    await onboard(token, validProfile({ state: 'Atlantis' })).expect(400);
    await onboard(token, validProfile({ degree: 'other' })).expect(400); // needs degreeOther
    await onboard(token, validProfile({ heardFrom: 'other' })).expect(400); // needs heardFromOther
    await onboard(token, validProfile({ interestedTracks: [] })).expect(400);
    await onboard(token, validProfile({ interestedTracks: ['hacking'] })).expect(400);
    await onboard(token, validProfile({ graduationYear: 1990 })).expect(400);
    await onboard(token, validProfile({ certificateNeededBy: '2026-13' })).expect(400);

    await onboard(token, validProfile({ degree: 'other', degreeOther: 'B.Voc' })).expect(200);
  });

  it('ignores fields the client must not set (mass assignment)', async () => {
    const { token } = await createUser();
    await onboard(token, { ...validProfile(), role: 'admin', isVerified: false, certificateNameLockedAt: new Date() })
      .expect(200);

    const user = await User.findOne({ email: 'ravi@example.com' });
    expect(user?.role).toBe('student');
    expect(user?.isVerified).toBe(true);
    expect(user?.profile?.certificateNameLockedAt).toBeUndefined();
  });

  it('can only be completed once', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    const again = await onboard(token).expect(409);
    expect(again.body.code).toBe('ALREADY_ONBOARDED');
  });

  it('login after onboarding reports onboardingCompleted', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: PASSWORD })
      .expect(200);
    expect(login.body.user.onboardingCompleted).toBe(true);
  });
});

describe('Colleges', () => {
  it('treats differently formatted names as the same college', async () => {
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');
    const resA = await onboard(a.token, validProfile({ college: 'Govt. College of Engg, Pune' })).expect(200);
    const resB = await onboard(b.token, validProfile({ college: '  govt college of ENGG   pune ' })).expect(200);

    expect(resB.body.user.profile.collegeId).toBe(resA.body.user.profile.collegeId);
    expect(await College.countDocuments()).toBe(1);
    expect((await College.findOne())?.studentCount).toBe(2);
  });

  it('searches by word prefixes in any order, most popular first', async () => {
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');
    const c = await createUser('c@example.com');
    await onboard(a.token, validProfile({ college: 'Government College of Engineering Pune' })).expect(200);
    await onboard(b.token, validProfile({ college: 'Pune Institute of Computer Technology' })).expect(200);
    await onboard(c.token, validProfile({ college: 'Pune Institute of Computer Technology' })).expect(200);

    const search = (q: string) =>
      request(app).get('/api/colleges').query({ q }).set('Authorization', `Bearer ${a.token}`);

    const pune = await search('pune').expect(200);
    expect(pune.body.colleges.map((x: { name: string }) => x.name)).toEqual([
      'Pune Institute of Computer Technology', // 2 students
      'Government College of Engineering Pune', // 1 student
    ]);

    const multiWord = await search('eng pune').expect(200);
    expect(multiWord.body.colleges).toHaveLength(1);
    expect(multiWord.body.colleges[0].name).toBe('Government College of Engineering Pune');

    const none = await search('xyz college').expect(200);
    expect(none.body.colleges).toEqual([]);

    await search('p').expect(400);
  });

  it('treats regex characters in the query as plain text', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    const res = await request(app)
      .get('/api/colleges')
      .query({ q: '.* (' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.colleges).toEqual([]);
  });

  it('caches search results in Redis', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    await request(app).get('/api/colleges').query({ q: 'Pune' }).set('Authorization', `Bearer ${token}`).expect(200);
    expect(await redisClient.exists('colleges:search:pune')).toBe(1);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/colleges').query({ q: 'pune' }).expect(401);
  });
});

describe('PATCH /api/users/me/profile', () => {
  it('requires onboarding first', async () => {
    const { token } = await createUser();
    const res = await patchProfile(token, { branch: 'IT' }).expect(400);
    expect(res.body.code).toBe('ONBOARDING_REQUIRED');
  });

  it('updates only the fields sent', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    const res = await patchProfile(token, { branch: 'IT', currentYear: 'passed_out' }).expect(200);
    expect(res.body.user.profile.branch).toBe('IT');
    expect(res.body.user.profile.currentYear).toBe('passed_out');
    expect(res.body.user.profile.city).toBe('Pune');
  });

  it('rejects an empty update and invalid values', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    await patchProfile(token, {}).expect(400);
    await patchProfile(token, { state: 'Atlantis' }).expect(400);
  });

  it('moves the student count when the college changes', async () => {
    const { token } = await createUser();
    const first = await onboard(token).expect(200);
    const oldId = first.body.user.profile.collegeId;

    const res = await patchProfile(token, { college: 'MIT World Peace University' }).expect(200);
    expect(res.body.user.profile.collegeName).toBe('MIT World Peace University');
    expect((await College.findById(oldId))?.studentCount).toBe(0);
    expect((await College.findById(res.body.user.profile.collegeId))?.studentCount).toBe(1);
  });

  it('clears degreeOther when switching away from "other"', async () => {
    const { token } = await createUser();
    await onboard(token, validProfile({ degree: 'other', degreeOther: 'B.Voc' })).expect(200);
    const res = await patchProfile(token, { degree: 'bca' }).expect(200);
    expect(res.body.user.profile.degreeOther).toBeNull();
  });

  it('locks the certificate name once a certificate has been issued', async () => {
    const { token } = await createUser();
    await onboard(token).expect(200);
    // Phase 3 certificate service will set this on first issue
    await User.updateOne({ email: 'ravi@example.com' }, { 'profile.certificateNameLockedAt': new Date() });

    const blocked = await patchProfile(token, { certificateName: 'Someone Else' }).expect(403);
    expect(blocked.body.code).toBe('CERTIFICATE_NAME_LOCKED');

    // Sending the same name (e.g. a full form re-submit) is fine
    await patchProfile(token, { certificateName: 'Ravi Kumar', branch: 'IT' }).expect(200);
  });
});

describe('requireOnboarding middleware', () => {
  const testApp = express();
  testApp.post('/enroll', protect, requireOnboarding, (_req, res) => res.json({ ok: true }));
  testApp.use(errorHandler);

  it('blocks protected business routes until onboarding is done', async () => {
    const { token } = await createUser();
    const blocked = await request(testApp).post('/enroll').set('Authorization', `Bearer ${token}`).expect(403);
    expect(blocked.body.code).toBe('ONBOARDING_REQUIRED');

    await onboard(token).expect(200);
    await request(testApp).post('/enroll').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
