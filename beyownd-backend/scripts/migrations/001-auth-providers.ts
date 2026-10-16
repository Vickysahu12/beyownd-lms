// scripts/migrations/001-auth-providers.ts
//
// User model badla: `authProvider: 'local' | 'google'` (single) →
// `authProviders: ('local' | 'google')[]` (ek account pe dono ho sakte hai).
// Yeh script purane documents ko naye shape mein convert karta hai.
//
// IDEMPOTENT - do baar chalao to bhi kuch kharab nahi hota (sirf woh docs
// touch hote hai jinme abhi bhi purana field hai).
//
// Run: npx ts-node --transpile-only scripts/migrations/001-auth-providers.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing');

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  // Aggregation-pipeline update: har doc ka apna authProvider value padh ke
  // array mein daalta hai - ek hi query, chahe 1 user ho ya 1 lakh
  const result = await users.updateMany({ authProvider: { $exists: true } }, [
    { $set: { authProviders: ['$authProvider'] } },
    { $unset: 'authProvider' },
  ]);

  console.log(`Migrated ${result.modifiedCount} user(s)`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
