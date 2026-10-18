// Runs before any app module is imported - env.ts validates these at import.
// dotenv never overrides variables that are already set, so .env can't leak in.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.REDIS_URL = 'redis://localhost:6379/15';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.RESEND_API_KEY = 're_test_dummy';
process.env.EMAIL_FROM = 'test@beyownd.in';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.TRUST_PROXY = '0';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummykey';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
// Placeholder so config/env.ts validation passes at import time. Tests never
// use it - tests/setup/db.ts connects to a per-file in-memory MongoDB.
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.PORT = '0';
