// tests/richLessons.test.ts
// Rich lessons end to end: asset upload + safe serving, admin save/check,
// what students receive, the practice-quiz answer-leak guard, and course
// import with an assets/ folder.

import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import app from '../src/app';
import Lesson from '../src/models/lesson.model';
import { importCourse, CourseDef } from '../src/services/admin/courseImport.service';
import { assetExists } from '../src/utils/assetStore.util';
import { createCourse, createStudent, createQuiz } from './helpers/fixtures';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const WIDGET = Buffer.from('<!doctype html><html><body><div id="n">0</div><script>let n=0;setInterval(()=>{document.getElementById("n").textContent=++n},500)</script></body></html>');

let admin: Awaited<ReturnType<typeof createStudent>>;
beforeEach(async () => {
  admin = await createStudent('admin');
});

const upload = (filename: string, bytes: Buffer, contentType = 'application/octet-stream') =>
  request(app).post(`/api/admin/assets?filename=${encodeURIComponent(filename)}`).set(admin.auth).set('Content-Type', contentType).send(bytes);

const QUIZ_BLOCK = ':::quiz\nWhich command writes a key?\n- [ ] GET\n- [x] SET\n> SET writes.\n:::';

// ─────────────────────────────────────────────────────────────────────────
describe('Asset upload', () => {
  it('stores a real image and returns a reference; same bytes → same name', async () => {
    const first = await upload('Flow Diagram.PNG', PNG, 'image/png').expect(201);
    expect(first.body.asset).toMatchObject({ kind: 'image', bytes: PNG.length });
    expect(first.body.asset.ref).toMatch(/^beyownd-asset:[a-f0-9]{16}\.png$/);
    expect(first.body.asset.url).toBe(`http://localhost:5000/api/assets/${first.body.asset.name}`);
    const again = await upload('other-name.png', PNG).expect(201);
    expect(again.body.asset.name).toBe(first.body.asset.name);
    expect(await assetExists(first.body.asset.name)).toBe(true);
  });

  it('rejects files that lie about their type, unsafe SVGs and widgets that load from the internet', async () => {
    const reject = async (name: string, bytes: Buffer, text: string) => {
      const res = await upload(name, bytes).expect(400);
      expect(res.body.code).toBe('ASSET_INVALID');
      expect(res.body.message).toContain(text);
    };
    await reject('x.png', WIDGET, 'not really a PNG');
    await reject('x.jpg', PNG, 'not really a JPEG');
    await reject('x.exe', PNG, 'allowed:');
    await reject('noext', PNG, 'allowed:');
    await reject('x.svg', Buffer.from('<svg><script>alert(1)</script></svg>'), '<script>');
    await reject('x.svg', Buffer.from('<svg onload="alert(1)"></svg>'), 'event handlers');
    await reject('x.svg', Buffer.from('<svg><image href="https://evil.com/a.png"/></svg>'), 'external');
    await reject('x.svg', Buffer.from('<!DOCTYPE x [<!ENTITY a "b">]><svg></svg>'), 'ENTITY');
    await reject('x.svg', Buffer.from('just text'), 'not really an SVG');
    await reject('w.html', Buffer.from('<html><script src="https://cdn.x.com/a.js"></script></html>'), 'self-contained');
    await reject('w.html', Buffer.from('<html><link rel="stylesheet" href="//cdn.x.com/a.css"></html>'), 'self-contained');
    await reject('w.html', Buffer.from('<style>@import url("https://fonts.x/a.css");</style><div></div>'), 'inline it');
    await reject('w.html', Buffer.from([0xff, 0xfe, 0x00, 0x3c]), 'UTF-8');
    await reject('w.html', Buffer.alloc(301 * 1024, 'a'), 'max 300 KB');
  });

  it('needs a file name and raw bytes; admins only; 2 MB cap', async () => {
    await request(app).post('/api/admin/assets').set(admin.auth).set('Content-Type', 'image/png').send(PNG).expect(400);
    const json = await request(app).post('/api/admin/assets?filename=a.png').set(admin.auth).send({ file: 'abc' }).expect(400);
    expect(json.body.message).toContain('file bytes');
    await request(app).post('/api/admin/assets?filename=a.png').set(admin.auth).set('Content-Type', 'image/png').send(Buffer.alloc(0)).expect(400);
    const student = await createStudent();
    await request(app).post('/api/admin/assets?filename=a.png').set(student.auth).set('Content-Type', 'image/png').send(PNG).expect(403);
    await request(app).post('/api/admin/assets?filename=a.png').set('Content-Type', 'image/png').send(PNG).expect(401);
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 2048)]);
    expect((await upload('big.png', big, 'image/png').expect(413)).body.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Asset serving', () => {
  it('serves images publicly with long caching, cross-origin allowed, and 304 on revalidation', async () => {
    const { name } = (await upload('a.png', PNG).expect(201)).body.asset;
    const res = await request(app).get(`/api/assets/${name}`).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
    await request(app).get(`/api/assets/${name}`).set('If-None-Match', res.headers.etag).expect(304);
  });

  it('serves widgets sandboxed: no cookies/API access, no network, embeddable only by our frontend', async () => {
    const { name } = (await upload('sim.html', WIDGET).expect(201)).body.asset;
    const res = await request(app).get(`/api/assets/${name}`).expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain('sandbox allow-scripts');
    expect(csp).not.toContain('allow-same-origin');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain('frame-ancestors http://localhost:3000');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('SVGs are sandboxed without scripts', async () => {
    const { name } = (await upload('d.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')).expect(201)).body.asset;
    const res = await request(app).get(`/api/assets/${name}`).expect(200);
    expect(res.headers['content-security-policy']).toMatch(/^sandbox;/);
  });

  it('404 for unknown or malformed names (no path tricks)', async () => {
    await request(app).get('/api/assets/0123456789abcdef.png').expect(404);
    await request(app).get('/api/assets/..%2F..%2Fpackage.json').expect(404);
    await request(app).get('/api/assets/ABCDEF0123456789.png').expect(404);
    await request(app).get('/api/assets/0123456789abcdef.exe').expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Admin lesson editor', () => {
  const setup = async () => {
    const { course, modules, lessons } = await createCourse();
    return { course, module: modules[0], lesson: lessons[0] };
  };

  it('refuses a broken lesson with every error and its line; nothing is saved', async () => {
    const { module } = await setup();
    const res = await request(app)
      .post(`/api/admin/modules/${String(module._id)}/lessons`)
      .set(admin.auth)
      .send({ title: 'Broken lesson', content: '# Title\n\n:::quiz\nQ?\n- [x] a\n:::\n\n:::callout\nnever closed' })
      .expect(400);
    expect(res.body.code).toBe('LESSON_FORMAT_INVALID');
    expect(res.body.message).toMatch(/^Line 1: /);
    expect(res.body.details.errors.map((e: { line: number }) => e.line)).toEqual([1, 3, 8]);
    expect(await Lesson.countDocuments({ title: 'Broken lesson' })).toBe(0);
  });

  it('saves a valid lesson and returns warnings for the editor', async () => {
    const { module } = await setup();
    const res = await request(app)
      .post(`/api/admin/modules/${String(module._id)}/lessons`)
      .set(admin.auth)
      .send({ title: 'Good lesson', content: `## Start\n\n${QUIZ_BLOCK}\n\n![](https://example.com/a.png)` })
      .expect(201);
    expect(res.body.lesson.title).toBe('Good lesson');
    expect(res.body.warnings).toEqual([{ line: 10, message: expect.stringContaining('no alt text') }]);
  });

  it('needs uploaded assets to exist; course-folder paths are not allowed in the editor', async () => {
    const { lesson } = await setup();
    const missing = await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: '![a](beyownd-asset:0123456789abcdef.png)' }).expect(400);
    expect(missing.body.details.errors[0].message).toContain('not found');
    const folder = await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: '![a](assets/x.png)' }).expect(400);
    expect(folder.body.details.errors[0].message).toContain('uploaded first');

    const { ref } = (await upload('a.png', PNG).expect(201)).body.asset;
    await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: `![a](${ref})` }).expect(200);
  });

  it('renaming a lesson saved before the format existed still works', async () => {
    const { lesson } = await setup();
    await Lesson.updateOne({ _id: lesson._id }, { content: '# Old style heading\n\n<div>old</div>' });
    await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ title: 'Renamed lesson' }).expect(200);
    // ...but editing its content applies the rules
    await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: '# Still old' }).expect(400);
  });

  it('"Check" endpoint reports errors, warnings and sections without saving', async () => {
    const res = await request(app)
      .post('/api/admin/lessons/check')
      .set(admin.auth)
      .send({ content: '## One\n*sub*\n\n## Two\n:::steps\n1. a\n:::' })
      .expect(200);
    expect(res.body).toMatchObject({
      ok: false,
      errors: [{ line: 5, message: expect.stringContaining('at least 2') }],
      sections: [
        { id: 'one', title: 'One', subtitle: 'sub' },
        { id: 'two', title: 'Two', subtitle: null },
      ],
    });
    await request(app).post('/api/admin/lessons/check').set(admin.auth).send({}).expect(400);
    await request(app).post('/api/admin/lessons/check').set(admin.auth).send({ content: 'x'.repeat(50001) }).expect(400);
  });

  it('accepts a full-size Hindi lesson (bigger than the normal 100 KB body limit)', async () => {
    const { lesson } = await setup();
    const hindi = `## परिचय\n\n${'कैशिंग '.repeat(7000)}`; // ~49k chars, ~140 KB UTF-8
    expect(Buffer.byteLength(JSON.stringify({ content: hindi }))).toBeGreaterThan(100 * 1024);
    await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: hindi }).expect(200);
  });

  it('blocks a practice quiz that copies a graded quiz question - from either side', async () => {
    const { course, module, lesson } = await setup();
    await createQuiz(course._id, module._id);
    const quiz = (await request(app).get(`/api/admin/modules/${String(module._id)}/quiz`).set(admin.auth).expect(200)).body.quiz;
    const graded = quiz.questions[0].prompt as string;

    // lesson copies the graded question
    const leak = `:::quiz\n${graded.toUpperCase()}\n- [x] a\n- [ ] b\n:::`;
    const res = await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: leak }).expect(400);
    expect(res.body.details.errors[0].message).toContain('graded module quiz');

    // graded quiz copies a lesson's practice question
    await request(app).patch(`/api/admin/lessons/${String(lesson._id)}`).set(admin.auth).send({ content: QUIZ_BLOCK }).expect(200);
    const questions = [...quiz.questions, { prompt: 'Which command writes a key?', options: ['GET', 'SET'], correctOptionIndexes: [1] }];
    const quizRes = await request(app).put(`/api/admin/modules/${String(module._id)}/quiz`).set(admin.auth).send({ questions }).expect(400);
    expect(quizRes.body.code).toBe('QUIZ_ANSWER_LEAK');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('What students receive', () => {
  it('asset references become URLs, and sections come with the lesson', async () => {
    const { course, lessons } = await createCourse();
    const { ref, url } = (await upload('a.png', PNG).expect(201)).body.asset;
    await request(app)
      .patch(`/api/admin/lessons/${String(lessons[0]._id)}`)
      .set(admin.auth)
      .send({ content: `## Why caching\n*Speed*\n\n![flow](${ref})\n\n## Setup` })
      .expect(200);

    const res = await request(app).get(`/api/courses/${course.slug}/preview/lessons/${String(lessons[0]._id)}`).expect(200);
    expect(res.body.lesson.content).toContain(`![flow](${url})`);
    expect(res.body.lesson.content).not.toContain('beyownd-asset:');
    expect(res.body.lesson.formatVersion).toBe(1);
    expect(res.body.lesson.sections).toEqual([
      { id: 'why-caching', title: 'Why caching', subtitle: 'Speed', line: 1 },
      { id: 'setup', title: 'Setup', subtitle: null, line: 6 },
    ]);
  });

  it('old plain-Markdown lessons are still delivered (no sections, no failure)', async () => {
    const { course, lessons } = await createCourse();
    await Lesson.updateOne({ _id: lessons[0]._id }, { content: '# Legacy\n:::broken' });
    const res = await request(app).get(`/api/courses/${course.slug}/preview/lessons/${String(lessons[0]._id)}`).expect(200);
    expect(res.body.lesson).toMatchObject({ content: '# Legacy\n:::broken', sections: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Course import with assets/', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'byd-rich-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'flow.png'), PNG);
    fs.writeFileSync(path.join(dir, 'assets', 'sim.html'), WIDGET);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const def = (lessonFiles: string[], quiz?: CourseDef['modules'][number]['quiz']): CourseDef => ({
    slug: 'rich-course',
    title: 'Rich Course',
    description: 'A course with rich lessons.',
    durationWeeks: 4,
    defaultPricePaise: 59900,
    project: { title: 'Project', brief: 'Build it.', rubric: [1, 2, 3].map((i) => ({ criterion: `Criterion ${i}`, maxScore: 10 })) },
    modules: [{ title: 'Module one', lessons: lessonFiles.map((f, i) => ({ title: `Lesson ${i + 1}`, contentFile: f })), ...(quiz ? { quiz } : {}) }],
  });
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };

  it('stores assets, rewrites the lesson and is idempotent', async () => {
    write('lessons/a.md', '## Flow\n\n![flow](assets/flow.png)\n\n:::interactive[Counter]{src="assets/sim.html"}\n:::\n\nThe file assets/flow.png is above.');
    write('lessons/b.md', '## Again\n\n![same image](assets/flow.png)');

    const dry = await importCourse(def(['lessons/a.md', 'lessons/b.md']), dir, { dryRun: true });
    expect(dry).toMatchObject({ assets: 2, dryRun: true });

    const r = await importCourse(def(['lessons/a.md', 'lessons/b.md']), dir);
    expect(r.assets).toBe(2);
    const stored = await Lesson.findOne({ title: 'Lesson 1' });
    const refs = stored!.content.match(/beyownd-asset:[a-f0-9]{16}\.(png|html)/g)!;
    expect(refs).toHaveLength(2);
    expect(stored!.content).toContain('The file assets/flow.png is above.'); // prose untouched
    for (const ref of refs) expect(await assetExists(ref.slice('beyownd-asset:'.length))).toBe(true);

    const again = await importCourse(def(['lessons/a.md', 'lessons/b.md']), dir);
    expect(again.created).toBe(false);
    expect((await Lesson.findOne({ title: 'Lesson 1' }))!.content).toBe(stored!.content);
  });

  it('reports every problem across all lessons with file + line, and writes nothing', async () => {
    write('lessons/a.md', '# Title\n\n![x](assets/missing.png)');
    write('lessons/b.md', '## Ok\n\n:::quiz\nQ?\n- [x] a\n:::');
    fs.writeFileSync(path.join(dir, 'assets', 'fake.png'), WIDGET);
    write('lessons/c.md', '## Fake\n![x](assets/fake.png)\n![y](assets/Flow.png)');

    let details: { errors: string[] } | undefined;
    await importCourse(def(['lessons/a.md', 'lessons/b.md', 'lessons/c.md']), dir).catch((e: { details?: { errors: string[] } }) => {
      details = e.details;
    });
    expect(details?.errors).toEqual([
      expect.stringMatching(/lesson 1 .* - lessons\/a\.md line 1: Don't use "# "/),
      expect.stringMatching(/lessons\/a\.md line 3: file "assets\/missing\.png" not found/),
      expect.stringMatching(/lessons\/b\.md line 3: Quiz needs at least 2 options/),
      expect.stringMatching(/lessons\/c\.md line 2: file is not really a PNG/),
      expect.stringMatching(/lessons\/c\.md line 3: .*named "flow\.png" \(capital letters/),
    ]);
    expect(await Lesson.countDocuments({ title: /^Lesson / })).toBe(0);
  });

  it('refuses a missing lesson file and asset links that escape the folder', async () => {
    const outside = path.join(os.tmpdir(), `byd-outside-${Date.now()}.png`);
    fs.writeFileSync(outside, PNG);
    try {
      let linked = true;
      try {
        fs.symlinkSync(outside, path.join(dir, 'assets', 'link.png'));
      } catch {
        linked = false; // Windows without symlink rights - skip that half
      }
      write('lessons/a.md', linked ? '## A\n![x](assets/link.png)' : '## A');
      let errors: string[] = [];
      await importCourse(def(['lessons/a.md', 'lessons/nope.md']), dir).catch((e: { details?: { errors: string[] } }) => {
        errors = e.details?.errors ?? [];
      });
      expect(errors).toEqual(expect.arrayContaining([expect.stringContaining('file "lessons/nope.md" not found')]));
      if (linked) expect(errors).toEqual(expect.arrayContaining([expect.stringContaining('outside the course folder')]));
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('blocks a practice quiz that copies the module quiz', async () => {
    write('lessons/a.md', ':::quiz\nWhat is Redis?\n- [x] A store\n- [ ] A font\n:::');
    const quiz = {
      questions: ['What is  redis?', 'Second question?', 'Third question?'].map((prompt) => ({ prompt, options: ['A store', 'A font'], correctOptionIndexes: [0] })),
    };
    await expect(importCourse(def(['lessons/a.md'], quiz), dir)).rejects.toMatchObject({
      details: { errors: [expect.stringContaining('graded module quiz')] },
    });
  });

  it('the reference course (docs/content/redis-course, converted from a real note) imports cleanly', async () => {
    const REDIS_DIR = path.join(__dirname, '..', '..', 'docs', 'content', 'redis-course');
    const redisDef = JSON.parse(fs.readFileSync(path.join(REDIS_DIR, 'course.json'), 'utf8')) as CourseDef;
    const r = await importCourse(redisDef, REDIS_DIR);
    expect(r).toMatchObject({ modules: 3, lessons: 8, quizzes: 3, assets: 1, warnings: [] });
    const first = await Lesson.findOne({ title: 'The viral post that killed the database' });
    const widget = /src="beyownd-asset:([a-f0-9]{16}\.html)"/.exec(first!.content);
    expect(widget).not.toBeNull();
    expect(await assetExists(widget![1])).toBe(true);
  });

  it('returns warnings without failing', async () => {
    write('lessons/a.md', '## A\n\n![](assets/flow.png)');
    const r = await importCourse(def(['lessons/a.md']), dir, { dryRun: true });
    expect(r.warnings).toEqual([expect.objectContaining({ file: 'lessons/a.md', line: 3, message: expect.stringContaining('alt text') })]);
  });
});
