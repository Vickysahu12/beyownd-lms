// scripts/admin/make-admin.ts
//
// Pehla admin banana (chicken-and-egg: role badalne wala API khud admin
// maangta hai). Baad ke admins/mentors admin panel se: PATCH /api/admin/users/:id/role
//
// Run (beyownd-backend folder se), us email se pehle signup + verify kar lo:
//   npm run make-admin -- you@example.com
//
// Us user ke saare sessions revoke hote hai - dobara login karo, naya role
// token mein aa jayega.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const main = async () => {
  const email = process.argv.slice(2).find((a) => !a.startsWith('--'))?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }

  const { default: User } = await import('../../src/models/user.model');
  const { revokeAllSessions } = await import('../../src/services/session.service');
  const { redisClient } = await import('../../src/config/redis');

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No user with email ${email}. Sign up and verify first.`);
      process.exitCode = 1;
      return;
    }
    if (!user.isVerified) {
      console.error(`${email} hasn't verified their email yet.`);
      process.exitCode = 1;
      return;
    }
    if (user.role === 'admin') {
      console.log(`${email} is already an admin.`);
      return;
    }
    const from = user.role;
    user.role = 'admin';
    await user.save();
    await revokeAllSessions(String(user._id));
    console.log(`✓ ${email}: ${from} → admin. Log in again to get the new role.`);
  } finally {
    await mongoose.disconnect();
    await redisClient.quit();
  }
};

void main();
