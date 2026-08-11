import reactHooks from 'eslint-plugin-react-hooks';

/**
 * The two rules `eslint-plugin-react-hooks` has always shipped.
 *
 * Everything else in the plugin's recommended set arrived with the React
 * Compiler and is treated as opt-in; see `resolveHooks`.
 */
export const CLASSIC_HOOK_RULES = new Set([
  'react-hooks/rules-of-hooks',
  'react-hooks/exhaustive-deps',
]);

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
export function isFlatConfig(value) {
  if (!value || typeof value !== 'object') return false;
  return !Array.isArray(/** @type {{ plugins?: unknown }} */ (value).plugins);
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
 * Shared by the React and Next presets. Next.js *is* React, and
 * `eslint-config-next` — what Next consumers migrate off — bundles hooks
 * linting, so a Next preset without it silently drops the two rules most likely
 * to catch a real bug.
 *
 * @param {boolean} compiler
 * @returns {import('eslint').Linter.Config[]}
 */
export function resolveHooks(compiler) {
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
  const config = candidates.find(isFlatConfig);

  if (!config) {
    throw new TypeError(
      '@jrmoulckers/eslint-config: eslint-plugin-react-hooks exposes no usable flat config at ' +
        '"configs.flat.recommended". Its export shape has changed; the preset needs updating.',
    );
  }

  if (compiler) return [/** @type {import('eslint').Linter.Config} */ (config)];

  const rules = { .../** @type {import('eslint').Linter.Config} */ (config.rules ?? {}) };
  for (const name of Object.keys(rules)) {
    if (!CLASSIC_HOOK_RULES.has(name)) rules[name] = 'off';
  }

  return [{ .../** @type {import('eslint').Linter.Config} */ (config), rules }];
}
