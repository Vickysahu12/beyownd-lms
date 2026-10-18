// src/routes/webhook.routes.ts
//
// Razorpay server-to-server calls. express.raw() - body Buffer rehta hai
// taaki signature exact bytes pe verify ho. Isliye app.ts mein yeh router
// express.json() se PEHLE mount hota hai. No auth (signature hi auth hai),
// no rate limit (Razorpay ke retries block nahi hone chahiye).

import express, { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';

const router = Router();

router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.razorpayWebhook);

export default router;
