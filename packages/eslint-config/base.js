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
 * **Type-aware linting is opt-in, and that is a deliberate trade.** The default
 * uses `tseslint.configs.recommended`, which needs no TypeScript project. The
 * type-checked rule sets — including the whole `no-unsafe-*` family and
 * `no-floating-promises` — require every linted file to resolve to a project,
 * so enabling them by default would break any consumer that lints config files
 * or scripts sitting outside `tsconfig.json`. Opting in is cheap: one measured
 * consumer went from 43 dropped rules to 13 mechanical violations.
 *
 * @param {object} [options]
 * @param {string[]} [options.ignores] Extra ignore globs appended to the shared set.
 * @param {'browser'|'node'|'both'} [options.env] Which global sets to enable. Defaults to 'both'.
 * @param {Record<string, unknown>} [options.rules] Rule overrides applied last.
 * @param {import('eslint').Linter.Config[]} [options.extend] Extra flat-config entries appended last.
 * @param {boolean} [options.typeAware] Supply type information so type-aware rules can run.
 * @param {boolean} [options.strictTypeChecked] Layer the type-checked and stylistic-type-checked
 *   rule sets. Implies `typeAware`.
 * @param {string[]} [options.untypedFiles] Extra globs for files a TypeScript project never
 *   covers. Type-aware rules are disabled for them, after `extend`. Presets pass their own
 *   file types here; `.svelte` is not a TypeScript project member even when its script block is.
 * @returns {import('eslint').Linter.Config[]}
 */
export function base(options = {}) {
  const {
    ignores = [],
    env = 'both',
    rules = {},
    extend = [],
    typeAware = false,
    strictTypeChecked = false,
    untypedFiles = [],
  } = options;

  const wantsTypeInformation = typeAware || strictTypeChecked;

  const globalSets = {
    browser: { ...globals.browser },
    node: { ...globals.node },
    both: { ...globals.browser, ...globals.node },
  };

  return tseslint.config(
    { ignores: [...sharedIgnores, ...ignores] },
    js.configs.recommended,
    ...(strictTypeChecked
      ? [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked]
      : tseslint.configs.recommended),
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
        // Type-aware, so it can only be enabled once a project is available.
        'no-return-await': 'off',
        ...(strictTypeChecked ? {} : { '@typescript-eslint/no-floating-promises': 'off' }),
        ...rules,
      },
    },
    {
      files: toolingFiles,
      rules: { 'no-console': 'off' },
    },
    ...extend,
    // Deliberately last, after `extend`. A type-aware rule on a file with no
    // type information aborts the entire ESLint run rather than that one rule,
    // so this must outrank anything a caller adds. Config files and scripts
    // routinely sit outside tsconfig.json.
    ...(wantsTypeInformation
      ? [
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
            languageOptions: { parserOptions: { projectService: true } },
          },
          // JavaScript is never covered by a TypeScript project, so every
          // type-aware rule has to come back off for it. This matters most
          // under `strictTypeChecked`, where the type-checked sets are applied
          // unscoped and would otherwise reach ordinary .js sources — not just
          // the config files and scripts the tooling globs cover.
          {
            files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
            languageOptions: { parserOptions: { projectService: false } },
            rules: tseslint.configs.disableTypeChecked.rules,
          },
          {
            files: toolingFiles,
            languageOptions: { parserOptions: { projectService: false } },
            rules: tseslint.configs.disableTypeChecked.rules,
          },
          // Preset-supplied file types with the same property. A preset cannot
          // fix this itself: its own entries go through `extend`, which is
          // inserted *above* these blocks, so anything it adds is outranked by
          // the very defaults it needs to override. The glob has to arrive here.
          ...(untypedFiles.length > 0
            ? [
                {
                  files: untypedFiles,
                  languageOptions: { parserOptions: { projectService: false } },
                  rules: tseslint.configs.disableTypeChecked.rules,
                },
              ]
            : []),
        ]
      : []),
  );
}

export default base;
