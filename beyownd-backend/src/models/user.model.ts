// src/models/User.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Defines the SHAPE of a user. services/auth.service.ts is the main place
//   that reads/writes it (signup, login, Google link, password reset).
// - ONE ACCOUNT PER EMAIL: a user can have a password, a Google ID, or both.
//   `authProviders` records which login methods this account has, e.g.
//   ['local'] or ['google'] or ['local', 'google']. Rules for linking live in
//   auth.service.ts and docs/design/user-flow.md.
// - Password is hashed automatically in the pre('save') hook below - no code
//   path can store a plaintext password.
// - `profile` = onboarding answers (college, year, goal...). Embedded, not a
//   separate collection: it's 1:1 with the user and always read together, so
//   GET /users/me stays a single indexed read. `onboardingCompleted` drives the
//   frontend redirect and the requireOnboarding middleware.
// - Access tokens are only ever issued to verified users, so
//   middlewares/auth.middleware.ts doesn't need to read this model on every
//   request (see the comment there).
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import {
  DEGREES, CURRENT_YEARS, GOALS, SKILL_LEVELS, HEARD_FROM, INTEREST_AREAS, INDIAN_STATES,
  Degree, CurrentYear, Goal, SkillLevel, HeardFrom, InterestArea, IndianState,
} from '../constants/profile';

export type AuthProvider = 'local' | 'google';

export interface IProfile {
  // Certificate pe yahi naam chhapega - pehla credential issue hote hi lock
  certificateName: string;
  certificateNameLockedAt?: Date;
  phone: string; // E.164: +91XXXXXXXXXX
  collegeId: Types.ObjectId;
  collegeName: string; // denormalized - /me aur certificates ke liye join nahi chahiye
  degree: Degree;
  degreeOther?: string;
  branch: string;
  currentYear: CurrentYear;
  graduationYear: number;
  city: string;
  state: IndianState;
  goal: Goal;
  certificateNeededBy?: string; // 'YYYY-MM'
  interestedTracks: InterestArea[];
  skillLevel: SkillLevel;
  heardFrom: HeardFrom;
  heardFromOther?: string;
  referralCode?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  authProviders: AuthProvider[];
  googleId?: string;
  role: 'student' | 'admin';
  isVerified: boolean;
  profile?: IProfile;
  onboardingCompleted: boolean;
  onboardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// bcrypt cost factor. 10 rounds ≈ 50-80ms per hash on a small VPS - slow
// enough to make offline brute force expensive, fast enough for login.
export const BCRYPT_ROUNDS = 10;

// _id: false - sub-document ko apna alag ID nahi chahiye
const profileSchema = new Schema<IProfile>(
  {
    certificateName: { type: String, required: true, trim: true, minLength: 2, maxLength: 60 },
    certificateNameLockedAt: { type: Date },
    phone: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true },
    collegeName: { type: String, required: true, trim: true, maxLength: 150 },
    degree: { type: String, enum: DEGREES, required: true },
    degreeOther: { type: String, trim: true, maxLength: 60 },
    branch: { type: String, required: true, trim: true, maxLength: 60 },
    currentYear: { type: String, enum: CURRENT_YEARS, required: true },
    graduationYear: { type: Number, required: true },
    city: { type: String, required: true, trim: true, maxLength: 60 },
    state: { type: String, enum: INDIAN_STATES, required: true },
    goal: { type: String, enum: GOALS, required: true },
    certificateNeededBy: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    interestedTracks: { type: [{ type: String, enum: INTEREST_AREAS }], default: [] },
    skillLevel: { type: String, enum: SKILL_LEVELS, required: true },
    heardFrom: { type: String, enum: HEARD_FROM, required: true },
    heardFromOther: { type: String, trim: true, maxLength: 60 },
    referralCode: { type: String, trim: true, maxLength: 30 },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      // Indian full names + Google display names can be long; 60 is safe
      minLength: 2,
      maxLength: 60,
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
      minLength: 8,
      select: false,
    },
    authProviders: {
      type: [{ type: String, enum: ['local', 'google'] }],
      default: [],
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
    // Local signups start false and can't log in until OTP-verified.
    // Google sign-in sets it true - Google already proved the email.
    isVerified: {
      type: Boolean,
      default: false,
    },
    profile: { type: profileSchema },
    onboardingCompleted: { type: Boolean, default: false },
    onboardedAt: { type: Date },
  },
  { timestamps: true }
);

// Admin stats: "is college ke saare students" - bina index ke poori
// users collection scan hoti
userSchema.index({ 'profile.collegeId': 1 });

// ---- HOOK 1: an account with the 'local' method must have a password ----
// isSelected check: password is `select: false`, so a user loaded normally
// (e.g. Google linking an existing account) has password === undefined even
// though one exists in the DB. Only enforce when the field was loaded/set.
userSchema.pre('validate', function () {
  if (this.authProviders.includes('local') && this.isSelected('password') && !this.password) {
    throw new Error('Password is required for email/password accounts');
  }
});

// ---- HOOK 2: hash the password before saving ----
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;
