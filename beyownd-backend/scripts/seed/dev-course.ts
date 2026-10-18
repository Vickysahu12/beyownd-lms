// scripts/seed/dev-course.ts
//
// Dev database mein ek sample course daalta hai - frontend banate waqt
// dikhane ke liye kuch real-jaisa data chahiye, aur admin panel (content
// banane wala) Phase 5 mein aayega.
//
// Kya banata hai:
//   Course "Full Stack Web Development" (published, slug: full-stack-web-dev)
//   3 modules (module 1 = free preview), 7 lessons (ek YouTube video lesson)
//   1 batch FSWD-DEV (already started, ₹599, enrollment open)
//
// IDEMPOTENT: dobara chalao to duplicate nahi banta - har cheez apni natural
// key se upsert hoti hai (course slug, module order, lesson order, cohort code).
//
// --enroll <email>: us user ka ACTIVE enrollment bana deta hai (payment
// Phase 3 mein aayega - tab tak frontend pe learning flow test karne ke liye).
//
// Run:
//   npm run seed:dev
//   npm run seed:dev -- --enroll you@example.com
//
// Production mein chalane se mana karta hai.

import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

import Course from '../../src/models/course.model';
import Module from '../../src/models/module.model';
import Lesson from '../../src/models/lesson.model';
import Cohort from '../../src/models/cohort.model';
import Enrollment from '../../src/models/enrollment.model';
import User from '../../src/models/user.model';
import { invalidateCourseCache } from '../../src/services/catalog.service';

const DAY = 24 * 60 * 60 * 1000;
const SLUG = 'full-stack-web-dev';
const COHORT_CODE = 'FSWD-DEV';

const CONTENT = [
  {
    title: 'Web Foundations',
    description: 'How the web works, HTML and CSS.',
    isFreePreview: true,
    lessons: [
      { title: 'How the web works', minutes: 12, content: '# How the web works\n\nWhen you open a website, your browser sends an **HTTP request** to a server...\n\n```text\nBrowser ──request──► Server\nBrowser ◄─response── Server\n```' },
      { title: 'HTML: structure of a page', minutes: 15, content: '# HTML\n\nHTML describes the *structure* of a page.\n\n```html\n<h1>Hello Beyownd</h1>\n<p>My first page</p>\n```' },
      { title: 'CSS basics (video)', minutes: 20, type: 'video' as const, videoYoutubeId: 'OEV8gMkCHXQ', content: 'Watch the video, then style your page from the previous lesson.' },
    ],
  },
  {
    title: 'JavaScript Essentials',
    description: 'Variables, functions and the DOM.',
    isFreePreview: false,
    lessons: [
      { title: 'Variables and types', minutes: 15, content: '# Variables\n\n```js\nconst name = "Ravi";\nlet score = 0;\n```' },
      { title: 'Functions', minutes: 15, content: '# Functions\n\n```js\nfunction greet(name) {\n  return `Hello ${name}`;\n}\n```' },
    ],
  },
  {
    title: 'Backend with Node.js',
    description: 'Build your first API with Express.',
    isFreePreview: false,
    lessons: [
      { title: 'Your first Express server', minutes: 20, content: '# Express\n\n```js\nconst app = express();\napp.get("/", (req, res) => res.send("Hi"));\n```' },
      { title: 'REST APIs', minutes: 20, content: '# REST\n\nGET reads, POST creates, PATCH updates, DELETE removes.' },
    ],
  },
];

export const seedDevCourse = async (enrollEmail?: string) => {
  const admin = await User.findOne({ role: 'admin' }).select({ _id: 1 });

  const course = await Course.findOneAndUpdate(
    { slug: SLUG },
    {
      $set: {
        title: 'Full Stack Web Development',
        tagline: 'Build and deploy real web apps - HTML to Node.js',
        description: 'An 8-week, project-based virtual internship. Learn the web from the ground up and ship a real project reviewed by a mentor.',
        level: 'beginner',
        skills: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'Express', 'MongoDB'],
        durationWeeks: 8,
        defaultPricePaise: 79900,
        status: 'published',
        project: {
          title: 'Job Board',
          brief: 'Build a job board where companies post jobs and students apply. Deploy it and share the live link.',
          rubric: [
            { criterion: 'Features work as described', maxScore: 10 },
            { criterion: 'Code quality and structure', maxScore: 10 },
            { criterion: 'Deployed and accessible', maxScore: 10 },
          ],
          passScorePercent: 60,
        },
      },
      $setOnInsert: { createdBy: admin?._id ?? new Types.ObjectId() },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const lessonIds: string[] = [];
  for (const [i, m] of CONTENT.entries()) {
    const module = await Module.findOneAndUpdate(
      { courseId: course._id, order: i + 1 },
      { $set: { title: m.title, description: m.description, isFreePreview: m.isFreePreview } },
      { upsert: true, new: true, runValidators: true }
    );
    for (const [j, l] of m.lessons.entries()) {
      const lesson = await Lesson.findOneAndUpdate(
        { moduleId: module._id, order: j + 1 },
        {
          $set: {
            courseId: course._id,
            title: l.title,
            type: 'type' in l ? l.type : 'text',
            videoYoutubeId: 'videoYoutubeId' in l ? l.videoYoutubeId : undefined,
            content: l.content,
            estimatedMinutes: l.minutes,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      lessonIds.push(String(lesson._id));
    }
  }

  const now = Date.now();
  const cohort = await Cohort.findOneAndUpdate(
    { code: COHORT_CODE },
    {
      $set: {
        courseId: course._id,
        name: 'Dev batch',
        startDate: new Date(now - 1 * DAY),
        endDate: new Date(now + 55 * DAY),
        enrollOpensAt: new Date(now - 7 * DAY),
        enrollClosesAt: new Date(now + 14 * DAY),
        capacity: 200,
        pricePaise: 59900,
        status: 'open',
        communityLink: 'https://chat.whatsapp.com/dev-placeholder',
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Pehle se cached purana data na dikhe
  await invalidateCourseCache({ id: String(course._id), slug: SLUG }, lessonIds);

  let enrolled: string | null = null;
  if (enrollEmail) {
    const user = await User.findOne({ email: enrollEmail.trim().toLowerCase() });
    if (!user) throw new Error(`No user with email ${enrollEmail} - sign up first`);
    await Enrollment.findOneAndUpdate(
      { userId: user._id, cohortId: cohort._id },
      { $set: { courseId: course._id, status: 'active' }, $setOnInsert: { activatedAt: new Date() } },
      { upsert: true, new: true }
    );
    enrolled = user.email;
  }

  return { courseId: String(course._id), cohortId: String(cohort._id), lessons: lessonIds.length, enrolled };
};

// CLI entry - sirf tab chalta hai jab file seedha run ho (test import pe nahi)
if (require.main === module) {
  (async () => {
    if (process.env.NODE_ENV === 'production') {
      console.error('Refusing to seed: NODE_ENV is production');
      process.exit(1);
    }
    const enrollIndex = process.argv.indexOf('--enroll');
    const enrollEmail = enrollIndex > -1 ? process.argv[enrollIndex + 1] : undefined;

    // Lazy import: redis client sirf CLI run pe banta hai
    const { redisClient } = await import('../../src/config/redis');
    await mongoose.connect(process.env.MONGO_URI as string);
    try {
      const result = await seedDevCourse(enrollEmail);
      console.log('Seeded:', result);
      console.log(`Try: GET /api/courses/${SLUG}`);
    } finally {
      await mongoose.disconnect();
      await redisClient.quit();
    }
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
