// src/services/content/lessonContent.service.ts
//
// Lesson content ke liye EK rasta - admin editor (save + "check" button)
// aur catalog (serve) dono yahin se. Importer apna import-mode check khud
// karta hai (files course folder se aati hai), lekin same parser.

import { AppError } from '../../utils/AppError';
import { assetExists, ASSET_BASE_URL } from '../../utils/assetStore.util';
import { analyzeLesson, resolveAssetRefs, LessonIssue, LessonSection, ASSET_REF_PREFIX } from './lessonFormat';

export interface LessonCheck {
  ok: boolean;
  errors: LessonIssue[];
  warnings: LessonIssue[];
  sections: LessonSection[];
  stats: ReturnType<typeof analyzeLesson>['stats'];
}

// Stored mode: assets must already be uploaded (beyownd-asset:...) - and exist
export const checkStoredLesson = async (content: string, lessonType: 'text' | 'video' = 'text'): Promise<LessonCheck> => {
  const analysis = analyzeLesson(content, { mode: 'stored', lessonType });
  const errors = [...analysis.errors];
  const names = [...new Set(analysis.assets.map((a) => a.path.slice(ASSET_REF_PREFIX.length)))];
  const exists = await Promise.all(names.map((n) => assetExists(n)));
  for (const a of analysis.assets) {
    if (!exists[names.indexOf(a.path.slice(ASSET_REF_PREFIX.length))]) {
      errors.push({ line: a.line, message: `"${a.path}" was not found - upload the file again` });
    }
  }
  errors.sort((x, y) => x.line - y.line);
  return { ok: errors.length === 0, errors, warnings: analysis.warnings, sections: analysis.sections, stats: analysis.stats };
};

// Save guard: 400 with every error (line + message) in details
export const assertValidStoredLesson = async (content: string, lessonType: 'text' | 'video' = 'text') => {
  const check = await checkStoredLesson(content, lessonType);
  if (!check.ok) {
    const first = check.errors[0];
    const more = check.errors.length > 1 ? ` (+${check.errors.length - 1} more)` : '';
    throw new AppError(400, `Line ${first.line}: ${first.message}${more}`, 'LESSON_FORMAT_INVALID', {
      errors: check.errors,
      warnings: check.warnings,
    });
  }
  return check;
};

// Serve: references → URLs + sidebar sections. Never fails - a lesson saved
// before the format existed still renders (just maybe without sections).
export const prepareForDelivery = (content: string) => {
  const { sections } = analyzeLesson(content, { mode: 'stored' });
  return { content: resolveAssetRefs(content, ASSET_BASE_URL), sections };
};
