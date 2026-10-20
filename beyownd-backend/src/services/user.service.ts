// src/services/user.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Logged-in user ka apna data: /me, onboarding complete karna, profile
// update karna. Auth (login/signup) auth.service.ts mein hai - yeh file
// "user kaun hai aur uske baare mein kya pata hai" sambhalti hai.
//
// Rules:
// - Onboarding sirf EK baar (PUT). Dobara → 409, baad ke changes PATCH se.
// - certificateName lock ho jaata hai pehla certificate/letter issue hote hi
//   (Phase 3 certificate service `certificateNameLockedAt` set karegi).
//   Uske baad naam badla to certificate pe aur profile pe alag naam - isliye block.
// - College naam se → College document (find or create), user pe collegeId
//   + collegeName dono store (naam denormalized, /me pe join nahi chahiye).
// ────────────────────────────────────────────────────────────────────────

import User, { IProfile, IUser } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { toPublicUser, PublicUser } from './auth.service';
import { findOrCreateCollege, adjustStudentCount } from './college.service';

// Request se aane wale fields - `college` naam hai, DB mein collegeId + collegeName
export type ProfileInput = Omit<IProfile, 'collegeId' | 'collegeName' | 'certificateNameLockedAt'> & {
  college: string;
};

// Response mein sirf yeh fields - explicit list, taaki model mein koi
// internal field add ho to woh galti se client tak na pahunche
export interface ProfileResponse {
  certificateName: string;
  certificateNameLocked: boolean;
  phone: string;
  collegeId: string;
  collegeName: string;
  degree: IProfile['degree'];
  degreeOther: string | null;
  branch: string;
  currentYear: IProfile['currentYear'];
  graduationYear: number;
  city: string;
  state: IProfile['state'];
  goal: IProfile['goal'];
  certificateNeededBy: string | null;
  interestedTracks: IProfile['interestedTracks'];
  skillLevel: IProfile['skillLevel'];
  heardFrom: IProfile['heardFrom'];
  heardFromOther: string | null;
  referralCode: string | null;
}

export interface MeResponse extends PublicUser {
  profile: ProfileResponse | null;
}

const toProfileResponse = (p: IProfile): ProfileResponse => ({
  certificateName: p.certificateName,
  certificateNameLocked: Boolean(p.certificateNameLockedAt),
  phone: p.phone,
  collegeId: String(p.collegeId),
  collegeName: p.collegeName,
  degree: p.degree,
  degreeOther: p.degreeOther ?? null,
  branch: p.branch,
  currentYear: p.currentYear,
  graduationYear: p.graduationYear,
  city: p.city,
  state: p.state,
  goal: p.goal,
  certificateNeededBy: p.certificateNeededBy ?? null,
  interestedTracks: [...p.interestedTracks],
  skillLevel: p.skillLevel,
  heardFrom: p.heardFrom,
  heardFromOther: p.heardFromOther ?? null,
  referralCode: p.referralCode ?? null,
});

const toMe = (user: IUser): MeResponse => ({
  ...toPublicUser(user),
  profile: user.profile ? toProfileResponse(user.profile) : null,
});

const findUserOrThrow = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  // Token valid tha lekin user delete ho gaya (≤15 min window, see protect)
  if (!user) throw AppError.unauthorized('Account not found', 'ACCOUNT_NOT_FOUND');
  return user;
};

export const getMe = async (userId: string): Promise<MeResponse> => toMe(await findUserOrThrow(userId));

export const completeOnboarding = async (userId: string, input: ProfileInput): Promise<MeResponse> => {
  const user = await findUserOrThrow(userId);
  if (user.onboardingCompleted) {
    throw AppError.conflict('Onboarding already completed. Use profile update instead.', 'ALREADY_ONBOARDED');
  }

  const { college: collegeName, ...rest } = input;
  const college = await findOrCreateCollege(collegeName);

  user.profile = { ...rest, collegeId: college._id, collegeName: college.name };
  user.onboardingCompleted = true;
  user.onboardedAt = new Date();
  await user.save();

  await adjustStudentCount(String(college._id), 1);
  return toMe(user);
};

export const updateProfile = async (userId: string, input: Partial<ProfileInput>): Promise<MeResponse> => {
  const user = await findUserOrThrow(userId);
  if (!user.onboardingCompleted || !user.profile) {
    throw AppError.badRequest('Complete onboarding first', 'ONBOARDING_REQUIRED');
  }

  const { college: newCollegeName, ...rest } = input;

  if (
    rest.certificateName !== undefined &&
    rest.certificateName !== user.profile.certificateName &&
    user.profile.certificateNameLockedAt
  ) {
    throw AppError.forbidden(
      'Certificate name cannot be changed after a certificate has been issued',
      'CERTIFICATE_NAME_LOCKED'
    );
  }

  let collegeChange: { from: string; to: string } | null = null;
  if (newCollegeName !== undefined) {
    const college = await findOrCreateCollege(newCollegeName);
    const previousId = String(user.profile.collegeId);
    if (String(college._id) !== previousId) {
      user.profile.collegeId = college._id;
      user.profile.collegeName = college.name;
      collegeChange = { from: previousId, to: String(college._id) };
    }
  }

  // Sirf bheje gaye fields update - baaki profile jaisa tha waisa
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) (user.profile as any)[key] = value;
  }
  // Profile "Other" chhod ke kuch aur chuna to purana "other" text hata do
  if (rest.degree && rest.degree !== 'other') user.profile.degreeOther = undefined;
  if (rest.heardFrom && rest.heardFrom !== 'other') user.profile.heardFromOther = undefined;

  await user.save();

  if (collegeChange) {
    await adjustStudentCount(collegeChange.from, -1);
    await adjustStudentCount(collegeChange.to, 1);
  }
  return toMe(user);
};

// requireOnboarding middleware ke liye - sirf ek boolean field padhta hai
export const isOnboarded = async (userId: string): Promise<boolean> => {
  const doc = await User.findById(userId).select({ onboardingCompleted: 1 }).lean();
  return doc?.onboardingCompleted === true;
};
