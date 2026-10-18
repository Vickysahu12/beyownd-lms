// src/worker.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// ALAG PROCESS - API (server.ts) se alag chalta hai: `npm run worker`.
// Queue se jobs uthata hai (PDF banana, document email) - API slow nahi hoti.
//
// RECOVERY: start hote hi jo credentials 'generating' mein atke hai (e.g.
// jab job queue karte waqt Redis down tha) unhe dobara queue karta hai.
// Processor idempotent hai, isliye dobara queue karna safe hai.
//
// GRACEFUL SHUTDOWN: SIGTERM pe chal rahe job ko poora hone deta hai.
// ────────────────────────────────────────────────────────────────────────

import { Worker } from 'bullmq';
import { connectDB, disconnectDB } from './config/db';
import { disconnectRedis } from './config/redis';
import Credential from './models/credential.model';
import { DOCUMENTS_QUEUE, createQueueConnection, enqueuePdf, closeQueues } from './jobs/queue';
import { processDocumentJob } from './jobs/document.processor';
import { logger } from './utils/logger';

const recoverStuckCredentials = async () => {
  const stuck = await Credential.find({ status: 'generating' }).select({ credentialId: 1 }).limit(500);
  for (const c of stuck) await enqueuePdf(c.credentialId);
  if (stuck.length) logger.info({ count: stuck.length }, 'Re-queued pending credentials');
};

const start = async () => {
  await connectDB();

  const workerConnection = createQueueConnection();
  const worker = new Worker(DOCUMENTS_QUEUE, (job) => processDocumentJob(job), {
    connection: workerConnection,
    // PDF CPU-bound hai - chhote VPS pe 2 parallel kaafi
    concurrency: 2,
  });
  worker.on('completed', (job, result) => logger.info({ job: job.name, id: job.id, result }, 'Job completed'));
  worker.on('failed', (job, err) =>
    logger.error({ job: job?.name, id: job?.id, attempts: job?.attemptsMade, err }, 'Job failed')
  );

  await recoverStuckCredentials();
  logger.info('Document worker running');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down');
    await worker.close(); // running job ko khatam hone deta hai
    await workerConnection.quit(); // BullMQ diya hua connection khud band nahi karta
    await closeQueues();
    await disconnectDB();
    await disconnectRedis();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

start().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
