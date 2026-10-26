// tests/lessonFormat.test.ts
// Rich lesson format (docs/content/LESSON_FORMAT.md) - the parser alone.
// Every rule a writer can break, with the line number it must point to.

import {
  analyzeLesson,
  parseAttributes,
  rewriteAssetPaths,
  resolveAssetRefs,
  findQuizLeaks,
  slugify,
  AnalyzeOptions,
} from '../src/services/content/lessonFormat';

const FENCE = '```';
const lesson = (...lines: string[]) => lines.join('\n');
const run = (content: string, options: AnalyzeOptions = { mode: 'import' }) => analyzeLesson(content, options);
const errorsOf = (content: string, options?: AnalyzeOptions) => run(content, options).errors;
const warningsOf = (content: string, options?: AnalyzeOptions) => run(content, options).warnings;
// "line N: message contains X"
const hasIssue = (issues: { line: number; message: string }[], line: number, text: string) =>
  issues.some((i) => i.line === line && i.message.toLowerCase().includes(text.toLowerCase()));

const QUIZ = [':::quiz', 'Which command stores a value?', '', '- [ ] GET', '- [x] SET', '- [ ] DEL', '', '> SET writes a key.', ':::'];

const FULL = lesson(
  'Intro paragraph with **bold** and `code`.', // 1
  '', // 2
  '## Why Redis is fast', // 3
  '*Memory, not disk*', // 4
  '', // 5
  `${FENCE}js title="lib/cache.js"`, // 6
  'const v = await redis.get("user:1");', // 7
  ':::quiz', // 8  (inside code - must be ignored)
  FENCE, // 9
  '', // 10
  ...QUIZ, // 11-19
  '', // 20
  ':::callout[Remember]{type="tip"}', // 21
  'Redis is single-threaded.', // 22
  ':::', // 23
  '', // 24
  ':::steps', // 25
  '1. Client sends GET', // 26
  '2. Redis looks up the key', // 27
  '3. Value returns', // 28
  ':::', // 29
  '', // 30
  ':::details[Why not a database?]', // 31
  'Disk is slower.', // 32
  ':::', // 33
  '', // 34
  '## Try it', // 35
  ':::interactive[Watch the hit ratio]{src="assets/hit-ratio.html" height=480}', // 36
  'Move the slider.', // 37
  ':::', // 38
  '', // 39
  '| Command | Does |', // 40
  '| --- | --- |', // 41
  '| GET | reads |', // 42
  '', // 43
  '![Cache flow](assets/flow.png)' // 44
);

describe('a complete, valid lesson', () => {
  it('has no errors and finds sections, assets and blocks', () => {
    const r = run(FULL);
    expect(r.errors).toEqual([]);
    expect(r.sections).toEqual([
      { id: 'why-redis-is-fast', title: 'Why Redis is fast', subtitle: 'Memory, not disk', line: 3 },
      { id: 'try-it', title: 'Try it', subtitle: null, line: 35 },
    ]);
    expect(r.assets).toEqual([
      { line: 36, path: 'assets/hit-ratio.html', kind: 'interactive' },
      { line: 44, path: 'assets/flow.png', kind: 'image' },
    ]);
    expect(r.stats).toEqual({ quizzes: 1, steps: 1, callouts: 1, details: 1, interactives: 1, codeBlocks: 1 });
    expect(r.quizQuestions).toEqual([{ line: 11, text: 'Which command stores a value?' }]);
  });

  it('gives the same result for Windows line endings and a BOM', () => {
    const windows = String.fromCharCode(0xfeff) + FULL.replace(/\n/g, '\r\n');
    const r = run(windows);
    expect(r.errors).toEqual([]);
    expect(r.sections.map((s) => s.line)).toEqual([3, 35]);
  });

  it('video lessons may be empty; text lessons may not', () => {
    expect(errorsOf('', { mode: 'import', lessonType: 'video' })).toEqual([]);
    expect(hasIssue(errorsOf('   \n\n'), 1, 'empty')).toBe(true);
  });
});

describe('headings + sections', () => {
  it('rejects "# " (title is shown automatically) and empty headings', () => {
    expect(hasIssue(errorsOf('# Title\n\nText'), 1, 'lesson title is shown automatically')).toBe(true);
    expect(hasIssue(errorsOf('Text\n\n##   \n'), 3, 'empty heading')).toBe(true);
  });

  it('gives duplicate section titles unique ids and warns', () => {
    const r = run('## Setup\ntext\n## Setup\ntext\n## Setup');
    expect(r.sections.map((s) => s.id)).toEqual(['setup', 'setup-2', 'setup-3']);
    expect(hasIssue(r.warnings, 3, 'also called')).toBe(true);
  });

  it('makes safe ids from any title (Hindi, symbols, markdown)', () => {
    expect(slugify('**Redis** `GET` vs SET!')).toBe('redis-get-vs-set');
    expect(slugify('कैशिंग क्या है')).toBe('section');
    expect(slugify('a'.repeat(100))).toHaveLength(60);
  });

  it('only a fully italic first line is a subtitle', () => {
    expect(run('## A\n\n*sub*').sections[0].subtitle).toBe('sub');
    expect(run('## A\n_sub_').sections[0].subtitle).toBe('sub');
    expect(run('## A\n*not* all italic').sections[0].subtitle).toBeNull();
    expect(run('## A\n**bold line**').sections[0].subtitle).toBeNull();
  });

  it('warns once about a sub-heading before the first section', () => {
    const r = run('### early\n### again\n## Real');
    expect(r.warnings.filter((w) => w.message.includes('before any'))).toHaveLength(1);
  });

  it('caps sections at 40', () => {
    const many = Array.from({ length: 41 }, (_, i) => `## Section ${i + 1}\ntext`).join('\n');
    expect(hasIssue(errorsOf(many), 81, 'too many sections')).toBe(true);
  });
});

describe('block structure', () => {
  it('reports a block that is never closed at the line it opened', () => {
    expect(hasIssue(errorsOf('Text\n:::callout\nhello'), 2, 'never closed')).toBe(true);
  });

  it('reports a stray ":::" that closes nothing', () => {
    expect(hasIssue(errorsOf('Text\n:::'), 2, 'closes nothing')).toBe(true);
  });

  it('rejects unknown blocks without a cascade of extra errors', () => {
    const errors = errorsOf(':::quizz\nQ?\n- [x] a\n:::\n\nAfter.');
    expect(errors).toHaveLength(1);
    expect(hasIssue(errors, 1, 'Unknown block ":::quizz"')).toBe(true);
  });

  it('rejects nesting and names both lines', () => {
    const errors = errorsOf(':::details[More]\ntext\n:::callout\ninner\n:::');
    expect(hasIssue(errors, 3, 'opened on line 1')).toBe(true);
  });

  it('needs exactly three colons', () => {
    expect(hasIssue(errorsOf('::::callout\nx\n:::'), 1, 'exactly ":::"')).toBe(true);
    expect(hasIssue(errorsOf(':::callout\nx\n::::'), 3, 'exactly ":::"')).toBe(true);
  });

  it('rejects broken block lines and "::" leaf directives', () => {
    expect(hasIssue(errorsOf(':::callout{type="tip"\nx\n:::'), 1, "can't read")).toBe(true);
    expect(hasIssue(errorsOf(':::callout[unclosed\nx\n:::'), 1, "can't read")).toBe(true);
    expect(hasIssue(errorsOf('::youtube{id=x}'), 1, '"::"')).toBe(true);
  });

  it('catches attribute typos per block', () => {
    expect(hasIssue(errorsOf(':::callout{typ="tip"}\nx\n:::'), 1, 'doesn\'t take "typ"')).toBe(true);
    expect(hasIssue(errorsOf(':::steps{x=1}\n1. a\n2. b\n:::'), 1, 'takes no attributes')).toBe(true);
  });

  it('does not allow headings inside a block', () => {
    expect(hasIssue(errorsOf(':::details[More]\n## Inside\ntext\n:::'), 2, 'inside a block')).toBe(true);
  });

  it('blocks may be indented (e.g. inside a list)', () => {
    expect(errorsOf('- item\n\n  :::callout\n  hi\n  :::')).toEqual([]);
  });
});

describe('code blocks', () => {
  it('ignores ":::", headings and HTML inside code', () => {
    const r = run(lesson(`${FENCE}html`, ':::', '# not a heading', '<script>alert(1)</script>', FENCE));
    expect(r.errors).toEqual([]);
    expect(r.sections).toEqual([]);
  });

  it('supports ~~~ and longer fences containing ``` lines', () => {
    expect(errorsOf(lesson('~~~md', FENCE, ':::', FENCE, '~~~'))).toEqual([]);
    expect(errorsOf(lesson('````md', FENCE + 'js', 'x', FENCE, '````'))).toEqual([]);
  });

  it('a shorter or different fence does not close it', () => {
    expect(hasIssue(errorsOf(lesson('````js', 'x', FENCE, '~~~~')), 1, 'never closed')).toBe(true);
  });

  it('reports an unclosed code block at the line it opened', () => {
    expect(hasIssue(errorsOf(lesson('Text', `${FENCE}js`, 'code')), 2, 'never closed')).toBe(true);
  });

  it('checks the info string: title only, with a value, known language', () => {
    expect(errorsOf(`${FENCE}js title='a.js'\nx\n${FENCE}`)).toEqual([]);
    expect(hasIssue(errorsOf(`${FENCE}js file="a.js"\nx\n${FENCE}`), 1, 'only support title')).toBe(true);
    expect(hasIssue(errorsOf(`${FENCE}js title\nx\n${FENCE}`), 1, 'needs a value')).toBe(true);
    expect(hasIssue(errorsOf(`${FENCE}js title="${'a'.repeat(81)}"\nx\n${FENCE}`), 1, 'longer than')).toBe(true);
    expect(hasIssue(warningsOf(`${FENCE}cobol\nx\n${FENCE}`), 1, 'isn\'t highlighted')).toBe(true);
    expect(hasIssue(warningsOf(`${FENCE}\nx\n${FENCE}`), 1, 'no language')).toBe(true);
  });

  it('inline ```code``` on one line is not a fence', () => {
    expect(errorsOf('Use ```js``` here')).toEqual([]);
  });
});

describe(':::quiz', () => {
  const quiz = (...body: string[]) => [':::quiz', ...body, ':::'].join('\n');

  it('accepts several correct answers and code in the question', () => {
    expect(errorsOf(quiz('Pick both:', `${FENCE}js`, 'x', FENCE, '- [x] a', '- [X] b', '- [ ] c', '> both'))).toEqual([]);
  });

  it('needs a question, 2-6 options, at least one right and one wrong', () => {
    expect(hasIssue(errorsOf(quiz('- [x] a', '- [ ] b')), 1, 'no question')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a')), 1, 'at least 2')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', ...'abcdefg'.split('').map((c, i) => `- [${i ? ' ' : 'x'}] ${c}`))), 1, 'at most 6')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [ ] a', '- [ ] b')), 1, 'no correct')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a', '- [x] b')), 1, 'every option')).toBe(true);
  });

  it('rejects empty and duplicate options (case-insensitive)', () => {
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a', '- [ ] ')), 4, 'empty quiz option')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] Yes', '- [ ] yes')), 4, 'duplicate')).toBe(true);
  });

  it('options come before the explanation; nothing random after options', () => {
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a', '> why', '- [ ] b')), 5, 'before the explanation')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a', '- [ ] b', 'stray text')), 5, 'unexpected text')).toBe(true);
    expect(hasIssue(errorsOf(quiz('Q?', '- [x] a', '- [ ] b', `${FENCE}js`, 'x', FENCE)), 5, 'before the options')).toBe(true);
  });

  it('allows a quote inside the question and multi-line explanations', () => {
    expect(errorsOf(quiz('> Given this', 'what happens?', '- [x] a', '- [ ] b', '> line one', '> line two', '  continued'))).toEqual([]);
  });

  it('warns (not errors) about a missing explanation or a label', () => {
    const w = warningsOf(':::quiz[Q1]\nQ?\n- [x] a\n- [ ] b\n:::');
    expect(hasIssue(w, 1, 'ignores the [label]')).toBe(true);
    expect(hasIssue(w, 1, 'no explanation')).toBe(true);
  });

  it('plain "- item" lists are not options', () => {
    expect(hasIssue(errorsOf(quiz('Q?', '- a', '- b')), 1, 'at least 2')).toBe(true);
  });
});

describe(':::steps, :::callout, :::details', () => {
  it('steps need a numbered list of 2+ non-empty steps, list first', () => {
    expect(errorsOf(':::steps\n1) one\n2) two\n:::')).toEqual([]);
    expect(hasIssue(errorsOf(':::steps\n1. only\n:::'), 1, 'at least 2')).toBe(true);
    expect(hasIssue(errorsOf(':::steps\n- a\n- b\n:::'), 1, 'numbered list')).toBe(true);
    expect(hasIssue(errorsOf(':::steps\nIntro\n1. a\n2. b\n:::'), 2, 'start with the numbered list')).toBe(true);
  });

  it('callout type must be known and content non-empty', () => {
    expect(errorsOf(':::callout\nx\n:::')).toEqual([]); // default note
    expect(hasIssue(errorsOf(':::callout{type=info}\nx\n:::'), 1, 'note, tip, warning, danger')).toBe(true);
    expect(hasIssue(errorsOf(':::callout{type}\nx\n:::'), 1, 'must be one of')).toBe(true);
    expect(hasIssue(errorsOf(':::callout{type=tip}\n\n:::'), 1, 'empty')).toBe(true);
  });

  it('details needs a summary and content', () => {
    expect(hasIssue(errorsOf(':::details\nx\n:::'), 1, 'needs a summary')).toBe(true);
    expect(hasIssue(errorsOf(':::details[   ]\nx\n:::'), 1, 'needs a summary')).toBe(true);
    expect(hasIssue(errorsOf(':::details[Why]\n:::'), 1, 'empty')).toBe(true);
  });
});

describe(':::interactive', () => {
  const block = (head: string) => `${head}\n:::`;

  it('needs a title and an .html file in assets/', () => {
    expect(errorsOf(block(':::interactive[Sim]{src="assets/sim/v2.html"}'))).toEqual([]);
    expect(hasIssue(errorsOf(block(':::interactive{src="assets/a.html"}')), 1, 'needs a title')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[Sim]')), 1, 'needs src')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[Sim]{src="https://evil.com/x.html"}')), 1, 'assets/ folder')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[Sim]{src="assets/../../.env.html"}')), 1, 'assets/ folder')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[Sim]{src="lessons/a.html"}')), 1, 'assets/ folder')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[Sim]{src="assets/a.js"}')), 1, '.html files')).toBe(true);
  });

  it('height is a whole number in range', () => {
    expect(errorsOf(block(':::interactive[S]{src="assets/a.html" height=160}'))).toEqual([]);
    for (const h of ['100', '901', '4.5', 'tall']) {
      expect(hasIssue(errorsOf(block(`:::interactive[S]{src="assets/a.html" height=${h}}`)), 1, 'height')).toBe(true);
    }
  });

  it('caps widgets per lesson at 5', () => {
    const six = Array.from({ length: 6 }, () => block(':::interactive[S]{src="assets/a.html"}')).join('\n\n');
    expect(hasIssue(errorsOf(six), 1, 'too many interactive')).toBe(true);
  });

  it('stored mode only accepts uploaded references', () => {
    const stored: AnalyzeOptions = { mode: 'stored' };
    expect(errorsOf(block(':::interactive[S]{src="beyownd-asset:0123456789abcdef.html"}'), stored)).toEqual([]);
    expect(hasIssue(errorsOf(block(':::interactive[S]{src="assets/a.html"}'), stored), 1, 'uploaded first')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[S]{src="beyownd-asset:0123456789abcdef.png"}'), stored), 1, 'not a valid')).toBe(true);
    expect(hasIssue(errorsOf(block(':::interactive[S]{src="beyownd-asset:XYZ.html"}'), stored), 1, 'not a valid')).toBe(true);
  });
});

describe('images, links and HTML', () => {
  it('images: assets/ or https, never http/data/javascript; alt text recommended', () => {
    expect(errorsOf('![a](assets/x.png)\n![b](https://cdn.example.com/y.jpg "title")')).toEqual([]);
    expect(hasIssue(errorsOf('![a](http://x.com/y.png)'), 1, 'https')).toBe(true);
    expect(hasIssue(errorsOf('![a](data:image/png;base64,AAAA)'), 1, 'not allowed')).toBe(true);
    expect(hasIssue(errorsOf('![a](assets/x.bmp)'), 1, 'images must be')).toBe(true);
    expect(hasIssue(errorsOf('![a](../assets/x.png)'), 1, 'assets/ folder')).toBe(true);
    expect(hasIssue(warningsOf('![](assets/x.png)'), 1, 'no alt text')).toBe(true);
  });

  it('image in stored mode must be uploaded', () => {
    expect(errorsOf('![a](beyownd-asset:0123456789abcdef.webp)', { mode: 'stored' })).toEqual([]);
    expect(hasIssue(errorsOf('![a](assets/x.png)', { mode: 'stored' }), 1, 'uploaded first')).toBe(true);
  });

  it('links: javascript:/data: blocked, http warned', () => {
    expect(hasIssue(errorsOf('[click](javascript:alert(1))'), 1, 'not allowed')).toBe(true);
    expect(hasIssue(warningsOf('[site](http://example.com)'), 1, 'prefer https')).toBe(true);
    expect(errorsOf('[docs](https://redis.io/docs) and [section](#why)')).toEqual([]);
  });

  it('dangerous HTML is an error; other HTML a warning; HTML in backticks is fine', () => {
    expect(hasIssue(errorsOf('<script>alert(1)</script>'), 1, 'not allowed')).toBe(true);
    expect(hasIssue(errorsOf('Hi <iframe src="x">'), 1, 'not allowed')).toBe(true);
    expect(hasIssue(errorsOf('<img src=x onerror="alert(1)">'), 1, 'event handlers')).toBe(true);
    expect(hasIssue(warningsOf('<div>hi</div>'), 1, 'removed')).toBe(true);
    expect(warningsOf('Use the `<div>` tag and `<script>`')).toEqual([]);
    expect(warningsOf('if a < b and c > d')).toEqual([]);
  });

  it('checks prose inside blocks too', () => {
    expect(hasIssue(errorsOf(':::callout\n<script>x</script>\n:::'), 2, 'not allowed')).toBe(true);
  });

  it('one-line HTML comments are writer notes, not HTML', () => {
    expect(run('<!-- TODO widget: <div class="sim"> -->\n\nText').warnings).toEqual([]);
  });

  it('"word:name" text (Redis keys) is not an issue', () => {
    expect(run('Keys like session:abc and user:profile are common.').warnings).toEqual([]);
  });
});

describe('helpers', () => {
  it('parseAttributes reads quotes, bare values and flags; rejects duplicates and junk', () => {
    expect(parseAttributes(`src="a b.html" height=300 title='x' open`)).toEqual({
      attrs: { src: 'a b.html', height: '300', title: 'x', open: true },
      error: null,
    });
    expect(parseAttributes('a=1 a=2').error).toMatch(/twice/);
    expect(parseAttributes('#id .class').error).toMatch(/can't read/);
    expect(parseAttributes('').attrs).toEqual({});
  });

  it('rewriteAssetPaths only touches image/interactive sources - not prose or code', () => {
    const content = lesson(
      '![d](assets/x.png)',
      ':::interactive[S]{src="assets/s.html"}',
      ':::',
      'See assets/x.png in the folder.',
      `${FENCE}md`,
      '![d](assets/x.png)extra',
      FENCE
    );
    const out = rewriteAssetPaths(content, new Map([
      ['assets/x.png', 'beyownd-asset:aaaaaaaaaaaaaaaa.png'],
      ['assets/s.html', 'beyownd-asset:bbbbbbbbbbbbbbbb.html'],
    ]));
    expect(out).toContain('![d](beyownd-asset:aaaaaaaaaaaaaaaa.png)');
    expect(out).toContain('src="beyownd-asset:bbbbbbbbbbbbbbbb.html"');
    expect(out).toContain('See assets/x.png in the folder.');
    // a path that is a prefix of another must not be half-replaced
    expect(rewriteAssetPaths('![a](assets/x.png.bak.png)', new Map([['assets/x.png', 'R']]))).toBe('![a](assets/x.png.bak.png)');
  });

  it('resolveAssetRefs turns stored refs into URLs', () => {
    expect(resolveAssetRefs('![a](beyownd-asset:0123456789abcdef.png)', 'https://cdn.x/a')).toBe('![a](https://cdn.x/a/0123456789abcdef.png)');
  });

  it('findQuizLeaks matches graded questions ignoring case, spaces and markdown', () => {
    const leaks = findQuizLeaks([{ line: 4, text: 'What does **SET**  do?' }, { line: 9, text: 'Other?' }], ['what does SET do?']);
    expect(leaks).toEqual([{ line: 4, message: expect.stringContaining('graded module quiz') }]);
    expect(findQuizLeaks([{ line: 1, text: 'Q' }], [])).toEqual([]);
  });
});
