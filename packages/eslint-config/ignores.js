/**
 * Ignore globs shared by every preset. Build output, dependencies, coverage,
 * vendored upstream artifacts, and generated tool directories are never linted.
 *
 * **Test-runner output belongs here even though it is not "build" output.**
 * Playwright's HTML reporter writes a bundled application into
 * `playwright-report/`, and a failing run writes trace snapshots — including
 * `.js` — into `test-results/`. Linting them is both meaningless and
 * catastrophic to the signal: one repository measured 16 problems becoming
 * 5439. The failure only appears after a test fails, so a repository that
 * adopts this preset while green will look fine and discover it later, on the
 * run that already had something wrong with it.
 */
export const sharedIgnores = [
  '**/dist/**',
  '**/build/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/.svelte-kit/**',
  '**/dev-dist/**',
  '**/vendor/**',
  '**/.impeccable/**',
  '**/playwright-report/**',
  '**/test-results/**',
];

/**
 * Files that legitimately write to the console and may use CommonJS: tests,
 * config, scripts, and repository tooling.
 *
 * **The extension lists are exhaustive on purpose.** An earlier revision carried
 * `*.test.js` but not `*.spec.js`, and `*.config.mjs` but not `*.config.cjs`, so
 * whether a file counted as tooling depended on which of two interchangeable
 * suffixes its author had picked. That is invisible until someone renames a file
 * and acquires lint errors that have nothing to do with its contents.
 *
 * This list cannot cover every repository's layout — `services/`, `packages/`,
 * `internal/` and the like are product source in most repositories and tooling
 * in some. It is exported so a consumer can spread and extend it rather than
 * re-author it:
 *
 * ```js
 * import { toolingFiles } from '@jrmoulckers/eslint-config/ignores';
 *
 * base({
 *   extend: [{ files: [...toolingFiles, 'services/**\/*.ts'], rules: { 'no-console': 'off' } }],
 * });
 * ```
 */
export const toolingFiles = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
  '**/*.config.ts',
  '**/*.config.js',
  '**/*.config.mjs',
  '**/*.config.cjs',
  '**/scripts/**/*.ts',
  '**/scripts/**/*.js',
  '**/scripts/**/*.mjs',
  '**/scripts/**/*.cjs',
  '**/tools/**/*.ts',
  '**/tools/**/*.js',
  '**/tools/**/*.mjs',
  '**/tools/**/*.cjs',
];
