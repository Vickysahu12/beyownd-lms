# User Flow — Landing → Auth → Onboarding → Dashboard

**Status:** ✅ Decided (Oct 15, 2026). Onboarding questions can be changed later without breaking anything (fields are optional at the schema level, required by the onboarding validator).

## 1. Domains

| Domain | Runs | Responsibility |
| --- | --- | --- |
| `beyownd.in` | Landing page (static / CDN) | Marketing only. "Login" / "Get started" buttons link to `classroom.beyownd.in/login`. No auth code here. |
| `classroom.beyownd.in` | Next.js app | Login, signup, onboarding, dashboard, courses |
| `api.beyownd.in` | Express API | Everything server-side |

`classroom.` and `api.` are the **same site** (same registrable domain `beyownd.in`), so the httpOnly refresh cookie on `api.beyownd.in` works with `sameSite: 'strict'` and CORS allows exactly `https://classroom.beyownd.in` with `credentials: true`.

## 2. Flow

```
beyownd.in ──"Login / Get started"──► classroom.beyownd.in/login
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
   Sign up: name + email +      Log in: email + password        Continue with Google
   password (platform-only)                │                            │
             │                             │                            │
     OTP to email → verify                 │                            │
             └──────────────┬──────────────┴────────────────────────────┘
                            ▼
                 GET /api/users/me → onboardingCompleted?
                     │ false                       │ true
                     ▼                             ▼
          /onboarding (2 steps) ──────────► /dashboard (tracks / courses)
```

## 3. Authentication methods (decision)

| Method | Signup | Login |
| --- | --- | --- |
| **Email + password** | Name, email, password (a password just for Beyownd) → 6-digit OTP to email → account verified | Email + password |
| **Google** | One click — Google already verified the email | One click |
| **Forgot password** | — | Email → OTP → new password |

### Account-linking rules (one account per email, always)

| Situation | What happens | Why |
| --- | --- | --- |
| Email signup, email already verified | "Already registered — log in" (if the account is Google-only: "Use Google, or set a password via Forgot password") | No duplicate accounts |
| Email signup, email exists but **unverified** | Overwrite password, send a fresh OTP | The earlier signup never proved inbox ownership, so nothing is lost |
| Google login, email exists (local account) | Link `googleId`, mark verified. **If it was unverified, clear its password.** | Prevents takeover: someone could pre-register a victim's email with their own password; once the real owner verifies via Google, that password must not work |
| Email login on a Google-only account | "This account uses Google sign-in. Use Google or Forgot password to set a password." | Clear guidance, no dead end |
| Forgot password, email not found | Same success message as when found | Prevents email enumeration |
| Password reset succeeds | All refresh tokens for the user revoked | Logs out any attacker sessions |

Model change: `authProvider: 'local' | 'google'` (single value) is replaced by `authProviders: ('local' | 'google')[]`, because one account can now have both.

OTPs are scoped by purpose: `otp:verify:<email>` and `otp:reset:<email>` — a signup OTP can never be used to reset a password.

## 4. Onboarding

Shown once, right after the first successful login (any method). Two short steps, mobile-first, < 60 seconds.

**Step 1 — About you**

| Field | Type | Notes |
| --- | --- | --- |
| `certificateName` | string, 2–60 | "Name as it should appear on your certificate". Prefilled from Google/signup name. **Locked once any credential is issued.** |
| `phone` | string | WhatsApp number, Indian mobile format |
| `college` | string | Autocomplete from colleges other students entered (cached in Redis), free text allowed |
| `degree` | enum + other | B.Tech, BE, BCA, BSc, MCA, MSc, Diploma, Other |
| `branch` | string | e.g. CSE, IT, ECE |
| `currentYear` | enum | 1, 2, 3, 4, passed_out |
| `graduationYear` | number | 2024–2032 |
| `city`, `state` | string | |

**Step 2 — Your goal**

| Field | Type | Notes |
| --- | --- | --- |
| `goal` | enum | internship_certificate, learn_skills, job_prep |
| `certificateNeededBy` | month (YYYY-MM), optional | When the college needs the certificate — used for cohort planning |
| `interestedTracks` | string[] | e.g. web_dev |
| `skillLevel` | enum | beginner, basics, confident |
| `heardFrom` | enum + other | instagram, whatsapp, friend, college, youtube, other |
| `referralCode` | string, optional | |

### Storage

Embedded `profile` sub-document on `User` + `onboardingCompleted: boolean` (default `false`). One document per user → `/me` is a single indexed read, no join. Index on `profile.college` for admin stats.

### Enforcement

- Frontend redirects to `/onboarding` when `onboardingCompleted` is false.
- **Backend** middleware `requireOnboarding` blocks enroll + payment routes until it's true — the redirect alone can be bypassed by calling the API directly.

## 5. Endpoints added by this flow

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/forgot-password` | public, rate-limited | Send reset OTP |
| POST | `/api/auth/reset-password` | public, rate-limited | OTP + new password |
| GET | `/api/users/me` | protect | User + `onboardingCompleted` |
| PUT | `/api/users/me/onboarding` | protect | Save onboarding (validated) |
| PATCH | `/api/users/me/profile` | protect | Update profile later (`certificateName` locked after issue) |
| GET | `/api/colleges?q=` | protect | College autocomplete (Redis-cached) |
