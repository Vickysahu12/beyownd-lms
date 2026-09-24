// src/utils/email.util.ts
// Resend ke through OTP email bhejta hai. Isolated rakha hai taaki agar
// kabhi provider badalna pade (Resend se kisi aur mein), sirf yeh ek file
// badalni padegi, baaki app ko pata hi nahi chalega.

import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.resendApiKey);

export const sendOtpEmail = async (email: string, otp: string): Promise<void> => {
  await resend.emails.send({
    from: env.emailFrom,
    to: email,
    subject: 'Verify your Beyownd account',
    html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });
};