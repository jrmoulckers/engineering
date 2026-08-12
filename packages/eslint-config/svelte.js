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
 * The rules half of `typescript-eslint`'s `eslint-recommended` layer.
 *
 * Exposed as a bare config object on some majors and as a single-element array
 * on others; both carry the same `rules`. Resolved once at module load so a
 * shape change fails loudly here rather than silently applying no rules.
 *
 * @returns {Record<string, unknown>}
 */
function resolveEslintRecommendedRules() {
  const candidate = tseslint.configs.eslintRecommended;
  const entry = Array.isArray(candidate) ? candidate.find((c) => c?.rules) : candidate;

  if (!entry?.rules || Object.keys(entry.rules).length === 0) {
    throw new TypeError(
      '@jrmoulckers/eslint-config: typescript-eslint exposes no rules on `configs.eslintRecommended`. ' +
        `Received: ${Object.prototype.toString.call(candidate)}.`,
    );
  }

  return entry.rules;
}

const eslintRecommendedRules = resolveEslintRecommendedRules();

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
    // `.svelte` is not a member of a TypeScript project even when its script
    // block is TypeScript, and this preset opts it out of `projectService`
    // above. Under `strictTypeChecked` the type-checked sets are applied
    // unscoped, so without this every type-aware rule reaches `.svelte` with no
    // project behind it and the first component aborts the entire run.
    untypedFiles: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
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
      // `typescript-eslint`'s `eslint-recommended` layer is scoped to
      // `**/*.ts` and friends, so it never reaches `.svelte`. That single
      // omission causes an asymmetry in both directions: 18 core rules the
      // TypeScript compiler already enforces stay on for `.svelte` files, and
      // four rules the same layer *enables* stay off for them.
      //
      // `no-undef` is the one that draws blood. Ambient and namespaced types
      // are values it cannot see, so `NodeJS.Timeout` and SvelteKit's own
      // `App.*` namespace are reported as undefined in `<script lang="ts">`
      // while identical code in a `.ts` file is clean.
      //
      // The trade: a `.svelte` file with a plain `<script>` gives up `no-undef`
      // too. That is deliberate. Svelte projects type-check components with
      // `svelte-check`, so the compiler-already-checks-this rationale holds for
      // the whole file type, and a false positive that cannot be fixed in the
      // source is worse than a missed one that another tool reports.
      {
        files: ['**/*.svelte'],
        rules: eslintRecommendedRules,
      },
      ...extend,
    ],
  });
}

export default svelteConfig;
