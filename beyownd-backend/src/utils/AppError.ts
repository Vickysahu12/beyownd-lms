// src/utils/AppError.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Services jab "expected" error throw karti hai (galat password, email
// already registered, module locked), unhe sahi HTTP status ke saath
// client tak jaana chahiye - 500 ke saath nahi. Plain `new Error()` mein
// status code nahi hota, isliye har aisa error AppError hoga.
//
// Rule: AppError = user ki galti / expected case (4xx, message safe to show).
// Koi aur error = bug / infra issue (500, message client ko NAHI dikhate).
// ────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  // Machine-readable code - frontend message text pe depend na kare,
  // code pe kare (e.g. 'EMAIL_NOT_VERIFIED' → OTP screen pe bhejo).
  public readonly code: string;
  // Extra machine-readable info, e.g. { retryAfterSeconds: 42 } - response
  // mein `details` key ke andar jaata hai
  public readonly details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(400, message, code);
  }

  static unauthorized(message = 'Not authenticated', code = 'UNAUTHORIZED') {
    return new AppError(401, message, code);
  }

  static forbidden(message = 'Access denied', code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(404, message, code);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, message, code);
  }

  static tooMany(message: string, code = 'TOO_MANY_REQUESTS', details?: Record<string, unknown>) {
    return new AppError(429, message, code, details);
  }
}
