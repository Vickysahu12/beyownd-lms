// src/services/auth.service.ts
// Auth ka poora business logic yahan hai - signup, OTP verify, login,
// Google login, token refresh. Controller sirf yeh functions call karega,
// koi direct DB/bcrypt/jwt access controller mein nahi hoga.

import User from '../models/user.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateTokens';
import { generateOtp, storeOtp, verifyOtp as verifyOtpUtil } from '../utils/otp.util';
import { sendOtpEmail } from '../utils/email.util';
import { verifyGoogleToken } from '../utils/googleAuth.util';

interface AuthResult {
  user: { id: string; name: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
}

export const signup = async (name: string, email: string, password: string) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Email already registered');

  await User.create({ name, email, password, authProvider: 'local' });

  const otp = generateOtp();
  await storeOtp(email, otp);
  await sendOtpEmail(email, otp);

  return { message: 'Signup successful. OTP sent to your email.' };
};

export const verifyOtpAndActivate = async (email: string, otp: string): Promise<AuthResult> => {
  const valid = await verifyOtpUtil(email, otp);
  if (!valid) throw new Error('Invalid or expired OTP');

  const user = await User.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
  if (!user) throw new Error('User not found');

  const payload = { userId: String(user._id), role: user.role };
  return {
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const resendOtp = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');
  if (user.isVerified) throw new Error('Account already verified');

  const otp = generateOtp();
  await storeOtp(email, otp);
  await sendOtpEmail(email, otp);

  return { message: 'OTP resent successfully' };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || user.authProvider !== 'local') throw new Error('Invalid credentials');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Invalid credentials');
  if (!user.isVerified) throw new Error('Please verify your email before logging in');

  const payload = { userId: String(user._id), role: user.role };
  return {
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

// Google user pehli baar aaya to naya account banta hai, isVerified: true
// ke saath directly - Google ne already unka email verify kar diya hai.
export const googleLogin = async (idToken: string): Promise<AuthResult> => {
  const googleData = await verifyGoogleToken(idToken);

  let user = await User.findOne({ email: googleData.email });
  if (!user) {
    user = await User.create({
      name: googleData.name,
      email: googleData.email,
      authProvider: 'google',
      googleId: googleData.googleId,
      isVerified: true,
    });
  }

  const payload = { userId: String(user._id), role: user.role };
  return {
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const refreshAccessToken = async (token: string) => {
  const decoded = verifyRefreshToken(token);
  return { accessToken: generateAccessToken({ userId: decoded.userId, role: decoded.role }) };
};