// eslint.config.mjs
//
// Code checker - reads the code WITHOUT running it and flags real bugs:
// forgotten `await`s, promises passed where a plain value is expected,
// unused code, etc. Runs locally (`npm run lint`) and in CI on every push.
//
// Type-aware rules (they use the TypeScript compiler) are on, because the
// most expensive bugs in this codebase would be async ones - a payment or
// email call whose promise is silently ignored.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', '.tmp/**', 'coverage/**', '*.config.js', '*.config.mjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // tsconfig.test.json covers src + tests + scripts
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ---- The bugs we care most about ----
      // An un-awaited promise: errors vanish, order of operations breaks
      '@typescript-eslint/no-floating-promises': 'error',
      // Promise where a boolean/void callback is expected (e.g. `if (asyncFn())`).
      // Express 5 handles async route handlers, so passing them as arguments is fine.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { arguments: false } }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn', // use the pino logger instead

      // ---- Deliberately relaxed (noise for this codebase, not bugs) ----
      // Third-party payloads (Razorpay, Mongo errors) are typed `any` at the edges
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Template strings with ObjectIds/numbers are intentional (keys, messages)
      '@typescript-eslint/restrict-template-expressions': 'off',
      // async functions without await are fine as Express handlers / interfaces
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },

  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: globals.jest },
    rules: {
      // Tests use non-null assertions and require() for env setup on purpose
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' }, // CLI scripts print to the terminal
  }
);
