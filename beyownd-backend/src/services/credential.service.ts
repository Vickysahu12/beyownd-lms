// src/services/credential.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Documents (offer letter, certificate, completion letter) ka lifecycle:
//   issue → (worker PDF banata hai) → issued → [revoke]
// Plus: "mere documents", download link, aur PUBLIC verify.
//
// issueCredential() IDEMPOTENT hai: same enrollment + type ke liye dobara
// call ho to naya nahi banta, existing return hota hai. Unique index
// { enrollmentId, type } race mein bhi duplicate rokta hai.
//
// SNAPSHOT: issue ke waqt naam, college, course, batch dates aur issuer
// (GrewDo) copy hote hai. Pehla document issue hote hi student ka
// certificate name LOCK (profile.certificateNameLockedAt).
//
// VERIFY public hai - email/phone kabhi nahi. Revoked document bhi verify
// hota hai lekin "revoked" status ke saath - taaki koi revoked certificate
// ko asli bata ke na chala sake. Redis mein cached, status badalte hi invalidate.
// ────────────────────────────────────────────────────────────────────────

import { isValidObjectId, Types } from 'mongoose';
import Credential, { ICredential, CredentialType } from '../models/credential.model';
import Enrollment from '../models/enrollment.model';
import User from '../models/user.model';
import Course from '../models/course.model';
import Cohort from '../models/cohort.model';
import { issuer } from '../config/issuer';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { getOrSet, invalidate } from '../utils/cache';
import { generateCredentialId, normalizeCredentialId } from '../utils/credentialId.util';
import { createDownloadUrl } from '../utils/storage.util';
import { enqueuePdf } from '../jobs/queue';

const VERIFY_TTL = 600;
export const verifyCacheKey = (credentialId: string) => `cache:verify:${credentialId}`;

const ISSUABLE_STATUSES = ['active', 'completed'];

export const issueCredential = async (enrollmentId: string | Types.ObjectId, type: CredentialType): Promise<ICredential> => {
  const existing = await Credential.findOne({ enrollmentId, type });
  if (existing) return existing;

  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment || !ISSUABLE_STATUSES.includes(enrollment.status)) {
    throw AppError.conflict('Enrollment is not active', 'ENROLLMENT_NOT_ACTIVE');
  }
  const [user, course, cohort] = await Promise.all([
    User.findById(enrollment.userId).select({ name: 1, profile: 1 }),
    Course.findById(enrollment.courseId).select({ title: 1, skills: 1 }),
    Cohort.findById(enrollment.cohortId).select({ name: 1, code: 1, startDate: 1, endDate: 1 }),
  ]);
  if (!user || !course || !cohort) throw new Error(`Missing data for enrollment ${enrollmentId}`);

  const weeks = Math.max(1, Math.round((cohort.endDate.getTime() - cohort.startDate.getTime()) / (7 * 24 * 3600 * 1000)));
  const snapshot = {
    studentName: user.profile?.certificateName ?? user.name,
    collegeName: user.profile?.collegeName ?? '',
    courseTitle: course.title,
    skills: [...course.skills],
    cohortName: cohort.name,
    cohortCode: cohort.code,
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    durationWeeks: weeks,
    issuedAt: new Date(),
    issuer: { ...issuer },
  };

  let credential: ICredential | null = null;
  for (let attempt = 0; attempt < 3 && !credential; attempt++) {
    try {
      credential = await Credential.create({
        credentialId: generateCredentialId(),
        type,
        userId: enrollment.userId,
        enrollmentId: enrollment._id,
        courseId: enrollment.courseId,
        cohortId: enrollment.cohortId,
        snapshot,
      });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      // Kisi aur request ne same enrollment+type abhi bana diya → wahi lo
      if (err.keyPattern?.enrollmentId) return (await Credential.findOne({ enrollmentId, type }))!;
      // Warna random ID collide hua (practically never) → naya ID try
    }
  }
  if (!credential) throw new Error('Could not generate a unique credential ID');

  // Pehla document issue → naam lock (sirf pehli baar set)
  await User.updateOne(
    { _id: enrollment.userId, profile: { $exists: true }, 'profile.certificateNameLockedAt': { $exists: false } },
    { $set: { 'profile.certificateNameLockedAt': new Date() } }
  );

  try {
    await enqueuePdf(credential.credentialId);
  } catch (err) {
    // Redis down - record 'generating' rehta hai; worker startup pe pending
    // credentials dobara queue karta hai (src/worker.ts recovery)
    logger.error({ err, credentialId: credential.credentialId }, 'Could not enqueue PDF job');
  }
  logger.info({ credentialId: credential.credentialId, type }, 'Credential issued');
  return credential;
};

export const revokeForEnrollment = async (enrollmentId: Types.ObjectId | string, reason: string, revokedBy?: string) => {
  const credentials = await Credential.find({ enrollmentId, status: { $ne: 'revoked' } }).select({ credentialId: 1 });
  if (credentials.length === 0) return 0;
  await Credential.updateMany(
    { enrollmentId, status: { $ne: 'revoked' } },
    { $set: { status: 'revoked', revokedAt: new Date(), revokedReason: reason, ...(revokedBy ? { revokedBy } : {}) } }
  );
  await invalidate(...credentials.map((c) => verifyCacheKey(c.credentialId)));
  return credentials.length;
};

// ---- Student: my documents ----

const TYPE_LABELS: Record<CredentialType, string> = {
  offer_letter: 'Offer letter',
  completion_certificate: 'Completion certificate',
  completion_letter: 'Completion letter',
};

export const listMyCredentials = async (userId: string) => {
  const credentials = await Credential.find({ userId }).sort({ createdAt: -1 }).limit(50);
  return credentials.map((c) => ({
    credentialId: c.credentialId,
    type: c.type,
    label: TYPE_LABELS[c.type],
    status: c.status,
    courseTitle: c.snapshot.courseTitle,
    cohortName: c.snapshot.cohortName,
    issuedAt: c.snapshot.issuedAt,
    revokedAt: c.revokedAt ?? null,
  }));
};

export const getDownloadLink = async (userId: string, rawId: string) => {
  const credentialId = normalizeCredentialId(rawId);
  if (!credentialId || !isValidObjectId(userId)) throw AppError.notFound('Document not found', 'CREDENTIAL_NOT_FOUND');
  const credential = await Credential.findOne({ credentialId, userId });
  if (!credential) throw AppError.notFound('Document not found', 'CREDENTIAL_NOT_FOUND');
  if (credential.status === 'revoked') throw AppError.forbidden('This document has been revoked', 'CREDENTIAL_REVOKED');
  if (credential.status !== 'issued' || !credential.pdfKey) {
    throw AppError.conflict('Your document is still being prepared. Please check again in a minute.', 'CREDENTIAL_NOT_READY');
  }
  return createDownloadUrl(credential.pdfKey);
};

// ---- Public verify ----

export interface VerifyResult {
  valid: boolean;
  status: 'issued' | 'revoked' | 'generating';
  credentialId: string;
  type: CredentialType;
  label: string;
  studentName: string;
  collegeName: string;
  courseTitle: string;
  skills: string[];
  cohortName: string;
  startDate: Date;
  endDate: Date;
  issuedAt: Date;
  issuedBy: string;
  programName: string;
  revokedAt: Date | null;
}

export const verifyCredential = async (rawId: string): Promise<VerifyResult> => {
  const credentialId = normalizeCredentialId(rawId);
  if (!credentialId) throw AppError.notFound('No document found with this ID', 'CREDENTIAL_NOT_FOUND');

  const result = await getOrSet<VerifyResult | null>(verifyCacheKey(credentialId), VERIFY_TTL, async () => {
    const c = await Credential.findOne({ credentialId });
    if (!c) return null;
    // Sirf public-safe fields - email, phone, userId kabhi nahi
    return {
      valid: c.status === 'issued',
      status: c.status,
      credentialId: c.credentialId,
      type: c.type,
      label: TYPE_LABELS[c.type],
      studentName: c.snapshot.studentName,
      collegeName: c.snapshot.collegeName,
      courseTitle: c.snapshot.courseTitle,
      skills: c.snapshot.skills,
      cohortName: c.snapshot.cohortName,
      startDate: c.snapshot.startDate,
      endDate: c.snapshot.endDate,
      issuedAt: c.snapshot.issuedAt,
      issuedBy: c.snapshot.issuer.legalName,
      programName: c.snapshot.issuer.programName,
      revokedAt: c.revokedAt ?? null,
    };
  });
  if (!result) throw AppError.notFound('No document found with this ID', 'CREDENTIAL_NOT_FOUND');
  return result;
};
