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

**A committed `.npmrc` outranks the one CI writes for you.** `setup-node`
writes its registry configuration to a **user**-level file and points
`NPM_CONFIG_USERCONFIG` at it. Your committed `.npmrc` is **project**-level,
and project beats user on every key it sets. npm says so out loud:

```
; "user" config from ...\user.npmrc
; @jrmoulckers:registry = "https://npm.pkg.github.com/" ; overridden by project
//npm.pkg.github.com/:_authToken = (protected)

; "project" config from ...\.npmrc
@jrmoulckers:registry = "https://project-wins.example.com/"
```

So the line above must route `@jrmoulckers` to the **same host** the workflow
authenticates against. If it points anywhere else, the project file silently
wins, and because the token is bound to `npm.pkg.github.com` it is simply not
sent to the other host — you get a 401 that looks exactly like the workflow
change never took effect. Trailing slashes are normalised, so that difference
is harmless. Keys your project file does not set — the token line included —
pass through untouched, so an `.npmrc` holding unrelated settings is fine.

**pnpm refuses to honour a committed credential regardless.** pnpm 11 ignores
any credential in a project-level `.npmrc` and says why:

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

> **`packages: read` is the one change that can break a working pipeline.**
> A called workflow can never hold a permission its caller lacks. If your
> workflow has an explicit `permissions:` block and you do not add
> `packages: read`, the run fails at startup with **no readable log** — no
> failing step to open, no error text, just `startup_failure`. It reads like
> an outage rather than a missing scope, so check this first. Workflows with
> no `permissions:` block at all inherit the repository default and are
> unaffected.

While a package is private, `GITHUB_TOKEN` is not enough on its own: each
consuming repository must also be added under the package's **Manage Actions
access** settings with **Read**. That is one grant per repository per package,
so seven repositories across three packages is twenty-one grants to create and
maintain.

Making the package public collapses all of that to nothing, because any
authenticated token may then read it. Note that public does **not** mean
anonymous — the registry still rejects an unauthenticated read with a 401, so
`packages: read` and the token remain required either way. What changes is
authorization, not authentication.

Prefer either of those over storing a PAT in a secret.

#### If your CI delegates to the reusable workflows in `jrmoulckers/.github`

The `setup-node` step above lives inside the reusable workflow, not in your
caller, so you cannot add `registry-url` yourself. Those workflows accept
`registry-url` and `registry-scope` inputs, and **authentication is
zero-config** — `NODE_AUTH_TOKEN` falls back to the job's `GITHUB_TOKEN`, so
you pass no secret at all:

```yaml
permissions:
  contents: read
  packages: read

jobs:
  web:
    uses: jrmoulckers/.github/.github/workflows/reusable-ci-web.yml@f1457271427fcde18a62b07c53a1ea75e14cd644
    with:
      package-manager: pnpm
      registry-url: https://npm.pkg.github.com
      registry-scope: "@jrmoulckers"
```

Pass a `secrets: NODE_AUTH_TOKEN:` block only for a registry the job's own
token cannot reach. If you staged one for GitHub Packages, delete it.

The token is resolved as
`inputs.registry-url != '' && (secrets.NODE_AUTH_TOKEN || github.token) || ''`,
so it is only present on runs that opted into a registry. Callers passing no
registry inputs get an unchanged environment rather than a live token exposed
to dependency `postinstall` scripts.

Pin to a reviewed SHA per `GH-ACT-003`. Workflows that install dependencies:
`reusable-ci-lint`, `reusable-ci-web`, `reusable-deploy-pages`,
`reusable-deploy-preview`, `reusable-perf-budget`, and `reusable-smoke-test`.
Passing none of the new inputs leaves behaviour unchanged — `setup-node` skips
its auth setup entirely when `registry-url` is empty.

**Route by scope. Never replace the default registry.** Setting
`registry=https://npm.pkg.github.com/` wholesale, rather than scoping it,
breaks `npm audit` / `pnpm audit` with `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS` —
GitHub Packages implements no audit endpoint. That failure is not an auth
problem and no token will fix it. Always pass `registry-scope` alongside
`registry-url`.

`reusable-security-ci` needs **no** registry configuration. Audit never
contacts the scoped registry: `@npmcli/arborist` resolves the advisory
endpoint as `options.auditRegistry || options.registry`, which is the default
registry. Verified against a lockfile holding a private `@jrmoulckers` package
and a vulnerable `minimist`, with no credentials — the advisory was reported
and no auth error occurred, in both npm and pnpm.

> **Audit sends your private package names to `registry.npmjs.org`.** The bulk
> advisory request contains the name and version of every dependency,
> `@jrmoulckers/*` included. This is inherent `npm audit` behaviour rather than
> anything this toolchain adds, but it is worth knowing before pointing audit
> at a repository whose dependency names are themselves sensitive.

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
# Pin to a release tag; the newest is listed at
# https://github.com/jrmoulckers/engineering/releases
ENGINEERING_REF=v0.2.3

curl -fsSL --retry 3 \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${ENGINEERING_REF}/configs/golangci.yml" \
  -o .golangci.yml
```

The tag shown is an example and will lag the current release, since writing a
literal version into a document guarantees the document is stale one release
later. Treat it as a knob to set, and pin to the newest tag when you adopt.

Four details carry the weight here:

**Write it to the repository root.** This is required, not cosmetic.
golangci-lint's default `run.relative-path-mode: cfg` resolves reported paths
relative to the config file's directory, so a config held outside the
repository produces diagnostics with paths like `../../elsewhere/file.go`.
Root placement also makes a bare `golangci-lint run` and editor integrations
work with no flags.

**Pin to a tag, never `main`.** An unpinned fetch means an unrelated commit
here can turn a consumer's build red with no change on their side, which is
the same failure mode `GH-ACT-003` pins action SHAs to avoid.

**`-f` is not optional.** Without it `curl` writes the error body to the output
file and exits zero, so lint then runs against a config that is HTML. That
passes, which is worse than failing.

**Verify the file is non-empty before running the linter.** A truncated
transfer produces a valid, empty config, and an empty config lints nothing
while reporting success.

Do not vendor the file into the repository. golangci-lint has no config
inheritance — no `extends`, no include, no remote config — so the file must
arrive on disk one way or another, and a committed copy silently drifts from
the shared config. The drift is invisible precisely because nothing fails.

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

Run the checker over your repository before opening the PR. It needs no
install and no auth — a pinned `--index` URL is all it reads:

```bash
curl -fsSL -o /tmp/check-citations.mjs \
  https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.10/scripts/check-citations.mjs

node /tmp/check-citations.mjs . --review \
  --index https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.10/principles/index.json
```

**Read the `--review` output; do not just check the exit code.** The exit code
only catches an ID that does not exist, and that is the rarer mistake. Every
miscitation found during the seven-repo migration used a **real ID that meant
something else** — those exit 0. `--review` prints each principle's real title
against the line citing it, which makes the mismatch obvious:

```
  AGENTS.md
      3  ENG-PERF-009   Assurance precedence
         Accessibility follows ENG-PERF-009.
      4  ENG-TEST-003   Regression boundaries
         Tests are colocated with source per ENG-TEST-003.
```

Both IDs exist. Neither says what the line claims: `ENG-PERF-009` forbids
trading accessibility away *for performance* rather than stating an
accessibility rule, and `ENG-TEST-003` is about regression tests at the
narrowest authoritative boundary, not file placement. There is no ratified
principle for either subject, so the honest fix is to keep the prose as
product-specific and cite nothing.

**If no principle covers it, cite nothing.** A near-miss citation is the one
failure mode this whole scheme cannot survive: it transfers authorship of a
rule to this repository, which never agreed to it, and the next reader treats
it as ratified. Restated prose is recoverable; a false citation is not.

**Do not cite a principle your repository does not follow.** Some principles
are conditional on an architecture, and the directory says which:

| Directory | Applies to |
| --- | --- |
| `principles/architecture/` | every repository |
| `principles/assurance/` | every repository |
| `principles/operations/` | every repository |
| `principles/platforms/` | **only repositories on that platform** |

A `platforms/` principle is scoped to its platform the same way
`browser-frontend.md` has nothing to say about a Go CLI. So a repository on a
different architecture is **out of scope, not non-compliant**, and should not
be measured against it.

`ENG-LOCAL-001` is the case that shows why this matters. It makes the device's
durable store the system of record — correct for a local-first product, and
flatly wrong for one where the server is canonical and clients are optimistic
caches. A server-authoritative product does not fail that principle; it is not
addressed by it. Citing it there would encode a false claim about the system,
and so would recording it as a compliance gap.

Being out of scope is not a free pass on the neighbours, and this is the part
most likely to be got wrong.

**Scope is per principle, not per file.** A repository that falls outside one
`platforms/` principle usually still falls **inside** its siblings. docket is
outside `ENG-LOCAL-001` because its server is authoritative, yet
`ENG-LOCAL-002`, `ENG-LOCAL-003` and `ENG-LOCAL-004` — the sync seam, the
conflict model, zero-config degradation — bind it in full. Concluding "we are
not local-first, so `local-first.md` does not apply to us" would drop three
principles that do.

**Check whether the platform-independent half still binds.** The exportability
requirement in `ENG-LOCAL-001` holds no matter who is authoritative, so a
server-canonical product still owes it.

**Say it where the architecture is described**, not in a compliance appendix —
and word it as scope rather than as a departure, because a reader who finds it
later will otherwise read it as an admission. docket's phrasing is the model:

> This is **not a departure from `ENG-LOCAL-001`** — that principle governs
> products whose device store is the system of record, and Docket answers that
> question differently because the self-hosted server is the product. Out of
> scope is not non-compliant.

If a principle genuinely does not apply, say so plainly rather than citing it,
and tell Engineering. Only the repository owner may ratify a change to
principle text, so a real scope gap needs a decision record rather than an
edit.

## Expected diff

Adoption should **remove** more than it adds:

- Delete the hand-authored `eslint.config.js` / `.eslintrc.cjs`, `.prettierrc*`,
  and duplicated `compilerOptions`.
- Delete prose that restates an `ENG-*` rule; leave a citation.
- Keep every product-specific rule, moved into `extend` or stated as such.

If adoption only adds files, the duplication was not actually removed.

### Expect a burst of type errors, and fix them at the source

`@jrmoulckers/tsconfig/base.json` turns on `noUncheckedIndexedAccess` and
`noImplicitOverride`, which most hand-rolled configs leave off. Adopting it in
a codebase of any size can surface a large batch of diagnostics at once — one
repository saw **109**.

That number is alarming and the temptation is to turn the flag back off. Don't.
In that repository the errors resolved to **19 genuine production gaps**, with
the remainder mechanical test assertions and `override` modifiers. The real
defects were all the same shape — a value assumed present at an index that the
type system could not prove:

- array elements read positionally without a guard,
- a property dereferenced off an element found by lookup,
- results zipped against `Promise.allSettled` by position,
- `getAllKeys()` zipped against `getAll()` on an assumed-equal length.

Those are latent crashes, not style. The flag did not create them; it revealed
them.

So treat the burst as a one-time debt payment. Fix at the call site — add the
guard, narrow the type, handle the absent case. Do **not** widen with `!` or
`as`, and do not disable the flag in your `tsconfig.json`: both re-hide exactly
the class of bug the flag exists to find. If a diagnostic is genuinely wrong
rather than inconvenient, that is worth reporting here.
