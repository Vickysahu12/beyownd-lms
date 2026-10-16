// src/constants/profile.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Onboarding ke saare dropdown options EK jagah. Model (DB validation) aur
// validator (request validation) dono yahi lists use karte hai - dono kabhi
// out of sync nahi honge. Option add/remove karna ho to sirf yeh file badlo.
// Frontend bhi same values bhejega (e.g. 'btech', 'passed_out').
//
// Full list + reasoning: docs/design/user-flow.md §4
// ────────────────────────────────────────────────────────────────────────

export const DEGREES = ['btech', 'be', 'bca', 'bsc', 'mca', 'msc', 'diploma', 'other'] as const;

export const CURRENT_YEARS = ['1', '2', '3', '4', 'passed_out'] as const;

export const GOALS = ['internship_certificate', 'learn_skills', 'job_prep'] as const;

export const SKILL_LEVELS = ['beginner', 'basics', 'confident'] as const;

export const HEARD_FROM = ['instagram', 'whatsapp', 'friend', 'college', 'youtube', 'linkedin', 'other'] as const;

// Tracks abhi bane nahi hai (Phase 1) - yeh "interest areas" hai jo
// decide karne mein help karenge ki pehle kaunse tracks launch karne hai
export const INTEREST_AREAS = [
  'web_dev',
  'frontend',
  'backend',
  'android',
  'data_science',
  'ai_ml',
  'cybersecurity',
  'ui_ux',
  'cloud_devops',
] as const;

// 28 states + 8 union territories. Free text ki jagah list - "MH",
// "Maharastra", "maharashtra" sab alag na ban jaye, aur admin stats sahi aaye.
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

// Name rule - signup name aur certificate name dono ke liye same.
// Koi bhi language ke letters, space, dot, apostrophe, hyphen.
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

export const MAX_INTERESTS = 5;

export type Degree = (typeof DEGREES)[number];
export type CurrentYear = (typeof CURRENT_YEARS)[number];
export type Goal = (typeof GOALS)[number];
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type HeardFrom = (typeof HEARD_FROM)[number];
export type InterestArea = (typeof INTEREST_AREAS)[number];
export type IndianState = (typeof INDIAN_STATES)[number];
