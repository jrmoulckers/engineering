/**
 * Base Prettier configuration.
 *
 * Reconciled from the configurations in use across the product repositories.
 * Two values are deliberate corrections rather than a majority vote:
 *
 * - `endOfLine: 'lf'` — one repository used `auto`, which lets CRLF enter a
 *   tracked file on Windows. LF is the only value consistent with the
 *   repository's enforced line-ending check.
 * - `semi: true` — stated explicitly rather than left to the default so the
 *   value survives a Prettier major-version change.
 *
 * @type {import('prettier').Config}
 */
export const config = {
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.md',
      options: { proseWrap: 'always', printWidth: 96 },
    },
  ],
};

export default config;
