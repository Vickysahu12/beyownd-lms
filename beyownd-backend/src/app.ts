// src/app.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Yeh Express APP ko BUILD karta hai - middleware register karna, routes
// mount karna, error handler lagana. Yeh file SERVER START nahi karti -
// bas ek "app" object export karti hai. server.ts isse port pe listen
// karata hai, aur tests isse directly import karte hai (bina real port ke).
//
// MIDDLEWARE KA ORDER MATTER KARTA HAI - request upar se neeche har
// middleware se guzarti hai:
//   trust proxy → request ID/logging → security headers → CORS →
//   compression → body parsing → cookies → routes → 404 → error handler
// ────────────────────────────────────────────────────────────────────────

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import collegeRoutes from './routes/college.routes';
import catalogRoutes from './routes/catalog.routes';
import enrollmentRoutes from './routes/enrollment.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import { credentialRoutes, verifyRoutes, fileRoutes } from './routes/credential.routes';
import reviewRoutes from './routes/review.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// ---- Proxy trust ----
// Production mein request Nginx se aati hai, to req.ip hamesha Nginx ka
// IP hota. Yeh setting Express ko X-Forwarded-For header se ASLI client IP
// padhne deti hai - rate limiter isi pe depend karta hai. Number (hops)
// diya hai, `true` nahi - `true` se koi bhi client fake header bhej ke
// apna IP spoof kar sakta hai.
app.set('trust proxy', env.trustProxy);

// "X-Powered-By: Express" header hatao - attacker ko stack batane ki zaroorat nahi
app.disable('x-powered-by');

// ---- Request ID + logging (sabse pehle, taaki har cheez log ho) ----
app.use(requestLogger);

// ---- Security headers ----
// helmet ek saath ~15 security headers set karta hai (HSTS, nosniff,
// frame-deny, etc.) - common web attacks ke against default protection.
app.use(helmet());

// ---- CORS ----
// Sirf apne frontend origins allowed (classroom.beyownd.in). credentials:
// true zaroori hai taaki browser refresh-token cookie bheje. `origin: '*'`
// aur credentials saath mein kaam hi nahi karte - isliye explicit list.
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);

// ---- Compression ----
// JSON responses gzip/brotli hoke jaate hai - 60-80% chhote. Humare
// students mobile data pe hai, yeh seedha unka data aur load time bachata hai.
app.use(compression());

// ---- Webhooks (express.json se PEHLE) ----
// Razorpay signature RAW body bytes pe banta hai. express.json() body parse
// kar de to exact bytes kho jaate hai aur signature kabhi match nahi hota.
app.use('/api/webhooks', webhookRoutes);

// ---- Body parsing ----
// 100kb limit - koi bhi legit request (signup, quiz answers, onboarding)
// isse bahut chhoti hai. Bina limit ke koi 50MB JSON bhej ke server ki
// memory/CPU kha sakta hai.
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---- Routes ----
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/courses', catalogRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/admin', adminRoutes);

// ---- 404 + global error handler (HAMESHA sabse aakhir mein) ----
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
