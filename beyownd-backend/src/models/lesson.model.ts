// src/models/lesson.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Lesson = notes (markdown) ya YouTube video + notes. Module ka hissa.
// - `courseId` denormalized hai (module se bhi mil sakta tha) - isse poore
//   course ka outline (saare modules ke lesson titles) EK query mein aata hai.
// - `content` bada ho sakta hai (50k chars) - outline query use SELECT nahi
//   karti; content ek-ek lesson karke load hota hai aur Redis mein cached.
// - Video kabhi self-host nahi - YouTube embed (free, adaptive quality
//   for slow mobile networks). Sirf video ID store hoti hai.
// - Design: docs/design/schemas.md §3.3
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const LESSON_TYPES = ['text', 'video'] as const;

export interface ILesson extends Document {
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  order: number;
  type: (typeof LESSON_TYPES)[number];
  content: string;
  videoYoutubeId?: string;
  estimatedMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true, trim: true, minLength: 3, maxLength: 120 },
    order: { type: Number, required: true, min: 1 },
    type: { type: String, enum: LESSON_TYPES, default: 'text' },
    content: { type: String, default: '', maxLength: 50_000 },
    // YouTube video IDs are 11 chars: letters, digits, - and _
    videoYoutubeId: { type: String, match: /^[A-Za-z0-9_-]{11}$/ },
    estimatedMinutes: { type: Number, default: 10, min: 1, max: 120 },
  },
  { timestamps: true }
);

// this.invalidate() (throw nahi) - Mongoose ValidationError banta hai →
// error handler 400 deta hai. Plain `throw new Error` = 500 (bug jaisa dikhta).
lessonSchema.pre('validate', function () {
  if (this.type === 'video' && !this.videoYoutubeId) {
    this.invalidate('videoYoutubeId', 'Video lessons need a YouTube video ID');
  }
});

lessonSchema.index({ moduleId: 1, order: 1 }, { unique: true });
// Outline: ek course ke saare lessons, module + order se sorted, ek query mein
lessonSchema.index({ courseId: 1, moduleId: 1, order: 1 });

const Lesson: Model<ILesson> = mongoose.model<ILesson>('Lesson', lessonSchema);

export default Lesson;
