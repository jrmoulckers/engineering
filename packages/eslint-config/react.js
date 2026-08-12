import { base } from './base.js';
import { reactLayer } from './react-layer.js';

/**
 * React preset.
 *
 * Layers React correctness and accessibility linting on top of the base
 * TypeScript preset. Deliberately excludes `eslint-plugin-react`'s prop-types
 * rules, which duplicate work TypeScript already does, and its
 * `react-in-jsx-scope` rule, which the automatic JSX runtime made obsolete.
 *
 * The plugin layer itself lives in `react-layer.js` and is shared with
 * `nextConfig()`, so a Next application gets the same React and accessibility
 * rules as a Vite one.
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

  return base({
    ...rest,
    extend: [...reactLayer(compiler), ...extend],
  });
}

export default reactConfig;
