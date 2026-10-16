// src/models/college.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Colleges ki list students khud banate hai: onboarding mein college ka
//   naam type karte hai → services/college.service.ts normalize karke
//   dhoondhta hai, na mile to naya bana deta hai. Agla student type kare
//   to suggestion mein dikhega (GET /api/colleges?q=).
// - `normalizedName` unique hai - "Govt. College of Engg, Pune" aur
//   "govt college of engg pune" ek hi college maane jaate hai.
// - `words` - normalized naam ke words. Multikey index ke saath "pune engg"
//   jaisi search bhi kaam karti hai, chahe words naam mein kahin bhi ho.
// - `studentCount` - suggestions mein popular colleges upar dikhte hai, aur
//   admin stats ("kis college se kitne students") ke kaam aata hai.
// - User.profile.collegeId isi model ko reference karta hai.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICollege extends Document {
  name: string;
  normalizedName: string;
  words: string[];
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const collegeSchema = new Schema<ICollege>(
  {
    // Pehli baar jis student ne type kiya, wahi display naam (trimmed)
    name: { type: String, required: true, trim: true, maxLength: 150 },
    normalizedName: { type: String, required: true, unique: true },
    words: { type: [String], default: [] },
    studentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Search: { words: /^pune/ } is index se fast chalta hai (prefix regex)
collegeSchema.index({ words: 1 });

const College: Model<ICollege> = mongoose.model<ICollege>('College', collegeSchema);

export default College;
