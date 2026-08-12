import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { isFlatConfig, resolveHooks } from './hooks.js';

export const JSX_FILES = ['**/*.jsx', '**/*.tsx'];

/**
 * Resolve the consumer's React version at config-construction time.
 *
 * `eslint-plugin-react` accepts `version: 'detect'`, but its detection calls
 * `context.getFilename()`, which ESLint 10 removed. Every rule in the plugin
 * then fails to load with `contextOrFilename.getFilename is not a function` —
 * which reads like a broken plugin rather than a removed API, and is why this
 * is worth resolving here instead.
 *
 * Reading the version ourselves keeps the plugin working on ESLint 9 and 10
 * alike, because a concrete version never enters the detection path. When
 * React cannot be resolved we return `undefined` and set nothing: the plugin
 * warns and falls back to its own default, which still loads.
 *
 * @returns {string | undefined}
 */
function detectReactVersion() {
  // Resolve from the consumer's root first. `import.meta.url` would resolve
  // relative to this package, which under pnpm's non-hoisted layout is a
  // different (or absent) React than the one being linted.
  const candidates = [join(process.cwd(), 'noop.js'), import.meta.url];

  for (const from of candidates) {
    try {
      const { version } = createRequire(from)('react/package.json');
      if (typeof version === 'string' && version) return version;
    } catch {
      // Try the next resolution root.
    }
  }
  return undefined;
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
 * The React linting layer shared by `reactConfig()` and `nextConfig()`:
 * `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react-hooks`.
 *
 * **This exists so the two presets cannot drift.** `nextConfig()` originally
 * imported only `@next/eslint-plugin-next` and layered hooks by hand. That
 * dropped 17 `react/*` and 6 `jsx-a11y/*` rules relative to the
 * `eslint-config-next` consumers migrate off — which bundles
 * `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react-hooks`
 * as direct dependencies, not just hooks.
 *
 * The regression was silent in the worst way. Removing `eslint-config-next` also
 * removes the only thing that installed those two plugins, so nothing was left
 * to report an unresolved plugin: the rules simply ceased to exist and lint
 * stayed green. `react/jsx-key` — a real correctness bug — passed.
 *
 * Duplicating this block in both presets would restore coverage today and let it
 * diverge again on the next change, so both presets call this instead.
 *
 * @param {boolean} [compiler] Enable the React Compiler rule family.
 * @returns {import('eslint').Linter.Config[]}
 */
export function reactLayer(compiler = false) {
  const reactFlat = reactPlugin.configs?.flat ?? {};
  const reactVersion = detectReactVersion();

  return [
    ...asConfigArray('eslint-plugin-react', reactFlat.recommended, 'configs.flat.recommended'),
    ...asConfigArray(
      'eslint-plugin-react',
      reactFlat['jsx-runtime'],
      "configs.flat['jsx-runtime']",
    ),
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
      ...(reactVersion ? { settings: { react: { version: reactVersion } } } : {}),
      rules: {
        // TypeScript checks prop shapes; prop-types is redundant ceremony.
        'react/prop-types': 'off',
        // The automatic JSX runtime removed the need for React to be in scope.
        'react/react-in-jsx-scope': 'off',
      },
    },
  ];
}
