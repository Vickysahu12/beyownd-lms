/* Response shapes for the mentor (§9) and admin (§10) APIs, copied from the backend services. */

export type SubmissionStatus = "pending" | "approved" | "changes_requested";

export interface QueueItem {
  id: string;
  version: number;
  status: SubmissionStatus;
  submittedAt: string;
  repoUrl: string;
  liveUrl: string | null;
  student: { name: string; college: string | null };
  course: { title: string | null };
  cohort: { name: string; code: string; endDate: string } | null;
}

export interface Review {
  rubricScores: { criterion: string; score: number }[];
  totalPercent: number;
  feedback: string;
  decidedAt: string;
}

export interface SubmissionDetail {
  submission: { id: string; version: number; status: SubmissionStatus; repoUrl: string; liveUrl: string | null; notes: string | null; submittedAt: string; review: Review | null };
  student: { name: string; college: string | null };
  project: { courseTitle: string; title: string; brief: string; rubric: { criterion: string; maxScore: number }[]; passScorePercent: number };
  previousVersions: { id: string; version: number; status: SubmissionStatus; repoUrl: string; submittedAt: string; feedback: string | null; totalPercent: number | null }[];
}

export interface AdminCourseRow {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  modules: number;
  lessons: number;
  students: number;
  defaultPricePaise: number;
  updatedAt: string;
}

export interface RubricItem { criterion: string; maxScore: number }
export interface AdminCourse {
  _id: string;
  title: string;
  slug: string;
  tagline?: string;
  description: string;
  thumbnailUrl?: string;
  level: "beginner" | "intermediate";
  skills: string[];
  durationWeeks: number;
  defaultPricePaise: number;
  status: "draft" | "published" | "archived";
  project: { title: string; brief: string; rubric: RubricItem[]; passScorePercent: number };
}

export interface AdminLessonRow { id: string; title: string; order: number; type: "text" | "video"; estimatedMinutes: number }
export interface AdminModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
  isFreePreview: boolean;
  quiz: { passPercent: number; questions: number } | null;
  lessons: AdminLessonRow[];
}
export interface CourseStructure { course: AdminCourse; modules: AdminModule[]; hasStudents: boolean }

export interface AdminLesson {
  _id: string;
  moduleId: string;
  courseId: string;
  title: string;
  type: "text" | "video";
  content: string;
  videoYoutubeId?: string | null;
  estimatedMinutes: number;
}

export interface QuizQuestion { _id?: string; prompt: string; type: "single" | "multiple"; options: string[]; correctOptionIndexes: number[]; explanation?: string; points?: number }
export interface AdminQuiz { passPercent: number; questions: QuizQuestion[] }

export interface AdminCohort {
  id: string;
  courseId: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  enrollOpensAt: string;
  enrollClosesAt: string;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  pricePaise: number;
  status: "scheduled" | "open" | "running" | "completed" | "cancelled";
  communityLink?: string;
  enrollments: Record<string, number>;
}

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  onboardingCompleted: boolean;
  certificateName: string | null;
  college: string | null;
  phone: string | null;
  enrollments: Record<string, number>;
  joinedAt: string;
}

export interface StudentDetail {
  user: { id: string; name: string; email: string; role: string; isVerified: boolean; authProviders: string[]; onboardingCompleted: boolean; profile: Record<string, unknown> | null; joinedAt: string };
  enrollments: {
    id: string;
    status: string;
    percentComplete?: number;
    course?: { title?: string; slug?: string };
    cohort?: { name?: string; startDate?: string; endDate?: string };
    [k: string]: unknown;
  }[];
  payments: { id: string; enrollmentId: string; amountPaise: number; status: string; method: string | null; razorpayPaymentId: string | null; refundRequired: boolean; paidAt: string | null; createdAt: string }[];
  credentials: { credentialId: string; type: string; label: string; status: string; courseTitle?: string; [k: string]: unknown }[];
  submissions: { id: string; enrollmentId: string; version: number; status: string; repoUrl: string; totalPercent: number | null; submittedAt: string }[];
}

export interface Overview {
  students: { total: number; verified: number; onboarded: number; newThisWeek: number };
  enrollments: Record<string, number> & { activeThisWeek: number };
  revenue: { paidCount: number; paidPaise: number; refundedCount: number; refundedPaise: number };
  documentsIssued: Record<string, number>;
  alerts: { pendingReviews: number; refundsToProcess: number };
}

export interface Funnel {
  enrolled: number;
  modules: { id: string; order: number; title: string; started: number; completed: number }[];
  project: { submitted: number; approved: number };
  completed: number;
}

export interface CollegeRow { collegeId: string; college: string | null; students: number; paidStudents: number }
