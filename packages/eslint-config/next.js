import next from '@next/eslint-plugin-next';

import { base } from './base.js';

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
      next.flatConfig.coreWebVitals,
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
