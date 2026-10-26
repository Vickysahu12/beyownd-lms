// scripts/content/import-course.ts
//
// Ek course folder (course.json + Markdown files) ko database mein load karta hai.
// Format guide: docs/content/COURSE_FORMAT.md · Example: docs/content/example-course/
//
// Run (beyownd-backend folder se):
//   npm run import:course -- ../docs/content/example-course/course.json --dry-run
//   npm run import:course -- ../docs/content/example-course/course.json
//   npm run import:course -- path/to/course.json --publish
//
//   --dry-run  sirf check karo, kuch likho mat (pehle hamesha yahi chalao)
//   --publish  import ke baad course ko website pe live kar do
//
// Kahan likhta hai: .env ka MONGO_URI (dev ya production - dhyan se!).

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const main = async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run import:course -- <path/to/course.json> [--dry-run] [--publish]');
    process.exit(1);
  }
  const dryRun = args.includes('--dry-run');
  const publish = args.includes('--publish');

  const jsonPath = path.resolve(file);
  let def: unknown;
  try {
    def = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${jsonPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  // Lazy imports: env validation + Redis client sirf yahan
  const { importCourse, formatIssue } = await import('../../src/services/admin/courseImport.service');
  const { redisClient } = await import('../../src/config/redis');
  const { default: User } = await import('../../src/models/user.model');

  const host = (process.env.MONGO_URI ?? '').replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`${dryRun ? '[dry run] ' : ''}Importing ${jsonPath}\n  into ${host}`);

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const admin = await User.findOne({ role: 'admin' }).select({ _id: 1 });
    const result = await importCourse(def as never, path.dirname(jsonPath), { dryRun, publish, createdBy: admin?._id as never });
    const { warnings, ...counts } = result;
    if (warnings.length) {
      console.log(`\n⚠ ${warnings.length} warning(s) - the course works, but worth fixing:`);
      for (const w of warnings) console.log(`  - ${formatIssue(w)}`);
    }
    console.log(dryRun ? '\nValid ✓ - nothing was written. Run again without --dry-run to import.' : '\nImported ✓');
    console.table(counts);
  } catch (err) {
    // Lesson format problems come as a full list (file + line each)
    const errors = (err as { details?: { errors?: string[] } }).details?.errors;
    if (errors?.length) {
      console.error(`\n✗ ${errors.length} problem(s) - nothing was imported. Fix these and run again:`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.error(`\n✗ ${(err as Error).message}`);
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    await redisClient.quit();
  }
};

void main();
