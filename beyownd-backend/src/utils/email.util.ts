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

const DOCUMENT_LABELS: Record<string, string> = {
  offer_letter: 'offer letter',
  completion_certificate: 'completion certificate',
  completion_letter: 'completion letter',
};

// Worker se call hota hai (document PDF ready hone ke baad). Error throw kare
// to BullMQ retry karta hai - isliye yahan bhi Resend ka { error } check.
export const sendDocumentReadyEmail = async (
  email: string,
  name: string,
  type: string,
  credentialId: string,
  courseTitle: string
): Promise<void> => {
  const label = DOCUMENT_LABELS[type] ?? 'document';
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: email,
    subject: `Your Beyownd ${label} is ready`,
    html: `<p>Hi ${escape(name)},</p>
<p>Your ${label} for <strong>${escape(courseTitle)}</strong> is ready. Download it from <strong>My Documents</strong> in your Beyownd classroom.</p>
<p>Credential ID: <strong>${credentialId}</strong><br/>Anyone can verify it at https://beyownd.in/verify/${credentialId}</p>`,
  });
  if (error) {
    logger.error({ err: error, credentialId }, 'Failed to send document email');
    throw new AppError(503, 'Could not send email', 'EMAIL_FAILED');
  }
};
