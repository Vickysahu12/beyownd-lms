// src/utils/email.util.ts
// Resend ke through emails bhejta hai. Isolated rakha hai taaki agar kabhi
// provider badalna pade (Resend se kisi aur mein), sirf yeh ek file
// badalni padegi, baaki app ko pata hi nahi chalega.
//
// Resend SDK error THROW nahi karta - { error } return karta hai. Pehle hum
// isse check nahi karte the, matlab email fail hone pe bhi API "OTP sent"
// bolti thi. Ab error aaye to AppError (503) throw hota hai.

import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from './AppError';
import { logger } from './logger';
import type { OtpPurpose } from './otp.util';

const resend = new Resend(env.resendApiKey);

const OTP_SUBJECTS: Record<OtpPurpose, string> = {
  verify: 'Verify your Beyownd account',
  reset: 'Reset your Beyownd password',
};

const OTP_INTROS: Record<OtpPurpose, string> = {
  verify: 'Your verification code is',
  reset: 'Your password reset code is',
};

export const sendOtpEmail = async (
  email: string,
  otp: string,
  purpose: OtpPurpose
): Promise<void> => {
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: email,
    subject: OTP_SUBJECTS[purpose],
    html: `<p>${OTP_INTROS[purpose]} <strong>${otp}</strong>. It expires in 10 minutes.</p>
<p>If you didn't request this, you can ignore this email.</p>`,
  });

  if (error) {
    logger.error({ err: error, purpose }, 'Failed to send OTP email');
    throw new AppError(503, 'Could not send email right now. Please try again.', 'EMAIL_FAILED');
  }
};
