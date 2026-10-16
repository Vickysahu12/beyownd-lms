// src/utils/googleAuth.util.ts
// Frontend Google Sign-In se ek idToken deta hai - yeh function usko
// Google ke servers se verify karta hai (hum apna OAuth flow nahi
// chalate, sirf Google ke token ko TRUST karte hai verify karke).

import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from './AppError';

const client = new OAuth2Client(env.googleClientId);

export interface GoogleUserPayload {
  email: string;
  name: string;
  googleId: string;
}

export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserPayload> => {
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw AppError.unauthorized('Invalid Google token', 'GOOGLE_TOKEN_INVALID');
  }

  if (!payload || !payload.email || !payload.sub) {
    throw AppError.unauthorized('Invalid Google token', 'GOOGLE_TOKEN_INVALID');
  }

  // Hum Google ke bharose account ko "verified" mark karte hai aur existing
  // email wale account se link karte hai - yeh tabhi safe hai jab Google
  // khud keh raha ho ki email verified hai.
  if (payload.email_verified !== true) {
    throw AppError.unauthorized('Google email is not verified', 'GOOGLE_EMAIL_UNVERIFIED');
  }

  return {
    email: payload.email.toLowerCase(),
    name: (payload.name || payload.email.split('@')[0]).slice(0, 60),
    googleId: payload.sub,
  };
};
