# Beyownd — Feature List & Prioritization

Real companies don't build every idea at once. They prioritize using frameworks like **MoSCoW** (Must have / Should have / Could have / Won't have — yet) so a 40-day deadline doesn't collapse under feature creep. This is that exercise, done properly.

---

## Must Have (MVP — ships in 40 days, no exceptions)

These are the features without which the product doesn't function or the pitch doesn't work.

1. **Auth & user roles** — signup/login (email + password, JWT-based), roles: `student`, `admin`/`mentor`. Password reset flow.
2. **Structured syllabus / course catalog** — Course → Module → Lesson hierarchy. Each lesson has notes/reading content.
3. **Progress tracking with prerequisite locking** — a student can't jump to Module 3 until Module 2 is marked complete. This is your core "structured learning path" promise.
4. **Practice/quiz system** — MCQ or short-answer quizzes per module, auto-graded, feeds into progress + leaderboard.
5. **Leaderboard** — ranks students by points earned from quizzes/modules completed. Real-time-ish (Redis sorted set).
6. **Certificate generation** — auto-generated PDF on course completion, with a unique verifiable certificate ID + public verification page (`/verify/:certId`). This is your single biggest credibility feature — recruiters checking it *is* your marketing.
7. **Admin/mentor dashboard** — you need to see enrollments, completion rates, who's stuck where. You are your own first admin user.
8. **Responsive, production-quality UI** — not optional. This is what you show interviewers and put in your resume; it has to not look like a bootcamp project.

## Should Have (adds real "wow," do if week 1–3 goes smoothly)

9. **Sandboxed code execution (Judge0 integration)** — students write & run code in-browser against test cases. This is the feature that separates you from "just another notes site."
10. **Streaks & badges** — daily login/activity streak counter, milestone badges (first module done, 7-day streak, top 10 finish).
11. **Discussion/comments per lesson** — lightweight threaded comments so your existing 30-student community has a reason to stay engaged inside the product, not just on WhatsApp.

## Could Have (post-MVP, nice differentiators)

12. **Resume/portfolio auto-builder** — generates a shareable public profile page from completed courses + certificates + projects. Strong differentiator, but not MVP-critical — build once you have real completions to showcase.
13. **Email notifications** — reminders for inactive students, certificate-issued emails, weekly progress digest.
14. **Search across syllabus/notes.**
15. **Peer code review / project submissions with mentor feedback.**

## Won't Have (explicitly out of scope for now — say this out loud so scope doesn't creep)

- Payments/subscriptions (you're running this as a free/community model for now)
- Mobile app (responsive web is enough for MVP)
- Live video classes / cohort scheduling
- Multi-tenant (other orgs white-labeling your platform)
- AI-based content generation or grading

---

**Why this matters for your interview story:** "We used MoSCoW prioritization to scope a 40-day MVP, cutting payments and live video from v1 to protect our ship date" is a *real* product-thinking answer. Companies live and die by this exact discipline.