// src/models/module.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Har module ek course ka hissa hai (`courseId`). `order` (1, 2, 3...)
//   unlock sequence decide karta hai: module N tabhi khulta hai jab N-1
//   complete ho (logic: services/enrollment.service.ts).
// - Lessons apne module ko point karte hai - module ke paas lessons ki list
//   nahi hoti (pehle draft mein thi, hata di: do jagah same link = drift).
// - `isFreePreview` - is module ke lessons bina pay kiye padh sakte hai
//   (funnel: student quality dekh ke pay kare). Quiz phir bhi enrollment maangta hai.
// - Design: docs/design/schemas.md §3.2
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IModule extends Document {
  courseId: Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  isFreePreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, minLength: 3, maxLength: 100 },
    description: { type: String, trim: true, maxLength: 500 },
    order: { type: Number, required: true, min: 1 },
    isFreePreview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// (1) "is course ke modules order mein" query fast, (2) ek course mein do
// modules same position pe nahi ho sakte
moduleSchema.index({ courseId: 1, order: 1 }, { unique: true });

const Module: Model<IModule> = mongoose.model<IModule>('Module', moduleSchema);

export default Module;
