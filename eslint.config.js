import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const bannedSyntax = [
  { selector: "MemberExpression[property.name='innerHTML']", message: 'innerHTML is banned (SR-4). Use textContent / DOM APIs.' },
  { selector: "MemberExpression[property.name='outerHTML']", message: 'outerHTML is banned (SR-4).' },
  { selector: "MemberExpression[property.name='insertAdjacentHTML']", message: 'insertAdjacentHTML is banned (SR-4).' },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name='write']", message: 'document.write is banned (SR-4).' },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'Use crypto.getRandomValues only (OPSEC 4.7).' },
  { selector: "NewExpression[callee.name='Function']", message: 'new Function is banned (SR-4).' },
  { selector: "CallExpression[callee.name='fetch']", message: 'fetch() is only allowed in src/core/net/fetch.ts.' },
  { selector: "CallExpression[callee.object.name='globalThis'][callee.property.name='fetch']", message: 'fetch() is only allowed in src/core/net/fetch.ts.' },
  { selector: "NewExpression[callee.name='XMLHttpRequest']", message: 'Network access goes through src/core/net only.' },
  { selector: "NewExpression[callee.name='WebSocket']", message: 'Network access goes through src/core/net only.' },
];

export default tseslint.config(
  { ignores: ['skills/**', 'shared/**', '.github/**', 'dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { window: 'readonly', document: 'readonly', self: 'readonly', navigator: 'readonly', crypto: 'readonly', URL: 'readonly', Blob: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', AbortSignal: 'readonly', AbortController: 'readonly', Response: 'readonly', globalThis: 'readonly', process: 'readonly', console: 'readonly', Buffer: 'readonly' } },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...bannedSyntax],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/net/fetch.ts'],
    rules: { 'no-restricted-syntax': ['error', ...bannedSyntax.filter((r) => !r.message.startsWith('fetch()'))] },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.ts', 'playwright.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { fetch: 'readonly' } },
    rules: { 'no-console': 'off', 'no-restricted-syntax': 'off' },
  },
);
