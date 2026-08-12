/**
 * Ignore globs shared by every preset. Build output, dependencies, coverage,
 * vendored upstream artifacts, and generated tool directories are never linted.
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
