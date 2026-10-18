// src/models/quizAttempt.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Har quiz submit = ek attempt (proof of work ka hissa). Score server pe
//   calculate hota hai (services/quiz.service.ts), client ka bheja score
//   kabhi trust nahi hota.
// - Alag collection (enrollment mein embed nahi) - attempts ki koi fixed
//   limit nahi (unlimited attempts, D3), aur sirf list mein padhe jaate hai.
// - Best score + passed flag enrollment.progress mein bhi likha jaata hai,
//   taaki dashboard ko attempts padhne na pade.
// - Design: docs/design/schemas.md §4.3
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAttemptAnswer {
  questionId: Types.ObjectId;
  selectedOptionIndexes: number[];
}

export interface IQuizAttempt extends Document {
  enrollmentId: Types.ObjectId;
  userId: Types.ObjectId;
  quizId: Types.ObjectId;
  moduleId: Types.ObjectId;
  answers: IAttemptAnswer[];
  scorePercent: number;
  passed: boolean;
  attemptNumber: number;
  createdAt: Date;
}

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    answers: [
      {
        _id: false,
        questionId: { type: Schema.Types.ObjectId, required: true },
        selectedOptionIndexes: { type: [Number], default: [] },
      },
    ],
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    passed: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// "Is module ke mere attempts, naye pehle"
quizAttemptSchema.index({ enrollmentId: 1, moduleId: 1, createdAt: -1 });

const QuizAttempt: Model<IQuizAttempt> = mongoose.model<IQuizAttempt>('QuizAttempt', quizAttemptSchema);

export default QuizAttempt;
