# Adopting Engineering practice

How a repository consumes this one. Three layers, adopt in order.

| Layer                                           | What you get                         | Transport                                       |
| ----------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| [Principles](../principles/README.md)           | 66 ratified `ENG-*` rules + evidence | Cite by ID; resolve via `principles/index.json` |
| [Practices](../practices/README.md)             | Technique for satisfying them        | Link by URL                                     |
| [Packages](#2-install-the-shared-configuration) | Executable enforcement               | GitHub Packages                                 |

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
`@jrmoulckers` scope to be routed explicitly, and requires authentication on
every read — even for a public package, and even though this repository is
public. There is no anonymous access to the npm registry.

What being public changes is _authorization_, not authentication: any
authenticated token can read a public package, so no per-repository access
grant is needed. You still have to send a token.

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

**pnpm refuses to honour it regardless.** pnpm 11 ignores any credential in a
project-level `.npmrc` and says why:

> environment variables are not expanded in registry credentials that come
> from a project `.npmrc`, because that file is committed to the repository
> and could leak the secret to an attacker-controlled registry

It then fails the install with a 401. The warning scrolls past in a wall of
install output, so the visible symptom is an unexplained 401 while a token is
demonstrably set — worth recognising. This is deliberate hardening on pnpm's
part and the same instinct as `ENG-SEC-001`, so the guidance above is what to
follow under either package manager.

### Local development

Put the token in your **user-level** `~/.npmrc`, where it is shared across
every repository and never committed:

```ini
//npm.pkg.github.com/:_authToken=ghp_...
```

Under pnpm, write it with `pnpm config set` rather than by hand, so it lands
in the user-level file pnpm actually reads:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" ghp_...
```

Use a classic PAT with only the `read:packages` scope.

### CI

Use the job's own `GITHUB_TOKEN`. Because the packages are public, no secret
has to be created, shared, or rotated in any consuming repository.

The permission must be requested explicitly. Without it the token is minted
without package scope and the install fails with the same 401 as no token at
all:

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      registry-url: https://npm.pkg.github.com
      scope: "@jrmoulckers"
  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If a package is ever made private again, each consuming repository must be
added under the package's **Manage Actions access** settings with **Read**.
Prefer that over storing a PAT in a secret.

#### If your CI delegates to the reusable workflows in `jrmoulckers/.github`

The `setup-node` step above lives inside the reusable workflow, not in your
caller, so you cannot add `registry-url` yourself. Those workflows accept
`registry-url` and `registry-scope` inputs and a `NODE_AUTH_TOKEN` secret —
pass them from your caller and pin to a reviewed SHA per `GH-ACT-003`.
Workflows that install dependencies: `reusable-ci-lint`, `reusable-ci-web`,
`reusable-deploy-pages`, `reusable-deploy-preview`, `reusable-perf-budget`,
and `reusable-smoke-test`.

`reusable-security-ci` needs the same treatment for a different reason: it
runs `npm audit` / `pnpm audit`, which resolves package metadata from
whatever registry the scope is routed to. Once your `.npmrc` points
`@jrmoulckers` at GitHub Packages, the audit hits a registry that requires
authentication even though nothing is being installed.

### Install

```bash
npm i -D @jrmoulckers/eslint-config @jrmoulckers/prettier-config @jrmoulckers/tsconfig
```

Peer dependencies are not bundled — install the ones your stack needs:

| Stack   | Also install                                                           |
| ------- | ---------------------------------------------------------------------- |
| Any     | `eslint prettier typescript`                                           |
| Svelte  | `eslint-plugin-svelte prettier-plugin-svelte`                          |
| React   | `eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y` |
| Next.js | `@next/eslint-plugin-next`                                             |

## 3. Wire it up

### ESLint — `eslint.config.js`

```js
// Svelte
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';
export default svelteConfig();

// React (Vite, or any non-Next React app)
import { reactConfig } from '@jrmoulckers/eslint-config/react';
export default reactConfig();

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
        "drizzle/enforce-delete-with-where": [
          "error",
          { drizzleObjectName: ["db"] },
        ],
      },
    },
  ],
});
```

### Prettier — `prettier.config.js`

```js
export { default } from "@jrmoulckers/prettier-config/svelte"; // or '@jrmoulckers/prettier-config'
```

#### `.gitattributes` — required on Windows

The shared config sets `endOfLine: 'lf'`. Commit a `.gitattributes` alongside
it:

```
* text=auto eol=lf
```

Without it, a Windows checkout under `core.autocrlf=true` gets CRLF in the
working tree while the index stays LF. `format:check` then **passes in CI and
fails on every Windows machine**, which reads as a broken developer setup
rather than a missing file. Adding it may reformat many files in the working
tree while producing a zero-byte commit diff — that is the fix working, not a
mass rewrite.

### TypeScript — `tsconfig.json`

```json
{ "extends": "@jrmoulckers/tsconfig/vite-app.json", "include": ["src"] }
```

| Variant           | For                                                  |
| ----------------- | ---------------------------------------------------- |
| `base.json`       | Any TypeScript                                       |
| `vite-app.json`   | Browser app — adds DOM libs and `vite/client`        |
| `vite-react.json` | React browser app — `vite-app` plus `jsx: react-jsx` |
| `vite-node.json`  | Build scripts and Node tooling                       |
| `next.json`       | Next.js — adds `jsx: preserve` and the Next plugin   |

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

There is no npm path, so the shared lint configuration is fetched over HTTP at
CI time. This repository is public, so the fetch is anonymous — no token, no
secret, no access grant.

Follow [practices/go.md](../practices/go.md) and fetch
[`configs/golangci.yml`](../configs/golangci.yml):

```bash
curl -fsSL --retry 3 \
  https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.0/configs/golangci.yml \
  -o .golangci.yml
```

Three details carry the weight here:

**Pin to a tag, never `main`.** An unpinned fetch means an unrelated commit
here can turn a consumer's build red with no change on their side, which is
the same failure mode `GH-ACT-003` pins action SHAs to avoid.

**`-f` is not optional.** Without it `curl` writes the error body to the output
file and exits zero, so lint then runs against a config that is HTML. That
passes, which is worse than failing.

**Verify the file is non-empty before running the linter.** A truncated
transfer produces a valid, empty config, and an empty config lints nothing
while reporting success.

Do not vendor the file into the repository. A committed copy silently drifts
from the shared config, and the drift is invisible precisely because nothing
fails.

## Non-npm configuration generally

The same reasoning applies to any config this repository publishes that has no
package-manager channel — Go today, shell or Python later. Fetch by tag from
`raw.githubusercontent.com`, fail loudly on a non-200, and check the result is
non-empty before using it.

## Citing principles

Replace prose that restates a rule with a citation to its ID. Two things make
a citation wrong rather than merely untidy.

**Verify every ID against `principles/index.json`.** IDs are not guessable from
the subject matter, and a citation that points at the wrong principle is worse
than the restated prose it replaced, because it looks authoritative.

```bash
curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-001") | .statement'
```

**Do not cite a principle your repository does not follow.** Some principles
are conditional on an architecture. `ENG-LOCAL-001` makes the device's durable
store the system of record, which is correct for a local-first product and
flatly wrong for one where the server is canonical and clients are never
authoritative. Citing it there would encode a false claim about the system.

If a principle does not apply, say so plainly rather than citing it, and tell
Engineering — a genuine architectural difference is worth knowing about, and
may mean the principle needs a stated scope.

## Expected diff

Adoption should **remove** more than it adds:

- Delete the hand-authored `eslint.config.js` / `.eslintrc.cjs`, `.prettierrc*`,
  and duplicated `compilerOptions`.
- Delete prose that restates an `ENG-*` rule; leave a citation.
- Keep every product-specific rule, moved into `extend` or stated as such.

If adoption only adds files, the duplication was not actually removed.
