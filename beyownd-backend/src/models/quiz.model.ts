// src/models/quiz.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Har module ka (max) ek quiz. Module tabhi complete hota hai jab saare
//   lessons done + quiz pass (services/enrollment.service.ts isModuleComplete).
// - Questions EMBEDDED hai - ek quiz ke 3-30 questions, hamesha saath padhe
//   jaate hai, alag collection ka koi fayda nahi.
// - `correctOptionIndexes` KABHI student ko nahi jaata - services/quiz.service.ts
//   response banate waqt hata deta hai. Grading sirf server pe hoti hai.
// - Har question ka apna `_id` - question order shuffle hota hai, answers
//   questionId se match hote hai (position se nahi).
// - Design: docs/design/schemas.md §3.4
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const QUESTION_TYPES = ['single', 'multiple'] as const;

export interface IQuestion {
  _id: Types.ObjectId;
  prompt: string;
  type: (typeof QUESTION_TYPES)[number];
  options: string[];
  correctOptionIndexes: number[];
  explanation?: string;
  points: number;
}

export interface IQuiz extends Document {
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId;
  passPercent: number;
  questions: IQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>({
  prompt: { type: String, required: true, maxLength: 2000 },
  // single = ek sahi option; multiple = saare sahi options chunne honge
  type: { type: String, enum: QUESTION_TYPES, default: 'single' },
  options: {
    type: [{ type: String, required: true, maxLength: 500 }],
    validate: { validator: (v: string[]) => v.length >= 2 && v.length <= 6, message: 'A question needs 2-6 options' },
  },
  correctOptionIndexes: { type: [Number], required: true },
  explanation: { type: String, maxLength: 2000 },
  points: { type: Number, default: 1, min: 1, max: 10 },
});

// Galat quiz data DB mein na jaye: correct index options ke range mein ho,
// single question ka exactly ek answer, multiple ka kam se kam ek
questionSchema.pre('validate', function () {
  const { options, correctOptionIndexes: correct, type } = this;
  if (correct.length === 0) throw new Error('Each question needs at least one correct option');
  if (type === 'single' && correct.length !== 1) throw new Error('Single-choice questions need exactly one correct option');
  if (new Set(correct).size !== correct.length) throw new Error('Duplicate correct option index');
  if (correct.some((i) => !Number.isInteger(i) || i < 0 || i >= options.length)) {
    throw new Error('Correct option index out of range');
  }
});

const quizSchema = new Schema<IQuiz>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    passPercent: { type: Number, default: 60, min: 1, max: 100 },
    questions: {
      type: [questionSchema],
      validate: { validator: (v: IQuestion[]) => v.length >= 3 && v.length <= 30, message: 'A quiz needs 3-30 questions' },
    },
  },
  { timestamps: true }
);

// Ek module = ek quiz
quizSchema.index({ moduleId: 1 }, { unique: true });
// Outline: "is course ke kis module mein quiz hai" ek query mein
quizSchema.index({ courseId: 1 });

const Quiz: Model<IQuiz> = mongoose.model<IQuiz>('Quiz', quizSchema);

export default Quiz;
