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
no authority may copy another's normative text — a copy drifts and hides who owns the rule.

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

Keep whatever is genuinely product-specific. Delete only what restates a rule this repository
already owns.

`principles/index.json` resolves any ID to its title, statement, status, and source path:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-003") | .statement'
```

## 2. Install the shared configuration

The packages are published to **GitHub Packages**, which requires the `@jrmoulckers` scope to be
routed explicitly, and requires authentication on every read. This holds whatever the package's
visibility is: there is no anonymous access to the npm registry.

Visibility changes _authorization_, not authentication. A public package can be read by any
authenticated token, with no per-repository grant. A private one additionally requires each
consuming repository to be granted access. Either way you must send a token.

> **A package's visibility is not the repository's visibility.** `jrmoulckers/engineering` is a
> **public** repository, and all three packages are currently **private** — publishing from a
> public repository does not make the package public, and nothing about the repository page
> hints otherwise. Check the package, never the repo:
>
> ```bash
> # Anonymous. Lists only public packages; the repo page itself returns 200 either way,
> # which is what makes the repo a misleading proxy for the answer.
> curl -s https://github.com/jrmoulckers/engineering/packages | grep -c eslint-config
> ```
>
> While that returns `0`, the grants below are required. This is the current state and the
> single blocker for adopting the presets.

> **GitHub Packages only supports classic personal access tokens.** Fine-grained PATs are
> rejected by the npm registry. A fine-grained token fails with a 401 that is indistinguishable
> from having no token at all, so this is worth getting right the first time.

### `.npmrc` — commit this

```ini
@jrmoulckers:registry=https://npm.pkg.github.com
```

Route the scope, and nothing else. Do **not** commit an `_authToken` line, even one that
interpolates an environment variable: it makes every local command fail confusingly when the
variable is unset, and it puts a credential-shaped string in version control.

**A committed `.npmrc` outranks the one CI writes for you.** `setup-node` writes its registry
configuration to a **user**-level file and points `NPM_CONFIG_USERCONFIG` at it. Your committed
`.npmrc` is **project**-level, and project beats user on every key it sets. npm says so out
loud:

```
; "user" config from ...\user.npmrc
; @jrmoulckers:registry = "https://npm.pkg.github.com/" ; overridden by project
//npm.pkg.github.com/:_authToken = (protected)

; "project" config from ...\.npmrc
@jrmoulckers:registry = "https://project-wins.example.com/"
```

So the line above must route `@jrmoulckers` to the **same host** the workflow authenticates
against. If it points anywhere else, the project file silently wins, and because the token is
bound to `npm.pkg.github.com` it is simply not sent to the other host — you get a 401 that looks
exactly like the workflow change never took effect. Trailing slashes are normalised, so that
difference is harmless. Keys your project file does not set — the token line included — pass
through untouched, so an `.npmrc` holding unrelated settings is fine.

**pnpm refuses to honour a committed credential regardless.** pnpm 11 ignores any credential in
a project-level `.npmrc` and says why:

> environment variables are not expanded in registry credentials that come from a project
> `.npmrc`, because that file is committed to the repository and could leak the secret to an
> attacker-controlled registry

It then fails the install with a 401. The warning scrolls past in a wall of install output, so
the visible symptom is an unexplained 401 while a token is demonstrably set — worth recognising.
This is deliberate hardening on pnpm's part and the same instinct as `ENG-SEC-001`, so the
guidance above is what to follow under either package manager.

### Local development

Put the token in your **user-level** `~/.npmrc`, where it is shared across every repository and
never committed:

```ini
//npm.pkg.github.com/:_authToken=ghp_...
```

Under pnpm, write it with `pnpm config set` rather than by hand, so it lands in the user-level
file pnpm actually reads:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" ghp_...
```

Use a classic PAT with only the `read:packages` scope.

**A missing token reports as a bad one.** With `NODE_AUTH_TOKEN` unset, npm sends an _empty_
credential rather than none, so the registry answers:

```
npm error 401 unauthenticated: User cannot be authenticated with the token provided.
```

That message describes a credential that was rejected, and the usual response is to reissue a
token that was never the problem. Fine-grained tokens fail with the same text, so no token, an
empty token and a wrong token are indistinguishable from the error alone. Check that the variable
is set and that the token is classic before reissuing anything.

### CI

Use the job's own `GITHUB_TOKEN`. No secret has to be created, shared, or rotated in any
consuming repository — but while the packages are private, that token also needs an access grant
per the note below.

The permission must be requested explicitly. Without it the token is minted without package
scope and the install fails with the same 401 as no token at all:

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

> **`packages: read` is the one change that can break a working pipeline.** A called workflow
> can never hold a permission its caller lacks. If your workflow has an explicit `permissions:`
> block and you do not add `packages: read`, the run fails at startup with **no readable log** —
> no failing step to open, no error text, just `startup_failure`. It reads like an outage rather
> than a missing scope, so check this first. Workflows with no `permissions:` block at all
> inherit the repository default and are unaffected.

**The packages are private today, so `GITHUB_TOKEN` is not enough on its own**: each consuming
repository must also be added under the package's **Manage Actions access** settings with
**Read**. That is one grant per repository per package, so seven repositories across three
packages is twenty-one grants to create and maintain.

Making the packages public collapses all of that to nothing, because any authenticated token may
then read them. Note that public does **not** mean anonymous — the registry still rejects an
unauthenticated read with a 401, so `packages: read` and the token remain required either way.
What changes is authorization, not authentication.

Prefer either of those over storing a PAT in a secret.

#### If your CI delegates to the reusable workflows in `jrmoulckers/.github`

The `setup-node` step above lives inside the reusable workflow, not in your caller, so you
cannot add `registry-url` yourself. Those workflows accept `registry-url` and `registry-scope`
inputs, and **authentication is zero-config** — `NODE_AUTH_TOKEN` falls back to the job's
`GITHUB_TOKEN`, so you pass no secret at all:

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
      registry-scope: '@jrmoulckers'
```

Pass a `secrets: NODE_AUTH_TOKEN:` block only for a registry the job's own token cannot reach.
If you staged one for GitHub Packages, delete it.

**The `packages: read` line above is not optional here, and this is where omitting it hurts
most.** Every one of these callees requests `packages: read` at job level, and a caller's
`permissions:` block _replaces_ the default rather than adding to it — so a caller that lists
only `contents: read` caps the callee below what it asks for and the run dies at startup with no
readable log. See the callout in the previous section.

**The grant tracks what the callee declares, not whether it installs anything.** This is the
part that catches people. `reusable-perf-budget` consumes a build artifact and runs no install,
so `packages: read` looks obviously irrelevant and gets left off — and the whole workflow dies
at startup in about a second. Match this table exactly, per callee you call:

| Callee                      | Permissions the caller must grant                         |
| --------------------------- | --------------------------------------------------------- |
| `reusable-ci-lint`          | `contents: read`, `packages: read`, `pull-requests: read` |
| `reusable-ci-web`           | `contents: read`, `packages: read`                        |
| `reusable-deploy-pages`     | `contents: read`, `packages: read`, `id-token: write`     |
| `reusable-deploy-preview`   | `contents: read`, `packages: read`                        |
| `reusable-perf-budget`      | `contents: read`, `packages: read` — **installs nothing** |
| `reusable-smoke-test`       | `contents: read`, `packages: read`                        |
| `reusable-security-ci`      | `contents: read`                                          |
| `reusable-change-detection` | `contents: read`                                          |

A caller with **no** `permissions:` block at all inherits the repository default and is
unaffected by any of this. The failure only appears once you write the block down.

`actionlint` does not model caller-callee permission ceilings and passes on both sides, so this
is not caught before it runs.

The token is resolved as
`inputs.registry-url != '' && (secrets.NODE_AUTH_TOKEN || github.token) || ''`, so it is only
present on runs that opted into a registry. Callers passing no registry inputs get an unchanged
environment rather than a live token exposed to dependency `postinstall` scripts.

Pin to a reviewed SHA per `GH-ACT-003`. Workflows that install dependencies: `reusable-ci-lint`,
`reusable-ci-web`, `reusable-deploy-pages`, `reusable-deploy-preview`, `reusable-perf-budget`,
and `reusable-smoke-test`. Passing none of the new inputs leaves behaviour unchanged —
`setup-node` skips its auth setup entirely when `registry-url` is empty.

**Route by scope. Never replace the default registry.** Setting
`registry=https://npm.pkg.github.com/` wholesale, rather than scoping it, breaks `npm audit` /
`pnpm audit` — GitHub Packages implements no advisory endpoint. Under npm the failure reads:

```
npm warn audit 404 Not Found - POST https://npm.pkg.github.com/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

pnpm reports the same condition as `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`. Neither is an auth
problem and **no token will fix either** — the endpoint does not exist at that host. Always pass
`registry-scope` alongside `registry-url`, and keep the committed `.npmrc` to a single scoped
line.

`reusable-security-ci` needs **no** registry configuration. Audit never contacts the scoped
registry: `@npmcli/arborist` resolves the advisory endpoint as
`options.auditRegistry || options.registry`, which is the default registry.

That claim is easy to believe and easy to get wrong, so it was tested by trying to falsify it —
the scope was routed to a host that cannot resolve at all:

```ini
@jrmoulckers:registry=https://blackhole.invalid/
```

If audit contacted the scoped registry, this must fail with a DNS error. It did not: the
`minimist` advisory was reported normally, exit 1 for the vulnerability, with no network error.
A 401 requires reaching a host; an unroutable host cannot return one. Reproduced independently in
both npm and pnpm.

> **Audit sends your private package names to `registry.npmjs.org`.** The bulk advisory request
> contains the name and version of every dependency, `@jrmoulckers/*` included. This is inherent
> `npm audit` behaviour rather than anything this toolchain adds, but it is worth knowing before
> pointing audit at a repository whose dependency names are themselves sensitive.

The no-auth conclusion holds for a plain `npm audit` / `pnpm audit`, which only reads advisory
data. It does **not** hold for a command that resolves or installs — `npm audit fix`, or any
install-then-audit sequence — because those do contact the scoped registry and will 401 without
a token. If you override `reusable-security-ci`'s `audit-command` input with anything of that
shape, you are back to needing registry configuration.

### Install

```bash
npm i -D @jrmoulckers/eslint-config @jrmoulckers/prettier-config @jrmoulckers/tsconfig
```

**Do not pin `^0.1.0`.** Early adoption briefs named that range, and on a `0.x` package a caret
only permits patch updates — `^0.1.0` resolves to `>=0.1.0 <0.2.0` and can never reach `0.2.x`.
The React presets and the ESLint v16 fix shipped in `0.2.0`, so a manifest pinned at `^0.1.0`
silently installs a build in which `@jrmoulckers/eslint-config/react` and
`@jrmoulckers/tsconfig/vite-react.json` **do not exist**. Current floors:

| Package                        | Minimum  | Why                                                                         |
| ------------------------------ | -------- | --------------------------------------------------------------------------- |
| `@jrmoulckers/eslint-config`   | `^0.7.0` | Hooks linting in `./next`; type-aware crash fix; opt-in `strictTypeChecked` |
| `@jrmoulckers/tsconfig`        | `^0.3.0` | `vite-react.json`; TypeScript 6 and 7 support                               |
| `@jrmoulckers/prettier-config` | `^0.2.0` | `proseWrap: 'preserve'`; `0.1.x` hard-wraps Markdown                        |

### The two packages support different TypeScript versions, on purpose

| Package                      | `typescript` peer                | Verified against                              |
| ---------------------------- | -------------------------------- | --------------------------------------------- |
| `@jrmoulckers/tsconfig`      | `^5.5.0 \|\| ^6.0.0 \|\| ^7.0.0` | 5.9, 6.0.3, 7.0.2 — all presets compile clean |
| `@jrmoulckers/eslint-config` | `>=5.5.0 <6.1.0` (optional)      | Ceiling set by `typescript-eslint@8.67.0`     |

**Do not "fix" this by making them agree.** `@jrmoulckers/eslint-config` depends on
`typescript-eslint`, whose own peer range is `>=4.8.4 <6.1.0`, so it cannot honestly claim
TypeScript 7 until that ships. The peer is declared — and marked optional, so JavaScript-only
consumers are unaffected — precisely so a TypeScript 7 repository gets an install-time `ERESOLVE`
naming the conflict, instead of a confusing failure inside the type-aware lint rules later.

If you are on TypeScript 7, adopt `@jrmoulckers/tsconfig` now and hold `@jrmoulckers/eslint-config`
until `typescript-eslint` widens. That split is expected, not a misconfiguration.

This bites hardest where a repository verified against the source tree — a `file:` or `link:`
dependency onto a local checkout resolves to whatever is checked out, which is current, while
the committed manifest still says `^0.1.0`. The gates pass locally and then install something
older in CI. If you verified that way, re-check the range you actually committed.

Peer dependencies are not bundled — install the ones your stack needs:

| Stack   | Also install                                                           |
| ------- | ---------------------------------------------------------------------- |
| Any     | `eslint prettier typescript`                                           |
| Svelte  | `eslint-plugin-svelte prettier-plugin-svelte`                          |
| React   | `eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y` |
| Next.js | `@next/eslint-plugin-next eslint-plugin-react-hooks`                   |

The Next row includes `eslint-plugin-react-hooks` because Next.js is React and the preset lints
hooks. Earlier revisions of this table omitted it, which is worth knowing if you adopted from a
copy: the preset then fails to load rather than silently skipping the rules.

`.npmrc` has no Prettier parser. Add it to `.prettierignore`, or `format:check` fails on a file
Prettier cannot parse.

### Exclude files that are sealed or generated

Three kinds of file must go in `.prettierignore` for reasons stronger than taste:

| Kind      | Why                                 | Symptom if you skip it                                         |
| --------- | ----------------------------------- | -------------------------------------------------------------- |
| Generated | The generator owns the formatting   | Formatter and generator fight; a permanent drift loop          |
| Sealed    | A checksum attests to exact content | Reformatting invalidates the attestation, not just the check   |
| Synced    | Another repository owns the content | False drift; the sync engine reports a conflict you never made |

This repository is its own example: `principles/` and `docs/ratification/` are pinned by
semantic content hashes, so reflowing them would break the evidence that the ratified text is
the text the owner approved. A formatter is not an owner. See this repository's
[`.prettierignore`](../.prettierignore).

**Synced files are the category most consumers miss**, because nothing about the file says it is
owned elsewhere. Anything distributed from `jrmoulckers/.github` qualifies — `.github/agents/`,
`.github/skills/`, `.github/prompts/`, `.github/instructions/`, and any managed region inside
`AGENTS.md`. Reformatting them changes content the sync engine tracks by hash, so the next sync
reports drift against a change you did not author. Vendored third-party sources are the same
shape. Exclude them **before** the first repo-wide `prettier --write`, not after:

```
.github/agents/
.github/skills/
.github/prompts/
.github/instructions/
vendor/
```

If you hold signed manifests, lockfiles with recorded integrity, golden or snapshot fixtures, or
vendored third-party sources, apply the same reasoning before your first format pass — the first
run is where the damage lands, and a reflowed snapshot fixture fails as a false test failure a
long way from its cause.

### A green test suite does not clear a formatter change

This is the failure mode most likely to cost you real correctness, and it is invisible.

Reformatting rewrites string literals — `singleQuote` applies to CSS as well as JS — and any
test or script that **parses its own source text** silently changes what it matches. Such a
check keeps passing while inspecting nothing.

Measured in one repository adopting this config, with roughly 28 self-scanning checks, four
degraded silently and none failed:

| Check                      | Before   | After                                    |
| -------------------------- | -------- | ---------------------------------------- |
| `i18n` rich-tag scanner    | 22 sites | **0 sites** — still exited 0             |
| creator-escalation test    | passing  | a `-1` anchor disabled a security filter |
| elevation / contrast tests | passing  | skipped every theme                      |

A suite that passes before and after tells you nothing here, because the degraded state is
indistinguishable from the healthy one. Verify by **diffing each scanner's output count** across
the reformat, not by re-running the suite:

```bash
# before the format pass
node scripts/scan.mjs --count > /tmp/before.txt
# after
node scripts/scan.mjs --count | diff /tmp/before.txt -
```

Then make the guards quote-agnostic and give each one an explicit assertion that its match count
is non-zero, so it fails loudly rather than inspecting an empty set. A check that cannot report
finding nothing is not a check. This is `ENG-TEST-008` applied to tooling: a scanner nobody has
proven can fail is not evidence.

Grep for the shape before you start — `readFileSync(__filename`, `readFileSync(import.meta`, and
any test reading files under `src/` and matching quoted substrings.

### Landing the first format pass

Markdown formatting uses `proseWrap: 'preserve'`, so adopting this config **does not reflow your
prose**. There is no mechanical markdown commit to land and no large diff to review.

The `.md` override narrows `printWidth` to 96, which affects only constructs Prettier does
reformat — tables, lists, code fences. Paragraph line breaks are left exactly as authored.

### Write prose in semantic line breaks

Since the formatter no longer decides where lines end, the convention does. Break lines at
sentence or clause boundaries; one sentence per line is the simplest form.

```md
The sync layer reconciles local mutations against the remote authority.
It uses a last-writer-wins strategy scoped per field rather than per record.
```

This is not a style preference. It is measurably better on the two things that matter for
review, and `preserve` exists to permit it:

| Shape           | One-word edit | Two edits, same paragraph | Bounded line length |
| --------------- | ------------- | ------------------------- | ------------------- |
| Hard-wrapped    | 3 lines       | merges                    | yes                 |
| One long line   | 1 line        | **conflicts**             | no                  |
| Semantic breaks | 1 line        | merges                    | yes                 |

Hard wrapping rewraps every following line in the paragraph, so a one-word change arrives as a
multi-line diff and the real edit has to be hunted for. A single unbroken line avoids that but
collides on any concurrent edit, since every change touches the same line. Semantic breaks avoid
both — and `proseWrap: 'always'` destroys them on write, which is why it is not the default.

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

Every preset takes `{ ignores, env, rules, extend }`. Product-specific rules — ORM guards, i18n
literal checks, import boundaries — go in `extend`, so the shared preset stays generic:

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

#### `.gitattributes` — required on Windows

The shared config sets `endOfLine: 'lf'`. Commit a `.gitattributes` alongside it:

```
* text=auto eol=lf
```

Without it, a Windows checkout under `core.autocrlf=true` gets CRLF in the working tree while
the index stays LF. `format:check` then **passes in CI and fails on every Windows machine**,
which reads as a broken developer setup rather than a missing file. Adding it may reformat many
files in the working tree while producing a zero-byte commit diff — that is the fix working, not
a mass rewrite.

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

**Svelte repositories replacing `@tsconfig/svelte`:** use `vite-app.json` and drop `sourceMap`.
`@tsconfig/svelte` sets it, explaining it is needed "to have warnings/errors of the Svelte
compiler at the correct position" — a rationale that predates Svelte 5. Measured on svelte-check
4.7.5 with svelte 5, diagnostic positions are identical with and without it, both for TS errors
inside `<script>` and for compiler warnings such as a11y and unused CSS. It could not have
worked regardless: `base.json` sets `noEmit`, so tsc writes no output and therefore no source
maps. Porting the flag would imply a behaviour it does not provide. Vite build sourcemaps are a
separate setting (`build.sourcemap` in `vite.config.ts`) and are unaffected.

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

`ENG-TEST-004` requires these to report independently. Do not collapse them into one script.

## Go repositories

There is no npm path, so the shared lint configuration is fetched over HTTP at CI time. This
repository is public, so the fetch is anonymous — no token, no secret, no access grant.

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

The tag shown is an example and will lag the current release, since writing a literal version
into a document guarantees the document is stale one release later. Treat it as a knob to set,
and pin to the newest tag when you adopt.

Four details carry the weight here:

**Write it to the repository root.** This is required, not cosmetic. golangci-lint's default
`run.relative-path-mode: cfg` resolves reported paths relative to the config file's directory,
so a config held outside the repository produces diagnostics with paths like
`../../elsewhere/file.go`. Root placement also makes a bare `golangci-lint run` and editor
integrations work with no flags.

**Pin to a tag, never `main`.** An unpinned fetch means an unrelated commit here can turn a
consumer's build red with no change on their side, which is the same failure mode `GH-ACT-003`
pins action SHAs to avoid.

**`-f` is not optional.** Without it `curl` writes the error body to the output file and exits
zero, so lint then runs against a config that is HTML. That passes, which is worse than failing.

**Verify the file is non-empty before running the linter.** A truncated transfer produces a
valid, empty config, and an empty config lints nothing while reporting success.

Do not vendor the file into the repository. golangci-lint has no config inheritance — no
`extends`, no include, no remote config — so the file must arrive on disk one way or another,
and a committed copy silently drifts from the shared config. The drift is invisible precisely
because nothing fails.

## Non-npm configuration generally

The same reasoning applies to any config this repository publishes that has no package-manager
channel — Go today, shell or Python later. Fetch by tag from `raw.githubusercontent.com`, fail
loudly on a non-200, and check the result is non-empty before using it.

## Citing principles

Replace prose that restates a rule with a citation to its ID. Two things make a citation wrong
rather than merely untidy.

**Verify every ID against `principles/index.json`.** IDs are not guessable from the subject
matter, and a citation that points at the wrong principle is worse than the restated prose it
replaced, because it looks authoritative.

```bash
curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-001") | .statement'
```

Run the checker over your repository before opening the PR. It needs no install and no auth — a
pinned `--index` URL is all it reads:

```bash
curl -fsSL -o /tmp/check-citations.mjs \
  https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.11/scripts/check-citations.mjs

node /tmp/check-citations.mjs . --review \
  --index https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.11/principles/index.json
```

**Read the `--review` output; do not just check the exit code.** The exit code only catches an
ID that does not exist, and that is the rarer mistake. A real ID used for the wrong rule
exits 0. `--review` prints each principle's real title, plus the neighbouring lines, against
every citation:

```
    171  ENG-PERF-009   Assurance precedence
         keyboard control and correctly labelled transport controls.
      >  [`ENG-PERF-009`](…/assurance/performance.md)
         additionally forbids trading accessibility away for performance.
```

The neighbouring lines are the point. A wrapped markdown link leaves the citing line a bare URL,
so the claim being checked sits on the line above or below it. Judging that citation from the
URL line alone is not possible — and reading a summary of it instead of the file is how a
correct citation gets mistaken for a wrong one.

The example above is **correct**, and reads as correct: `ENG-PERF-009` is not an accessibility
rule, and the prose does not claim it is — it says the principle _additionally_ forbids trading
accessibility away for performance, which is exactly what it says. Compare a wrong one:

```
      3  ENG-PERF-009   Assurance precedence
      >  Accessibility follows ENG-PERF-009.
```

That asserts an equivalence the principle does not support. There is no ratified accessibility
principle, so the fix is to state the accessibility rule as your own and cite `ENG-PERF-009`
only for what it actually constrains.

**If no principle covers it, cite nothing.** A near-miss citation is the one failure mode this
whole scheme cannot survive: it transfers authorship of a rule to this repository, which never
agreed to it, and the next reader treats it as ratified. Restated prose is recoverable; a false
citation is not.

Two shapes that stay honest when nothing covers the subject:

- **Name it as yours.** "Colocate tests … a libro convention; the obligation it serves is
  `ENG-TEST-003` (regress at the narrowest authoritative boundary)." The convention is local,
  the cited principle is the real obligation beneath it, and neither is misattributed.
- **Record it as a decision.** A constraint with no principle behind it is an ADR, and
  `ENG-ARCH-003` is what requires you to write one before treating it as durable. Cite
  `ENG-ARCH-003` for the _recording_, not for the constraint.

**Do not cite a principle your repository does not follow.** Some principles are conditional on
an architecture, and the directory says which:

| Directory                  | Applies to                             |
| -------------------------- | -------------------------------------- |
| `principles/architecture/` | every repository                       |
| `principles/assurance/`    | every repository                       |
| `principles/operations/`   | every repository                       |
| `principles/platforms/`    | **only repositories on that platform** |

A `platforms/` principle is scoped to its platform the same way `browser-frontend.md` has
nothing to say about a Go CLI. So a repository on a different architecture is **out of scope,
not non-compliant**, and should not be measured against it.

`ENG-LOCAL-001` is the case that shows why this matters. It makes the device's durable store the
system of record — correct for a local-first product, and flatly wrong for one where the server
is canonical and clients are optimistic caches. A server-authoritative product does not fail
that principle; it is not addressed by it. Citing it there would encode a false claim about the
system, and so would recording it as a compliance gap.

Being out of scope is not a free pass on the neighbours, and this is the part most likely to be
got wrong.

**Scope is per principle, not per file.** A repository that falls outside one `platforms/`
principle usually still falls **inside** its siblings. docket is outside `ENG-LOCAL-001` because
its server is authoritative, yet `ENG-LOCAL-002`, `ENG-LOCAL-003` and `ENG-LOCAL-004` — the sync
seam, the conflict model, zero-config degradation — bind it in full. Concluding "we are not
local-first, so `local-first.md` does not apply to us" would drop three principles that do.

**Check whether the platform-independent half still binds.** The exportability requirement in
`ENG-LOCAL-001` holds no matter who is authoritative, so a server-canonical product still owes
it.

**Say it where the architecture is described**, not in a compliance appendix — and word it as
scope rather than as a departure, because a reader who finds it later will otherwise read it as
an admission. docket's phrasing is the model:

> This is **not a departure from `ENG-LOCAL-001`** — that principle governs products whose
> device store is the system of record, and Docket answers that question differently because the
> self-hosted server is the product. Out of scope is not non-compliant.

If a principle genuinely does not apply, say so plainly rather than citing it, and tell
Engineering. Only the repository owner may ratify a change to principle text, so a real scope
gap needs a decision record rather than an edit.

## Recording decisions (ADRs)

`ENG-ARCH-003` requires a decision record before a consequential tradeoff is treated as durable.
The naming convention already exists — it is stated in
[`docs/architecture/README.md`](../docs/architecture/README.md) and repeated here because that
is not the file a consuming repository reads:

**Name records `NNNN-short-title.md`.** Four digits, zero-padded, kebab-case title, no prefix.
`0004-identity-and-mapping-strategy.md`, not `adr-0004-…` and not `4-…`.

The convention governs the **filename**, not the directory. Both of these conform:

| Layout                                  | Use when                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/architecture/NNNN-*.md`           | the directory holds decisions only                                             |
| `docs/architecture/decisions/NNNN-*.md` | the directory also holds architecture prose, and separating the two is clearer |

`jrmoulckers/.github` uses the first. Neither is required of you, and a repository already using
either is conformant and should not renumber or relocate anything.

Two rules that do matter, because both have been violated in practice:

- **Numbers are unique and never reused**, including across a rename or a supersession. A
  superseded record keeps its number and gains `Status: Superseded` plus a link to its
  replacement; the replacement takes a new number. Two records sharing a number make every
  cross-reference to it ambiguous, and cross-references are the entire point of numbering.
- **Do not renumber a published record.** Anything already merged may be cited from another
  repository, and this repository's own guidance tells consumers to cite ADRs by number. Fix a
  collision by giving the _newer_ record the next free number.

## Expected diff

Adoption should **remove** more than it adds:

- Delete the hand-authored `eslint.config.js` / `.eslintrc.cjs`, `.prettierrc*`, and duplicated
  `compilerOptions`.
- Delete prose that restates an `ENG-*` rule; leave a citation.
- Keep every product-specific rule, moved into `extend` or stated as such.

If adoption only adds files, the duplication was not actually removed.

### Expect a burst of type errors, and fix them at the source

`@jrmoulckers/tsconfig/base.json` turns on `noUncheckedIndexedAccess` and `noImplicitOverride`,
which most hand-rolled configs leave off. Adopting it in a codebase of any size can surface a
large batch of diagnostics at once — one repository saw **109**.

That number is alarming and the temptation is to turn the flag back off. Don't. In that
repository the errors resolved to **19 genuine production gaps**, with the remainder mechanical
test assertions and `override` modifiers. The real defects were all the same shape — a value
assumed present at an index that the type system could not prove:

- array elements read positionally without a guard,
- a property dereferenced off an element found by lookup,
- results zipped against `Promise.allSettled` by position,
- `getAllKeys()` zipped against `getAll()` on an assumed-equal length.

Those are latent crashes, not style. The flag did not create them; it revealed them.

A second repository reproduced the pattern at larger scale: **152 errors, every one from
`noUncheckedIndexedAccess`** — 12 in production source, 140 in test files that index immediately
after their own `toHaveLength` assertion. That distribution is the useful part to plan around:

| Location   | Share | Fix                                                     |
| ---------- | ----- | ------------------------------------------------------- |
| Test files | ~92%  | Mechanical; a non-null assertion is acceptable **here** |
| Production | ~8%   | Narrow properly — guard, destructure, or default        |

Two repositories now agree that this is the single highest-friction setting in the base, and that
the friction is concentrated where the risk is lowest. A test that has just asserted
`toHaveLength(3)` genuinely knows index `0` exists, so `!` there is a statement of fact rather
than a suppression. The same `!` in production code is the bug being re-hidden. Budget for the
test churn separately so it does not disguise the small number of real fixes.

So treat the burst as a one-time debt payment. Fix at the call site — add the guard, narrow the
type, handle the absent case. Do **not** widen with `!` or `as` in production code, and do not
disable the flag in your `tsconfig.json`: both re-hide exactly the class of bug the flag exists
to find. If a diagnostic is genuinely wrong rather than inconvenient, that is worth reporting
here.
