# API Routes — The Contract Between Frontend and Backend

**Status:** ✅ Approved (Oct 16, 2026). ✅ next to a section = built and tested.
**Data behind these routes:** [schemas.md](schemas.md) · **User journey:** [user-flow.md](user-flow.md)

The frontend can be built against this document before the backend exists — that's the point of writing it first.

---

## 1. Conventions (apply to every route)

| Topic | Rule |
| --- | --- |
| Base URL | `https://api.beyownd.in/api` (local: `http://localhost:5000/api`) |
| Auth | `Authorization: Bearer <accessToken>` (15 min). On `401 TOKEN_EXPIRED`, call `POST /auth/refresh` (cookie) and retry once |
| Cookies | Send `credentials: 'include'` on `/auth/*` calls — the refresh cookie lives on `/api/auth` only |
| Success | `{ "success": true, ...data }` |
| Error | `{ "success": false, "message": "human text", "code": "MACHINE_CODE", "errors"?: [{ field, message }], "details"?: { … } }` — **frontend branches on `code`, never on `message`** |
| Lists | Cursor pagination: `?limit=20&cursor=<id>` → `{ items: [...], nextCursor: string \| null }`. `limit` max 50 |
| IDs | MongoDB ObjectIds, except the public `credentialId` |
| Money | Integer paise (`59900` = ₹599) |
| Dates | ISO 8601 UTC strings; frontend shows IST |
| Access levels | **public** · **auth** (logged in) · **onboarded** (auth + onboarding done) · **enrolled** (owns an active enrollment) · **mentor** · **admin** |

## 2. Health ✅

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Liveness (no DB) |
| GET | `/health/ready` | public | Mongo + Redis check; 503 when down |

## 3. Auth ✅ (Phase 0)

| Method | Path | Access | Purpose · key error codes |
| --- | --- | --- | --- |
| POST | `/auth/signup` | public | `{ name, email, password }` → 201, OTP emailed · `EMAIL_TAKEN`, `GOOGLE_ACCOUNT`, `EMAIL_FAILED` |
| POST | `/auth/verify-otp` | public | `{ email, otp }` → `{ user, accessToken }` + cookie · `OTP_INVALID`, `OTP_LOCKED` |
| POST | `/auth/resend-otp` | public | `{ email }` → generic message · `OTP_COOLDOWN` |
| POST | `/auth/login` | public | `{ email, password }` → `{ user, accessToken }` + cookie · `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `USE_GOOGLE_SIGNIN` |
| POST | `/auth/google` | public | `{ idToken }` → `{ user, accessToken }` + cookie |
| POST | `/auth/refresh` | cookie | → new `{ user, accessToken }` + rotated cookie · `SESSION_INVALID`, `SESSION_REUSED` |
| POST | `/auth/logout` | cookie | Revokes the session |
| POST | `/auth/forgot-password` | public | `{ email }` → generic message |
| POST | `/auth/reset-password` | public | `{ email, otp, password }` → logs out all devices |

All auth routes are rate-limited per IP + email and per IP (campus-friendly) — see Phase 0 build doc.

## 4. Me & onboarding ✅ (Phase 0)

| Method | Path | Access | Purpose · key error codes |
| --- | --- | --- | --- |
| GET | `/users/me` | auth | User + `onboardingCompleted` + `profile` |
| PUT | `/users/me/onboarding` | auth | Full onboarding form (once) · `ALREADY_ONBOARDED` |
| PATCH | `/users/me/profile` | auth | Any subset of profile fields · `ONBOARDING_REQUIRED`, `CERTIFICATE_NAME_LOCKED` |
| GET | `/colleges?q=` | auth | Autocomplete, max 10, Redis-cached |

## 5. Catalog ✅ (Phase 1) — public, cached

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/courses` | public | Published courses: title, slug, tagline, thumbnail, durationWeeks, skills, from-price, next open cohort date |
| GET | `/courses/:slug` | public | Course detail + **outline** (modules → lesson titles, types, minutes; no content) + project title · `NOT_FOUND` |
| GET | `/courses/:slug/cohorts` | public | Cohorts open for enrollment: dates, price, seats left |
| GET | `/courses/:slug/preview/lessons/:lessonId` | public | Full lesson content **only if** its module is `isFreePreview` · `PREVIEW_NOT_AVAILABLE` |

Served from Redis (`cache:courses:published`, `cache:course:<slug>:outline`) — the most-hit pages never touch MongoDB after the first request.

## 6. Enrollment & learning ✅ (Phase 1–3A)

| Method | Path | Access | Purpose · key error codes |
| --- | --- | --- | --- |
| POST | `/enrollments` | onboarded | `{ cohortId }` → creates (or reuses) a `pending_payment` enrollment **and** a Razorpay order → `{ enrollment: { id, status }, checkout: { keyId, orderId, amountPaise, currency, name, description, prefill: { name, email, contact } } }` (pass `checkout` straight to Razorpay Checkout) · `ENROLLMENT_CLOSED`, `COHORT_FULL`, `ALREADY_ENROLLED`, `PAYMENT_PROVIDER_ERROR` |
| GET | `/enrollments` | auth | My enrollments with course title, cohort dates, status, % complete |
| GET | `/enrollments/:id` | enrolled | Dashboard for one course: modules with lock/complete state, quiz status, project status, community link, `completion: { completed, documentsIssued, documentsAvailableFrom }` |
| GET | `/enrollments/:id/lessons/:lessonId` | enrolled | Lesson content + `completed` + `previousLessonId` / `nextLessonId` · `MODULE_LOCKED`, `ENROLLMENT_NOT_ACTIVE`, `COHORT_NOT_STARTED` |
| POST | `/enrollments/:id/lessons/:lessonId/complete` | enrolled | Mark done (idempotent) → `{ moduleCompleted, nextModuleUnlocked, percentComplete }` |
| GET | `/enrollments/:id/modules/:moduleId/quiz` | enrolled | Questions in shuffled order, **without answers**, plus `passed`, `bestScorePercent`, `retryAfterSeconds` · `MODULE_LOCKED`, `LESSONS_INCOMPLETE` |
| POST | `/enrollments/:id/modules/:moduleId/quiz/attempts` | enrolled | `{ answers: [{ questionId, selectedOptionIndexes }] }` → `{ scorePercent, passed, attemptNumber, results, moduleCompleted, nextModuleUnlocked }`. `results` = right/wrong only on a fail; correct answers + explanations only on a pass · `QUIZ_COOLDOWN` (`details.retryAfterSeconds` + `Retry-After` header) |
| GET | `/enrollments/:id/modules/:moduleId/quiz/attempts` | enrolled | My past attempts (scores only) |
| GET | `/enrollments/:id/project` | enrolled | Brief + rubric + `unlocked`, `canSubmit`, `projectStatus` + my submissions with review feedback |
| POST | `/enrollments/:id/project/submissions` | enrolled | `{ repoUrl (https://github.com/owner/repo), liveUrl? (https), notes? }` → 201 · `MODULES_INCOMPLETE`, `SUBMISSION_PENDING`, `PROJECT_ALREADY_APPROVED` |

"Enrolled" is checked once per request by loading the enrollment by `{ _id, userId }` — a student can never read someone else's enrollment by changing the ID in the URL (returns `NOT_FOUND`, not `FORBIDDEN`, so it doesn't reveal that the ID exists).

## 7. Payments ✅ (Phase 3A)

| Method | Path | Access | Purpose · key error codes |
| --- | --- | --- | --- |
| POST | `/payments/verify` | auth | Called by the frontend right after Razorpay checkout: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` → signature checked → enrollment activated → `{ outcome: 'activated' \| 'already_processed' \| 'cohort_full_refund_required', enrollment: { id, status } }` · `PAYMENT_SIGNATURE_INVALID` |
| POST | `/webhooks/razorpay` | Razorpay only | `payment.captured`, `payment.failed`, `refund.processed`. Verified with `X-Razorpay-Signature`. **Source of truth** — activates the enrollment even if the student closed the tab before `/payments/verify` ran |
| GET | `/payments` | auth | My payment history (receipts) |

Both `/payments/verify` and the webhook run the same idempotent activation (see schemas §5.1), so it doesn't matter which arrives first or how many times.

**Implementation note:** the webhook signature is computed over the **raw request body**, so `/webhooks/razorpay` is mounted with `express.raw()` *before* the global `express.json()` in `app.ts`. It is excluded from CORS and rate limiting, and always answers 200 quickly (heavy work goes to the queue) so Razorpay doesn't retry needlessly.

## 8. Credentials & public verification ✅ (Phase 3B)

| Method | Path | Access | Purpose · key error codes |
| --- | --- | --- | --- |
| GET | `/credentials` | auth | My documents: type, course, status (`generating` / `issued` / `revoked`), credentialId |
| GET | `/credentials/:credentialId/download` | auth (owner) | `{ url, expiresAt }` — a signed link valid for 5 minutes (open it to download the PDF) · `CREDENTIAL_NOT_FOUND`, `CREDENTIAL_NOT_READY` (still generating), `CREDENTIAL_REVOKED` |
| GET | `/files/:folder/:file?expires=&sig=` | signed link | The PDF itself (`Content-Disposition: attachment`) · `DOWNLOAD_LINK_EXPIRED` |
| GET | `/verify/:credentialId` | **public** | `{ credential: { valid, status (issued \| generating \| revoked), credentialId, type, label, studentName, collegeName, courseTitle, skills, cohortName, startDate, endDate, issuedAt, issuedBy (GrewDo), programName, revokedAt } }`. Case/space-insensitive ID. Never returns email or phone. Cached; rate-limited per IP · `CREDENTIAL_NOT_FOUND` |

Revoked credentials still verify — they show **status: revoked** with the date, so a revoked certificate can't be passed off as genuine.

## 9. Mentor ✅ (Phase 3C)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/review/submissions?status=pending&limit=20&cursor=` | mentor, admin | `{ items: [{ id, version, status, submittedAt, repoUrl, liveUrl, student: { name, college }, course: { title }, cohort: { name, code, endDate } }], nextCursor }` — pending oldest first, reviewed newest first |
| GET | `/review/submissions/:id` | mentor, admin | Submission + rubric + previous versions |
| POST | `/review/submissions/:id/decision` | mentor, admin | `{ decision: 'approved' \| 'changes_requested', rubricScores: [{ criterion, score }], feedback (10–5000) }` → `{ submissionId, decision, totalPercent, completion: 'completed' \| 'already_completed' \| 'not_ready' \| null }` · `RUBRIC_INVALID`, `SCORE_BELOW_PASS`, `SUBMISSION_ALREADY_REVIEWED` · audit-logged, student emailed |

## 10. Admin (Phase 5)

All routes: `admin` only. Every change that affects money or trust writes to `auditlogs`.

**Content**

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/admin/courses` | List all (any status) / create |
| GET / PATCH | `/admin/courses/:id` | Read / update (incl. project brief, publish/archive) — clears catalog cache |
| POST | `/admin/courses/:id/modules` | Add module |
| PATCH / DELETE | `/admin/modules/:id` | Update / delete (only if no active enrollments) |
| PUT | `/admin/courses/:id/modules/order` | `{ moduleIds: [...] }` reorder in one request |
| POST | `/admin/modules/:id/lessons` | Add lesson |
| PATCH / DELETE | `/admin/lessons/:id` | Update / delete |
| PUT | `/admin/modules/:id/lessons/order` | Reorder lessons |
| PUT | `/admin/modules/:id/quiz` | Create or replace the module's quiz |

**Cohorts & students**

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/admin/cohorts` | List / create |
| PATCH | `/admin/cohorts/:id` | Dates, capacity, price, status, community link (price change audit-logged) |
| GET | `/admin/students?q=&cohortId=&status=` | Search by name/email/college; paginated |
| GET | `/admin/students/:userId` | Profile, enrollments, progress, payments, credentials |
| POST | `/admin/enrollments/:id/refund` | Mark refunded (after refunding in Razorpay) → revokes credentials · audit-logged |

**Credentials**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin/credentials/:credentialId/revoke` | `{ reason }` — irreversible, audit-logged, clears verify cache |
| POST | `/admin/enrollments/:id/credentials/reissue` | Regenerate a missing/failed PDF (same credentialId, same snapshot) |

**Stats**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/stats/overview` | Signups, onboarded, paid, active this week, revenue, certificates issued |
| GET | `/admin/stats/funnel?courseId=` | Per module: how many students reached / completed it — shows where students drop off |
| GET | `/admin/stats/colleges` | Students and paid enrollments per college |

## 11. New error codes introduced by Phases 1–3

| Code | HTTP | Meaning for the frontend |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Doesn't exist **or isn't yours** |
| `PREVIEW_NOT_AVAILABLE` | 403 | Lesson needs enrollment → show "Enroll to continue" |
| `ENROLLMENT_CLOSED` | 409 | Cohort not accepting enrollments |
| `COHORT_FULL` | 409 | No seats left → suggest next cohort |
| `ALREADY_ENROLLED` | 409 | Send to existing enrollment |
| `ENROLLMENT_NOT_ACTIVE` | 403 | Pending payment / refunded → show payment state |
| `MODULE_LOCKED` | 403 | Finish the previous module first |
| `COHORT_NOT_STARTED` | 403 | Paid content opens on the batch start date (D10); free-preview modules stay open |
| `LESSONS_INCOMPLETE` | 403 | Mark all lessons complete before the quiz |
| `QUIZ_COOLDOWN` | 429 | Wait before retrying (`details.retryAfterSeconds`, also `Retry-After` header) |
| `MODULES_INCOMPLETE` | 403 | Project opens after all modules |
| `SUBMISSION_PENDING` | 409 | Already waiting for review |
| `PROJECT_ALREADY_APPROVED` | 409 | Nothing to submit |
| `PAYMENT_SIGNATURE_INVALID` | 400 | Payment not confirmed — webhook may still activate; show "verifying payment" |

## 12. What is deliberately **not** here (post-launch)

Leaderboard, streaks & badges, Judge0 code execution, lesson comments, notifications inbox, public portfolio page, search across lessons, coupons. Each will get its own section here when its phase starts.
