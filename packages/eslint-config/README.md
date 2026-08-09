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
| `@jrmoulckers/eslint-config/next` | Next.js / React | `@next/eslint-plugin-next` |

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

## Base rules and why

| Rule | Setting | Reason |
| --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | error, `^_` opt-out | An unused binding is dead code or a mistake |
| `no-console` | warn, allows `warn`/`error` | Diagnostics belong in a deliberate logging seam |
| `eqeqeq` | error, `null` ignored | Coercion comparisons hide type bugs |

Tests, config files, and scripts are exempt from `no-console`.

## Compatibility

`eslint-plugin-svelte` v2 exposes flat configs under `flat/<name>`; v3 exposes
arrays at `<name>`. The Svelte preset resolves either and fails with a readable
error listing the keys it found, rather than a bare `not iterable` at config
load.
