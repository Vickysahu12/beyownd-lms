// src/utils/googleAuth.util.ts
// Frontend Google Sign-In se ek idToken deta hai - yeh function usko
// Google ke servers se verify karta hai (hum apna OAuth flow nahi
// chalate, sirf Google ke token ko TRUST karte hai verify karke).

import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const client = new OAuth2Client(env.googleClientId);

export interface GoogleUserPayload {
  email: string;
  name: string;
  googleId: string;
}

export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserPayload> => {
  const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.sub) {
    throw new Error('Invalid Google token');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    googleId: payload.sub,
  };
};