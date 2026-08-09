# @jrmoulckers/prettier-config

Engineering-owned Prettier configuration.

See [docs/adopting.md](../../docs/adopting.md) for installation and
authentication.

## Use

```js
// prettier.config.js
export { default } from '@jrmoulckers/prettier-config';        // base
export { default } from '@jrmoulckers/prettier-config/svelte'; // + prettier-plugin-svelte
```

## Settings

| Option | Value |
| --- | --- |
| `printWidth` | `100` (`96` for Markdown) |
| `tabWidth` | `2` |
| `semi` | `true` |
| `singleQuote` | `true` |
| `trailingComma` | `'all'` |
| `arrowParens` | `'always'` |
| `endOfLine` | `'lf'` |

Two values are deliberate corrections rather than a majority vote across the
repositories this was reconciled from:

- **`endOfLine: 'lf'`** — one repository used `auto`, which admits CRLF into a
  tracked file on Windows. LF is the only value consistent with an enforced
  line-ending check.
- **`semi: true`** — stated explicitly rather than relying on the default, so it
  survives a Prettier major-version change.

## Extending

Prettier configuration is plain data; spread it:

```js
import config from '@jrmoulckers/prettier-config';

export default { ...config, plugins: ['prettier-plugin-tailwindcss'] };
```
