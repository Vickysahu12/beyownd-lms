// src/server.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Yeh poore backend ka ACTUAL entry point hai - jab tu `npm run dev`
// chalayega, sabse pehle yehi file run hogi. Iska kaam simple hai:
// 1. Pehle database se connect ho (db.ts ka connectDB() call karke)
// 2. Connection successful hone ke BAAD hi app.ts wale Express app ko
//    kisi port pe listen karwana
//
// Yeh order jaanbujh ke aisa hai: agar database connect hi nahi hua,
// server start hona hi nahi chahiye - kyunki almost har request database
// maangegi, aur bina DB ke server chalu rakhna sirf confusing errors
// dega har request pe, na ki ek clear "server start hi nahi hua" signal.
// ────────────────────────────────────────────────────────────────────────

import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

const startServer = async (): Promise<void> => {
  // Pehle DB connect - agar yeh fail hua, connectDB() ke andar hi
  // process.exit(1) chal jayega (humne db.ts mein already likha tha),
  // isliye neeche wali line kabhi nahi chalegi agar connection fail hua.
  await connectDB();

  // DB connect hone ke baad hi server ko actual port pe listen karwao.
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer();