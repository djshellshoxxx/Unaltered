// ESLint flat config. Enforces SR-4 (no eval, no innerHTML, no inline handlers)
// and NET-2 (only src/core/net may call fetch).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nounsanitized from 'eslint-plugin-no-unsanitized';

const bannedSinks = [
  { selector: "MemberExpression[property.name='innerHTML']", message: 'innerHTML is banned (SR-4); use textContent/DOM APIs.' },
  { selector: "MemberExpression[property.name='outerHTML']", message: 'outerHTML is banned (SR-4).' },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'insertAdjacentHTML is banned (SR-4).' },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]", message: 'document.write is banned (SR-4).' },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'Math.random is banned; use crypto.getRandomValues (OPSEC 4.7).' },
  { selector: "CallExpression[callee.object.name='console'][callee.property.name=/^(log|info|debug|trace)$/]", message: 'No console logging of user data (SR-8).' },
];

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  {
    files: ['src/**/*.ts'],
    plugins: { 'no-unsanitized': nounsanitized },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
      'no-restricted-syntax': ['error', ...bannedSinks],
      'no-restricted-globals': ['error',
        { name: 'fetch', message: 'Only src/core/net may call fetch (NET-2).' },
        { name: 'XMLHttpRequest', message: 'Network I/O only via src/core/net (NET-2).' },
        { name: 'WebSocket', message: 'Network I/O only via src/core/net (NET-2).' },
        { name: 'EventSource', message: 'Network I/O only via src/core/net (NET-2).' },
      ],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'fetch', message: 'Only src/core/net may call fetch (NET-2).' },
        { object: 'globalThis', property: 'fetch', message: 'Only src/core/net may call fetch (NET-2).' },
        { object: 'self', property: 'fetch', message: 'Only src/core/net may call fetch (NET-2).' },
        { object: 'navigator', property: 'sendBeacon', message: 'No beacons (NFR-1).' },
      ],
    },
  },
  {
    files: ['src/core/net/fetch.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'desktop/**/*.cjs', 'desktop/**/*.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'writable' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
