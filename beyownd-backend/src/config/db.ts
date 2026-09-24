// src/config/db.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Iska sirf EK kaam hai: MongoDB Atlas se connection banana aur us
// connection ko manage karna. Yeh khud kabhi call nahi hota apne aap -
// server.ts isko startup pe call karega, aur agar connection fail ho jaye,
// to server.ts server hi start nahi karega (safety check - bina DB ke
// server chalu karna bekaar hai, kyunki har request database maangegi).
// ────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';
import { env } from './env';

// Function ka return type Promise<void> hai - matlab yeh kuch return nahi
// karta, bas connection banata hai ya error throw karta hai. server.ts
// isko await karega taaki connection complete hone tak wait kare.
export const connectDB = async (): Promise<void> => {
  try {
    // mongoose.connect() khud hi internally connection pool manage karta
    // hai - matlab tujhe manually multiple connections handle nahi karne
    // padte, Mongoose ek connection pool rakhta hai jo concurrent requests
    // ko efficiently serve karta hai. Yeh important hai tere 1k-2k
    // concurrent users wale goal ke liye - ek hi connection sab requests
    // ke liye kaam karega, bar bar naya connection nahi banega.
    const conn = await mongoose.connect(env.mongoUri);

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // Agar connection fail hua, to error console pe print karo aur
    // process ko EXIT kar do (process.exit(1)). Yeh jaanbujh ke kiya hai -
    // agar database connect hi nahi hua, to server ko chalu rehne dena
    // galat hai, kyunki har request fail hogi anyway. Behtar hai server
    // start hi na ho, taaki tujhe TURANT pata chale ki kuch galat hai,
    // na ki har request pe silent errors milein.
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// ---- BONUS: connection event listeners (optional but useful) ----
// Yeh runtime mein connection ki health track karte hai - agar connection
// initially ban gaya tha lekin baad mein kabhi drop ho gaya (network
// issue, Atlas restart, waghera), tujhe turant console mein pata chal
// jayega, silently fail nahi hoga.
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});