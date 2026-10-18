// src/services/quiz.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Module ke end ka quiz: dikhana (bina answers ke), grade karna (server pe),
// attempts ki list. Pass hone pe module complete → agla module unlock.
//
// RULES (decision D3):
// - Pass = passPercent (default 60%). Attempts unlimited, best score count.
// - Har attempt ke beech 60 sec wait (Redis SET NX EX) - unlimited attempts
//   ke saath bhi brute force (har combination try karna) practical nahi.
// - Question order har baar shuffle.
// - Quiz tabhi khulta hai jab module ke saare lessons complete ho.
//
// ANSWER LEAK RULE:
// - FAIL hone pe: sirf kaunsa question sahi/galat - correct answer ya
//   explanation NAHI (warna ek baar fail karo, answers copy karo, pass).
// - PASS hone pe: correct answers + explanations - seekhne ke liye.
//
// Score hamesha server calculate karta hai - client sirf selected options
// bhejta hai. correctOptionIndexes kabhi response mein nahi jaata (pass ke
// baad wale result ko chhod ke).
// ────────────────────────────────────────────────────────────────────────

import { Types } from 'mongoose';
import Quiz from '../models/quiz.model';
import QuizAttempt from '../models/quizAttempt.model';
import Enrollment from '../models/enrollment.model';
import { redisClient } from '../config/redis';
import { AppError } from '../utils/AppError';
import { getOrSet, cacheKeys } from '../utils/cache';
import {
  loadOwnEnrollment,
  loadCohort,
  assertModuleAccessible,
  resolveModule,
  ensureProgressEntry,
  settleModuleCompletion,
} from './enrollment.service';

const QUIZ_TTL = 1800;
export const QUIZ_COOLDOWN_SECONDS = 60;

interface CachedQuestion {
  id: string;
  prompt: string;
  type: 'single' | 'multiple';
  options: string[];
  correctOptionIndexes: number[];
  explanation: string | null;
  points: number;
}

interface CachedQuiz {
  id: string;
  moduleId: string;
  passPercent: number;
  questions: CachedQuestion[];
}

export interface AnswerInput {
  questionId: string;
  selectedOptionIndexes: number[];
}

const cooldownKey = (enrollmentId: string, moduleId: string) => `quiz_cooldown:${enrollmentId}:${moduleId}`;

// Answers ke saath cached - yeh object kabhi seedha response mein nahi jaata
const loadQuiz = async (moduleId: string): Promise<CachedQuiz | null> =>
  getOrSet<CachedQuiz | null>(cacheKeys.quiz(moduleId), QUIZ_TTL, async () => {
    const quiz = await Quiz.findOne({ moduleId });
    if (!quiz) return null;
    return {
      id: String(quiz._id),
      moduleId: String(quiz.moduleId),
      passPercent: quiz.passPercent,
      questions: quiz.questions.map((q) => ({
        id: String(q._id),
        prompt: q.prompt,
        type: q.type,
        options: [...q.options],
        correctOptionIndexes: [...q.correctOptionIndexes],
        explanation: q.explanation ?? null,
        points: q.points,
      })),
    };
  });

// Fisher-Yates - har order barabar probability se
const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Pure function - DB/Redis nahi, seedha unit-testable.
// single: exactly woh ek option. multiple: exactly saare sahi options (koi
// extra nahi, koi kam nahi). Jawab nahi diya = galat.
export const gradeAnswers = (questions: CachedQuestion[], answers: AnswerInput[]) => {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionIndexes]));
  let earned = 0;
  let total = 0;

  const results = questions.map((q) => {
    total += q.points;
    const selected = [...new Set(byQuestion.get(q.id) ?? [])].sort();
    const expected = [...q.correctOptionIndexes].sort();
    const correct = selected.length === expected.length && selected.every((v, i) => v === expected[i]);
    if (correct) earned += q.points;
    return { question: q, correct };
  });

  return { results, scorePercent: total === 0 ? 0 : Math.round((earned / total) * 100) };
};

// Quiz access = module access rules + quiz exist kare + saare lessons done
const loadQuizContext = async (enrollmentId: string, userId: string, moduleId: string) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  const ctx = await resolveModule(enrollment, moduleId);
  assertModuleAccessible(enrollment, await loadCohort(enrollment.cohortId), ctx.state);

  const quiz = ctx.module.hasQuiz ? await loadQuiz(moduleId) : null;
  if (!quiz) throw AppError.notFound('This module has no quiz');

  if (ctx.state.lessonsCompleted < ctx.state.lessonsTotal) {
    throw AppError.forbidden('Complete all lessons in this module before the quiz', 'LESSONS_INCOMPLETE');
  }
  return { enrollment, quiz, ...ctx };
};

const cooldownRemaining = async (enrollmentId: string, moduleId: string): Promise<number> => {
  const ttl = await redisClient.ttl(cooldownKey(enrollmentId, moduleId));
  return ttl > 0 ? ttl : 0;
};

export const getQuiz = async (enrollmentId: string, userId: string, moduleId: string) => {
  const { enrollment, quiz } = await loadQuizContext(enrollmentId, userId, moduleId);
  const progress = enrollment.progress.find((p) => String(p.moduleId) === moduleId);

  return {
    moduleId,
    passPercent: quiz.passPercent,
    totalQuestions: quiz.questions.length,
    passed: progress?.quizPassed ?? false,
    bestScorePercent: progress?.bestQuizScorePercent ?? 0,
    retryAfterSeconds: await cooldownRemaining(String(enrollment._id), moduleId),
    // Answers aur explanations hata ke, shuffled order mein
    questions: shuffle(quiz.questions).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      points: q.points,
    })),
  };
};

export const submitAttempt = async (
  enrollmentId: string,
  userId: string,
  moduleId: string,
  answers: AnswerInput[]
) => {
  const { enrollment, quiz, outline } = await loadQuizContext(enrollmentId, userId, moduleId);
  const enrollmentKey = String(enrollment._id);

  // Cooldown claim - SET NX atomic hai: do parallel submits mein se sirf ek
  // jaata hai, doosre ko 429 (aur attemptNumber duplicate nahi hota)
  const allowed = await redisClient.set(cooldownKey(enrollmentKey, moduleId), '1', 'EX', QUIZ_COOLDOWN_SECONDS, 'NX');
  if (!allowed) {
    const retryAfterSeconds = await cooldownRemaining(enrollmentKey, moduleId);
    throw AppError.tooMany(`Please wait ${retryAfterSeconds} seconds before trying again`, 'QUIZ_COOLDOWN', {
      retryAfterSeconds,
    });
  }

  const { results, scorePercent } = gradeAnswers(quiz.questions, answers);
  const passed = scorePercent >= quiz.passPercent;
  const moduleObjectId = new Types.ObjectId(moduleId);

  const previousAttempts = await QuizAttempt.countDocuments({ enrollmentId: enrollment._id, moduleId: moduleObjectId });
  await QuizAttempt.create({
    enrollmentId: enrollment._id,
    userId: enrollment.userId,
    quizId: new Types.ObjectId(quiz.id),
    moduleId: moduleObjectId,
    // Sirf is quiz ke questions ke answers store - fake questionIds drop
    answers: answers
      .filter((a) => quiz.questions.some((q) => q.id === a.questionId))
      .map((a) => ({ questionId: new Types.ObjectId(a.questionId), selectedOptionIndexes: a.selectedOptionIndexes })),
    scorePercent,
    passed,
    attemptNumber: previousAttempts + 1,
  });

  // Enrollment progress: best score ($max - kabhi neeche nahi jaata), pass flag
  await ensureProgressEntry(enrollment._id as Types.ObjectId, moduleObjectId);
  const updated = await Enrollment.findOneAndUpdate(
    { _id: enrollment._id, 'progress.moduleId': moduleObjectId },
    {
      $max: { 'progress.$.bestQuizScorePercent': scorePercent },
      ...(passed ? { $set: { 'progress.$.quizPassed': true } } : {}),
    },
    { new: true }
  );
  if (!updated) throw AppError.notFound('Enrollment not found');

  const completion = await settleModuleCompletion(outline, enrollment, updated, moduleId);

  return {
    scorePercent,
    passed,
    passPercent: quiz.passPercent,
    attemptNumber: previousAttempts + 1,
    retryAfterSeconds: passed ? 0 : QUIZ_COOLDOWN_SECONDS,
    // Fail: sirf sahi/galat. Pass: correct answers + explanation bhi.
    results: results.map(({ question, correct }) =>
      passed
        ? { questionId: question.id, correct, correctOptionIndexes: question.correctOptionIndexes, explanation: question.explanation }
        : { questionId: question.id, correct }
    ),
    ...completion,
  };
};

export const listAttempts = async (enrollmentId: string, userId: string, moduleId: string) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  await resolveModule(enrollment, moduleId);
  const attempts = await QuizAttempt.find({ enrollmentId: enrollment._id, moduleId })
    .sort({ createdAt: -1 })
    .limit(50)
    .select({ scorePercent: 1, passed: 1, attemptNumber: 1, createdAt: 1 });
  return attempts.map((a) => ({
    attemptNumber: a.attemptNumber,
    scorePercent: a.scorePercent,
    passed: a.passed,
    createdAt: a.createdAt,
  }));
};
