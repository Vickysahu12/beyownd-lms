// src/app.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Yeh Express APP ko BUILD karta hai - middleware register karna, routes
// mount karna, error handler lagana. Yeh file SERVER START nahi karti -
// bas ek "app" object banake export karti hai. server.ts iska "app"
// import karega aur usko actual port pe listen karayega.
//
// Yeh split (app.ts vs server.ts) isliye hai taaki TESTS bhi app.ts ko
// directly import kar sake, bina ek real port pe server chalaye - jab
// hum tests likhenge, yeh cheez kaam aayegi.
// ────────────────────────────────────────────────────────────────────────

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler.middleware';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';

const app: Application = express();

// ---- Middleware ----
// cors() browser ko allow karta hai frontend (alag origin/port pe chal
// raha, jaise localhost:3000) se is backend (jaise localhost:5000) ko
// requests bhejne ki. Bina iske, browser security ki wajah se requests
// block kar dega.
app.use(cors());

// express.json() incoming request body ko automatically JSON se JS object
// mein parse karta hai - iske bina req.body hamesha undefined milega.
app.use(express.json());

// ---- Health check route ----
// Yeh route abhi sirf confirm karne ke liye hai ki server zinda hai.
// Baad mein docker-compose / deployment tools bhi isi tarah ke route se
// check karenge ki container healthy hai ya nahi (jaisa system design
// doc mein NFR8 - observability mein likha tha).
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Beyownd API is running' });
});

// ---- Routes (abhi khali, jaise jaise modules banenge yahan add honge) ----
// import authRoutes from './routes/auth.routes';
// app.use('/api/auth', authRoutes);

// ... existing app.use(cors()), app.use(express.json()) ke baad:
app.use(cookieParser());

// ... /health route ke baad:
app.use('/api/auth', authRoutes);

// ---- 404 handler ----
// Agar koi bhi request kisi bhi upar wale route se match nahi hoti,
// yeh catch-all yahan pakad lega, taaki koi bhi galat URL par silent
// crash ya confusing default Express error na aaye.
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ---- Global error handler (HAMESHA sabse aakhir mein lagana hota hai) ----
// Express ka rule: error-handling middleware sabse last mein register
// hona chahiye, tabhi yeh poore app ke errors ko catch kar payega.
app.use(errorHandler);

export default app;