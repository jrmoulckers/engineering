# @jrmoulckers/eslint-config

Engineering-owned ESLint flat-configuration presets.

Consolidated from the configurations previously hand-authored in each product repository; the
strictest variant of each rule was kept. Formatting is delegated entirely to Prettier — this
package carries only correctness and discipline rules.

See [docs/adopting.md](../../docs/adopting.md) for installation and authentication.

## Presets

| Import                              | For             | Requires                                                                     |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `@jrmoulckers/eslint-config`        | Any TypeScript  | —                                                                            |
| `@jrmoulckers/eslint-config/svelte` | Svelte 5 + Vite | `eslint-plugin-svelte`                                                       |
| `@jrmoulckers/eslint-config/react`  | React + Vite    | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` |
| `@jrmoulckers/eslint-config/next`   | Next.js         | `@next/eslint-plugin-next`                                                   |

## Options

Every preset is a function taking the same options:

| Option              | Type                            | Default  | Effect                                        |
| ------------------- | ------------------------------- | -------- | --------------------------------------------- |
| `ignores`           | `string[]`                      | `[]`     | Appended to the shared ignore set             |
| `env`               | `'browser' \| 'node' \| 'both'` | `'both'` | Which global sets to enable                   |
| `rules`             | `object`                        | `{}`     | Rule overrides applied after the preset's own |
| `extend`            | `Config[]`                      | `[]`     | Flat-config entries appended last             |
| `typeAware`         | `boolean`                       | `false`  | Supply type information to TypeScript files   |
| `strictTypeChecked` | `boolean`                       | `false`  | Layer the type-checked rule sets              |

```js
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';

export default svelteConfig({
  ignores: ['static/**'],
  rules: { 'no-console': 'off' },
});
```

Product-specific rules belong in `extend`, never upstream in this package.

## Type-aware linting is opt-in

`base()` uses `tseslint.configs.recommended`, **not** `recommendedTypeChecked` +
`stylisticTypeChecked`. This is a deliberate decision, recorded here because it
is otherwise invisible: adopting this preset in place of a hand-rolled
type-checked config **removes roughly 40 active rules**, including the entire
`no-unsafe-*` family, `no-floating-promises`, `await-thenable`, `unbound-method`
and `restrict-template-expressions`. Nothing is gained in exchange. If you are
migrating from a type-checked setup, that is a real reduction in coverage and
you should opt back in.

The default is untyped because type-aware rules require **every linted file to
resolve to a TypeScript project**. A type-aware rule on a file with no type
information does not fail that rule — it aborts the entire ESLint run. Config
files, scripts and plain `.js` sources routinely sit outside `tsconfig.json`, so
enabling the type-checked sets by default would break consumers on contact.

Opting in is cheap. One consumer measured the full cost of turning it on across
a large app at **13 mechanical violations**; the unsafe family reported zero.

```js
export default base({ strictTypeChecked: true });
```

`strictTypeChecked` implies `typeAware`, supplies a project service to
TypeScript files, and turns type-aware rules back **off** for JavaScript,
config files, scripts and tests, so files outside your project cannot abort the
run. Use `typeAware: true` alone if you want type information available without
the type-checked rule sets.

The React preset takes one additional option:

| Option     | Type      | Default | Effect                                |
| ---------- | --------- | ------- | ------------------------------------- |
| `compiler` | `boolean` | `false` | Enable the React Compiler rule family |

## The React preset

Carries hook correctness (`react-hooks`) and accessibility (`jsx-a11y`), and deliberately drops
two things from `eslint-plugin-react`'s recommended set:

- `react/prop-types`, which duplicates work TypeScript already does.
- `react/react-in-jsx-scope`, made obsolete by the automatic JSX runtime.

### Why the Compiler rules are opt-in

`eslint-plugin-react-hooks` v7 expanded `recommended` from two rules to sixteen by folding in
the React Compiler family — `purity`, `immutability`, `set-state-in-effect`,
`preserve-manual-memoization`, and others. Those rules are valuable, but on an existing codebase
they are a migration rather than a lint config: enabling them wholesale can produce thousands of
findings, and the practical result is that a repository disables the plugin entirely.

So the two classic rules are always on, and the rest are enabled with
`reactConfig({ compiler: true })` when a repository is ready to do the work.

The opt-out set is **derived** from whatever the installed plugin ships, not hardcoded, so a
rule added in a future version is handled without a change here.

## Base rules and why

| Rule                                | Setting                     | Reason                                          |
| ----------------------------------- | --------------------------- | ----------------------------------------------- |
| `@typescript-eslint/no-unused-vars` | error, `^_` opt-out         | An unused binding is dead code or a mistake     |
| `no-console`                        | warn, allows `warn`/`error` | Diagnostics belong in a deliberate logging seam |
| `eqeqeq`                            | error, `null` ignored       | Coercion comparisons hide type bugs             |

Tests, config files, and scripts are exempt from `no-console`.

## Compatibility

Plugins disagree about where flat configs live, and reading the wrong key fails at config load
with an error that names no plugin.

`eslint-plugin-svelte` v2 exposes flat configs under `flat/<name>` and v3 exposes arrays at
`<name>`. `eslint-plugin-react-hooks` v7 keeps flat configs under `configs.flat.*` and leaves
**legacy eslintrc objects** at the bare `recommended` / `recommended-latest` keys, where v5 had
published the flat one.

Both presets therefore select by _shape_ rather than by key name — a flat config declares
`plugins` as an object, eslintrc as an array of strings — and fail with a readable error naming
the package when no usable config is found.
