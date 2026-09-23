# Beyownd — Product Requirements Document (PRD)

## 1. Problem Statement

Self-taught and early-stage developer students (like your Surat community) struggle to find a single platform that combines a **structured syllabus**, **hands-on practice**, and **credible proof of work** (a certificate that actually means something on a resume). Existing options are fragmented: YouTube for content, LeetCode for practice, nothing that ties structured learning to a verifiable credential.

## 2. Goals

- **Primary:** Ship a production-grade LMS MVP in 40 days that can onboard your existing community (\~30 → target 200 students) before the November internship hiring season.
- **Secondary:** Build a platform strong enough to be a legitimate resume/portfolio piece — demonstrating full-stack, system design, and DevOps skills to future employers/interviewers.
- **Tertiary:** Create a defensible, differentiated product (not "just another Udemy clone") via the practice environment + verifiable certificates + leaderboard.

## 3. Non-Goals (v1)

- Not a payments/monetization platform yet
- Not a live-class/cohort scheduling tool
- Not competing on content breadth (you're not trying to have 500 courses — depth and credibility over volume)

## 4. Personas

### Persona A — The Student ("Rahul," 19, learning web dev)

- Currently juggles free YouTube content + random practice sites, no structure, no way to prove skill to recruiters.
- Wants: a clear path ("do X, then Y"), practice that isn't just theory, and *something to show* at the end.

### Persona B — The Admin/Mentor (you)

- Needs to see cohort health at a glance: who's active, who's stuck, who's ready to graduate.
- Needs to issue and manage certificates without manual work.

## 5. Core User Flows

**Flow 1 — Student onboarding** Sign up → land on dashboard → see enrolled/available courses → start Module 1 → read lesson → attempt quiz → progress unlocks Module 2.

**Flow 2 — Practice loop** Student opens a coding exercise → writes code in-browser → runs against test cases (Judge0) → sees pass/fail → submission recorded → points added to leaderboard.

**Flow 3 — Completion & certificate** Student completes all modules in a course → system auto-generates certificate PDF with unique ID → student can share link → anyone (e.g. a recruiter) can visit `/verify/:certId` and see it's genuine.

**Flow 4 — Admin oversight** Admin logs in → dashboard shows: total students, active this week, completion funnel per course, drop-off points → can issue/revoke certificates manually if needed.

## 6. Success Metrics (MVP)

- 150+ of your 200-student target actively enrolled within first month of launch
- 1k–2k concurrent user capacity holds under load-testing (see System Design doc)
- At least 30% of enrolled students reach certificate completion (industry LMS completion rates are often much lower — this would already be a strong number)
- Zero critical downtime during the November launch window

## 7. Scope Cut Line (what "MVP done" means)

MVP = all **Must Have** features from the Feature List doc, deployed, dockerized, and load-tested for 1-2k concurrent users. "Should Have" and "Could Have" items are explicitly post-launch iteration, not launch blockers.

## 8. Timeline

- **Days 1–5:** Finalize PRD/architecture (this phase), DB schema design, project scaffolding, CI setup
- **Days 6–30:** Core build — auth, syllabus, progress tracking, quizzes, leaderboard, certificates
- **Days 31–40:** Should-have features (code execution, streaks) if on schedule; otherwise polish + hardening
- **Days 41–47:** Testing — load testing (target 1-2k concurrent), bug fixes, security pass
- **Days 48–50:** Launch buffer before November internship season