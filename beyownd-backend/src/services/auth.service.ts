// src/services/auth.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Auth ka poora business logic - signup, email verify, login, Google login,
// refresh, logout, forgot/reset password. Controller sirf yeh functions
// call karta hai.
//
// ONE ACCOUNT PER EMAIL - linking rules (docs/design/user-flow.md §3):
// - Email signup, verified account exists   → 409 (Google-only → hint)
// - Email signup, UNVERIFIED account exists → password overwrite, naya OTP
// - Google login, email account exists      → link googleId, verified = true;
//   agar account unverified tha to uska password HATA do (takeover fix)
// - Password login on Google-only account   → "use Google / set password"
// - Forgot password, email not found        → same success message
// - Password reset                          → saare sessions revoke
// ────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import User, { IUser, BCRYPT_ROUNDS } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { generateAccessToken } from '../utils/generateTokens';
import { issueOtp, consumeOtp } from '../utils/otp.util';
import { sendOtpEmail } from '../utils/email.util';
import { verifyGoogleToken } from '../utils/googleAuth.util';
import {
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeAllSessions,
} from './session.service';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  authProviders: string[];
  // Login ke response mein hi - frontend turant /onboarding ya /dashboard
  // pe bhej sake, alag /me call ke bina
  onboardingCompleted: boolean;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

// Email exist kare ya na kare - forgot-password/resend ka response same rehta hai
const GENERIC_OTP_MESSAGE = 'If an account exists for this email, a code has been sent.';

// Login mein user na mile to bhi ek bcrypt compare chalate hai - warna
// "user nahi mila" ka response turant aata aur "galat password" ka ~70ms
// baad. Is timing difference se attacker pata laga sakta hai kaunse
// emails registered hai (user enumeration).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const toPublicUser = (user: IUser): PublicUser => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  authProviders: [...user.authProviders],
  onboardingCompleted: user.onboardingCompleted,
});

// Har successful login ka common end - access token + naya session
const issueAuth = async (user: IUser): Promise<AuthResult> => {
  const userId = String(user._id);
  return {
    user: toPublicUser(user),
    accessToken: generateAccessToken({ userId, role: user.role }),
    refreshToken: await createSession(userId),
  };
};

const sendOtp = async (purpose: 'verify' | 'reset', email: string): Promise<void> => {
  const otp = await issueOtp(purpose, email);
  await sendOtpEmail(email, otp, purpose);
};

export const signup = async (name: string, email: string, password: string) => {
  const existing = await User.findOne({ email });

  if (existing?.isVerified) {
    if (!existing.authProviders.includes('local')) {
      throw AppError.conflict(
        'This email is registered with Google. Continue with Google, or use Forgot password to set a password.',
        'GOOGLE_ACCOUNT'
      );
    }
    throw AppError.conflict('Email already registered. Please log in.', 'EMAIL_TAKEN');
  }

  if (existing) {
    // Unverified account - pichle signup ne inbox ownership prove hi nahi
    // ki thi, isliye naya password overwrite karna safe hai
    existing.name = name;
    existing.password = password;
    if (!existing.authProviders.includes('local')) existing.authProviders.push('local');
    await existing.save();
  } else {
    await User.create({ name, email, password, authProviders: ['local'] });
  }

  // Email fail hua to user unverified rehta hai - "resend" ya dobara signup
  // dono kaam karenge, koi stuck state nahi
  await sendOtp('verify', email);
  return { message: 'Signup successful. A verification code has been sent to your email.' };
};

export const verifyEmail = async (email: string, otp: string): Promise<AuthResult> => {
  await consumeOtp('verify', email, otp);

  const user = await User.findOneAndUpdate({ email }, { isVerified: true }, { returnDocument: 'after' });
  if (!user) throw AppError.badRequest('Invalid or expired code', 'OTP_INVALID');

  return issueAuth(user);
};

export const resendVerificationOtp = async (email: string) => {
  const user = await User.findOne({ email });
  if (user && !user.isVerified) {
    await sendOtp('verify', email);
  }
  return { message: GENERIC_OTP_MESSAGE };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.password) {
    throw AppError.badRequest(
      'This account uses Google sign-in. Continue with Google, or use Forgot password to set a password.',
      'USE_GOOGLE_SIGNIN'
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Password sahi hone ke BAAD hi batate hai ki unverified hai - warna yeh
  // message bhi enumeration leak ban jaata. Frontend is code pe OTP screen
  // dikhata hai aur /resend-otp call karta hai.
  if (!user.isVerified) {
    throw AppError.forbidden('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }

  return issueAuth(user);
};

export const googleLogin = async (idToken: string): Promise<AuthResult> => {
  const google = await verifyGoogleToken(idToken);

  let user =
    (await User.findOne({ googleId: google.googleId })) ??
    (await User.findOne({ email: google.email }));

  if (!user) {
    user = await User.create({
      name: google.name,
      email: google.email,
      googleId: google.googleId,
      authProviders: ['google'],
      isVerified: true,
    });
    return issueAuth(user);
  }

  if (!user.isVerified) {
    // TAKEOVER FIX: kisi ne victim ka email + apna password daal ke account
    // bana ke chhod diya ho sakta hai. Asli owner ne ab Google se email
    // prove kiya hai - us unverified password ko kabhi kaam nahi karna chahiye.
    user.set('password', undefined);
    user.authProviders = user.authProviders.filter((p) => p !== 'local');
    user.isVerified = true;
  }

  if (!user.googleId) user.googleId = google.googleId;
  if (!user.authProviders.includes('google')) user.authProviders.push('google');
  await user.save();

  return issueAuth(user);
};

export const refresh = async (refreshToken: string) => {
  const { userId, refreshToken: newRefreshToken } = await rotateSession(refreshToken);

  // Refresh har 15 min mein ek baar hota hai - yahan DB read sasta hai, aur
  // isse deleted user ya badla hua role agle access token mein aa jaata hai
  const user = await User.findById(userId);
  if (!user) {
    await revokeAllSessions(userId);
    throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');
  }

  return {
    user: toPublicUser(user),
    accessToken: generateAccessToken({ userId, role: user.role }),
    refreshToken: newRefreshToken,
  };
};

export const logout = async (refreshToken?: string) => {
  if (refreshToken) await revokeSessionByToken(refreshToken);
};

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email });
  if (user) {
    await sendOtp('reset', email);
  }
  return { message: GENERIC_OTP_MESSAGE };
};

export const resetPassword = async (email: string, otp: string, newPassword: string) => {
  await consumeOtp('reset', email, otp);

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw AppError.badRequest('Invalid or expired code', 'OTP_INVALID');

  user.password = newPassword;
  if (!user.authProviders.includes('local')) user.authProviders.push('local');
  // Reset OTP inbox pe aaya aur sahi daala - email ownership prove ho gayi
  user.isVerified = true;
  await user.save();

  // Agar password isliye reset hua kyunki kisi ne account le liya tha -
  // uske saare sessions abhi khatam
  await revokeAllSessions(String(user._id));

  return { message: 'Password reset successful. Please log in with your new password.' };
};
