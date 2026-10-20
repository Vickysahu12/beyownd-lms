// src/jobs/queue.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Background jobs ki queue (BullMQ, Redis pe). API sirf job DAALTA hai aur
// turant response deta hai; alag WORKER process (src/worker.ts) job uthata
// hai aur slow kaam karta hai - PDF banana, email bhejna.
//
// Kyun: PDF 1-2 sec leta hai. Payment request ke andar banate to student
// wait karta, aur 100 log ek saath pay karein to API slow ho jaati. Queue
// ke saath API fast rehti hai, worker apni speed se kaam karta hai.
//
// RELIABILITY:
// - attempts 5 + exponential backoff - email provider 1 min down raha to bhi kaam ho jaata hai
// - jobId = credential ID → same document ka job do baar queue mein nahi baithta
// - processor idempotent hai (document.processor.ts) - retry se duplicate nahi
// ────────────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

export const DOCUMENTS_QUEUE = 'documents';

export type DocumentJobName =
  | 'generate-pdf' // credentialId → PDF banao
  | 'send-document-email' // credentialId → "document ready" email
  | 'issue-completion-documents' // enrollmentId → certificate + completion letter (batch end pe)
  | 'send-review-email' // submissionId → "project reviewed" email
  | 'completion-sweep'; // hourly safety net - koi completed student certificate ke bina na rahe

export interface DocumentJobData {
  credentialId?: string;
  enrollmentId?: string;
  submissionId?: string;
}

// BullMQ ko apna connection chahiye with maxRetriesPerRequest: null
// (blocking commands ke liye) - app ka normal redisClient reuse nahi karte
export const createQueueConnection = () => new Redis(env.redisUrl, { maxRetriesPerRequest: null });

let documentsQueue: Queue<DocumentJobData, unknown, DocumentJobName> | undefined;
// BullMQ ko apna diya hua connection queue.close() pe band NAHI karta (use
// lagta hai woh shared hai) - isliye reference rakh ke khud band karte hai
let queueConnection: Redis | undefined;

export const getDocumentsQueue = () => {
  if (!documentsQueue) queueConnection = createQueueConnection();
  documentsQueue ??= new Queue<DocumentJobData, unknown, DocumentJobName>(DOCUMENTS_QUEUE, {
    connection: queueConnection!,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  return documentsQueue;
};

export const enqueuePdf = (credentialId: string) =>
  getDocumentsQueue().add('generate-pdf', { credentialId }, { jobId: `pdf-${credentialId}` });

export const enqueueDocumentEmail = (credentialId: string) =>
  getDocumentsQueue().add('send-document-email', { credentialId }, { jobId: `email-${credentialId}` });

// DELAYED job: batch end date tak ruk ke chalta hai (decision D2). Redis mein
// rehta hai, isliye worker restart se bhi khota nahi. Hourly sweep backup hai.
export const enqueueCompletionDocuments = (enrollmentId: string, delayMs = 0) =>
  getDocumentsQueue().add(
    'issue-completion-documents',
    { enrollmentId },
    { jobId: `completion-${enrollmentId}`, delay: Math.max(0, delayMs) }
  );

export const enqueueReviewEmail = (submissionId: string) =>
  getDocumentsQueue().add('send-review-email', { submissionId }, { jobId: `review-email-${submissionId}` });

export const COMPLETION_SWEEP_EVERY_MS = 60 * 60 * 1000;

// Repeatable job - worker start pe register (upsert = dobara register karne
// se duplicate nahi banta)
export const scheduleCompletionSweep = () =>
  getDocumentsQueue().upsertJobScheduler(
    'completion-sweep',
    { every: COMPLETION_SWEEP_EVERY_MS },
    { name: 'completion-sweep', data: {} }
  );

export const closeQueues = async () => {
  if (documentsQueue) {
    await documentsQueue.close();
    documentsQueue = undefined;
  }
  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = undefined;
  }
};
