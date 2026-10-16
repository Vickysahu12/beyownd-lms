# Beyownd — Business Model

## 1. The problem we're monetizing

In the final year, most colleges (especially tier 3 / tier 4) require students to submit an **internship certificate + internship letter** as part of their degree requirements. Students at these colleges usually:

- Don't have access to real company internships (no network, no on-campus placements for internships)
- End up with low-quality "certificate-only" internships that teach nothing and can't be verified
- Have no structured way to actually build skills during that period

## 2. What we sell

**The Beyownd Virtual Internship Program** — a fixed-duration, project-based, mentor-reviewed internship, delivered online.

| Item | Detail |
| --- | --- |
| Price | ₹599 – ₹799 per program (final price per track decided before launch) |
| What the student gets | Cohort access (structured syllabus + community), weekly tasks, a real project, mentor review, offer letter, completion certificate + completion letter |
| Verification | Every letter and certificate has a unique ID + QR code → public `/verify/:id` page anyone (college, recruiter) can check |
| Duration | Fixed per track (e.g. 4 / 6 / 8 weeks) — dates printed on the letters are the **real** cohort dates |

Free tier (funnel): anyone can sign up and preview the first module of each track for free. Paying unlocks the full program + documents.

## 3. Non-negotiable: the documents must be earned (this is what makes it a business, not a liability)

A certificate that is sold without work is a fake credential — colleges stop accepting it, and it exposes the business to legal and reputational risk. So the product enforces this in code, not just in policy:

1. **Offer letter** is issued only after payment + enrollment in a cohort with a real start date.
2. **Completion certificate + letter** are issued only when the system confirms: all modules complete, quizzes passed, final project submitted **and approved by a mentor**.
3. Every document states exactly what it is: *"Virtual Internship Program at Beyownd, [track], [start]–[end]"* — never claims on-site work or a role that didn't exist.
4. Documents are **immutable and revocable** — if a certificate is found to be obtained dishonestly, admin revokes it and the verify page shows "Revoked".
5. The verify page is public — this is the trust engine. Colleges can check it themselves, which is exactly what makes them accept it.

This is also the strongest interview point: *"the business only works if the credential is trustworthy, so trust is enforced by the system design."*

## 4. Before launch — non-code checklist (start these NOW, they take days)

These have lead times outside our control. Verify current requirements yourself / with a CA — rules change.

- [ ] **Business registration** — at least Udyam (MSME) registration; many colleges check that the internship provider is a registered entity. Consider LLP / Pvt Ltd later.
- [ ] **Razorpay account + KYC** — activation needs business details, bank account, and a live website with policy pages. Apply early.
- [ ] **Policy pages** on the site: Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, Contact Us.
- [ ] **Domain + business email** (e.g. `hello@beyownd.in`) and verify the domain in Resend so OTP / certificate emails don't land in spam.
- [ ] **Letterhead design** — logo, registered name, address, signature of an authorized signatory.
- [ ] **GST** — check with a CA whether/when registration is required for your revenue level.
- [ ] Ask 2–3 target colleges' TPO / HOD what they accept for internship submissions — design the letter format to match.

## 5. Unit economics (back-of-envelope)

| | Per student |
| --- | --- |
| Revenue | ₹599 – ₹799 |
| Razorpay fee (~2%) | ~₹12 – ₹16 |
| Infra (VPS + Atlas + email + storage at ~1000 students) | well under ₹50 |
| Mentor review time | the real cost — keep review rubric-based and fast |

At 1000 paying students → ~₹6 – 8 lakh revenue per batch cycle. Infra cost stays small; **mentor time is the scaling bottleneck**, which is why reviews are rubric-based and the admin panel makes review fast.

## 6. What changed from the original PRD

The original PRD listed payments as a non-goal. With this model, **payments + internship documents move to Must Have** and leaderboard/streaks move down. See [roadmap.md](roadmap.md).
