// src/server.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Backend ka ACTUAL entry point. Kaam:
// 1. Pehle Mongo connect - fail ho to server start hi nahi hota
// 2. Phir app.ts wale Express app ko port pe listen karwana
// 3. GRACEFUL SHUTDOWN - deploy/restart pe Docker SIGTERM bhejta hai.
//    Hum turant process kill nahi karte: naye connections lena band,
//    chal rahi requests (jaise payment webhook) poori hone dete hai, phir
//    Mongo + Redis cleanly band karke exit. Bina iske har deploy pe kuch
//    requests beech mein kat jaati.
// ────────────────────────────────────────────────────────────────────────

import { Server } from 'http';
import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { disconnectRedis } from './config/redis';
import { closeQueues } from './jobs/queue';
import { env } from './config/env';
import { logger } from './utils/logger';

// Itne time mein shutdown poora na ho to force exit - kabhi hang na ho
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) {
      // Naye connections band, existing requests poori hone do
      await new Promise<void>((resolve, reject) =>
        server!.close((err) => (err ? reject(err) : resolve()))
      );
      logger.info('HTTP server closed');
    }
    await closeQueues(); // API jobs daalta hai - queue connection bhi band
    await disconnectDB();
    await disconnectRedis();
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    exitCode = 1;
  }

  process.exit(exitCode);
};

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
  } catch (err) {
    logger.fatal({ err }, 'MongoDB connection failed, not starting server');
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'Server running');
  });

  // Nginx/load balancer apne keep-alive connections ~60s tak reuse karta
  // hai. Agar Node unhe pehle band kar de (default 5s), to beech-beech mein
  // random 502 errors aate hai. Node ka timeout proxy se thoda zyada rakho.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Koi bug jisne error bina catch kiye chhod diya - process ki state ab
// bharose layak nahi. Log karo, cleanly band karo, Docker restart karega.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

// Errors inside are handled (fatal log + exit); `void` marks the promise as intentionally not awaited
void startServer();
