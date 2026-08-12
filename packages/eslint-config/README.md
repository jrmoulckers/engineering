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
| `@jrmoulckers/eslint-config/next`   | Next.js         | `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`                      |

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

### Take `no-floating-promises` without taking the rest

`strictTypeChecked` is a large first bill. Measured on one repository: **2,093
findings across 45 rules**, led by `no-unsafe-assignment` (311) and
`no-unnecessary-type-assertion` (187). Most of that is untyped surface rather
than defects, and it scales with how much `any` a codebase carries, not with how
many files it has — so treat any quoted figure as a range, not an estimate.

`no-floating-promises` is the rule in that set that finds a genuine defect class:
a dropped rejection is a failure that never surfaces. On the same repository it
accounted for **54 sites in 32 files**. You can enable it alone:

```js
base({
  typeAware: true,
  rules: { '@typescript-eslint/no-floating-promises': 'error' },
});
```

Roughly a fifth of the findings, and the ones worth acting on first.

This is safe rather than lucky, and the ordering is what makes it so. A caller's
`rules` are merged into the preset's own rules block, which sits **before** the
trailing blocks that switch type-aware rules off for JavaScript, tooling and any
file type the preset marks untyped. So the override reaches TypeScript files and
cannot reach the files that have no project behind them. Verified: with the
config above, `no-floating-promises` resolves to severity `2` on a `.ts` file in
the project and `0` on a `.js` file, and the run exits `1` with findings rather
than `2` with a crash.

### Tooling globs

Repositories disagree about where tooling lives. `toolingFiles` covers tests,
`*.config.*`, `scripts/**` and `tools/**`; it deliberately does not claim
directories like `services/` or `internal/`, which are product source in most
repositories. Extend it rather than re-authoring it:

```js
import { toolingFiles } from '@jrmoulckers/eslint-config/ignores';

export default base({
  extend: [
    {
      files: [...toolingFiles, 'services/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
});
```

The React **and Next** presets take one additional option:

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

### The Next preset lints hooks too

Next.js is React, and `eslint-config-next` — what Next consumers migrate off — bundles
`eslint-plugin-react-hooks`. A Next preset without it would silently drop `rules-of-hooks` and
`exhaustive-deps`, the two rules most likely to catch a real bug, with nothing at the call site
to say so.

Both presets resolve hooks through the same module and a test asserts they stay identical, so
the Next path cannot quietly drift from the React one again. `nextConfig({ compiler: true })`
opts into the Compiler family on the same terms.

The Next preset does **not** pull in `eslint-plugin-react` or `eslint-plugin-jsx-a11y`. Use
`reactConfig` if you want those; the hooks rules are included because losing them is a
correctness regression, not a stylistic preference.

## Type declarations

Every entrypoint ships a hand-written `.d.ts` beside it, wired through the `exports` map, so
consumers get option checking without a `@types` install — including repos that lint their own
`eslint.config.js` under `checkJs`.

The declarations deliberately do **not** reference `eslint` or `@types/eslint`, and `extend` is
typed `unknown[]`. Config objects originating from two different `@types/eslint` copies are not
mutually assignable, so a narrower type would make _correct_ configs fail to compile. Loose here
is the accurate choice, not the lazy one.

## Base rules and why

| Rule                                | Setting                     | Reason                                          |
| ----------------------------------- | --------------------------- | ----------------------------------------------- |
| `@typescript-eslint/no-unused-vars` | error, `^_` opt-out         | An unused binding is dead code or a mistake     |
| `no-console`                        | warn, allows `warn`/`error` | Diagnostics belong in a deliberate logging seam |
| `eqeqeq`                            | error, `null` ignored       | Coercion comparisons hide type bugs             |

Tests, config files, and scripts are exempt from `no-console`.

### `warn` is not advisory under `--max-warnings 0`

Every preset ships some rules at `warn` deliberately, on the reasoning that they flag things worth
seeing but not worth blocking a build for. **That reasoning is void the moment a consumer runs
`eslint --max-warnings 0`**, which is a common and otherwise sensible gate: a `warn` then fails
the build exactly as an `error` does, and the severity distinction this package chose collapses
without any signal that it has.

The count is not one or two rules. Measured from the resolved config on a `.tsx` file:

| Preset           | Rules at `warn` |
| ---------------- | --------------- |
| `base()`         | 1               |
| `reactConfig()`  | 2               |
| `svelteConfig()` | 2               |
| `nextConfig()`   | **18**          |

`no-console` reaches every preset, so no consumer is exempt. The Next figure is large because
`@next/next` publishes 14 of its own rules at `warn`, and the preset deliberately preserves Next's
severities rather than promoting them.

The rules most likely to need a per-repo decision under that flag are the two with genuine false
positives — `react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any` — plus
`no-console` in any repository with legitimate console output outside the tooling globs.

Neither severity is wrong; they are answering different questions. **Decide which gate you are
running before reading a `warn` as advisory:**

```jsonc
// treats warn as advisory — the severities in this package mean what they say
"lint": "eslint ."

// treats warn as fatal — every rule in the table above becomes blocking
"lint": "eslint . --max-warnings 0"
```

If you want the second gate and not the promotion, downgrade the specific rules at the call site
rather than abandoning the flag:

```js
export default nextConfig({
  rules: { 'react-hooks/exhaustive-deps': 'off' },
});
```

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
