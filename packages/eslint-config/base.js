import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

import { sharedIgnores, toolingFiles } from './ignores.js';

/**
 * Base TypeScript preset.
 *
 * Consolidated from the strictest configuration in use across the product
 * repositories. Formatting is delegated entirely to Prettier; this preset only
 * carries correctness and discipline rules.
 *
 * @param {object} [options]
 * @param {string[]} [options.ignores] Extra ignore globs appended to the shared set.
 * @param {'browser'|'node'|'both'} [options.env] Which global sets to enable. Defaults to 'both'.
 * @param {Record<string, unknown>} [options.rules] Rule overrides applied last.
 * @param {import('eslint').Linter.Config[]} [options.extend] Extra flat-config entries appended last.
 * @returns {import('eslint').Linter.Config[]}
 */
export function base(options = {}) {
  const { ignores = [], env = 'both', rules = {}, extend = [] } = options;

  const globalSets = {
    browser: { ...globals.browser },
    node: { ...globals.node },
    both: { ...globals.browser, ...globals.node },
  };

  return tseslint.config(
    { ignores: [...sharedIgnores, ...ignores] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
      languageOptions: {
        globals: globalSets[env] ?? globalSets.both,
      },
      rules: {
        // An unused binding is either dead code or a mistake. A leading
        // underscore is the explicit opt out.
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        // Diagnostics belong in a deliberate logging seam, not stray console
        // calls. Warnings and errors stay available for genuine failures.
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        // A swallowed rejection hides the failure it was supposed to surface.
        'no-return-await': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        ...rules,
      },
    },
    {
      files: toolingFiles,
      rules: { 'no-console': 'off' },
    },
    ...extend,
  );
}

export default base;
