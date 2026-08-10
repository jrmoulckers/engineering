import next from '@next/eslint-plugin-next';

import { base } from './base.js';

/**
 * Is this a flat config, rather than a legacy eslintrc object?
 *
 * The reliable discriminator is `plugins`: flat config requires an object,
 * eslintrc used an array of strings. Key names are not a reliable signal —
 * v16 publishes the flat config at `configs['core-web-vitals']`, which in v15
 * was the eslintrc one.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFlatConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { plugins } = /** @type {{ plugins?: unknown }} */ (value);
  return Boolean(plugins) && !Array.isArray(plugins);
}

/**
 * Resolve Next's Core Web Vitals flat config across plugin majors.
 *
 * v15 exposed it at `flatConfig.coreWebVitals`. v16 empties `flatConfig`
 * entirely and moves flat configs to `configs['core-web-vitals']`, leaving the
 * eslintrc form at `configs['core-web-vitals-legacy']`. Reading the v15 key
 * under v16 yields `undefined`, which ESLint reports as a malformed config
 * naming no plugin.
 *
 * @returns {import('eslint').Linter.Config}
 */
function resolveCoreWebVitals() {
  const candidates = [
    next.flatConfig?.coreWebVitals,
    next.configs?.['core-web-vitals'],
    next.configs?.coreWebVitals,
  ];

  const config = candidates.find(isFlatConfig);
  if (config) return /** @type {import('eslint').Linter.Config} */ (config);

  throw new TypeError(
    '@jrmoulckers/eslint-config: @next/eslint-plugin-next exposes no usable flat ' +
      'Core Web Vitals config. Its export shape has changed; the preset needs updating.',
  );
}

/**
 * Next.js / React preset. Layers Next's Core Web Vitals rules on top of the
 * base TypeScript preset.
 *
 * Carries only rules that apply to any Next.js application. Product-specific
 * plugins — ORM guards, i18n literal checks, and similar domain rules — stay in
 * the consuming repository and are passed through `rules` and `extend`.
 *
 * Requires `@next/eslint-plugin-next` in the consumer.
 *
 * @param {Parameters<typeof base>[0]} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function nextConfig(options = {}) {
  const { ignores = [], extend = [], ...rest } = options;

  return base({
    ...rest,
    env: 'both',
    ignores: ['**/.next/**', '**/playwright-report/**', '**/test-results/**', ...ignores],
    extend: [
      resolveCoreWebVitals(),
      {
        rules: {
          // A type-only import that survives into the emitted module changes
          // runtime behaviour; make the intent explicit at the import site.
          '@typescript-eslint/consistent-type-imports': [
            'warn',
            { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
          ],
          // Passing an async function where a void return is expected silently
          // drops the rejection. JSX attributes are exempt because React event
          // handlers legitimately take them.
          '@typescript-eslint/no-misused-promises': [
            'error',
            { checksVoidReturn: { attributes: false } },
          ],
          '@typescript-eslint/no-explicit-any': 'warn',
        },
      },
      ...extend,
    ],
  });
}

export default nextConfig;
