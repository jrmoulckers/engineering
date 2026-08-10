# @jrmoulckers/eslint-config

Engineering-owned ESLint flat-configuration presets.

Consolidated from the configurations previously hand-authored in each product
repository; the strictest variant of each rule was kept. Formatting is delegated
entirely to Prettier — this package carries only correctness and discipline
rules.

See [docs/adopting.md](../../docs/adopting.md) for installation and
authentication.

## Presets

| Import | For | Requires |
| --- | --- | --- |
| `@jrmoulckers/eslint-config` | Any TypeScript | — |
| `@jrmoulckers/eslint-config/svelte` | Svelte 5 + Vite | `eslint-plugin-svelte` |
| `@jrmoulckers/eslint-config/react` | React + Vite | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` |
| `@jrmoulckers/eslint-config/next` | Next.js | `@next/eslint-plugin-next` |

## Options

Every preset is a function taking the same options:

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `ignores` | `string[]` | `[]` | Appended to the shared ignore set |
| `env` | `'browser' \| 'node' \| 'both'` | `'both'` | Which global sets to enable |
| `rules` | `object` | `{}` | Rule overrides applied after the preset's own |
| `extend` | `Config[]` | `[]` | Flat-config entries appended last |

```js
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';

export default svelteConfig({
  ignores: ['static/**'],
  rules: { 'no-console': 'off' },
});
```

Product-specific rules belong in `extend`, never upstream in this package.

The React preset takes one additional option:

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `compiler` | `boolean` | `false` | Enable the React Compiler rule family |

## The React preset

Carries hook correctness (`react-hooks`) and accessibility (`jsx-a11y`), and
deliberately drops two things from `eslint-plugin-react`'s recommended set:

- `react/prop-types`, which duplicates work TypeScript already does.
- `react/react-in-jsx-scope`, made obsolete by the automatic JSX runtime.

### Why the Compiler rules are opt-in

`eslint-plugin-react-hooks` v7 expanded `recommended` from two rules to sixteen
by folding in the React Compiler family — `purity`, `immutability`,
`set-state-in-effect`, `preserve-manual-memoization`, and others. Those rules
are valuable, but on an existing codebase they are a migration rather than a
lint config: enabling them wholesale can produce thousands of findings, and the
practical result is that a repository disables the plugin entirely.

So the two classic rules are always on, and the rest are enabled with
`reactConfig({ compiler: true })` when a repository is ready to do the work.

The opt-out set is **derived** from whatever the installed plugin ships, not
hardcoded, so a rule added in a future version is handled without a change
here.

## Base rules and why

| Rule | Setting | Reason |
| --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | error, `^_` opt-out | An unused binding is dead code or a mistake |
| `no-console` | warn, allows `warn`/`error` | Diagnostics belong in a deliberate logging seam |
| `eqeqeq` | error, `null` ignored | Coercion comparisons hide type bugs |

Tests, config files, and scripts are exempt from `no-console`.

## Compatibility

Plugins disagree about where flat configs live, and reading the wrong key fails
at config load with an error that names no plugin.

`eslint-plugin-svelte` v2 exposes flat configs under `flat/<name>` and v3
exposes arrays at `<name>`. `eslint-plugin-react-hooks` v7 keeps flat configs
under `configs.flat.*` and leaves **legacy eslintrc objects** at the bare
`recommended` / `recommended-latest` keys, where v5 had published the flat one.

Both presets therefore select by *shape* rather than by key name — a flat
config declares `plugins` as an object, eslintrc as an array of strings — and
fail with a readable error naming the package when no usable config is found.
