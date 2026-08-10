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
 * **Type-aware.** `@typescript-eslint/no-misused-promises` needs type
 * information, so this preset enables typescript-eslint's project service for
 * TypeScript files and turns type-aware rules back off for JavaScript tooling
 * files, which are typically outside `tsconfig.json`. Pass `typeAware: false`
 * if your repository cannot supply a project — the type-aware rule is then
 * dropped rather than left enabled and crashing.
 *
 * @param {Parameters<typeof base>[0] & { typeAware?: boolean }} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function nextConfig(options = {}) {
  const { ignores = [], extend = [], typeAware = true, ...rest } = options;

  return base({
    ...rest,
    env: 'both',
    typeAware,
    ignores: [
      '**/.next/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Next regenerates this on every build and it carries a triple-slash
      // reference the preset otherwise reports.
      '**/next-env.d.ts',
      ...ignores,
    ],
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
          '@typescript-eslint/no-explicit-any': 'warn',
        },
      },
      // Scoped to TypeScript, matching exactly the files `base` gives a project
      // service to. A type-aware rule enabled on a file with no type
      // information aborts the whole run, so it must never apply more widely —
      // including to plain .js sources, which are not tooling files and would
      // otherwise be caught by an unscoped rules entry.
      ...(typeAware
        ? [
            {
              files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
              rules: {
                // Passing an async function where a void return is expected
                // silently drops the rejection. JSX attributes are exempt
                // because React event handlers legitimately take them.
                '@typescript-eslint/no-misused-promises': [
                  'error',
                  { checksVoidReturn: { attributes: false } },
                ],
              },
            },
          ]
        : []),
      ...extend,
    ],
  });
}

export default nextConfig;
