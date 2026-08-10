import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { base } from './base.js';

const JSX_FILES = ['**/*.jsx', '**/*.tsx'];

/**
 * The two rules `eslint-plugin-react-hooks` has always shipped.
 *
 * Everything else in the plugin's recommended set arrived with the React
 * Compiler and is treated as opt-in; see `resolveHooks`.
 */
const CLASSIC_HOOK_RULES = new Set(['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps']);

/**
 * Is this a flat config, rather than a legacy eslintrc object?
 *
 * The reliable discriminator is `plugins`: flat config requires an object,
 * eslintrc used an array of strings. Key names are not a reliable signal
 * because plugins have moved their flat configs between keys across versions.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFlatConfig(value) {
  if (!value || typeof value !== 'object') return false;
  return !Array.isArray(/** @type {{ plugins?: unknown }} */ (value).plugins);
}

/**
 * Resolve a flat config from a plugin that may publish it under any of several
 * historical keys, and may publish either an array or a single config object.
 *
 * Each React plugin picked a different convention, and reading the wrong key
 * yields a value that fails at config load rather than at lint time.
 *
 * @param {string} pluginName Package name, for the error message only.
 * @param {unknown} candidate The value read from the plugin.
 * @param {string} where Key path that was read, for the error message only.
 * @returns {import('eslint').Linter.Config[]}
 */
function asConfigArray(pluginName, candidate, where) {
  if (Array.isArray(candidate) && candidate.every(isFlatConfig)) return candidate;
  if (isFlatConfig(candidate)) return [/** @type {import('eslint').Linter.Config} */ (candidate)];

  throw new TypeError(
    `@jrmoulckers/eslint-config: ${pluginName} exposes no usable flat config at "${where}". ` +
      `Its export shape has changed; the preset needs updating.`,
  );
}

/**
 * Build the react-hooks entry.
 *
 * v7 expanded `recommended` from two rules to sixteen by folding in the React
 * Compiler rule family (purity, immutability, set-state-in-effect, and so on).
 * Those rules are valuable but they are a migration, not a lint config: turning
 * them on wholesale can produce thousands of findings in an existing codebase,
 * which in practice means a repository disables the whole plugin.
 *
 * So the classic correctness rules are always on, and the rest are opt-in via
 * `compiler: true`. The opt-out set is derived from whatever the installed
 * plugin actually ships rather than hardcoded, so a future rule is handled
 * without a change here.
 *
 * @param {boolean} compiler
 * @returns {import('eslint').Linter.Config[]}
 */
function resolveHooks(compiler) {
  const configs = reactHooks.configs ?? {};

  // Order matters only as a preference; `isFlatConfig` decides. v7 keeps flat
  // configs under `flat/*` and leaves eslintrc objects at the bare keys, while
  // v5 published the flat config at `recommended-latest`. Picking by key name
  // alone silently yields an eslintrc object on one of the two.
  const candidates = [
    configs.flat?.['recommended-latest'],
    configs.flat?.recommended,
    configs['recommended-latest'],
    configs.recommended,
  ];
  const flat = candidates.find(isFlatConfig);
  const [config] = asConfigArray('eslint-plugin-react-hooks', flat, 'configs.flat.recommended');

  if (compiler) return [config];

  const rules = { ...config.rules };
  for (const name of Object.keys(rules)) {
    if (!CLASSIC_HOOK_RULES.has(name)) rules[name] = 'off';
  }

  return [{ ...config, rules }];
}

/**
 * React preset.
 *
 * Layers React correctness and accessibility linting on top of the base
 * TypeScript preset. Deliberately excludes `eslint-plugin-react`'s prop-types
 * rules, which duplicate work TypeScript already does, and its
 * `react-in-jsx-scope` rule, which the automatic JSX runtime made obsolete.
 *
 * Requires `eslint-plugin-react`, `eslint-plugin-react-hooks`, and
 * `eslint-plugin-jsx-a11y` in the consumer.
 *
 * @param {Parameters<typeof base>[0] & { compiler?: boolean }} [options]
 * @param {boolean} [options.compiler] Enable the React Compiler rule family. Defaults to false.
 * @returns {import('eslint').Linter.Config[]}
 */
export function reactConfig(options = {}) {
  const { compiler = false, extend = [], ...rest } = options;

  const reactFlat = reactPlugin.configs?.flat ?? {};

  return base({
    ...rest,
    extend: [
      ...asConfigArray('eslint-plugin-react', reactFlat.recommended, 'configs.flat.recommended'),
      ...asConfigArray('eslint-plugin-react', reactFlat['jsx-runtime'], "configs.flat['jsx-runtime']"),
      ...asConfigArray(
        'eslint-plugin-jsx-a11y',
        jsxA11y.flatConfigs?.recommended ?? jsxA11y.configs?.recommended,
        'flatConfigs.recommended',
      ),
      ...resolveHooks(compiler),
      {
        files: JSX_FILES,
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      {
        settings: { react: { version: 'detect' } },
        rules: {
          // TypeScript checks prop shapes; prop-types is redundant ceremony.
          'react/prop-types': 'off',
          // The automatic JSX runtime removed the need for React to be in scope.
          'react/react-in-jsx-scope': 'off',
        },
      },
      ...extend,
    ],
  });
}

export default reactConfig;
