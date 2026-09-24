// src/validators/auth.validator.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Yahan har auth request ki FORMAT validation hoti hai - field required
// hai ya nahi, sahi type ka hai ya nahi, sahi pattern follow karta hai ya
// nahi. Yeh sirf "shape" check karta hai - "email@example.com jaisa
// dikhta hai" - yeh CHECK NAHI karta ki woh email database mein already
// registered hai ya nahi, kyunki uske liye database call chahiye, jo
// service layer ka kaam hai, validator ka nahi. Yeh separation jaanbujh
// ke hai - validator fast aur database-independent rehta hai.
// ────────────────────────────────────────────────────────────────────────

import { body } from 'express-validator';

export const signupValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required').bail()
    .isLength({ min: 5, max: 20 }).withMessage('Name must be 5-20 characters').bail()
    .escape(), // XSS protection - HTML characters ko encode kar deta hai
               // (<script> jaisa kuch daala to woh harmless text ban jayega)

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required').bail()
    .isEmail().withMessage('Invalid email format').bail()
    .normalizeEmail(), // "John+test@Gmail.com" ko "johntest@gmail.com" jaisa
                        // consistent format mein convert karta hai - isse
                        // duplicate accounts alag-alag casing se nahi banenge

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
];

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
    // Login mein password ki STRENGTH dobara check nahi karte - sirf
    // "present hai ya nahi". Strength sirf SIGNUP time pe matter karti
    // hai jab password set ho raha hai.
];

export const verifyOtpValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
];

export const resendOtpValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];