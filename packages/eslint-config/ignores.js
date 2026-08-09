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
 * Files that legitimately write to the console: tests, config, and scripts.
 */
export const toolingFiles = [
  '**/*.test.ts',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.config.ts',
  '**/*.config.js',
  '**/*.config.mjs',
  '**/scripts/**/*.js',
  '**/scripts/**/*.mjs',
  '**/scripts/**/*.ts',
];
