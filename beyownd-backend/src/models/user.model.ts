// src/models/User.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - config/db.ts opens the Mongo connection at server startup; this file just
//   defines the SHAPE of a user, it doesn't connect to anything itself.
// - services/auth.service.ts is the ONLY place that queries this model directly
//   (findOne during login/Google-login, `new User({...})` during signup). It
//   calls user.comparePassword(...) below rather than importing bcrypt itself.
//   It's also the place that sets isVerified = true after correct OTP entry,
//   and skips OTP entirely for Google signups (auth.provider === 'google').
// - controllers/auth.controller.ts never imports User at all - it only talks
//   to auth.service.ts.
// - middlewares/auth.middleware.ts uses this model too - after verifying a JWT
//   it does User.findById(decoded.id) to fetch the real user and attach it as
//   req.user for later controllers to read. It will ALSO check isVerified
//   there and block access if false, for local-signup users who never
//   finished OTP verification.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  authProvider: 'local' | 'google';
  googleId?: string;
  role: 'student' | 'admin';
  isVerified: boolean;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minLength: 3,
      maxLength: 20,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      required: true,
      default: 'local',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    // NEW FIELD - this is the whole point of today's OTP discussion.
    // Local signups start as false and can't log in until OTP-verified.
    // Google signups get created with this already true in auth.service.ts
    // at signup time - Google itself already proved the email is real, so
    // there's nothing for us to re-verify.
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ---- HOOK 1: enforce "password required only for local signups" ----
userSchema.pre('validate', function () {
  if (this.authProvider === 'local' && !this.password) {
    throw new Error('Password is required for email/password signup');
  }
});

// ---- HOOK 2: hash the password before saving ----
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;