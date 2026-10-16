// tests/auth.test.ts
// End-to-end auth tests against the real Express app, in-memory Mongo and
// local Redis. Email sending and Google token verification are mocked -
// everything else (hashing, OTPs, sessions, rate limits) is real.

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/user.model';
import { sendOtpEmail } from '../src/utils/email.util';
import { verifyGoogleToken } from '../src/utils/googleAuth.util';
import { protect, restrictTo } from '../src/middlewares/auth.middleware';
import { errorHandler } from '../src/middlewares/errorHandler.middleware';
import { redisClient } from '../src/config/redis';
import { AppError } from '../src/utils/AppError';

jest.mock('../src/utils/email.util', () => ({ sendOtpEmail: jest.fn() }));
jest.mock('../src/utils/googleAuth.util', () => ({ verifyGoogleToken: jest.fn() }));

const mockedSendOtp = sendOtpEmail as jest.MockedFunction<typeof sendOtpEmail>;
const mockedGoogle = verifyGoogleToken as jest.MockedFunction<typeof verifyGoogleToken>;

const PASSWORD = 'Str0ng@Pass';
const NEW_PASSWORD = 'N3w@Password';

// ---- helpers ----

const lastOtp = (purpose: 'verify' | 'reset' = 'verify'): string => {
  const call = [...mockedSendOtp.mock.calls].reverse().find((c) => c[2] === purpose);
  if (!call) throw new Error(`No ${purpose} OTP was sent`);
  return call[1];
};

const refreshCookie = (res: request.Response): string => {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('refreshToken='));
  if (!cookie) throw new Error('No refreshToken cookie set');
  return cookie.split(';')[0];
};

const signup = (email: string, name = 'Ravi Kumar', password = PASSWORD) =>
  request(app).post('/api/auth/signup').send({ name, email, password });

// Signup + OTP verify → verified user with a live session
const createVerifiedUser = async (email = 'ravi@example.com') => {
  await signup(email).expect(201);
  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email, otp: lastOtp('verify') })
    .expect(200);
  return { res, cookie: refreshCookie(res), accessToken: res.body.accessToken as string };
};

// Lets a test skip the 60s resend cooldown without waiting
const clearOtpCooldowns = async () => {
  const keys = await redisClient.keys('otp_cooldown:*');
  if (keys.length) await redisClient.del(...keys);
};

beforeEach(() => {
  mockedSendOtp.mockReset();
  mockedSendOtp.mockResolvedValue(undefined);
  mockedGoogle.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────

describe('Signup', () => {
  it('creates an unverified user, hashes the password and emails a 6-digit OTP', async () => {
    const res = await signup('ravi@example.com').expect(201);
    expect(res.body.success).toBe(true);

    const user = await User.findOne({ email: 'ravi@example.com' }).select('+password');
    expect(user?.isVerified).toBe(false);
    expect(user?.authProviders).toEqual(['local']);
    expect(user?.password).not.toBe(PASSWORD);
    expect(lastOtp()).toMatch(/^\d{6}$/);
  });

  it('accepts short and apostrophe names, and stores them unescaped', async () => {
    await signup('a@example.com', 'Ravi').expect(201);
    await signup('b@example.com', "Anita D'Souza").expect(201);
    const user = await User.findOne({ email: 'b@example.com' });
    expect(user?.name).toBe("Anita D'Souza");
  });

  it('rejects invalid names and weak passwords with 400', async () => {
    const short = await signup('c@example.com', 'R').expect(400);
    expect(short.body.code).toBe('VALIDATION_ERROR');
    await signup('d@example.com', '<script>').expect(400);
    await signup('e@example.com', 'Ravi', 'weakpass').expect(400);
  });

  it('keeps Gmail dots so Google login matches the same account', async () => {
    await signup('John.Doe@Gmail.com').expect(201);
    expect(await User.exists({ email: 'john.doe@gmail.com' })).toBeTruthy();
  });

  it('re-signup on an unverified email overwrites the password and sends a new OTP', async () => {
    await signup('ravi@example.com').expect(201);
    await clearOtpCooldowns();
    await signup('ravi@example.com', 'Ravi Kumar', NEW_PASSWORD).expect(201);

    expect(await User.countDocuments({ email: 'ravi@example.com' })).toBe(1);
    await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'ravi@example.com', otp: lastOtp() })
      .expect(200);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: NEW_PASSWORD })
      .expect(200);
  });

  it('returns 409 EMAIL_TAKEN for an already verified email', async () => {
    await createVerifiedUser();
    const res = await signup('ravi@example.com').expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 503 EMAIL_FAILED when the email provider fails, and the user can retry', async () => {
    mockedSendOtp.mockRejectedValueOnce(new AppError(503, 'Could not send email', 'EMAIL_FAILED'));
    const failed = await signup('ravi@example.com').expect(503);
    expect(failed.body.code).toBe('EMAIL_FAILED');

    // User exists but unverified → retrying signup works (no stuck account)
    await clearOtpCooldowns();
    await signup('ravi@example.com').expect(201);
  });
});

describe('OTP verification', () => {
  it('verifies the email, returns an access token and sets an httpOnly refresh cookie', async () => {
    const { res } = await createVerifiedUser();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.isVerified).toBe(true);

    const raw = ([] as string[]).concat(res.headers['set-cookie']).join(';');
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Path=\/api\/auth/i);
    expect(raw).toMatch(/SameSite=Strict/i);
  });

  it('rejects a wrong OTP with 400 OTP_INVALID', async () => {
    await signup('ravi@example.com').expect(201);
    const wrong = lastOtp() === '111111' ? '222222' : '111111';
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'ravi@example.com', otp: wrong })
      .expect(400);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('burns the OTP after 5 wrong attempts - even the correct code fails after that', async () => {
    await signup('ravi@example.com').expect(201);
    const correct = lastOtp();
    const wrong = correct === '111111' ? '222222' : '111111';

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/verify-otp').send({ email: 'ravi@example.com', otp: wrong }).expect(400);
    }
    const locked = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'ravi@example.com', otp: correct })
      .expect(429);
    expect(locked.body.code).toBe('OTP_LOCKED');

    await request(app).post('/api/auth/verify-otp').send({ email: 'ravi@example.com', otp: correct }).expect(400);
  });

  it('is one-time use - replaying the same OTP fails', async () => {
    await signup('ravi@example.com').expect(201);
    const otp = lastOtp();
    await request(app).post('/api/auth/verify-otp').send({ email: 'ravi@example.com', otp }).expect(200);
    await request(app).post('/api/auth/verify-otp').send({ email: 'ravi@example.com', otp }).expect(400);
  });

  it('enforces a 60s cooldown between OTP sends', async () => {
    await signup('ravi@example.com').expect(201);
    const res = await request(app).post('/api/auth/resend-otp').send({ email: 'ravi@example.com' }).expect(429);
    expect(res.body.code).toBe('OTP_COOLDOWN');
  });

  it('resend returns the same generic message for unknown emails and sends nothing', async () => {
    const res = await request(app).post('/api/auth/resend-otp').send({ email: 'nobody@example.com' }).expect(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(mockedSendOtp).not.toHaveBeenCalled();
  });
});

describe('Login', () => {
  it('returns 401 INVALID_CREDENTIALS (not 500) for a wrong password or unknown email', async () => {
    await createVerifiedUser();
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: 'Wr0ng@Pass' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('returns 403 EMAIL_NOT_VERIFIED for a correct password on an unverified account', async () => {
    await signup('ravi@example.com').expect(201);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('logs in a verified user', async () => {
    await createVerifiedUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'RAVI@example.com', password: PASSWORD })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(refreshCookie(res)).toMatch(/^refreshToken=/);
  });
});

describe('Refresh tokens, rotation and logout', () => {
  it('rotates the refresh token on every refresh', async () => {
    const { cookie } = await createVerifiedUser();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('allows the previous token within the 10s grace window (two tabs refreshing together)', async () => {
    const { cookie } = await createVerifiedUser();
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
  });

  it('detects reuse of an old token after the grace window and kills the whole session', async () => {
    const { cookie: oldCookie } = await createVerifiedUser();
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie).expect(200);
    const newCookie = refreshCookie(rotated);

    const realNow = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 11_000);
    try {
      const reuse = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie).expect(401);
      expect(reuse.body.code).toBe('SESSION_REUSED');
    } finally {
      jest.restoreAllMocks();
    }

    // Attacker reused the old token → even the legit new token is dead now
    await request(app).post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
  });

  it('logout revokes the session server-side', async () => {
    const { cookie } = await createVerifiedUser();
    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('SESSION_INVALID');
  });

  it('returns 401 with no cookie', async () => {
    await request(app).post('/api/auth/refresh').expect(401);
  });
});

describe('Google sign-in and account linking', () => {
  const googleUser = { email: 'ravi@example.com', name: 'Ravi Kumar', googleId: 'g-123' };

  it('creates a verified Google-only account for a new email', async () => {
    mockedGoogle.mockResolvedValue(googleUser);
    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(res.body.user.authProviders).toEqual(['google']);
    expect(res.body.user.isVerified).toBe(true);
  });

  it('links Google to an existing verified email account - both methods then work', async () => {
    await createVerifiedUser();
    mockedGoogle.mockResolvedValue(googleUser);
    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(res.body.user.authProviders.sort()).toEqual(['google', 'local']);
    await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: PASSWORD }).expect(200);
    expect(await User.countDocuments()).toBe(1);
  });

  it('TAKEOVER FIX: clears the password of an unverified account when the real owner uses Google', async () => {
    // Attacker pre-registers the victim's email with their own password, never verifies
    await signup('ravi@example.com', 'Attacker', PASSWORD).expect(201);

    mockedGoogle.mockResolvedValue(googleUser);
    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) }).expect(200);
    expect(res.body.user.authProviders).toEqual(['google']);

    // Attacker's password no longer works on the now-verified account
    const attempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: PASSWORD })
      .expect(400);
    expect(attempt.body.code).toBe('USE_GOOGLE_SIGNIN');
  });

  it('guides Google-only users who try password login or signup', async () => {
    mockedGoogle.mockResolvedValue(googleUser);
    await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) }).expect(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: PASSWORD })
      .expect(400);
    expect(login.body.code).toBe('USE_GOOGLE_SIGNIN');

    const again = await signup('ravi@example.com').expect(409);
    expect(again.body.code).toBe('GOOGLE_ACCOUNT');
  });
});

describe('Forgot / reset password', () => {
  it('returns the same message for unknown emails and sends nothing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(mockedSendOtp).not.toHaveBeenCalled();
  });

  it('a signup (verify) OTP cannot be used to reset a password', async () => {
    await signup('ravi@example.com').expect(201);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'ravi@example.com', otp: lastOtp('verify'), password: NEW_PASSWORD })
      .expect(400);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('resets the password, revokes all sessions, and only the new password works', async () => {
    const { cookie } = await createVerifiedUser();
    await clearOtpCooldowns();

    await request(app).post('/api/auth/forgot-password').send({ email: 'ravi@example.com' }).expect(200);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'ravi@example.com', otp: lastOtp('reset'), password: NEW_PASSWORD })
      .expect(200);

    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: PASSWORD }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: NEW_PASSWORD }).expect(200);
  });

  it('lets a Google-only user set a password via reset', async () => {
    mockedGoogle.mockResolvedValue({ email: 'ravi@example.com', name: 'Ravi', googleId: 'g-1' });
    await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) }).expect(200);

    await request(app).post('/api/auth/forgot-password').send({ email: 'ravi@example.com' }).expect(200);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'ravi@example.com', otp: lastOtp('reset'), password: NEW_PASSWORD })
      .expect(200);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: NEW_PASSWORD })
      .expect(200);
    expect(res.body.user.authProviders.sort()).toEqual(['google', 'local']);
  });
});

describe('Rate limiting (campus-friendly)', () => {
  it('blocks the 11th failed login on one account, but other accounts on the same IP still work', async () => {
    await createVerifiedUser('ravi@example.com');
    await createVerifiedUser('priya@example.com');

    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: 'Wr0ng@Pass' }).expect(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@example.com', password: PASSWORD })
      .expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');

    // Same IP (same college lab), different student → not blocked
    await request(app).post('/api/auth/login').send({ email: 'priya@example.com', password: PASSWORD }).expect(200);
  });

  it('limiters have separate counters - OTP requests do not use up login attempts', async () => {
    await createVerifiedUser();
    for (let i = 0; i < 5; i++) {
      await clearOtpCooldowns();
      await request(app).post('/api/auth/forgot-password').send({ email: 'ravi@example.com' });
    }
    await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: PASSWORD }).expect(200);
  });
});

describe('protect / restrictTo middleware', () => {
  const testApp = express();
  testApp.get('/me', protect, (req, res) => res.json({ user: req.user }));
  testApp.get('/admin', protect, restrictTo('admin'), (_req, res) => res.json({ ok: true }));
  testApp.use(errorHandler);

  it('rejects requests without a token', async () => {
    const res = await request(testApp).get('/me').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns TOKEN_EXPIRED for an expired token so the frontend knows to refresh', async () => {
    const expired = jwt.sign({ userId: 'u1', role: 'student' }, 'test-access-secret', { expiresIn: -10 });
    const res = await request(testApp).get('/me').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a refresh token used as an access token', async () => {
    const refreshLike = jwt.sign({ userId: 'u1', sid: 's', jti: 'j' }, 'test-refresh-secret');
    const res = await request(testApp).get('/me').set('Authorization', `Bearer ${refreshLike}`).expect(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('attaches req.user for a valid token and enforces roles', async () => {
    const { accessToken } = await createVerifiedUser();
    const me = await request(testApp).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.user.role).toBe('student');
    await request(testApp).get('/admin').set('Authorization', `Bearer ${accessToken}`).expect(403);
  });
});
