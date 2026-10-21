/*
 * Student-side API shapes and the profile option lists. Values mirror the
 * backend (constants/profile.ts, enrollment/quiz/project/credential/payment
 * services); labels are what students read.
 */

export const DEGREES = [
  ["btech", "B.Tech"],
  ["be", "B.E."],
  ["bca", "BCA"],
  ["bsc", "B.Sc"],
  ["mca", "MCA"],
  ["msc", "M.Sc"],
  ["diploma", "Diploma"],
  ["other", "Other"],
] as const;
export const CURRENT_YEARS = [
  ["1", "1st year"],
  ["2", "2nd year"],
  ["3", "3rd year"],
  ["4", "4th year"],
  ["passed_out", "Passed out"],
] as const;
export const GOALS = [
  ["internship_certificate", "Internship certificate for college", "My college needs an internship and I want proper documents"],
  ["learn_skills", "Learn real skills", "I want to build something and understand it"],
  ["job_prep", "Get job-ready", "Projects and skills for placements"],
] as const;
export const SKILL_LEVELS = [
  ["beginner", "New to this", "I'm just starting"],
  ["basics", "Know the basics", "I've tried a few things"],
  ["confident", "Fairly confident", "I've built projects before"],
] as const;
export const HEARD_FROM = [
  ["instagram", "Instagram"],
  ["whatsapp", "WhatsApp"],
  ["friend", "A friend"],
  ["college", "My college"],
  ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"],
  ["other", "Somewhere else"],
] as const;
export const INTEREST_AREAS = [
  ["web_dev", "Web development"],
  ["frontend", "Frontend"],
  ["backend", "Backend"],
  ["android", "Android"],
  ["data_science", "Data science"],
  ["ai_ml", "AI / ML"],
  ["cybersecurity", "Cybersecurity"],
  ["ui_ux", "UI / UX"],
  ["cloud_devops", "Cloud / DevOps"],
] as const;
export const MAX_INTERESTS = 5;
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

/** Same as the backend: certificates print Latin letters only. */
export const CERTIFICATE_NAME = /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/;
export const PERSON_NAME = /^[\p{L}\p{M} .'-]+$/u;

export interface Profile {
  certificateName: string;
  certificateNameLocked: boolean;
  phone: string;
  collegeId: string;
  collegeName: string;
  degree: string;
  degreeOther: string | null;
  branch: string;
  currentYear: string;
  graduationYear: number;
  city: string;
  state: string;
  goal: string;
  certificateNeededBy: string | null;
  interestedTracks: string[];
  skillLevel: string;
  heardFrom: string;
  heardFromOther: string | null;
  referralCode: string | null;
}

export type EnrollmentStatus = "pending_payment" | "active" | "completed" | "refunded" | "cancelled";
export type ProjectStatus = "not_submitted" | "pending_review" | "changes_requested" | "approved";

export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  course: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null;
  cohort: { id: string; name: string; code: string; startDate: string; endDate: string } | null;
  percentComplete: number;
  projectStatus: ProjectStatus;
}

export interface ModuleState {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  hasQuiz: boolean;
  unlocked: boolean;
  completed: boolean;
  quizPassed: boolean;
  lessonsCompleted: number;
  lessonsTotal: number;
  lessons: { id: string; title: string; order: number; type: "text" | "video"; estimatedMinutes: number; completed: boolean }[];
}

export interface EnrollmentDashboard {
  id: string;
  status: EnrollmentStatus;
  course: { id: string; title: string; slug: string; projectTitle: string } | null;
  cohort: { id: string; name: string; code: string; startDate: string; endDate: string; started: boolean; communityLink: string | null };
  percentComplete: number;
  modules: ModuleState[];
  projectStatus: ProjectStatus;
  completedAt: string | null;
  completion: { completed: boolean; documentsIssued: boolean; documentsAvailableFrom: string | null };
}

export interface StudentLesson {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
  type: "text" | "video";
  content: string;
  videoYoutubeId: string | null;
  estimatedMinutes: number;
  completed: boolean;
  previousLessonId: string | null;
  nextLessonId: string | null;
}

export interface CompletionResult {
  moduleCompleted: boolean;
  nextModuleUnlocked: { id: string; title: string } | null;
  percentComplete: number;
}

export interface StudentQuiz {
  moduleId: string;
  passPercent: number;
  totalQuestions: number;
  passed: boolean;
  bestScorePercent: number;
  retryAfterSeconds: number;
  questions: { id: string; prompt: string; type: "single" | "multiple"; options: string[]; points: number }[];
}

export interface QuizResult extends CompletionResult {
  scorePercent: number;
  passed: boolean;
  passPercent: number;
  attemptNumber: number;
  retryAfterSeconds: number;
  results: { questionId: string; correct: boolean; correctOptionIndexes?: number[]; explanation?: string | null }[];
}

export interface QuizAttemptRow {
  attemptNumber: number;
  scorePercent: number;
  passed: boolean;
  createdAt: string;
}

export interface MySubmission {
  id: string;
  version: number;
  repoUrl: string;
  liveUrl: string | null;
  notes: string | null;
  status: "pending" | "changes_requested" | "approved";
  submittedAt: string;
  review: { rubricScores: { criterion: string; score: number }[]; totalPercent: number; feedback: string; decidedAt: string } | null;
}

export interface ProjectView {
  project: { title: string; brief: string; rubric: { criterion: string; maxScore: number }[]; passScorePercent: number };
  projectStatus: ProjectStatus;
  unlocked: boolean;
  canSubmit: boolean;
  submissions: MySubmission[];
}

export interface MyCredential {
  credentialId: string;
  type: string;
  label: string;
  status: "generating" | "issued" | "revoked";
  courseTitle: string;
  cohortName: string;
  issuedAt: string;
  revokedAt: string | null;
}

export interface MyPayment {
  id: string;
  enrollmentId: string;
  amountPaise: number;
  currency: string;
  status: "paid" | "refunded" | string;
  method: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface Checkout {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}
