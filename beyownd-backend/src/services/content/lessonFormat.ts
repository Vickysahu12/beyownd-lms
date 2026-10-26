// src/services/content/lessonFormat.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Rich lessons (Markdown + blocks) ka "grammar checker". Lesson save/import
// hone se PEHLE yeh har line padhta hai aur galti exact LINE NUMBER ke saath
// batata hai - taaki tooti hui lesson kabhi students tak na pahunche.
//
// Format spec (writers + frontend ke liye): docs/content/LESSON_FORMAT.md
// Syntax `remark-directive` standard ka hai - frontend wahi library use
// karega, isliye backend aur frontend ek hi cheez samajhte hai:
//
//   :::name[label]{key="value" flag}
//   ...body...
//   :::
//
// Blocks: callout, quiz, steps, details, interactive. Nesting allowed NAHI
// (simple rakhna, galti kam). Fenced code (``` / ~~~) ke andar kuch bhi
// parse nahi hota - code mein ":::" likhna safe hai.
//
// PURE module: koi DB/network nahi. Isliye har edge case unit-test hota hai.
//
// Output:
//   errors   → lesson save NAHI hoga (line + message)
//   warnings → save hoga, lekin writer ko dikhaya jaata hai
//   sections → `##` headings (sidebar ke liye, stable ids ke saath)
//   assets   → images / interactive widgets jo upload karne hai
// ────────────────────────────────────────────────────────────────────────

export interface LessonIssue {
  line: number;
  message: string;
}

export interface LessonSection {
  id: string;
  title: string;
  subtitle: string | null;
  line: number;
}

export interface LessonAssetRef {
  line: number;
  path: string; // as written: "assets/x.png" (import) or "beyownd-asset:<hash>.png" (stored)
  kind: 'image' | 'interactive';
}

export interface LessonAnalysis {
  errors: LessonIssue[];
  warnings: LessonIssue[];
  sections: LessonSection[];
  assets: LessonAssetRef[];
  // Inline (practice) quiz question texts - importer checks they don't copy
  // a graded module-quiz question (practice answers are visible to students)
  quizQuestions: { line: number; text: string }[];
  stats: { quizzes: number; steps: number; callouts: number; details: number; interactives: number; codeBlocks: number };
}

export interface AnalyzeOptions {
  // import: assets are files in the course folder (assets/...)
  // stored: assets are already uploaded (beyownd-asset:...) - admin editor / DB
  mode: 'import' | 'stored';
  lessonType?: 'text' | 'video';
}

// ---- limits (one place, documented in LESSON_FORMAT.md) ----
export const LIMITS = {
  sections: 40,
  quizzes: 30,
  interactives: 5,
  quizOptions: { min: 2, max: 6 },
  label: 120,
  calloutLabel: 80,
  codeTitle: 80,
  caption: 500,
  height: { min: 160, max: 900, default: 420 },
};

export const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger'] as const;
export const BLOCK_NAMES = ['callout', 'quiz', 'steps', 'details', 'interactive'] as const;
type BlockName = (typeof BLOCK_NAMES)[number];

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
export const ASSET_REF_PREFIX = 'beyownd-asset:';
const ASSET_REF = /^beyownd-asset:[a-f0-9]{16}\.(png|jpg|jpeg|webp|gif|svg|html)$/;
const IMPORT_ASSET = /^assets\/[A-Za-z0-9._/-]+$/;

// Languages the frontend highlights. Unknown → warning (shown as plain text).
const KNOWN_LANGUAGES = new Set([
  'js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'json', 'bash', 'sh', 'shell', 'zsh', 'powershell',
  'html', 'css', 'scss', 'sql', 'python', 'py', 'java', 'c', 'cpp', 'go', 'yaml', 'yml', 'dockerfile',
  'redis', 'text', 'plaintext', 'markdown', 'md', 'diff', 'mermaid', 'http', 'nginx', 'ini', 'env', 'graphql',
]);

// Allowed attributes per block (anything else = error, so typos are caught)
const BLOCK_ATTRS: Record<BlockName, string[]> = {
  callout: ['type'],
  quiz: [],
  steps: [],
  details: [],
  interactive: ['src', 'height'],
};

// ---- small helpers ----

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const DIRECTIVE_LINE = /^\s*(:{3,})(.*)$/;
const DIRECTIVE_HEAD = /^([A-Za-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const TASK_ITEM = /^\s*[-*+]\s+\[( |x|X)\]\s*(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;

const stripInlineCode = (line: string) => line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (m) => ' '.repeat(m.length));

export const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 60) || 'section';

// key="v" key='v' key=v flag  →  map (errors on garbage / duplicates)
export const parseAttributes = (raw: string): { attrs: Record<string, string | true>; error: string | null } => {
  const attrs: Record<string, string | true> = {};
  const re = /\s*([A-Za-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=]+)))?\s*/y;
  let index = 0;
  const text = raw.trim();
  while (index < text.length) {
    re.lastIndex = index;
    const m = re.exec(text);
    if (!m || m[0].length === 0) return { attrs, error: `can't read attributes near "${text.slice(index, index + 20)}"` };
    const key = m[1];
    if (key in attrs) return { attrs, error: `attribute "${key}" is written twice` };
    attrs[key] = m[2] ?? m[3] ?? m[4] ?? true;
    index = re.lastIndex;
  }
  return { attrs, error: null };
};

interface BodyLine {
  text: string;
  line: number;
  inCode: boolean;
}

interface OpenBlock {
  name: BlockName;
  label: string | null;
  attrs: Record<string, string | true>;
  line: number;
  body: BodyLine[];
}

// ---- main ----

export const analyzeLesson = (input: string, options: AnalyzeOptions): LessonAnalysis => {
  const errors: LessonIssue[] = [];
  const warnings: LessonIssue[] = [];
  const sections: LessonSection[] = [];
  const assets: LessonAssetRef[] = [];
  const quizQuestions: { line: number; text: string }[] = [];
  const stats = { quizzes: 0, steps: 0, callouts: 0, details: 0, interactives: 0, codeBlocks: 0 };
  const err = (line: number, message: string) => errors.push({ line, message });
  const warn = (line: number, message: string) => warnings.push({ line, message });

  // Normalize: BOM, Windows/Mac line endings
  const content = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = content.split('\n');

  if (options.lessonType !== 'video' && content.trim() === '') {
    err(1, 'Lesson content is empty');
  }

  let fence: { char: string; length: number; line: number } | null = null;
  let block: OpenBlock | null = null;
  let pendingSubtitle: LessonSection | null = null;
  let warnedOrphanSubheading = false;
  const usedIds = new Map<string, number>();

  const checkAssetPath = (path: string, line: number, kind: 'image' | 'interactive') => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const wantExt = kind === 'image' ? IMAGE_EXTENSIONS : ['html'];
    if (path.startsWith(ASSET_REF_PREFIX)) {
      if (!ASSET_REF.test(path) || !wantExt.includes(ext)) err(line, `"${path}" is not a valid uploaded ${kind === 'image' ? 'image' : 'widget'} reference`);
      else assets.push({ line, path, kind });
      return;
    }
    if (options.mode === 'stored') {
      err(line, `"${path}" must be uploaded first - use the asset upload, then paste the beyownd-asset: reference`);
      return;
    }
    if (!IMPORT_ASSET.test(path) || path.includes('..')) {
      err(line, `"${path}" must be a file inside the course's assets/ folder, e.g. assets/diagram.png`);
      return;
    }
    if (!wantExt.includes(ext)) {
      err(line, kind === 'image' ? `"${path}" - images must be ${IMAGE_EXTENSIONS.join(', ')}` : `"${path}" - interactive widgets must be .html files`);
      return;
    }
    assets.push({ line, path, kind });
  };

  // Checks that run on normal prose lines (outside code)
  const checkProse = (raw: string, line: number) => {
    // <!-- one-line comments --> are writer notes; the renderer drops them
    const text = stripInlineCode(raw).replace(/<!--.*?-->/g, " ");

    // Dangerous HTML - never allowed (frontend strips HTML anyway; we fail loudly instead of silently)
    if (/<\s*\/?\s*(script|iframe|style|object|embed|form|input|button|link|meta|base)\b/i.test(text)) {
      err(line, 'HTML tags like <script>, <iframe> or <style> are not allowed - use Markdown and blocks (an :::interactive block for widgets)');
    } else if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(text)) {
      err(line, 'HTML event handlers (onclick=...) are not allowed');
    } else if (/<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i.test(text)) {
      warn(line, 'Raw HTML is removed when the lesson is shown - use Markdown instead (wrap code-like text such as <div> in backticks)');
    }

    // Images: ![alt](src)
    for (const m of text.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) {
      const [, alt, src] = m;
      if (!alt.trim()) warn(line, `Image "${src}" has no alt text - describe it for screen readers and slow connections`);
      if (/^https:\/\//i.test(src)) continue;
      if (/^http:\/\//i.test(src)) err(line, `Image "${src}" uses http:// - use https:// (browsers block insecure images)`);
      else if (/^(data|javascript|vbscript):/i.test(src)) err(line, `Image "${src.slice(0, 30)}…" - data:/javascript: URLs are not allowed`);
      else checkAssetPath(src, line, 'image');
    }

    // Links: [text](href) - not images
    for (const m of text.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?/g)) {
      const href = m[1];
      if (/^(javascript|data|vbscript):/i.test(href)) err(line, `Link "${href.slice(0, 30)}" is not allowed`);
      else if (/^http:\/\//i.test(href)) warn(line, `Link "${href}" uses http:// - prefer https://`);
    }

    // Note: remark-directive reads "session:abc" in prose as an inline
    // directive. The frontend turns unknown inline directives back into plain
    // text (LESSON_FORMAT.md §Renderer rules), so writers don't need to care.
  };

  const validateBlock = (b: OpenBlock) => {
    const allowed = BLOCK_ATTRS[b.name];
    for (const key of Object.keys(b.attrs)) {
      if (!allowed.includes(key)) {
        err(b.line, `:::${b.name} doesn't take "${key}"${allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (it takes no attributes)'}`);
      }
    }
    const prose = b.body.filter((l) => !l.inCode);
    const hasContent = b.body.some((l) => l.text.trim() !== '');

    switch (b.name) {
      case 'callout': {
        stats.callouts++;
        const type = b.attrs.type ?? 'note';
        if (type === true || !(CALLOUT_TYPES as readonly string[]).includes(type)) {
          err(b.line, `:::callout type must be one of ${CALLOUT_TYPES.join(', ')}`);
        }
        if (b.label !== null && b.label.length > LIMITS.calloutLabel) err(b.line, `Callout title is longer than ${LIMITS.calloutLabel} characters`);
        if (!hasContent) err(b.line, ':::callout is empty');
        break;
      }
      case 'details': {
        stats.details++;
        if (!b.label?.trim()) err(b.line, ':::details needs a summary: :::details[Why does this happen?]');
        else if (b.label.length > LIMITS.label) err(b.line, `:::details summary is longer than ${LIMITS.label} characters`);
        if (!hasContent) err(b.line, ':::details is empty');
        break;
      }
      case 'steps': {
        stats.steps++;
        const items = prose.filter((l) => ORDERED_ITEM.test(l.text));
        if (items.length < 2) err(b.line, ':::steps needs a numbered list with at least 2 steps (1. … 2. …)');
        const firstItemIndex = prose.findIndex((l) => ORDERED_ITEM.test(l.text));
        const before = prose.slice(0, firstItemIndex === -1 ? prose.length : firstItemIndex).filter((l) => l.text.trim());
        if (firstItemIndex > 0 && before.length) err(before[0].line, ':::steps must start with the numbered list - put intro text above the block');
        for (const it of items) {
          if (!ORDERED_ITEM.exec(it.text)![1].trim()) err(it.line, 'Empty step');
        }
        break;
      }
      case 'interactive': {
        stats.interactives++;
        if (!b.label?.trim()) err(b.line, ':::interactive needs a title: :::interactive[Watch the hit ratio climb]{src="assets/hit-ratio.html"}');
        else if (b.label.length > LIMITS.label) err(b.line, `Interactive title is longer than ${LIMITS.label} characters`);
        const src = b.attrs.src;
        if (typeof src !== 'string' || !src.trim()) err(b.line, ':::interactive needs src="assets/<file>.html"');
        else checkAssetPath(src.trim(), b.line, 'interactive');
        if (b.attrs.height !== undefined) {
          const h = Number(b.attrs.height);
          if (b.attrs.height === true || !Number.isInteger(h) || h < LIMITS.height.min || h > LIMITS.height.max) {
            err(b.line, `height must be a whole number from ${LIMITS.height.min} to ${LIMITS.height.max}`);
          }
        }
        const caption = prose.map((l) => l.text).join(' ').trim();
        if (caption.length > LIMITS.caption) err(b.line, `Interactive caption is longer than ${LIMITS.caption} characters`);
        break;
      }
      case 'quiz': {
        stats.quizzes++;
        if (b.label !== null) warn(b.line, ':::quiz ignores the [label] - quizzes are numbered automatically');
        const options: { correct: boolean; text: string; line: number }[] = [];
        const question: BodyLine[] = [];
        let seenOption = false;
        let seenExplanation = false;
        for (const l of b.body) {
          if (l.inCode) {
            if (seenOption) err(l.line, 'Code in a quiz must be in the question, before the options');
            else question.push(l);
            continue;
          }
          const opt = TASK_ITEM.exec(l.text);
          if (opt) {
            if (seenExplanation) err(l.line, 'Options must come before the explanation (> …)');
            seenOption = true;
            options.push({ correct: opt[1].toLowerCase() === 'x', text: opt[2].trim(), line: l.line });
          } else if (/^\s*>/.test(l.text)) {
            if (!seenOption) question.push(l); // a quote inside the question is fine
            else seenExplanation = true;
          } else if (l.text.trim() === '') {
            continue;
          } else if (!seenOption) {
            question.push(l);
          } else if (seenExplanation && /^\s{2,}\S/.test(l.text)) {
            continue; // indented continuation of the explanation
          } else {
            err(l.line, 'Unexpected text after the options - each option is "- [ ] text" (wrong) or "- [x] text" (right), explanation starts with ">"');
          }
        }
        const questionText = question.filter((l) => !l.inCode).map((l) => l.text.trim()).filter(Boolean).join(' ');
        if (!question.some((l) => l.text.trim())) err(b.line, 'Quiz has no question text above the options');
        else quizQuestions.push({ line: b.line, text: questionText });
        if (options.length < LIMITS.quizOptions.min) err(b.line, `Quiz needs at least ${LIMITS.quizOptions.min} options written as "- [ ] …" / "- [x] …"`);
        if (options.length > LIMITS.quizOptions.max) err(b.line, `Quiz can have at most ${LIMITS.quizOptions.max} options`);
        if (options.length >= LIMITS.quizOptions.min && !options.some((o) => o.correct)) err(b.line, 'Quiz has no correct option - mark at least one with [x]');
        if (options.length >= LIMITS.quizOptions.min && options.every((o) => o.correct)) err(b.line, 'Every option is marked correct - a quiz needs at least one wrong option');
        const seen = new Set<string>();
        for (const o of options) {
          if (!o.text) err(o.line, 'Empty quiz option');
          const key = o.text.toLowerCase();
          if (o.text && seen.has(key)) err(o.line, `Duplicate option "${o.text}"`);
          seen.add(key);
        }
        if (!seenExplanation) warn(b.line, 'Quiz has no explanation (> …) - explaining why the answer is right helps students learn');
        break;
      }
    }

    // Headings inside blocks break the sidebar
    for (const l of prose) {
      if (HEADING.test(l.text)) err(l.line, 'Headings (#) can\'t be inside a block - close the block first');
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const line = i + 1;

    // ---- inside a fenced code block: only look for its closing fence ----
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      if (block) block.body.push({ text, line, inCode: true });
      continue;
    }

    // ---- opening a fenced code block ----
    const open = FENCE_OPEN.exec(text);
    if (open) {
      const marker = open[1];
      const info = open[2].trim();
      if (marker[0] === '`' && info.includes('`')) {
        // Not a fence (CommonMark): treat as prose
      } else {
        fence = { char: marker[0], length: marker.length, line };
        stats.codeBlocks++;
        pendingSubtitle = null;
        const lang = info.split(/\s+/)[0]?.toLowerCase() ?? '';
        const meta = info.slice(lang.length).trim();
        if (lang && !KNOWN_LANGUAGES.has(lang)) warn(line, `Code language "${lang}" isn't highlighted - it will show as plain text`);
        if (!lang) warn(line, 'Code block has no language (```js, ```bash …) - it will show without highlighting');
        if (meta) {
          const { attrs, error } = parseAttributes(meta);
          if (error) err(line, `Code block info: ${error}`);
          for (const key of Object.keys(attrs)) {
            if (key !== 'title') err(line, `Code blocks only support title="…" (found "${key}")`);
          }
          if (typeof attrs.title === 'string' && attrs.title.length > LIMITS.codeTitle) err(line, `Code title is longer than ${LIMITS.codeTitle} characters`);
          if (attrs.title === true) err(line, 'title needs a value: title="lib/cache.js"');
        }
        if (block) block.body.push({ text, line, inCode: true });
        continue;
      }
    }

    // ---- block directives ----
    const directive = DIRECTIVE_LINE.exec(text);
    if (directive) {
      const colons = directive[1];
      const rest = directive[2].trim();
      if (rest === '') {
        if (!block) err(line, '":::" closes nothing - there is no open block here');
        else {
          if (colons.length !== 3) err(line, 'Close blocks with exactly ":::"');
          validateBlock(block);
          block = null;
        }
        pendingSubtitle = null;
        continue;
      }
      const head = DIRECTIVE_HEAD.exec(rest);
      if (colons.length !== 3) {
        err(line, 'Open blocks with exactly ":::" (e.g. :::quiz)');
        continue;
      }
      if (!head) {
        err(line, `Can't read this block line - format is :::name[optional label]{optional attributes}`);
        continue;
      }
      const name = head[1].toLowerCase();
      if (block) {
        err(line, `Blocks can't be nested - close :::${block.name} (opened on line ${block.line}) before starting :::${name}`);
        continue;
      }
      if (!(BLOCK_NAMES as readonly string[]).includes(name)) {
        err(line, `Unknown block ":::${name}" - available: ${BLOCK_NAMES.join(', ')}`);
        // still open a dummy so its body and closer are consumed without cascading errors
        block = { name: 'callout', label: null, attrs: { type: 'note' }, line, body: [{ text: 'x', line, inCode: false }] };
        (block as OpenBlock & { dummy?: boolean }).dummy = true;
        continue;
      }
      const { attrs, error } = parseAttributes(head[3] ?? '');
      if (error) err(line, `:::${name} - ${error}`);
      block = { name: name as BlockName, label: head[2] ?? null, attrs, line, body: [] };
      pendingSubtitle = null;
      continue;
    }

    // ---- inside a block: collect ----
    if (block) {
      const isDummy = (block as OpenBlock & { dummy?: boolean }).dummy;
      if (!isDummy) {
        block.body.push({ text, line, inCode: false });
        if (!HEADING.test(text)) checkProse(text, line);
      }
      continue;
    }

    // Leaf/text directive lines (::name) are not part of the format
    if (/^\s*::[A-Za-z]/.test(text)) {
      err(line, 'Lines starting with "::" are not supported - blocks start with ":::"');
      continue;
    }

    // ---- headings ----
    const heading = HEADING.exec(text);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      pendingSubtitle = null;
      if (level === 1) {
        err(line, 'Don\'t use "# " in a lesson - the lesson title is shown automatically. Use "## " for sections');
        continue;
      }
      if (!title) {
        err(line, 'Empty heading');
        continue;
      }
      if (level === 2) {
        const base = slugify(title);
        const count = (usedIds.get(base) ?? 0) + 1;
        usedIds.set(base, count);
        if (count > 1) warn(line, `Another section is also called "${title}" - consider a unique title`);
        const section: LessonSection = { id: count > 1 ? `${base}-${count}` : base, title, subtitle: null, line };
        sections.push(section);
        pendingSubtitle = section;
      } else if (sections.length === 0 && !warnedOrphanSubheading) {
        warnedOrphanSubheading = true;
        warn(line, 'This sub-heading comes before any "## " section - the sidebar starts at the first "## "');
      }
      checkProse(title, line);
      continue;
    }

    // ---- section subtitle: first line after "## " that is fully *italic* ----
    if (pendingSubtitle) {
      if (text.trim() === '') continue;
      const sub = /^\s*([*_])(?!\1)(.+?)\1\s*$/.exec(text);
      if (sub) pendingSubtitle.subtitle = sub[2].trim();
      pendingSubtitle = null;
    }

    if (text.trim()) checkProse(text, line);
  }

  // ---- end of file: anything left open? ----
  if (fence) err(fence.line, `Code block opened here is never closed - add a closing ${fence.char.repeat(fence.length)}`);
  if (block) {
    const isDummy = (block as OpenBlock & { dummy?: boolean }).dummy;
    err(block.line, `:::${isDummy ? 'block' : block.name} opened here is never closed - add ":::" on its own line`);
  }

  if (sections.length > LIMITS.sections) err(sections[LIMITS.sections].line, `Too many sections (max ${LIMITS.sections}) - split the lesson`);
  if (stats.quizzes > LIMITS.quizzes) err(1, `Too many quizzes (${stats.quizzes}, max ${LIMITS.quizzes}) - split the lesson`);
  if (stats.interactives > LIMITS.interactives) err(1, `Too many interactive widgets (${stats.interactives}, max ${LIMITS.interactives}) - they are heavy on phones`);

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return { errors, warnings, sections, assets, quizQuestions, stats };
};

// Replace asset paths (assets/x.png → beyownd-asset:<hash>.png) only where
// they are used as an image src or an interactive src - never in prose/code.
export const rewriteAssetPaths = (content: string, mapping: Map<string, string>): string => {
  if (mapping.size === 0) return content;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = content;
  for (const [from, to] of mapping) {
    const p = escape(from);
    out = out
      .replace(new RegExp(`(\\]\\(\\s*<?)${p}(?=[\\s)>])`, 'g'), `$1${to}`)
      .replace(new RegExp(`(\\bsrc\\s*=\\s*["']?)${p}(?=["'\\s}])`, 'g'), `$1${to}`);
  }
  return out;
};

// Stored refs → public URLs when a lesson is served
export const resolveAssetRefs = (content: string, assetBaseUrl: string): string =>
  content.replace(/beyownd-asset:([a-f0-9]{16}\.(?:png|jpg|jpeg|webp|gif|svg|html))/g, `${assetBaseUrl}/$1`);

// Practice quiz in the notes copying a GRADED module-quiz question = answer
// leak (practice answers are visible in the lesson). Same text after
// normalizing (case, spaces, markdown marks) → reported.
const normalizeQuestion = (s: string) => s.toLowerCase().replace(/[`*_~>#]/g, '').replace(/\s+/g, ' ').trim();

export const findQuizLeaks = (inline: { line: number; text: string }[], gradedPrompts: string[]): LessonIssue[] => {
  const graded = new Set(gradedPrompts.map(normalizeQuestion).filter(Boolean));
  return inline
    .filter((q) => graded.has(normalizeQuestion(q.text)))
    .map((q) => ({ line: q.line, message: 'This practice quiz repeats a question from the graded module quiz - students would see its answer. Write a different question' }));
};
