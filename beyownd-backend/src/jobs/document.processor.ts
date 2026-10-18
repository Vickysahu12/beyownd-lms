// src/jobs/document.processor.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Worker yeh function chalata hai har job ke liye. Alag file (worker.ts se)
// taaki tests isse seedha call kar sakein, bina worker process chalaye.
//
// IDEMPOTENT - BullMQ retry kare ya job do baar aaye:
// - 'generate-pdf': document pehle se issued + pdfKey hai → kuch nahi karta.
//   Status update conditional (sirf 'generating' → 'issued'), revoked ko
//   kabhi wapas issued nahi karta.
// - 'send-document-email': sirf issued documents ke liye.
// Error throw hua → BullMQ backoff ke saath retry (5 attempts).
// ────────────────────────────────────────────────────────────────────────

import Credential from '../models/credential.model';
import User from '../models/user.model';
import { renderCredentialPdf } from '../services/document.service';
import { verifyCacheKey } from '../services/credential.service';
import { putObject } from '../utils/storage.util';
import { invalidate } from '../utils/cache';
import { sendDocumentReadyEmail } from '../utils/email.util';
import { logger } from '../utils/logger';
import { enqueueDocumentEmail, DocumentJobName, DocumentJobData } from './queue';

export const pdfKeyFor = (type: string, credentialId: string) => `${type.replace(/_/g, '-')}/${credentialId}.pdf`;

const generatePdf = async (credentialId: string) => {
  const credential = await Credential.findOne({ credentialId });
  if (!credential) {
    logger.warn({ credentialId }, 'PDF job for unknown credential - skipping');
    return 'missing';
  }
  if (credential.status === 'revoked') return 'revoked';
  if (credential.status === 'issued' && credential.pdfKey) return 'already_issued';

  const bytes = await renderCredentialPdf(credential.type, credential.snapshot, credential.credentialId);
  const key = pdfKeyFor(credential.type, credential.credentialId);
  await putObject(key, bytes);

  const updated = await Credential.updateOne(
    { _id: credential._id, status: 'generating' },
    { $set: { status: 'issued', pdfKey: key } }
  );
  await invalidate(verifyCacheKey(credentialId));

  if (updated.modifiedCount === 1) {
    await enqueueDocumentEmail(credentialId);
    logger.info({ credentialId, bytes: bytes.length }, 'Credential PDF ready');
    return 'issued';
  }
  return 'already_issued';
};

const sendEmail = async (credentialId: string) => {
  const credential = await Credential.findOne({ credentialId, status: 'issued' });
  if (!credential) return 'skipped';
  const user = await User.findById(credential.userId).select({ email: 1 });
  if (!user) return 'skipped';
  await sendDocumentReadyEmail(user.email, credential.snapshot.studentName, credential.type, credential.credentialId, credential.snapshot.courseTitle);
  return 'sent';
};

export const processDocumentJob = async (job: { name: DocumentJobName | string; data: DocumentJobData }) => {
  switch (job.name) {
    case 'generate-pdf':
      return generatePdf(job.data.credentialId);
    case 'send-document-email':
      return sendEmail(job.data.credentialId);
    default:
      logger.warn({ name: job.name }, 'Unknown document job');
      return 'unknown';
  }
};
