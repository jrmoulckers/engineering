import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

import { base } from './base.js';

/**
 * Resolve a flat-config array from the Svelte plugin across major versions.
 *
 * v2 publishes flat configs under `flat/<name>` and keeps the legacy eslintrc
 * object at `<name>`. v3 drops the prefix and publishes arrays at `<name>`.
 * Reading the wrong one yields a non-iterable object and fails at config load.
 *
 * @param {string} name
 * @returns {import('eslint').Linter.Config[]}
 */
function flatConfigs(name) {
  const configs = svelte.configs ?? {};
  const candidate = configs[`flat/${name}`] ?? configs[name];

  if (!Array.isArray(candidate)) {
    throw new TypeError(
      `@jrmoulckers/eslint-config: eslint-plugin-svelte exposes no flat config for "${name}". ` +
        `Found keys: ${Object.keys(configs).join(', ') || '(none)'}.`,
    );
  }

  return candidate;
}

/**
 * Svelte preset. Layers the Svelte plugin's recommended rules and its Prettier
 * reconciliation on top of the base TypeScript preset, then teaches the Svelte
 * parser to delegate `<script lang="ts">` blocks to the TypeScript parser.
 *
 * Requires `eslint-plugin-svelte` and `prettier-plugin-svelte` in the consumer.
 *
 * @param {Parameters<typeof base>[0]} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function svelteConfig(options = {}) {
  const { extend = [], ...rest } = options;

  return base({
    ...rest,
    extend: [
      ...flatConfigs('recommended'),
      ...flatConfigs('prettier'),
      {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
          parserOptions: {
            parser: tseslint.parser,
            projectService: false,
          },
        },
      },
      ...extend,
    ],
  });
}

export default svelteConfig;
