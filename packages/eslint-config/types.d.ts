/**
 * Type declarations for the shared ESLint presets.
 *
 * **These deliberately do not reference `@types/eslint`.** A flat-config entry
 * typed as `Linter.Config` from one copy of `@types/eslint` is not assignable to
 * the same-named type from another copy, and a consumer routinely ends up with a
 * different version than this package would. Typing the surface structurally
 * keeps the presets usable from a `checkJs` config without dragging a second
 * `@types/eslint` into the consumer's graph.
 *
 * The looseness is the point: these declarations exist so `eslint.config.js`
 * type-checks under `checkJs`, not to type-check ESLint's own config schema.
 */

/** A single flat-config entry. Structural on purpose; see the note above. */
export type FlatConfigEntry = Record<string, unknown>;

/** A resolved preset: the array `eslint.config.js` exports. */
export type FlatConfig = FlatConfigEntry[];

export interface BaseOptions {
  /** Extra ignore globs, appended to the shared set. */
  ignores?: string[];
  /** Which global sets to enable. Defaults to `'both'`. */
  env?: 'browser' | 'node' | 'both';
  /** Rule overrides, applied after the preset's own. */
  rules?: Record<string, unknown>;
  /**
   * Extra flat-config entries, appended last.
   *
   * Typed as `unknown[]` rather than a config array because the entries a
   * consumer passes come from their own plugins, carrying their own
   * `@types/eslint`. Narrowing this is what makes a correct config fail to
   * compile.
   */
  extend?: unknown[];
  /** Supply type information so type-aware rules can run. Defaults to `false`. */
  typeAware?: boolean;
  /**
   * Layer the type-checked and stylistic-type-checked rule sets. Implies
   * `typeAware`. Defaults to `false`; see the README for why.
   */
  strictTypeChecked?: boolean;
}

export interface ReactOptions extends BaseOptions {
  /** Enable the React Compiler rule family. Defaults to `false`. */
  compiler?: boolean;
}

export type NextOptions = ReactOptions;
