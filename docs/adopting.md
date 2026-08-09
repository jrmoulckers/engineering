# Adopting Engineering practice

How a repository consumes this one. Three layers, adopt in order.

| Layer | What you get | Transport |
| --- | --- | --- |
| [Principles](../principles/README.md) | 66 ratified `ENG-*` rules + evidence | Cite by ID; resolve via `principles/index.json` |
| [Practices](../practices/README.md) | Technique for satisfying them | Link by URL |
| [Packages](#2-install-the-shared-configuration) | Executable enforcement | GitHub Packages |

## 1. Cite principles by ID

Replace restated rules with a citation. Under
[ADR-0003](https://github.com/jrmoulckers/.github/blob/main/docs/architecture/0003-four-authority-topology.md),
no authority may copy another's normative text — a copy drifts and hides who
owns the rule.

```diff
-## Sync rules
-
-Deletes are tombstones. Records are retained so clients converge, and merges
-take the newest `updatedAt` per record.
+## Sync rules
+
+Merge behaviour follows `ENG-LOCAL-003` (declared conflict model). See
+[local-first sync](https://github.com/jrmoulckers/engineering/blob/main/practices/local-first-sync.md).
+
+Docket-specific: the mutation log is server-authoritative (ADR-0003), so
+`updatedAt` ties break toward the server sequence.
```

Keep whatever is genuinely product-specific. Delete only what restates a rule
this repository already owns.

`principles/index.json` resolves any ID to its title, statement, status, and
source path:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-003") | .statement'
```

## 2. Install the shared configuration

The packages are published to **GitHub Packages**, which requires the
`@jrmoulckers` scope and authentication even for reads, because this
repository is private.

> **GitHub Packages only supports classic personal access tokens.**
> Fine-grained PATs are rejected by the npm registry. A fine-grained token
> fails with a 401 that is indistinguishable from having no token at all, so
> this is worth getting right the first time.

### `.npmrc` — commit this

```ini
@jrmoulckers:registry=https://npm.pkg.github.com
```

Route the scope, and nothing else. Do **not** commit an `_authToken` line,
even one that interpolates an environment variable: it makes every local
command fail confusingly when the variable is unset, and it puts a
credential-shaped string in version control.

### Local development

Put the token in your **user-level** `~/.npmrc`, where it is shared across
every repository and never committed:

```ini
//npm.pkg.github.com/:_authToken=ghp_...
```

Use a classic PAT with only the `read:packages` scope.

### CI

Prefer granting the consuming repository access to the package over storing a
token. In each package's settings, under **Manage Actions access**, add the
consuming repository with **Read**. `GITHUB_TOKEN` then works with no stored
secret, and GitHub recommends this over a PAT.

The job must request the permission explicitly:

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      registry-url: https://npm.pkg.github.com
      scope: '@jrmoulckers'
  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Fall back to a `read:packages` classic PAT in a secret only where an access
grant is not possible.

#### If your CI delegates to the reusable workflows in `jrmoulckers/.github`

The `setup-node` step above lives inside the reusable workflow, not in your
caller, so you cannot add `registry-url` yourself. Those workflows accept
`registry-url` and `registry-scope` inputs and a `NODE_AUTH_TOKEN` secret —
pass them from your caller and pin to a reviewed SHA per `GH-ACT-003`.
Workflows that install dependencies: `reusable-ci-lint`, `reusable-ci-web`,
`reusable-deploy-pages`, `reusable-deploy-preview`, `reusable-perf-budget`,
and `reusable-smoke-test`.

### Install

```bash
npm i -D @jrmoulckers/eslint-config @jrmoulckers/prettier-config @jrmoulckers/tsconfig
```

Peer dependencies are not bundled — install the ones your stack needs:

| Stack | Also install |
| --- | --- |
| Any | `eslint prettier typescript` |
| Svelte | `eslint-plugin-svelte prettier-plugin-svelte` |
| Next.js | `@next/eslint-plugin-next` |

## 3. Wire it up

### ESLint — `eslint.config.js`

```js
// Svelte
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';
export default svelteConfig();

// Next.js
import { nextConfig } from '@jrmoulckers/eslint-config/next';
export default nextConfig();

// Plain TypeScript
import { base } from '@jrmoulckers/eslint-config';
export default base({ env: 'node' });
```

Every preset takes `{ ignores, env, rules, extend }`. Product-specific rules —
ORM guards, i18n literal checks, import boundaries — go in `extend`, so the
shared preset stays generic:

```js
export default nextConfig({
  extend: [
    {
      rules: {
        'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['db'] }],
      },
    },
  ],
});
```

### Prettier — `prettier.config.js`

```js
export { default } from '@jrmoulckers/prettier-config/svelte'; // or '@jrmoulckers/prettier-config'
```

### TypeScript — `tsconfig.json`

```json
{ "extends": "@jrmoulckers/tsconfig/vite-app.json", "include": ["src"] }
```

| Variant | For |
| --- | --- |
| `base.json` | Any TypeScript |
| `vite-app.json` | Browser app — adds DOM libs and `vite/client` |
| `vite-node.json` | Build scripts and Node tooling |
| `next.json` | Next.js — adds `jsx: preserve` and the Next plugin |

### Scripts

```json
{
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "build": "vite build"
}
```

`ENG-TEST-004` requires these to report independently. Do not collapse them into
one script.

## Go repositories

No npm path. Follow [practices/go.md](../practices/go.md) and reference
[`configs/golangci.yml`](../configs/golangci.yml).

## Expected diff

Adoption should **remove** more than it adds:

- Delete the hand-authored `eslint.config.js` / `.eslintrc.cjs`, `.prettierrc*`,
  and duplicated `compilerOptions`.
- Delete prose that restates an `ENG-*` rule; leave a citation.
- Keep every product-specific rule, moved into `extend` or stated as such.

If adoption only adds files, the duplication was not actually removed.
