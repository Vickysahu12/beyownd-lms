// src/services/college.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// College autocomplete + "student ne naya college type kiya to bana do".
//
// NORMALIZE: "Govt. College of Engg., Pune" → "govt college of engg pune"
// (lowercase, punctuation hatao, extra spaces hatao). Isse same college
// alag-alag formatting se duplicate nahi banta.
//
// SEARCH: query ke har word ko college ke kisi word ka PREFIX hona chahiye
// → "pune eng" milega "Government College of Engineering Pune" se.
// Pehla word `words` index use karta hai, isliye 1000s colleges pe bhi fast.
//
// CACHE: same query (e.g. "govt") bahut students type karenge - result
// Redis mein 5 min ke liye. Naya college max 5 min baad suggestions mein
// aata hai - autocomplete ke liye bilkul theek.
// ────────────────────────────────────────────────────────────────────────

import College, { ICollege } from '../models/college.model';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

const SEARCH_CACHE_TTL_SECONDS = 300;
const SEARCH_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

export interface CollegeSuggestion {
  id: string;
  name: string;
  studentCount: number;
}

export const normalizeCollegeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation → space ("engg." → "engg")
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Onboarding/profile update pe call hota hai. Atomic upsert - do students
// ek saath same naya college daalein to bhi ek hi document banega.
export const findOrCreateCollege = async (rawName: string): Promise<ICollege> => {
  const name = rawName.replace(/\s+/g, ' ').trim();
  const normalizedName = normalizeCollegeName(name);
  const words = normalizedName.split(' ');

  const upsert = () =>
    College.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name, normalizedName, words } },
      { upsert: true, new: true }
    );

  try {
    return (await upsert())!;
  } catch (err: any) {
    // Do parallel upserts dono "nahi mila" dekh ke insert karein to ek
    // unique index pe fail hota hai - retry mein woh existing doc mil jaata hai
    if (err?.code === 11000) return (await upsert())!;
    throw err;
  }
};

// Student count +1 / -1 (college badla to purane ka -1). Approximate stat
// hai, isliye user update ke saath transaction mein nahi bandha.
export const adjustStudentCount = async (collegeId: string, delta: 1 | -1): Promise<void> => {
  await College.updateOne(
    delta < 0 ? { _id: collegeId, studentCount: { $gt: 0 } } : { _id: collegeId },
    { $inc: { studentCount: delta } }
  );
};

export const searchColleges = async (query: string): Promise<CollegeSuggestion[]> => {
  const normalized = normalizeCollegeName(query);
  if (normalized.length < MIN_QUERY_LENGTH) return [];

  const cacheKey = `colleges:search:${normalized}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as CollegeSuggestion[];
  } catch (err) {
    // Cache down ho to bhi search chalni chahiye - seedha DB se
    logger.warn({ err }, 'College search cache read failed');
  }

  const queryWords = normalized.split(' ').slice(0, 5);
  const docs = await College.find({
    $and: queryWords.map((w) => ({ words: { $regex: `^${escapeRegex(w)}` } })),
  })
    .sort({ studentCount: -1, name: 1 })
    .limit(SEARCH_LIMIT)
    .select({ name: 1, studentCount: 1 })
    .lean();

  const results = docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    studentCount: d.studentCount,
  }));

  try {
    await redisClient.set(cacheKey, JSON.stringify(results), 'EX', SEARCH_CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'College search cache write failed');
  }

  return results;
};
