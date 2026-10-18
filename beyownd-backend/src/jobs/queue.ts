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

export type DocumentJobName = 'generate-pdf' | 'send-document-email';
export interface DocumentJobData {
  credentialId: string;
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
