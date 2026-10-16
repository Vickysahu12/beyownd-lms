// src/middlewares/requestLogger.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Har request ko ek unique ID deta hai (x-request-id) aur request ke end
// mein ek log line likhta hai: method, url, status, kitna time laga.
// Wahi ID response header mein bhi jaati hai - agar koi student bug report
// kare, uske browser ke network tab se ID le ke us request ki saari logs
// dhoondh sakte hai.
//
// req.log bhi yahi attach karta hai - controllers/services req.log.info()
// use karein to har line mein automatically reqId hoga.
// ────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    // Nginx ne ID bheji ho to wahi use karo - proxy aur API logs match honge
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  // Health checks har kuch second mein aate hai - unse logs bharna bekaar hai
  autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Default serializer poore headers log karta hai - sirf kaam ki cheezein rakho
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
