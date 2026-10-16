// src/validators/auth.validator.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Har auth request ki FORMAT validation - field hai ya nahi, sahi type,
// sahi pattern. Database check (email registered hai ya nahi) yahan NAHI
// hota - woh service ka kaam hai. Validator fast aur DB-independent rehta hai.
//
// Do jaanbujh ke kiye gaye decisions:
// 1. Name pe .escape() NAHI - "O'Brien" DB mein "O&#x27;Brien" ban jaata
//    aur wahi certificate pe chhapta. XSS se bachav OUTPUT pe hota hai
//    (React khud escape karta hai), input data ko kharab karke nahi.
// 2. Email pe normalizeEmail() NAHI - woh Gmail ke dots hata deta hai
//    (john.doe@gmail.com → johndoe@gmail.com). Phir Google login ka email
//    (dots ke saath) match nahi hota aur ek hi insaan ke DO accounts ban
//    jaate. Sirf trim + lowercase.
// ────────────────────────────────────────────────────────────────────────

import { body } from 'express-validator';

const emailRule = () =>
  body('email')
    .isString().withMessage('Email is required').bail()
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Email is required').bail()
    .isLength({ max: 254 }).withMessage('Email is too long').bail()
    .isEmail().withMessage('Invalid email format');

// bcrypt sirf pehle 72 bytes dekhta hai - 64 chars max taaki lamba password
// chupchap truncate na ho
const newPasswordRule = (field = 'password') =>
  body(field)
    .isString().withMessage('Password is required').bail()
    .isLength({ min: 8, max: 64 }).withMessage('Password must be 8-64 characters').bail()
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character');

const otpRule = () =>
  body('otp')
    .isString().withMessage('OTP is required').bail()
    .trim()
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits').bail()
    .isNumeric().withMessage('OTP must contain only numbers');

export const signupValidator = [
  body('name')
    .isString().withMessage('Name is required').bail()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters').bail()
    // Letters (koi bhi language), space, dot, apostrophe, hyphen
    .matches(/^[\p{L}\p{M} .'-]+$/u).withMessage('Name can only contain letters, spaces, . \' -'),
  emailRule(),
  newPasswordRule(),
];

export const loginValidator = [
  emailRule(),
  // Login pe password STRENGTH check nahi - sirf present hai ya nahi
  body('password')
    .isString().withMessage('Password is required').bail()
    .isLength({ min: 1, max: 128 }).withMessage('Password is required'),
];

export const verifyOtpValidator = [emailRule(), otpRule()];

export const emailOnlyValidator = [emailRule()];

export const resetPasswordValidator = [emailRule(), otpRule(), newPasswordRule()];

export const googleLoginValidator = [
  body('idToken')
    .isString().withMessage('Google token is required').bail()
    .isLength({ min: 20, max: 4096 }).withMessage('Invalid Google token'),
];
