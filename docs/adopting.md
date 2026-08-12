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

**A citation replaces prose. If there is no prose, do not add one.** A principle can apply to your
repository and still be the wrong thing to cite. One consumer found `ENG-WEB-003` (measured
foreground performance) genuinely satisfied — `bundle-budgets.json`, a budget script, Lighthouse in
CI — and deliberately did not cite it, because nothing in their docs restated the rule. It was
enforced by configuration, not narrated. With no duplicated text to remove, the citation would have
been decoration.

That is the right instinct and it is the test to apply: **citations exist to delete a copy, not to
demonstrate coverage.** Adding IDs to documents that never claimed the rule inflates apparent
adoption while removing nothing, and it makes the citations that _are_ load-bearing harder to find.
A repository that satisfies a principle in config and says nothing about it is already compliant.

**Resolve every ID against `index.json` before citing it — including IDs handed to you.** The same
consumer was sent a brief containing three incorrect ID-to-title pairings and hit none of them,
because they looked each one up rather than trusting the label. Two other repositories took the
labels at face value and cited the wrong principles. A wrong citation is worse than a missing one:
it reads as deliberate and survives review, because reviewers check that the ID exists far more
often than they check that it means what the sentence claims.

`principles/index.json` resolves any ID to its title, statement, status, and source path:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-003") | .statement'
```

## 2. Install the shared configuration

There are **two delivery channels**, and which one you use is decided per package, not per
repository. Most repositories will use both.

| Package                        | Channel            | Why                                                                    |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------- |
| `@jrmoulckers/tsconfig`        | **registry (npm)** | pure JSON, no runtime dependencies                                     |
| `@jrmoulckers/prettier-config` | **registry (npm)** | dependency-free ES modules                                             |
| `@jrmoulckers/eslint-config`   | **registry (npm)** | depends on four packages at runtime that a consumer must not re-choose |

> **Correction, and this repository's most costly error to date.** `tsconfig` and
> `prettier-config` were documented here — and recorded in `versions.json` — as **vendored at a
> ref: never published, no token required, adopt them while blocked**. That was false. All three
> packages are `private: false`, and `publish.yml` publishes every directory under `packages/`
> unconditionally without consulting `channel`, so all three have been on the registry the entire
> time and all three require a token.
>
> Three repositories were told they were unblocked on two packages that return `403
permission_denied: read_package`, and one of them proved it with a real CI run naming
> `@jrmoulckers/tsconfig/0.2.0`. **All three packages are gated on the same visibility grant.**
>
> The detail worth carrying: the contradicting evidence was in this repository's own CI output on
> every run. `versions:check` prints `versions.json matches the registry for 3 of 3 package(s)` —
> which is only possible if all three are on the registry — and that line was repeatedly quoted as
> confirmation the file was correct. A check can be passing, accurate, and read as proof of the
> opposite of what it says. `scripts/test/versions-channels.test.mjs` now asserts that a channel
> claiming `requiresRegistryAuth: false` is backed by a package with `private: true`, so the
> declaration cannot drift from what `publish.yml` actually does.

The split exists because **GitHub Packages authenticates every read, including reads of a public
package.** Putting the scope in the install path therefore requires every contributor — and, for a
self-hosted product, every self-hoster — to mint a token before `install` succeeds. That is a real
onboarding regression, and package visibility does not fix it: visibility changes authorization,
not authentication.

So the registry is used only where it earns its cost. `eslint-config` depends on `@eslint/js`,
`typescript-eslint`, `eslint-config-prettier` and `globals` at runtime. Vendoring its source would
hand those four version choices back to every repository, which is precisely the drift the shared
layer exists to remove. `tsconfig` and `prettier-config` have no such dependencies and can simply
be copied in.

If your repository has no ESLint dependency at all — a Go service, a docs site — you need no
registry access whatsoever.

#### Self-hosted products: the production install needs no token

The table above leaves one gap, and a self-hosted product is where it shows. `eslint-config` is a
`devDependency`, so it is absent from a production install tree — but a self-hoster who runs a bare
`npm ci` still resolves it and still gets a `401`. Document the production install explicitly:

```bash
npm ci --omit=dev
```

With `--omit=dev`, nothing scoped is requested, so **a person deploying your product never mints a
token.** Only contributors do, and only for lint. This is the same mechanism that makes a
production-scoped `npm audit` succeed while an install fails in the same run.

Combined with vendoring `tsconfig` and `prettier-config`, the result is that a clone builds and runs
with no credential anywhere: the two configs a build needs are committed files, and the one package
that requires the registry is never reached outside a contributor's machine.

### Vendoring — no token required

Fetch the script once, then run it with the tag you want to pin:

```bash
mkdir -p scripts

# <latest-tag> is a placeholder, not a version. Pin the newest release:
#   gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name
REF=<latest-tag>

curl -fsSL \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/scripts/vendor-configs.mjs" \
  -o scripts/vendor-configs.mjs

node scripts/vendor-configs.mjs "$REF"
```

Commit the fetched files, `engineering-configs.lock.json`, and the script. Refreshing is the same
command with a newer tag, which makes an upgrade a reviewable diff.

Vendoring normally trades away the one thing a registry gives you — a version signal — so this
deliberately keeps it. The lock file records the ref and the SHA-256 of every file, the fetched
files are written **byte-identical** to source with no generated header, and a re-run at a
different ref reports how many files actually changed:

```
Vendored 8 file(s) from jrmoulckers/engineering@v0.15.0 into config/engineering/
Ref moved v0.14.0 -> v0.15.0; 2 file(s) changed content.
```

Because the files are byte-identical, `git diff` after a refresh shows upstream's change and
nothing else, and local drift shows up as a diff against the recorded hash.

Three failure modes are fatal, and **nothing is written until every file passes all three** — a
partial write is worse than a failed one, because the tools would then run against a mix of refs
and report success:

1. a non-200 response, naming the ref so a bad tag is obvious;
2. an empty body;
3. a 200 carrying the wrong payload. This is the one that matters. An HTML error page or a
   redirect landing page arrives with status 200, and a config file that parses as nothing lints
   nothing while reporting success. JSON must parse _and_ carry `compilerOptions`; a module must
   actually export something.

Point it at a tag rather than a branch. A branch ref will resolve, but it re-points under you and
the lock file then records a name rather than a state.

#### Enforce the lock in CI, and warn about staleness without failing

`--check` verifies the vendored tree still matches the lock, then reports whether a newer release
exists. It takes no ref — the lock is the source of truth for what you pinned:

```yaml
- run: node scripts/vendor-configs.mjs --check
```

The two outcomes deliberately differ in severity:

- **Drift fails.** A vendored file that was edited by hand, or has gone missing, is a local
  integrity problem — the config no longer matches what the lock claims, so "verified at ref X"
  stops meaning anything. Without this, vendoring quietly reintroduces the drift the registry
  channel prevents, which is [ADR-0001](architecture/0001-two-channel-config-delivery.md)'s main
  cost. This closes it.
- **Staleness only warns**, and exits 0:

  ```
  Notice: pinned at v0.15.1; newest release is v0.15.2.
  This is not a failure. Update deliberately when you choose to:
    node scripts/vendor-configs.mjs v0.15.2
  ```

**Never make staleness fatal, and never resolve the newest tag at fetch time.** Both convert
pinning from a decision into a default. If a tag pushed here could redden your build, the change
arrives on whichever unrelated PR happens to be open, with nothing in your history explaining it —
and the pressure is to bump the ref to get green rather than to accept the change on its merits.
The property worth protecting is that when your lint result changes, `git log` says why. Make the
pin easy to update and loud when it is stale; never automatic.

A runner that is offline or rate-limited cannot tell you about staleness, so `--check` treats an
unavailable answer as "fine" and stays silent. Drift is still checked, because that needs no
network.

### Registry — for `eslint-config` only

The rest of this section applies **only** if you install `@jrmoulckers/eslint-config`.

The package is published to **GitHub Packages**, which requires the `@jrmoulckers` scope to be
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

**"Scope, not wholesale" is not a style preference, and stating it as one is why people ignore
it.** Setting `registry=` without a scope prefix reroutes _every_ registry operation, including
advisory lookups — and GitHub Packages implements **no advisory endpoint at all**. So a wholesale
reroute does not redirect `npm audit` / `pnpm audit` to a different source; it **removes the
capability**, and your security gate starts erroring instead of auditing. Said that way it also
predicts the symptom on both package managers, rather than having to be memorized per tool. The
measured failure text for each is [below](#the-npmrc-scope-trap-measured).

**The trailing slash does not matter, and this document uses both forms.** A consumer noticed
their `.npmrc` said `https://npm.pkg.github.com` while an example here said
`https://npm.pkg.github.com/`, and — because a mis-routed scope silently never sends the
credential — tested it rather than assuming. With a dummy token against the slashless form, npm
returned `401 unauthenticated: User cannot be authenticated with the token provided`: the token
**was** transmitted and rejected on its merits, so the host normalizes and both forms bind to the
same `//npm.pkg.github.com/:_authToken` entry.

Recorded because the negative result is the useful part. Had the forms _not_ matched, the symptom
would have been an auth failure indistinguishable from "the CI change didn't take" — so this is
a plausible suspect permanently eliminated rather than a difference to correct.

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

> **The behaviour is pnpm 11+, and that makes it a delayed failure.** A repository pinned to pnpm
> 10 via `packageManager` does not reproduce it, so a committed interpolated `_authToken` appears
> to work indefinitely. It breaks at a routine `packageManager` bump, with nothing in that diff
> pointing at the `.npmrc`. Reported by a consumer on pnpm 10.6.1 who correctly predicted they
> would not reproduce it.
>
> Verified on both majors against a project-level `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`:
>
> | pnpm | Behaviour                                | Result                                           |
> | ---- | ---------------------------------------- | ------------------------------------------------ |
> | 10   | expands the variable and sends the token | `ERR_PNPM_FETCH_401` — a real registry rejection |
> | 11   | warns, ignores the line entirely         | `401` — the token was never sent                 |
>
> **Both fail with 401, for opposite reasons**, which is the part that costs debugging time. Under
> pnpm 10 a 401 means the token is wrong; under pnpm 11 it means your correct token was discarded
> before the request. Chasing token validity is the natural response and it is the wrong thread on
> pnpm 11. The `[WARN] Ignored project-level auth setting` line is the only thing distinguishing
> them, and it appears far above the error. Remove the line and the ambiguity goes with it.

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
> can never hold a permission its caller lacks. If your workflow **calls an install-bearing
> reusable** and has an explicit `permissions:` block that omits `packages: read`, the run fails
> at startup with **no readable log** — no failing step to open, no error text, just
> `startup_failure`. It reads like an outage rather than a missing scope, so check this first.
>
> **Both halves of that condition are required, and conditioning on the wrong one is expensive
> in a different direction.** A Go repository with an explicit `contents: read` block and no
> `packages: read` is green, because it calls no such reusable — nothing is ever asked for the
> permission, so the ceiling never binds. Read as "explicit block without `packages: read` is
> dangerous", the rule pushes repositories with no npm surface at all to grant a scope they have
> no use for. That is a **widening of `GITHUB_TOKEN` authority adopted for no reason**, which is
> the opposite of `ENG-SEC-004` (_"least privilege, scope, and credential lifetime needed for
> each operation"_). Condition on the call, not on the block.
>
> **And do not read this as a reason to omit `permissions:`.** Omitting it inherits the
> repository default, which in many organizations is still the permissive write-all set — so
> "unaffected" is true of `startup_failure` and false of least authority. The advice that gets
> both: **declare an explicit narrow block, and add `packages: read` only if a job in that file
> calls a reusable that declares it.** Raised by a consumer who was the counterexample to the
> earlier phrasing.
>
> **The exposure is inverted, and that is the thing to take away.** A second consumer sets
> `permissions: {}` at _workflow_ level so that every job must declare its own — the strictest
> posture available, and the one this guide recommends. An empty block grants nothing, so it is
> the most efficient possible way to reach `startup_failure`: every scope any callee requests is
> already denied. Meanwhile a repository that declared nothing at all inherits a permissive
> default and sails through.
>
> So the population most exposed to this trap is **the population that followed the stricter
> advice**, and "you are fine if you have no block" is close to backwards for a fleet that has
> been told to write one. Least privilege and this failure mode are not in tension — the fix is
> per-job `packages: read` on the callers that need it, not a looser ceiling — but the ordering
> matters: tighten the block and add the scope in the same change, or the tightening is what
> takes the pipeline down.
>
> This was measured against a deliberately misconfigured caller, and there is genuinely nothing to
> read: **zero jobs created** (`/actions/runs/<id>/jobs` returns `total_count: 0`), **no check-run
> for the failing job**, and `gh run view --log` answers `failed to get run log: log not found`.
> The only surface text is the generic _"This run likely failed because of a workflow file
> issue."_ The ceiling is enforced before any job is instantiated, so no preflight step or `if:`
> guard can ever report it — anything you write lives inside a job that is never created. Diagnose
> it by reading the caller's `permissions:` block against the callee's, not by looking for output.
>
> **The blast radius is the whole workflow file, not the one misconfigured job.** A second,
> unrelated, perfectly valid job in the same file was added to that measurement and it did not run
> either. Permission resolution happens before any job is instantiated, so one caller job missing
> `packages: read` takes down every job that file would have produced — including the ones that
> never touch a package. If a file mixes a shared-workflow call with your own build or test jobs,
> you lose all of them at once, with the same absent log.
>
> Two consequences worth acting on. First, **a green history proves nothing about your next
> re-pin**: the failure is latent until the day you move the ref to a version whose callees request
> `packages: read`, and then it is total. At the time of writing, an org-wide scan found **13 caller
> jobs across 4 repositories** in exactly that state — currently green, pinned before the auth
> change, and one re-pin away from an opaque failure. Second, since no check can live inside the
> affected file, **any static check must be a separate workflow file**, which is unaffected and
> still runs.
>
> So treat "re-pin a shared workflow" as an instruction to re-read its `permissions:` blocks, not as
> a version bump.
>
> **Grant exactly what the callee declares. Do not reason from whether the job installs.** That
> heuristic is intuitive, mechanical-sounding, and wrong in both directions — it produced two
> incorrect answers here, one of each kind. Verified against the pinned callees:
>
> | Callee                     | Installs? | Declares `packages: read`? |
> | -------------------------- | --------- | -------------------------- |
> | `reusable-perf-budget.yml` | no        | **yes**                    |
> | `reusable-security-ci.yml` | no\*      | **no**                     |
> | `reusable-ci-lint.yml`     | yes       | yes                        |
>
> \*audits a manifest full of scoped packages, which is exactly why "it must need the scope" feels
> obvious and is false: advisory metadata resolves from the default registry.
>
> A consumer arrived at the right answer by reading each callee's own `permissions:` block at the
> pinned SHA and copying it, without knowing anything about how audit resolves endpoints. That is
> the rule: the callee has already declared its requirement, so read the declaration rather than
> re-deriving it from behaviour. A derivation can be reasoned wrong; a declaration cannot.

> **Reconcile counts against your own call list, and treat a maintainer's chat summary as the
> lossy channel it is.** Three times now this guide has been correct while a message summarising
> it was not, and every time a consumer caught it. One instance: a message listed six
> install-bearing reusables and then asserted "all five you call are covered." Those cannot both
> be true — the reader called five, but only **four** of theirs were on the list, the fifth being
> `reusable-security-ci`, which needs nothing. In a third, a message predicted that no Markdown
> would remain in a format diff, while the section above says the opposite and names the three
> categories that survive.
>
> The direction of the error is what makes it worth recording. A count that does not reconcile
> does not fail safe: the reader resolves the discrepancy by assuming the uncounted callee belongs
> in the set, and adds registry configuration to `reusable-security-ci` — the exact thing the next
> paragraph forbids. An off-by-one in a summary became an argument for the wrong action, and it
> arrived with more apparent authority than the table it contradicted.
>
> So: **when a message and this document disagree, the document wins**, and please say so rather
> than complying. Both consumers who caught this declined to act on the wrong claim and reported
> it instead. That is the behaviour that works — a fleet where the summary is trusted over the
> source propagates a maintainer's arithmetic slip to every repository at once, and none of them
> can detect it locally, because each one's configuration is individually plausible.

**The packages are private today, so `GITHUB_TOKEN` is not enough on its own**: each consuming
repository must also be added under the package's **Manage Actions access** settings with
**Read**. That is one grant per repository per package, so seven repositories across three
packages is twenty-one grants to create and maintain.

> **If "Manage Actions access" is not on the package settings page, this is why.** All three
> packages were published _linked_ to `jrmoulckers/engineering`, and a linked package **inherits
> the access permissions of its repository by default**. While it inherits, the granular settings
> — including **Manage Actions access** — are not shown at all. You must first remove the
> inherited permissions, after which the package's own access list becomes editable.
>
> The npm registry does support this. It is one of the registries with granular, user-scoped
> permissions, alongside the Container, NuGet and RubyGems registries; only the Maven and Gradle
> registries are repository-scoped and genuinely cannot do it. A consumer who looks for the
> button, does not find it, and concludes npm lacks the capability has drawn a reasonable but
> wrong conclusion from a real observation.

Making the packages public collapses all of that to nothing, because any authenticated token may
then read them. Note that public does **not** mean anonymous — the registry still rejects an
unauthenticated read with a 401, so `packages: read` and the token remain required either way.
What changes is authorization, not authentication.

**This section applies to all three packages.** An earlier revision said it applied to
`@jrmoulckers/eslint-config` only, on the grounds that `tsconfig` and `prettier-config` were
vendored at a pinned ref and needed no registry, token, or grant. That was wrong — all three are
published and all three need the grant, so the count stands at twenty-one rather than seven. See
the correction under §1.

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

**Deleting it is a simplification, not a repair — and that distinction is worth stating out loud.**
`NODE_AUTH_TOKEN` is still a declared optional `workflow_call` secret in every one of these
callees, so a caller that keeps passing it goes on working. The old shape carries dead config; it
does not break. One repository checked the callees' `on.workflow_call` blocks _before_ removing the
secret rather than after, which is the right order, and it turned an apparently urgent change into
a tidy-up.

This generalizes past workflows, and it is a duty on whoever publishes the guidance rather than on
you: **whenever a recommended shape changes, say whether the previous shape still works.** Silence
on that point reads as _breaking_, and the rational response to a suspected break is to re-pin
immediately — which is precisely the action most likely to expose an unrelated latent fault, such
as the permission-ceiling failure above. A shape change announced without a compatibility note can
therefore cause more breakage than the change itself ever would.

So when you receive one: establish whether it is required or cosmetic before you schedule it, and
verify against the callee's declared interface rather than against the announcement.

**An explicitly passed secret beats the fallback, and that destroys your diagnosis.** If the caller
passes `NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN }}`, the workflow authenticates as that PAT
and never exercises `github.token` at all. A `403 permission_denied: read_package` then tells you
about **the PAT's** authorization — a missing `read:packages` scope, or un-authorized SSO — which
is indistinguishable in the log from the package being unreachable. Deleting the line splits the two
cleanly:

| After removing the explicit secret | Means                                    |
| ---------------------------------- | ---------------------------------------- |
| install succeeds                   | the PAT was the problem                  |
| `403` on `github.token`            | the package's Manage Actions access list |
| `401`                              | `packages: read` missing from the caller |

**The empty-token trap does not apply to these workflows.** Elsewhere in this guide, an unset
`NODE_AUTH_TOKEN` sends an empty credential and 401s. At the pinned ref above the expression is
`${{ secrets.packages-read-token || github.token }}`, so an unset or empty secret **degrades to the
job token** rather than sending nothing. That is strictly better, but it means a stale secret name
fails as a _403 against the wrong identity_ instead of an obvious 401 — quieter, and easier to
misread as a package problem.

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

**Never accept a pin without checking its direction first.** A SHA handed to you in a message,
issue or review comment is meaningless on its own: what matters is how it relates to the ref
_you_ are already on. Check before you move, and refuse if the answer is `behind`:

```bash
gh api repos/<owner>/<repo>/compare/<your-current-sha>...<proposed-sha> \
  --jq '{status, ahead_by, behind_by}'
# status "ahead"  -> the proposal contains your ref; safe to adopt
# status "behind" -> the proposal is an ancestor; adopting it is a rollback
```

This is worth a hard rule because **a backwards re-pin is invisible**. Every other failure in this
guide announces itself — a 401, a 403, a `startup_failure`. Silently reverting to an older set of
shared workflows does not: CI stays green, because the older workflows were green too. You simply
lose whatever they fixed, and you find out later from the symptom rather than the cause.

The mechanism that produces these is worth naming, because it is systemic rather than careless.
**A single SHA broadcast to several repositories is guaranteed to be wrong for some of them**, since
each is at a different pin — the same message that advances one repository rolls another back. It
also happens when the sender quotes the SHA of the branch or PR they are working on rather than the
tip of the default branch. Four such instructions went out during this migration; the repository
that checked every one of them and refused caught all four, and the repositories that complied would
have had no signal at all.

So the obligation runs both ways. If you publish a pin, compare it against each recipient's current
ref before sending, and say what it contains rather than only quoting it. If you receive one, verify
`ahead` before you move — a correct-looking SHA from a credible source is exactly the case this
check exists for.

**Check the recipient even applies before you send.** One repository was told to re-pin shared
workflow refs three separate times while consuming none of them — 0 `uses:` references across all
31 of its workflows, a fact the sender had themselves confirmed earlier in the same thread. That is
not merely wasted effort: it teaches a recipient that messages from the shared repository need not
apply to them, which is precisely the habit that makes the next real advisory get skimmed. A
broadcast is cheap to send and expensive to receive, and the cost lands on whoever has to work out
that it was irrelevant.

**Before telling anyone to delete a line, confirm they have it.** Another repository was told to
drop a `sourceMap` setting it had never written: the flag was inherited from a third-party base
config, so `git grep` found nothing to remove. Their reply is the right instruction back —
_worth checking before you tell them to delete something they also don't have._ An instruction to
remove something is uniquely bad when misdirected, because the recipient cannot comply and cannot
tell whether they have misread you or you have misread them. Name the file and line you expect it
in, so a recipient who lacks it knows immediately that the message is not about them.

**The sharper version of that: confirm the line exists in _their tree_, not in your notes about
them.** It happened again, and worse. A repository was told to remove a note recording an ADR
naming convention as "pending" — a repo-wide grep found nothing. The note had never been in their
tree at all. It existed only in **their earlier report to me**, where they had flagged the
convention as unresolved in conversation and then, correctly, declined to write speculation into
the repository. I read my own record of the conversation as a record of their files.

That is a distinct failure from the `sourceMap` case and it is easier to commit, because the
sender genuinely did see the text — just not where they think. **The check is not "do I remember
this?" but "does `git grep` find it on their default branch?"** A recipient who diligently follows
such an instruction will search, find nothing, and be left unable to distinguish a phantom
instruction from their own oversight. Both of this migration's instances were caught only because
the recipient reported the absence instead of assuming they had misread.

**A measurement is evidence for the number, not for the cause.** The most expensive defect in this
migration was self-inflicted and began with a correct report. A consumer measured 37 packages /
6.2 MB of React and Next tooling arriving in a Svelte-only repository. We assigned it a cause —
that `peerDependenciesMeta.optional` does not prevent installation — and on that basis moved five
framework plugins into a bespoke `frameworkPlugins` field that npm ignores, published the mechanism
on this page, and added a regression test asserting the plugins must never be peers.

The premise was false. Optional peers are not auto-installed by npm 7, npm 11, pnpm 11, or pnpm
with `auto-install-peers=true`; installing the real package at the very version the report was
filed against yields zero framework plugins present. The change bought nothing and cost the version
contract for three releases, during which the published ranges were documentation rather than
constraints.

Two things generalise. First, **the cause was never re-derived** — the number was checked and the
explanation was not, and a plausible explanation for a real number is the easiest kind of error to
ship. When you report a size or count, include the dependency path (`npm ls <pkg>`, `pnpm why
<pkg>`); when you receive one, ask for it before designing against a mechanism.

That request is not a formality, and the same report recurred after the correction shipped —
same repository, same count, same attribution to optional peers. So it was measured a third time,
as the exact upgrade being performed rather than as an isolated install. A Svelte-only tree
(`eslint`, `eslint-plugin-svelte`, `typescript`), npm 11.16.0, real tarballs packed from the tags:

| Step          | `node_modules` dirs | lockfile lines |
| ------------- | ------------------- | -------------- |
| at `0.1.0`    | 102                 | 1884           |
| after `0.2.1` | 102                 | 1896           |
| **delta**     | **0**               | **+12**        |

Zero React, hooks, a11y or Next plugins present at either version, though `0.2.1` declares all four
as optional peers and `0.1.0` declares none of them. The reported 37 packages are real and the
dependency path producing them is somewhere in the consuming tree; nothing in this package can
account for it. **If a shared config appears to add packages, run `npm why <plugin>` before
reporting the config as the cause** — that single command distinguishes the two explanations, and
it is the step whose absence cost this migration its most expensive defect.

Second, and worse: **a wrong belief with a green check on it stops looking like a belief.** The
regression test encoded the false invariant, passed on every run, and would have blocked the
correct fix had it not been read closely. A test is an assertion about the world and inherits every
error in the reasoning that produced it. When a test exists only to defend a conclusion rather than
a behaviour, write the evidence for that conclusion into the test body, so the next reader can
re-check the claim instead of trusting the check.

**Route by scope. Never replace the default registry.** <a id="the-npmrc-scope-trap-measured"></a>Setting
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

> **Audit sends dependency names — including `@jrmoulckers/*` — to `registry.npmjs.org`.** The bulk
> advisory request contains the name and version of every dependency, whichever registry resolved
> it. Scoping a dependency to a private registry does **not** keep it out of that payload.
>
> Be precise about what this does _not_ mean, because the loose version invites a mitigation that
> does nothing. A consumer intercepted and gunzipped the actual
> `POST /-/npm/v1/security/advisories/bulk` body rather than reasoning about it: 745 public
> name/version pairs went out, an isolated probe sent `{"@jrmoulckers/eslint-config":["0.2.1"]}`,
> and **zero of their own five `private: true` workspace packages appeared**. npm excludes private
> workspace roots. So "your private package names leak" is false for internals, and renaming or
> re-scoping them buys nothing. The real exposure is your **dependency** names; the real mitigations
> are `--offline`, or accepting it.

The no-auth conclusion holds for a plain `npm audit` / `pnpm audit`, which only reads advisory
data. It does **not** hold for a command that resolves or installs — `npm audit fix`, or any
install-then-audit sequence — because those do contact the scoped registry and will 401 without
a token. If you override `reusable-security-ci`'s `audit-command` input with anything of that
shape, you are back to needing registry configuration.

`--omit=dev` makes the point moot regardless. All three presets are `devDependencies`, so an audit
scoped to production dependencies never queries them and passes even while `npm ci` fails in the
lint and build jobs. A repository auditing dev dependencies too is the case that needs the
registry wiring — confirmed in practice by a consumer whose `Package audit` job stayed green
through every run in which the install jobs failed.

#### Reading the failure: 401 and 403 are different problems

Both surface at install and are easy to conflate, but they point at opposite causes:

| Symptom                               | Meaning                             | Fix                                                     |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `401 unauthenticated`                 | No token, wrong host, or wrong type | Check `NODE_AUTH_TOKEN`, `registry-url`, token class    |
| `403 permission_denied: read_package` | Authenticated, not authorized       | Package visibility or an explicit grant — not the token |

The tell for a 403 is that **metadata resolves and only the tarball download fails**: the request
was authenticated successfully and rejected on authorization. No amount of token work fixes it.
Diagnostic contributed by a consumer who chased the wrong one first.

**The general shape, worth recognising before you debug any of them:** every credential failure on
this path reports as _a bad credential_ when the cause is almost always a **missing, misrouted, or
misclassified** one. An empty `NODE_AUTH_TOKEN` interpolates to nothing; a token bound to
`npm.pkg.github.com` is simply not sent to another host; a fine-grained token is rejected where a
classic one is required; an authorized-but-unprivileged token authenticates and then fails on the
tarball. Four different causes, one misleading symptom. Check _which_ credential reached _which_
host before changing the credential itself.

### Install

```bash
npm i -D @jrmoulckers/eslint-config @jrmoulckers/prettier-config @jrmoulckers/tsconfig
```

**Do not use a caret at all while these packages are `0.x`.** On a `0.x` package a caret only
permits _patch_ updates — `^0.1.0` resolves to `>=0.1.0 <0.2.0` and can never reach `0.2.x`. Early
adoption briefs named `^0.1.0`, and a manifest still carrying it silently installs a build in
which `@jrmoulckers/eslint-config/react` and `@jrmoulckers/tsconfig/vite-react.json` **do not
exist**.

The trap is that this repeats at every minor. `^0.3.0` locks you out of `0.4.0` exactly as
`^0.1.0` locks you out of `0.2.0`, so a consumer who follows a floor table using carets is stale
again one release later and has no signal. Pin with an explicit upper bound instead, which tracks
every minor until the first stable major:

| Package                        | Range             | Floor is set by                                                        |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `@jrmoulckers/eslint-config`   | `>=0.12.0 <1.0.0` | Runtime deps track the ESLint major, so ESLint 10 gets ESLint 10 rules |
| `@jrmoulckers/tsconfig`        | `>=0.4.0 <1.0.0`  | `vite-react.json`; TypeScript 6 and 7 support; opt-in `node.json`      |
| `@jrmoulckers/prettier-config` | `>=0.3.0 <1.0.0`  | `proseWrap: 'preserve'`; `0.1.x` hard-wraps Markdown                   |

The floors say what each version _added_, so they only rise when something is genuinely required.
The ranges keep you current without editing the manifest. Confirm what is actually published
rather than trusting this table, which is a literal and therefore ages:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json
```

**Verifying the behaviour does not verify the version, and this is the way the caret survives a
careful adoption.** One repository adopted `@jrmoulckers/prettier-config@^0.2.0` and checked it
properly — not package metadata but the _effective resolved config_: `proseWrap: preserve` and
`printWidth: 96` on Markdown, `parser: svelte` on a component, `format:check` green. Every
assertion was true. The pin was still a minor behind, because `^0.2.0` is `>=0.2.0 <0.3.0` and
`0.3.0` was published.

A stale version passes a behavioural test **because it behaves correctly**. What it lacks is not
wrong behaviour but absent capability, and no test you write against the features you already use
can see a feature you do not use yet. In this instance the excluded release was the one that
widened `prettier-plugin-svelte` from `^3.2.0` to `^3.2.0 || ^4.0.0` — and the repository was a
Svelte repository. The pin blocked precisely the change most relevant to it, and every check it
ran stayed green.

So the resolved version is its own assertion, and it is the one behavioural verification cannot
supply:

```bash
npm ls @jrmoulckers/prettier-config @jrmoulckers/eslint-config @jrmoulckers/tsconfig
# compare against versions.json — currency is a separate claim from correctness
```

This is the sixth repository to lose work to the `0.x` caret, and the first where a thorough
verification pass ran, succeeded, and confirmed nothing about currency. It belongs with the other
instances in which **a missing thing presents as a passing one**.

> **A stale pin hides the fix for the bug you are about to report.** The sharpest instance so far:
> a Svelte repository held `prettier-config` at `^0.2.0` deliberately, and in the same message
> escalated — as an open upstream defect — that the package's `prettier-plugin-svelte` peer of
> `^3.2.0` was stale against the `4.1.1` it runs. Release `0.3.0`, the one release that caret
> excludes, is exactly the one that widened that peer to `^3.2.0 || ^4.0.0`.
>
> The bug report and its remedy were separated by the version range alone. That is worse than an
> ordinary stale pin, because it is **self-sealing**: the range does not merely withhold the fix,
> it makes the fix unobservable, since the release carrying it is never fetched and never read.
> Nothing in the repository can distinguish "not fixed yet" from "fixed in a version my range
> forbids", so the natural next step is to escalate — and the escalation is unfalsifiable from
> inside the pin.
>
> Three separate repositories have now reported a peer range as a live upstream defect when the
> widening had already shipped. Before filing one, resolve the current version and read the peer
> **there**: `curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json`,
> then check the peer at that release rather than at your pinned one.

**Use that, not `npm view`, and not `git show`.** This table went stale within one release of being
written — twice — and the verification command previously recommended here was `npm view`, which
requires registry access, the one thing the repositories most likely to be stale do not have. A
check that only works for readers who are already fine is not a check.

The `git show origin/main:versions.json` form recommended here before was better, but it has a
failure this one does not: **`origin/main` is a local cache.** Without a preceding `git fetch` it
returns whatever you last downloaded, silently and with no error. A consumer read this repository at
a tag sixteen releases behind and reported four facts as current — the published versions, a missing
`projectService`, absent hooks rules, and absent type declarations. All four were true at their ref.
All four were false on `main`. Nothing in their method could have revealed that, because a stale
read looks exactly like a fresh one.

`curl` against `raw.githubusercontent.com` cannot be stale: no clone, no fetch, no local ref, and no
authentication, since this repository is public. If you prefer `git`, run `git fetch origin` first
and treat the fetch as part of the command rather than as something you did earlier.

> **Reading the source is not more current than reading a manifest. Currency is a property of the
> ref, not of the method.** A consumer opened with _"confirmed against source, not transcribed"_ —
> exactly the right instinct — and read `packages/eslint-config/package.json` at tag `v0.4.0`. They
> found `eslint: ^9.0.0`, correctly derived that their `eslint@10` tree would `ERESOLVE`, and filed
> it as a second blocker independent of package visibility. Every step was sound and the conclusion
> was false: the current release peers `^9.0.0 || ^10.0.0`, and had for nine minors.
>
> They then went further, resolving the preset from that source and _executing_ it — the strongest
> form of verification anyone in this migration has used — and reported that the `react` subpath
> throws on ESLint 10 because `eslint-plugin-react` calls the removed `context.getFilename()`. That
> diagnosis is exactly right, and it is the same one that produced the fix already shipped: the
> preset sets a concrete `settings.react.version` instead of `'detect'`, which is what triggers the
> removed API. Reproduced on their exact versions — `eslint@10.6.0`, `eslint-plugin-react@7.37.5` —
> the current `reactConfig()` loads and `react/jsx-no-target-blank` fires.
>
> **Executing the code does not rescue you from reading it at the wrong ref**, and it is worth
> saying plainly because the effort is what makes it convincing. Running a thing feels categorically
> stronger than reading about it, so a result obtained by execution gets less scrutiny about
> _which_ thing was run. This is the same failure as the stale-pin case above with the direction
> reversed: there, current source and a stale install; here, a stale checkout executed faithfully.
> Both produce a true statement about the wrong artifact.
>
> Check the ref before checking the code. `git fetch origin && git describe --tags origin/main`, or
> `curl` the raw `versions.json`, costs one command and invalidates the entire investigation if it
> disagrees.

Their general point survives the correction and is worth keeping: **a satisfiable range is not the
same as a working range.** The preset's `eslint-plugin-react: ^7.37.0` does permit versions that
need the `settings` workaround to run at all, so the config compensates for a plugin defect the
manifest cannot express. Only executing the resolved tree shows that — which is why the repository
runs its preset tests under an ESLint 9 **and** an ESLint 10 matrix rather than trusting the peer
range to describe reality.

A test asserts that every version range printed in this document matches `versions.json`, so the
table above cannot drift again without failing CI.

**And read `channel` while you are there.** All three packages are `"channel": "registry"`, so all
three require a token and all three are gated on the same visibility grant.

Three repositories independently reported being blocked on all three packages, and this paragraph
previously told them that only `eslint-config` was affected — that `tsconfig` and
`prettier-config` were `"channel": "vendored"`, never published, and adoptable while blocked.
**They were right and this document was wrong.** The correction and its cause are under §1.

The lesson survives the correction, and is now sharper. The original diagnosis was that prose goes
stale in a consumer's checkout while `versions.json` is read from `main`, so the meaning of
`channel` should live beside the value. That reasoning is still right, and it is why the legend
exists. But it was applied to a value that was itself false, which moved a wrong answer somewhere
more authoritative and harder to argue with. **Co-locating an explanation with a value does
nothing if nothing checks the value**, and three consumers contradicting it was the signal that
should have prompted the check.

So the legend now carries an enforcement rather than an assertion: a channel declaring
`"requiresRegistryAuth": false` must be backed by a package with `private: true`, and a channel no
package uses cannot remain in the file. Both are tested.

**If that command fails for you, read [`versions.json`](../versions.json) at the repository
root — not a git tag, and not `packages/<name>/package.json`.** A consumer without
`read:packages` gets `401`/`403` here, which is the same position as a repository whose access
grant has not landed yet. The tempting fallback is to read `packages/<name>/package.json` at a
tag, and it is wrong in a way that looks authoritative: it reports the source tree at that
moment, not what is published. That failure has now happened repeatedly, in both directions — a
consumer concluding a fix was missing when it had shipped several releases earlier, and
Engineering citing a repository tag as though it were an installable version. **Both are the same
mistake**, and the second one causes the first.

`versions.json` exists because that instinct — read the repository — is not going away, and
three separate repositories acted on it after this section already told them not to. So the
repository now answers correctly instead. It records the published version, the channel, the
range to pin, and the peer ranges, and `npm run versions:check` fails CI if any of it drifts from
the registry. It is therefore safe to read at a tag: every commit on `main` had it matching the
registry at that time. A newer version may exist, but nothing it states will be wrong.

#### Telling "not authorized yet" apart from "not published"

A `401` on its own answers nothing, and several repositories have read one as proof a package was
private. GitHub Packages **authenticates every read, including of public packages**, so an
anonymous request returns `401` whether the package is public, private, or absent. Visibility
changes _authorization_, not _authentication_.

Run it twice, and the pair is what settles it:

```bash
# 1. anonymous
curl -so /dev/null -w '%{http_code}\n' \
  https://npm.pkg.github.com/@jrmoulckers%2Ftsconfig

# 2. authenticated
curl -so /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://npm.pkg.github.com/@jrmoulckers%2Ftsconfig
```

| Anonymous | Authenticated | Meaning                                                        |
| --------- | ------------- | -------------------------------------------------------------- |
| `401`     | `200`         | Readable by you. Any install failure is elsewhere.             |
| `401`     | `403`         | Authenticated fine, **not authorized** — access grant is owed. |
| `401`     | `404`         | No such package or version.                                    |
| `401`     | `401`         | Your token is wrong or lacks `read:packages`.                  |

The `403` row is the one worth knowing, because it separates _your_ problem from _ours_: your
token works, and what is missing is a grant only the package owner can make. Reported by a
consumer who ran both probes rather than escalating on the `401` alone — which lets any
repository answer "has the access landed yet" without asking.

The `401`/`200`/`404`/`401` rows were confirmed from the owner side against this registry; the
`403` row is the consumer's evidence, since an owner cannot reproduce it.

That last distinction is the whole design. This table and the floor table are literals that age
silently; `versions.json` is a literal that **cannot** age silently, because a check compares it
to the registry rather than trusting it. Prefer it over any version number written in prose,
including numbers written here.

So: if you cannot query the registry, take versions from `versions.json`, and say in your report
that you could not verify against the registry yourself. That sentence is what lets the claim be
checked rather than propagated.

If you are reporting a defect in a preset, **state the version you resolved, not the range you
pinned.** Several reports have described behaviour fixed many releases earlier, because a `^0.1.0`
range held the install at `0.1.x` while the report was written against current documentation.

**`versions.json` cannot be found by the tags most likely to need it.** It is newer than much of
what consumers are pinned to, so a repository old enough to be reading `packages/*/package.json`
at a tag is usually too old to contain the file that would have told it not to. One repository
read `packages/eslint-config/package.json` at `v0.2.8` and reported `eslint: ^9.0.0` as too narrow.
That read was _correct for that tag_ — the package was `0.2.1` there — but the published version
was `0.10.0`, which had widened it to `^9.0.0 || ^10.0.0` along with the two other ranges the same
report asked for. So the check is not "does the repository say the range is narrow", it is **"am I
reading a tag old enough that this file predates the answer?"** If `versions.json` is absent from
the tree you are reading, that absence is itself the finding: resolve a newer ref before reporting
anything about versions.

**In any document that states a version twice, the summary is the copy that goes stale.** A
consumer found their own `AGENTS.md` saying the shared packages were "all pinned at `v0.1.0`"
thirty lines above adoption guidance that correctly said `^0.2.1` — the detail had been revised
three times and the summary line never re-read, because nobody re-reads the summary while editing
the section it summarizes. The failure is not cosmetic: `0.1.0` was not installable in that
repository at all, and the one-line summary is the first thing every reader hits. Either state the
version once and link to it, or point both places at `versions.json`. This is the same failure as
acting on a compressed summary instead of the artifact, committed at authoring time rather than at
reading time.

**Check the registry, not a git tag.** A repository tag and a package version are different
numbers and move independently: this repository was at `v0.2.5` while `@jrmoulckers/tsconfig` was
at `0.2.0`, and is at `v0.15.x` while that package is at `0.4.0`. Reading
`packages/tsconfig/package.json` at some tag tells you what the source tree contained then, not
what is published now — a consumer checked exactly that and concluded a peer range had never been
widened, four releases after it was. The registry is authoritative:

```bash
npm view @jrmoulckers/tsconfig version peerDependencies \
  --registry=https://npm.pkg.github.com
```

**Never cite a repository tag as a version to install.** Release notes here are written against
repository tags, and adoption briefs have repeated them — but `v0.16.0` is not something you can
put in a `package.json`, and the three packages carry three different numbers that all differ from
it. A consumer told to "adopt `v0.2.5`" will reasonably write `^0.2.5` and get a resolution error
for all three. Resolve each package separately; that is what the command above is for.

### A green install does not prove your peer ranges are satisfied

Package managers disagree about what an unmet peer means, and the disagreement is silent:

| Manager                              | Unmet peer                |
| ------------------------------------ | ------------------------- |
| pnpm (default)                       | warning; install succeeds |
| pnpm with `strict-peer-dependencies` | error                     |
| npm 7+                               | `ERESOLVE`; install fails |

So a pnpm repository can run lint, format, and typecheck entirely green while three peer ranges are
unmet, and learn nothing. This is not hypothetical: a consumer verified a full green toolchain and
only found the unmet ranges by reading the manifests, having sailed past the wall an npm repository
would have hit on the first install.

The consequence worth acting on is that **a green run in one repository is not evidence for
another.** If you are on pnpm, check unmet peers explicitly rather than inferring them from a
passing build:

```bash
pnpm install --strict-peer-dependencies --lockfile-only
```

This is the same shape as two other traps in this guide — a clean `rules-of-hooks` run, and a
lab-only performance channel. In each, a tool reports nothing and the absence is read as
correctness when it only means the check was never made.

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

> **Sharper: the wrong range is not unverified, it is _unverifiable_ by that method.** A consumer
> who had verified exactly this way drew the distinction, and it is the more useful statement. A
> `file:` resolution **ignores the range entirely** — the specifier is never consulted, so it is
> never exercised, so no amount of care in the local run can surface a wrong one. The two
> disagreements cancel out visually: the source is current, the results are real, and the manifest
> that would have contradicted them was never read.
>
> This matters because "re-run your gates after bumping" implies the gates could have caught it.
> They could not. **The step that catches it is lockfile generation**, which resolves the range
> against the registry — and for a repository blocked on package access, that is precisely the step
> it cannot run. Treat a `file:`-verified adoption as carrying **one unvalidated field** into CI,
> and re-read the range by eye against `versions.json` before the pull request opens.
>
> **`npm pack` has the same hazard with a sharper edge.** A consumer verified by packing the local
> checkout, then correctly observed that the packed versions each satisfied their declared range —
> and concluded the green run therefore covered the manifest. It did, but only against **that
> checkout**, which was several minors behind `main`. A `file:` link at least always resolves to
> current source. `npm pack` freezes whatever the tree happened to be, so the check "does the
> packed version satisfy my range?" can pass while both sides are stale together. Self-consistency
> is not currency. Compare against `versions.json` on `main`, not against the tree you packed from.

**"Did you install a tarball, or link a checkout?" is the diagnostic question.** A second consumer
proposed it after using `npm pack` deliberately — not as a shortcut, but because a workspace link
resolves differently from a registry install and they wanted the failure modes a real install has.
That reasoning is right, and it separates two things the paragraph above ran together:

| Method                 | Resolves to        | Exercises your declared range? | Exercises packaging? |
| ---------------------- | ------------------ | ------------------------------ | -------------------- |
| `link:` / `file:`      | live working tree  | no                             | no — `files` ignored |
| `npm pack` + install   | the packed tarball | no                             | **yes**              |
| lockfile from registry | the published tar  | **yes**                        | yes                  |

So `npm pack` is materially better than a link: it honours `files`, `exports` and `main`, so a
missing entry point or an unpublished directory fails the way it would in CI. The hazard is
narrower than "packing is a trap" — it is that the packed tree can be stale, and that **neither**
local method consults your declared range.

> **Generate the lockfile with the same package-manager major CI runs, and check which that is.**
> A consumer regenerated a lockfile against the real registry on npm 11.16.0, verified it locally,
> and CI rejected it: the reusable workflows run Node 22 / npm 10.9.8, and npm 10 read the npm-11
> lockfile as out of sync — `Missing: picomatch@4.0.5 from lock file`. The manifest and the
> resolved versions were correct; only the lockfile's internal placement differed. Regenerating on
> npm 10.9.8 fixed it in 15 insertions / 72 deletions with no manifest change.
>
> **`lockfileVersion: 3` does not imply cross-major compatibility.** Both majors write v3, and the
> version field is unchanged by the incompatibility, so the file looks portable and is not.
>
> **It is also graph-dependent, so do not try to predict it.** Reproducing this on a minimal
> `svelte-check` tree did **not** fail: an npm-11 lockfile installed cleanly under
> `npm@10.9.8 ci`. Whether a given dependency graph trips it is not something you can reason about
> in advance, which is the argument for matching the major rather than for knowing when it
> matters. Pin the manager in `packageManager`, or read the Node version the reusable workflow
> actually uses, and generate to match.
>
> **This is not a source of dependency-count differences.** Measured directly, because it was a
> plausible explanation for a long-running bloat report: installing a package declaring three
> optional peers into an identical tree adds exactly one directory under **both** npm 10.9.8 and
> npm 11.16.0, and installs none of the optional peers under either. Optional-peer behaviour does
> not vary across these majors; lockfile placement does.

**The general rule, which is not npm-specific: verify against the resolved artifact, not a
convenient local stand-in.** This framing came from the one consumer with no npm surface at all,
and it is better than the packaging-flavoured version above because it survives a change of
channel. The failure has the same shape everywhere it appears:

| Channel           | The convenient stand-in                                       | What CI actually resolves               |
| ----------------- | ------------------------------------------------------------- | --------------------------------------- |
| npm packages      | a `link:`/`file:` checkout, or a stale pack                   | the tarball your declared range selects |
| fetched Go config | golangci-lint's built-in defaults, when the fetch has not run | the pinned `configs/golangci.yml`       |
| vendored files    | the copy in your tree                                         | the copy at the ref you recorded        |

The Go instance is worth stating because the mechanism is completely different and the symptom is
identical: golangci-lint does not error on a missing config, it silently falls back to its defaults.
A contributor who has not run the fetch loses `nilerr`, `errorlint`, `revive`, `misspell` and
`unconvert`, gets a **clean local run**, and is red in CI with no local reproduction. In the rebase
that surfaced this, a `nilerr` violation would have shipped for exactly that reason.

Because the mechanisms differ, a fix for one does not fix the other — the shared discipline is the
question, not the remedy: **is the thing I just verified the thing that will be installed?** Ask it
before believing a green local run, on any channel, including ones added later.

> **The wider class: a missing thing presents as a wrong thing, or as a passing one.** The same
> consumer unified three failures in this migration that had been recorded separately, and the
> unification is correct — they are one lesson, not three:
>
> | Missing                               | How it presents                                                                                  |
> | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
> | no registry token                     | `401`, textually identical to a wrong or expired token                                           |
> | no fetched `.golangci.yml`            | a clean lint run against a strictly smaller default rule set                                     |
> | a failed fetch writing to disk        | an error body saved as config, with exit status `0`                                              |
> | `packages: read` absent from a caller | `startup_failure` with **no job, no step and no log** — indistinguishable from a platform outage |
>
> In each case the absent thing is indistinguishable from a present-but-wrong thing, and in two of
> them it is indistinguishable from success. **So verify presence before assuming validity**: check
> the token is non-empty before concluding it is invalid, check the config exists before trusting
> a clean run, check the fetched body is the shape you expected before moving it into place. An
> error message describes what failed, not what was missing, and reasoning from the message alone
> reliably diagnoses the wrong one.
>
> The same consumer later added the fourth row and it is the most extreme member: the other three
> at least produce output to misread, while this one produces **nothing at all** and so presents as
> a fault in GitHub rather than in your file. It also shows the countermeasure has a limit — you
> cannot assert presence from inside a job that is never created, so this row is checked by reading
> the caller against the callee, or from a separate workflow file. Where the general rule fails,
> the fallback is to make the dependency **unreachable rather than merely absent**: the
> `blackhole.invalid` test elsewhere in this guide disproves a suspected registry dependency
> precisely because an unroutable host cannot return a plausible-looking `401`. Absence is
> ambiguous; unroutability is not.

**Byte-identical source across versions still does not license carrying a result forward.** This is
the part worth internalising, and it comes from that consumer being unusually precise about scope.
They noted their verification covered only the files their repository actually imports, diffed
those files between the version they had verified and the version they were bumping to, and found
them identical — a sound reason to carry the rule-level result forward. Reproduced here: across
`v0.1.0` and `v0.2.14`, `eslint-config/svelte.js`, `eslint-config/base.js`,
`prettier-config/svelte.js` and `tsconfig/vite-app.json` are all byte-identical.

And the bump still mattered, because the delta was not in any of those files:

```
v0.1.0   eslint-plugin-svelte: ^2.46.0
v0.2.1   eslint-plugin-svelte: ^2.46.0 || ^3.0.0
```

**`peerDependencies` live in the manifest, not in the modules you import.** A repository on
`eslint-plugin-svelte` v3 would install cleanly at one version and hit an unmet peer at the other,
with every consumed file identical between them. So the correct scope statement is narrower than
"the code I use didn't change": diff the `package.json` too, and say which of the two you checked.

Peer dependencies are not bundled — install the ones your stack needs:

| Stack   | Also install                                                           |
| ------- | ---------------------------------------------------------------------- |
| Any     | `eslint prettier typescript`                                           |
| Svelte  | `eslint-plugin-svelte prettier-plugin-svelte`                          |
| React   | `eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y` |
| Next.js | `@next/eslint-plugin-next eslint-plugin-react-hooks`                   |

**These are not installed for you, and that is deliberate — but the reason given here was wrong for
several releases, so read this if you adopted between `0.9.0` and `0.12.0`.**

Framework plugins are declared as **optional `peerDependencies`**. npm does not install an optional
peer, so a Svelte-only repository never receives the React or Next plugins — while the supported
range stays somewhere npm will check it and warn you on a mismatch:

| Plugin                      | Supported range        |
| --------------------------- | ---------------------- |
| `eslint-plugin-svelte`      | `^2.46.0 \|\| ^3.0.0`  |
| `eslint-plugin-react`       | `^7.37.0`              |
| `eslint-plugin-react-hooks` | `^5 \|\| ^6 \|\| ^7`   |
| `eslint-plugin-jsx-a11y`    | `^6.10.0`              |
| `@next/eslint-plugin-next`  | `^15.0.0 \|\| ^16.0.0` |

> **Correction, `0.12.0`.** From `0.9.0` these were moved out of `peerDependencies` into a bespoke
> `frameworkPlugins` field, and this page asserted that `peerDependenciesMeta.optional` "suppresses
> the error when a peer is missing, but npm 7+ still installs an optional peer whenever it can
> resolve one."
>
> **That is false, and the change it justified removed version checking for no benefit.** Measured by
> packing this package and installing the tarball into a bare consumer: `eslint` — a _required_ peer
> — is auto-installed, and all five optional peers are not. Same result on npm 7, npm 11, pnpm 11,
> and pnpm with `auto-install-peers=true`. A clean install of the Svelte-only tree came to 38.7 MB
> with zero React or Next plugins present, at the very version the original report was filed
> against.
>
> The consumer's measurement of 37 packages / 6.2 MB was real; the diagnosis was not, and nobody
> re-derived it before it became a design change, a documented mechanism, and a regression test that
> asserted the wrong invariant. If you are carrying a workaround for implicitly-arriving plugins,
> you can drop it — and if you copied the "optional peers are still installed" claim into your own
> notes, it is wrong there too.
>
> The lesson worth keeping: **a measurement is evidence for the number, not for the cause.**

Each preset is reached only through its own subpath export and imports its plugin directly, so a
missing one fails immediately at config load with the package named — you will not get a silent
half-configured lint run. With the plugins declared again, a version outside its range is now caught
at install time as an `npm warn peerOptional` rather than only at lint time.

If you adopted before `0.9.0` and relied on the plugins arriving implicitly, add the row for your
stack to your own `devDependencies` when you upgrade.

The Next row includes `eslint-plugin-react-hooks` because Next.js is React and the preset lints
hooks. Earlier revisions of this table omitted it, which is worth knowing if you adopted from a
copy: the preset then fails to load rather than silently skipping the rules.

**On ESLint 10, do not set `settings.react.version` to `'detect'`.** `eslint-plugin-react@7.37.5`
— the current release — declares `eslint: ... || ^9.7`, and its version detection calls
`context.getFilename()`, which ESLint 10 removed. Every rule in the plugin then fails to load
with `contextOrFilename.getFilename is not a function`, which reads like a broken plugin rather
than a removed API.

`reactConfig()` and `nextConfig()` are **not** affected: they resolve the installed React version
themselves at config-construction time and pass a concrete string, so nothing enters the detection
path. Verified against ESLint 10.8.1 with `eslint-plugin-react@7.37.5` and React 19 — the preset
lints normally, and the same config forced to `'detect'` throws the error above. If you are
migrating, the `'detect'` line is usually the only thing you need to delete; keeping your own
`settings.react` block is what reintroduces the failure.

> **Isolating _which_ component throws is not the same as finding the cause, and the difference
> changed the recommendation.** A consumer on ESLint 10 hit this error, installed the three peers
> and ran them separately, and produced a clean result: `jsx-a11y` works, `react-hooks` works,
> `eslint-plugin-react` throws — "the sole fault". Every one of those observations is correct.
> The conclusion drawn from them was that the plugin is incompatible with ESLint 10 and should be
> **dropped or gated by ESLint major**.
>
> It is not incompatible. Reproduced on ESLint 10.8.1 with that exact plugin version: the preset's
> full smoke suite passes, and reintroducing `settings.react.version: 'detect'` fails it with the
> error above. The plugin works; **one setting** does not. Acting on the isolation result would
> have removed a working plugin — including `react-hooks`, which is the part that found that
> consumer two genuine stale-closure bugs — to avoid a line they could have deleted.
>
> Elimination answers "which one", and "which one" looks like a cause because it is specific and
> was arrived at by measurement. It is worth one more step: **change the suspect component's
> configuration before concluding the component is at fault.** The peer-range warning reinforced the
> wrong reading here, because a declared `^9.7` cap makes "incompatible with 10" the obvious story
> — but a peer range is an author's claim, not a test result.

**`.npmrc` has no Prettier parser — but whether that breaks `format:check` depends on how your
script targets files, not on `.npmrc` being present.** The advice previously given here — add it to
`.prettierignore` — is a no-op for most repositories and insufficient for the rest. Measured on
Prettier 3.9.6:

| Invocation                | Result                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| `prettier --check .`      | **passes** — `.npmrc` is silently skipped                        |
| `prettier --check .npmrc` | fails — `No parser could be inferred`                            |
| `prettier --check "**/*"` | fails on **every** unparseable file, `.npmrc` and binaries alike |

Prettier skips files whose parser it cannot infer when the target is a **directory**, and errors
only when a file is named explicitly or matched by an explicit glob. So:

- If your script is `prettier --check .`, there is nothing to do. Adding `.npmrc` to
  `.prettierignore` is an inert entry guarding a failure the repository cannot have.
- If your script is `prettier --check "**/*"`, you were **already failing** on binary assets —
  PNGs, `.wasm` — before `.npmrc` existed. Adding one entry does not fix that. Use
  **`--ignore-unknown`**, or target the directory.

> **`--ignore-unknown` is the general fix; `.prettierignore` handles only the file that already
> bit you.** A second consumer made this point after reproducing the glob-vs-directory split
> independently, and it is right. Measured on 3.9.6 against a fixture holding `.npmrc`, a PNG, and
> one badly-formatted Markdown file:
>
> | Invocation                               | Result                                               |
> | ---------------------------------------- | ---------------------------------------------------- |
> | `prettier --check "**"`                  | `No parser could be inferred` on the PNG, **exit 2** |
> | `prettier --check "**" --ignore-unknown` | skips both, still flags the Markdown, **exit 1**     |
>
> The exit code is the part worth noticing. Without the flag the run exits **2** — a tooling error,
> not a formatting verdict — so the real Markdown finding is reported alongside a failure that has
> nothing to do with code style. With the flag you get exit **1** and a genuine result. An ignore
> entry per offending file converges on the same place one bite at a time, and only for files that
> already exist; `--ignore-unknown` covers every future extensionless config for free.

**A green run is not a refutation of this warning.** If you were told this would hit you and it did
not, check the shape of your format script before concluding the warning was wrong — the
directory form silently saved you, and it will keep saving you right up until someone switches it
to a glob. That is also the one defensible reason to add the `.prettierignore` entry anyway: as
insurance against the script form changing, recorded as such, rather than as a fix for a failure
you had. One consumer did exactly that, with a comment saying so. That is fine. What is not fine is
a later reader inferring from the entry that the repository once had the bug.

> **The suggested fix creates the next instance of the failure it fixes.** Verified: adding a
> `.prettierignore` containing `.npmrc` under a `**/*` glob removes the `.npmrc` error and
> immediately produces `No parser could be inferred for file ".prettierignore"`, because
> `.prettierignore` is itself extensionless and now matched by the glob. The error count does not
> even drop. A fix that reproduces its own bug is a strong signal the diagnosis sat at the wrong
> level, which it did: the fault is the glob, not any file it happens to name.

This correction came from a consumer who **could not reproduce** the problem, ran all three
invocations rather than reporting a null result, and declined to add the ignore entry on the
grounds that it would be an inert line guarding an impossible failure. That is the right call for
the right reason. A consumer who had simply applied the advice would have shipped the inert entry
and confirmed nothing.

**The same reasoning applies to sequencing, not just to whether a line belongs.** Another
consumer declined to pre-stage `registry-url` and `registry-scope` in CI ahead of the dependency
that would use them. The config would have been harmless and the run would have been green — and
that was the objection: a green run over a scope nothing resolves from **looks like validation of
the registry wiring while exercising none of it**. Staged with the dependency instead, the same
green tick carries evidence.

Generalised, because this migration has now produced the failure twice — once as gates passing
against a `link:`ed local checkout while the manifest claimed a published range:

> **Do not land configuration ahead of the thing that exercises it.** A passing check over inert
> config is indistinguishable from a passing check over working config, and the two get read the
> same way later. The cost of waiting is one PR; the cost of the false green is that nobody
> re-tests the wiring, because the tick is already there.

Pre-staging for fleet consistency is a legitimate reason to override this — just record in the PR
that the config is inert until the dependency lands, so the green run is not mistaken for proof.

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
AGENTS.md
.github/copilot-instructions.md
.studio-sync.lock.json
```

**The single files at the bottom of that list are the sharper trap, and they were missing from it
until a consumer said so.** A synced _directory_ is obvious once you have had the thought about
syncing at all — the whole path is foreign. A synced _file_ sitting among authored ones looks
exactly like a file you own, and `AGENTS.md` is both the most likely of them to be hand-edited
and the one whose managed region is easiest to reformat by accident. Directory exclusions are
discoverable by inspection; file exclusions are not.

The mitigation that consumer applies is worth copying: **comment each entry with who owns it**,
so the next person to tidy the ignore file can see that removing a line has an owner on the other
end rather than looking like dead weight.

If you hold signed manifests, lockfiles with recorded integrity, golden or snapshot fixtures, or
vendored third-party sources, apply the same reasoning before your first format pass — the first
run is where the damage lands, and a reflowed snapshot fixture fails as a false test failure a
long way from its cause.

**But do not exclude a fixture merely for being one — read how it is compared first.** The hazard
is not that golden fixtures exist, it is that they are **compared as bytes**. A fixture that is
parsed before it is asserted on — `JSON.parse`, `json.decodeFromString`, then a comparison on the
resulting object — is immune to reformatting by construction, and excluding it buys nothing.

This matters because the exclusion is not free and not temporary: every path you add is a file
Prettier stops checking forever. Told only to "check for fixtures," a repository audits six golden
files, finds all six deserialise before comparing, and still adds six permanent holes to fix a
problem it did not have.

So the rule is: **find the fixtures, read their consumers, and exclude only the byte-compared
ones.** `toMatchSnapshot`, `toMatchFileSnapshot`, `.snap` files, and any assertion against a raw
`readFile` result are byte comparisons. A `parse`-then-`assertEquals` is not.

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

#### The same trap fires again on every rebase

A large format pass conflicts with every concurrent branch, so expect to rebase repeatedly — one
repository rebased five times. Resolving those conflicts by taking upstream's side is the obvious
move and it **silently reintroduces the defect**: the upstream hunk carries pre-format text, so a
source-shape guard goes back to matching against quotes and wrapping that no longer exist.

Two guards in that repository re-broke exactly this way after being fixed once, asserting against
the literal text of a config file and a Markdown doc. They failed loudly only because the earlier
non-zero anchors were already in place. Without those, they would have rejoined the silent set.

Fix it at the read, not at the assertion — normalise quotes and collapse whitespace as the file is
loaded, so the guard is insensitive to formatting by construction rather than by being re-patched
after each rebase:

```js
const source = readFileSync(target, 'utf8').replace(/["']/g, "'").replace(/\s+/g, ' ');
const matches = source.match(pattern) ?? [];
assert.ok(matches.length > 0, 'guard matched nothing — it is no longer inspecting anything');
```

**The clearest evidence for the anchors is a single repository running both ways at once.** One
adoption produced both outcomes from the same root cause in the same rebase. Fifteen tests across
eight files broke on `singleQuote` and failed **loudly**, because the non-zero anchors had already
been added — one of them `creator-escalation.test.ts`, a security guard confining co-creator write
authority. In the same repository, `i18n-rich-tags.mjs` went from 22 matched call sites to **0 and
still exited 0**, because it had no anchor.

Same defect, same commit, opposite outcomes, and the only variable was whether the guard asserted
it had found anything. A security guard silently inspecting an empty set is indistinguishable from
a security guard passing — that is the whole cost of the missing line.

So the pre-adoption sweep is not optional and is worth stating as a step rather than a caution:
**grep for `readFileSync` in your tests and scripts before trusting a green suite.** A guard that
reads source and counts matches passes vacuously the moment its pattern stops matching, and a
formatting change is exactly what stops it.

Merge the format pass quickly or freeze the branch. Its cost grows with every day it stays open.

### The preset lints more files than yours did

A rule-by-rule diff of the old config against this one cannot see this, and it is easy to
under-report as a result: the shared presets apply to paths many local configs never covered —
`scripts/**/*.mjs` most commonly. One repository's first run surfaced a genuine `no-regex-spaces`
violation in a script that had never been linted at all.

So when comparing before and after, compare the **set of files linted**, not just the set of rules
enabled. Widened coverage is a real gain that a rules diff scores as zero:

```bash
npx eslint --debug . 2>&1 | grep -c 'Linting '
```

### Do not bulk-remove `svelte-ignore` comments

`svelte/no-unused-svelte-ignore` is one of the few new violations that looks purely mechanical and
is not. One repository had four `state_referenced_locally` ignores in a single file; the rule
flagged exactly **one** as unused. Removing the other three — the obvious next step once you
believe the category is noise — produced `svelte/valid-compile` errors, because they were
load-bearing.

Delete only what the rule actually names, one at a time, and re-run. The rule is precise; the
generalisation from its output is what goes wrong.

### A clean `rules-of-hooks` run is not proof of absence

`react-hooks/rules-of-hooks` detects a hook call it can see in a statement position. It does not
see one nested inside a returned object literal. A repository with seven `try`/`catch` hook
wrappers in a single file had **two** flagged, because the rule catches

```js
const { value } = useThing();
```

and misses

```js
return { value: useThing().value };
```

Both are conditional hook calls; only the first is reported. The two that did flag were genuine
bugs, so the rule earned its place — but treat a zero count as "no violations of the shape this
rule recognises", not as "no conditional hooks". If you are auditing a codebase for hook
correctness rather than just gating new code, read the wrappers by hand.

This generalises past this one rule. A lint gate reports the violations its rules are written to
find, and adopting a stricter preset changes which shapes are visible, not whether the underlying
defect exists. Reported by a consumer whose audit found the two the rule missed.

### Landing the first format pass

Markdown formatting uses `proseWrap: 'preserve'`, so adopting this config **does not reflow your
prose**. Paragraph line breaks are left exactly as authored.

**It does not follow that there is nothing to reformat.** `preserve` cancels the _rewrap_, not
the _reformat_ — and the difference is the whole first commit. Expect `prettier --check` on
Markdown to fail after adopting, and expect a real diff. A repository told "nothing to reformat"
that then sees `format:check` go red will reasonably suspect its wiring, when what it is looking
at is tables and code fences.

Measured on a repository that had staged the reflow under `always` and re-ran it under
`preserve`, against a clean tree to rule out residue from its own commit:

| Regime              | Lines changed |
| ------------------- | ------------- |
| `always`            | 1,126         |
| `preserve`          | **575**       |
| of which prose flow | **0**         |

The surviving 575 fell into three categories, none of them prose:

- **Table padding** (~354). The `.md` override narrows `printWidth` to 96, and Prettier still
  pads pipe tables into aligned columns.
- **Embedded code in fences** (~170). Prettier formats fenced code inside Markdown, so
  `singleQuote: true` rewrites quotes in a fenced YAML or JSON block. A docs-heavy repository
  that documents configuration in fences sees this most.
- **Emphasis normalisation** (48). `*works*` becomes `_works_`.

Reproduced here from scratch on a 16-line file: all three fire, and the line count is byte-identical
before and after. That last part is the check to run — if every file's line count is unchanged, no
authored break moved, and the diff really is confined to the categories above.

The practical consequence is the opposite of the rewrap's. The residual diff is mechanical,
low-risk, and worth landing in one commit; the rewrap was neither. **Same command, opposite
advice** — which is why the two need separating before anyone runs it.

> **Count files and count lines separately — `proseWrap` moves one and not the other.** A
> repository re-ran its whole tree twice, holding `.prettierignore` constant and changing only
> `proseWrap`:
>
> | Config                  | Files failing | Of which Markdown |
> | ----------------------- | ------------- | ----------------- |
> | `proseWrap: 'always'`   | 60            | 5                 |
> | `proseWrap: 'preserve'` | **60**        | **5**             |
>
> Identical. `proseWrap` changed the file count by **zero**, while changing the line count by 551.
> It cancels churn _within_ failing files; it does not stop any file failing. So a repository that
> measures adoption by "how many files does `--check` list" will see no movement at all, and may
> conclude its configuration never took effect. The measurement that shows the effect is lines,
> not files.
>
> **The same run isolated a confound worth copying.** That repository's file count had genuinely
> dropped, 104 → 60, and it would have been natural to credit `proseWrap`, since a drop was
> predicted. The entire drop came from its `.prettierignore` — a different change, shipped in the
> same pass. Holding one variable fixed and re-running is what separated them.
>
> This is the trap in predictions generally: **a confirming measurement does not identify the
> cause.** Two changes landed together, an effect was predicted, the effect appeared, and it
> belonged wholly to the other change. Every downstream repository would have inherited the wrong
> mechanism — and repositories with no `.prettierignore` would have seen no drop and reasonably
> suspected their own wiring. When you ship two changes at once and one of them has a predicted
> effect, vary them independently before reporting the effect as evidence.

> **"Does not reflow your prose" is true at the moment you switch, and progressively less true
> afterwards. Expect a mixed corpus, and do not "fix" it.** `preserve` does not merely permit
> semantic breaks; it stops enforcing `printWidth` on prose entirely. A repository arriving from
> `proseWrap: 'always'` therefore keeps its hard-wrapped files, but those files stop being
> maintained at that width the moment anyone edits them. Measured, inserting one word into a
> wrapped paragraph:
>
> | Config             | Resulting line                  |
> | ------------------ | ------------------------------- |
> | `always` (before)  | re-wrapped to 94 chars          |
> | `preserve` (after) | **191 chars, left as authored** |
>
> **And no gate reports it.** A 191-character prose line passes `prettier --check` under
> `preserve` with exit 0, because `preserve` treats any authored shape as correct. That is the
> intended trade — you cannot have semantic breaks and enforced wrapping at the same time — but it
> means the honest end state for an already-wrapped repository is a **mixed corpus**: old files
> hard-wrapped and slowly fraying, new prose semantic.
>
> The trap is what happens next. Someone notices the ragged over-width lines, sees that they
> genuinely exceed `printWidth`, and reflows the corpus to fix it — producing exactly the large
> mechanical markdown commit that choosing `preserve` was meant to avoid, and destroying any
> semantic breaks written since. **Ragged old files are the expected steady state. Leave them.**
> Reformat a file's prose only when you are already editing it for other reasons.
>
> Raised by the repository whose `.prettierrc.json` was the original source of
> `proseWrap: 'always'` — so this is the consequence of its own setting being reversed, reported
> against itself.

> **Citations are unbreakable by construction, and over-width lines containing one are correct.**
> A markdown link destination cannot be wrapped — there is no legal break point inside it — so a
> pinned citation is a single atomic token:
>
> ```md
> [`ENG-SEC-001`](https://github.com/jrmoulckers/engineering/blob/v0.2.3/principles/assurance/security-and-privacy.md#secret-lifecycle)
> ```
>
> Measured at `printWidth: 96`, `proseWrap: 'always'` handles that sentence by splitting it into
> three lines — and the citation line is still **134 characters**. So the reflow destroys the
> surrounding sentence structure _and_ fails to achieve the width it reflowed for. It is
> destructive and ineffective in the same operation, which is the strongest single argument
> against `'always'` in this repository's own documentation style.
>
> Two rules follow. **Over-width is expected and acceptable on any line containing a link
> destination or a table row**, and no gate should be configured to flag it. And **do not "fix" it
> by shortening the URL**: the pinned tag in a citation path is load-bearing, and trading it for a
> branch path or a bare anchor buys width by making the link mutable.
>
> Worth planning for rather than discovering: **the adoption programme is itself increasing the
> population of these lines.** Every repository that lands citations acquires lines that wrap
> badly by nature, and this is the second distinct piece of tooling to meet them at the line level
> — the first was a `--review` bare-URL defect with the same root cause.

### Write prose in semantic line breaks

Since the formatter no longer decides where lines end, the convention does. Break lines at
sentence or clause boundaries; one sentence per line is the simplest form.

```md
The sync layer reconciles local mutations against the remote authority.
It uses a last-writer-wins strategy scoped per field rather than per record.
```

This is not a style preference. It is measurably better on the things that matter for review,
and `preserve` exists to permit it. Every cell below is a real `git merge` result, with each
edit re-formatted under the regime named in its row:

| Shape                   | One-word edit   | Two edits, distant sentences | Two edits, adjacent lines | Bounded line length |
| ----------------------- | --------------- | ---------------------------- | ------------------------- | ------------------- |
| Hard-wrapped (`always`) | whole paragraph | **conflicts**                | **conflicts**             | yes                 |
| One long line           | 1 line          | **conflicts**                | **conflicts**             | no                  |
| Semantic breaks         | 1 line          | clean                        | **conflicts**             | yes                 |

Hard wrapping rewraps every following line in the paragraph, so a one-word change arrives as a
multi-line diff and the real edit has to be hunted for. A single unbroken line avoids that but
collides on any concurrent edit, since every change touches the same line. Semantic breaks avoid
both — and `proseWrap: 'always'` destroys them on write, which is why it is not the default.

**Read the last column before using this table in an argument.** Adjacent edits conflict under
every regime, because git needs an unchanged context line between two changes and no wrapping
policy can supply one. Wrapping cannot fix that case and should not be claimed to.

**And be careful how you measure the middle column, because it inverts.** A consumer measured
this by editing _lines_ directly and concluded that conflict behaviour is governed by line
granularity alone — that `always` and semantic breaks are indistinguishable, so the axis should
not be cited in either direction. Measured that way the result is real and reproduces here. But
holding the _line_ edit constant switches off reflow, which is the single behaviour that defines
`always`. Hold the **prose** edit constant instead — one word added to the first sentence, one to
the last — and the two regimes separate cleanly: `always` rewrote all 3 lines of the paragraph
and **conflicted**, while semantic breaks touched 1 line and **merged clean**. Same edits, same
Prettier invocation, opposite answer.

That is the fourth-instance heuristic firing again, and this time on a _measurement of a
measurement_: the consumer correctly retracted a wrong conflict claim, then verified the
replacement with a test that held the deciding variable fixed. Both the original claim and its
correction were argued from a test that could not have shown the difference. If a setting's
whole function is to transform the artifact, an experiment that edits the artifact's
post-transform shape has quietly removed the setting from the experiment.

**The `~5 lines` figure is measured, and it is deliberately not larger.** The consumer who supplied
it had earlier argued that `'always'` makes a one-word change produce an unbounded multi-line diff,
then retracted their own claim after measuring it properly — inserting three words mid-paragraph and
diffing wrapped-baseline against wrapped-after-edit, rather than against the unwrapped original,
which was the confound in their first attempt. Reflow is bounded by **paragraph** length, not file
length: 5 changed lines versus 1 for `preserve`.

That is a ~5× ongoing review cost, not a catastrophic one, and the weaker number is the honest one.
It is worth stating plainly because the argument against `'always'` does not need the exaggeration
and is damaged by it — the one-time cost carries the case on its own, and a reader who checks the
inflated version and finds it false has reason to discount the rest.

> **The one-time reflow is not actually the expensive part.** A single mechanical commit is
> absorbed once and forgotten. The cost that matters is that `'always'` destroys semantic line
> breaks **silently and repeatedly**: every subsequent `format:write` re-flattens breaks the author
> just made, with no diagnostic and no failing check. The author reasonably concludes their editor
> did it. A one-time cost gets paid; a recurring invisible one teaches people to stop using the
> shape at all, which is the actual loss. This is why the value of catching it early is not
> measured in the files a reflow would have touched.

> **Independently reached, from the largest corpus of the seven.** A consumer measured `'always'`
> against 590 markdown files and rejected it, arriving at the same mechanism from the other end:
> the reflow makes a one-word edit a multi-line diff, so `'always'` "costs a mass reflow and buys a
> worse diff than doing nothing". They ranked `'never'` above `'always'` for review, which is
> correct as far as it goes — the row this table adds is that **semantic breaks beat both**, and
> `'preserve'` is what permits them. `'never'` gives one line per paragraph and therefore inherits
> the concurrent-edit collision in row two.
>
> Their sharpest point is about the shape of the answer rather than the value: **do not make it
> optional.** An inconsistent default is its own tax — every repository re-litigates it, and a
> shared config that declines to decide has moved the cost rather than removed it. `'preserve'` is
> also the only value that is safe to impose retroactively, because it is the one that changes
> nothing already written.

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

Type declarations ship with the package from `0.8.0`, so option names and types are checked even
in a plain `eslint.config.js` if you lint it under `checkJs`. Do not hand-write ambient
declarations. `extend` is deliberately typed `unknown[]`: config objects originating from a
different copy of `@types/eslint` than yours are not mutually assignable, so a narrower type would
reject correct configs.

#### Diff the _resolved_ rule set per file class, not the config source

A consumer with no previous ESLint config had no before/after to compare, and said so rather than
manufacturing one. They applied `eslint --print-config` to a representative file of each class —
normal TypeScript, a scoped-exception file, a test, a config file, a normal component, an exception
component — and diffed the **active** rules (severity `off`/`0` filtered, options serialized so an
option-only change shows up). That is the strongest verification method any consumer has used here,
and it found a real preset defect that reading the source would not.

**`.svelte` and `.ts` resolved to materially different rule sets, in both directions.** The cause is
one line of scoping: `typescript-eslint`'s `eslint-recommended` layer declares
`files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']`, so it never reached `.svelte`. Because
that single layer both **disables** the core rules the compiler already enforces and **enables**
four others, its absence moved 18 rules on and 4 off at once:

- **18 active in `.svelte`, off in `.ts`** — the whole `eslint-recommended` disable set, including
  `no-undef`, `no-redeclare`, `no-const-assign` and `getter-return`.
- **5 active in `.ts`, off in `.svelte`** — `prefer-const`, `no-var`, `prefer-spread`,
  `prefer-rest-params`, `no-self-assign`.

**`no-undef` is the one that draws blood**, because it cannot see ambient or namespaced types.
Verified on a fixture: `NodeJS.Timeout` and SvelteKit's own `App.User` were both reported
`is not defined` inside `<script lang="ts">`, while byte-identical code in a `.ts` file reported
nothing. That is unfixable in the source — the identifiers are correct — so every SvelteKit
repository would hit it on the first component referencing `App.*`.

Fixed in `@jrmoulckers/eslint-config` **0.11.0** by applying the same layer to `**/*.svelte`. The
resolved sets now differ by exactly one rule, `no-self-assign`, which the Svelte plugin turns off
deliberately because `x = x` is the invalidation idiom. Three smoke tests lint real components to
hold it, and reverting the fix fails one of them.

> **The consumer's reading of the second list was wrong, and the correction matters.** They took the
> 5 rules off in `.svelte` as deliberate Svelte 5 accommodations — plausible, since `prefer-const`
> genuinely does conflict with `$state` reassignment. Only `no-self-assign` is actually the plugin's
> decision. The other four are off for the same reason the 18 are on: nothing scoped them to
> `.svelte` either. **One cause, two opposite-looking symptoms** — which is why a diff that shows
> both directions is worth more than one that shows only the alarming half. Had the fix been
> designed around the stated explanation, it would have addressed a rationale that did not exist.
>
> The trade the fix accepts, stated plainly: a `.svelte` file with a plain `<script>` gives up
> `no-undef` too. Svelte projects type-check components with `svelte-check`, so the
> compiler-already-checks-this rationale holds for the file type, and a false positive with no
> source-level fix is worse than a missed one another tool reports.

**A latent finding is still a finding.** `no-undef` was not firing on the reporting repository —
their components happened to reference no ambient type, and their lint was green. They reported it
anyway, as a sharp edge rather than a break. Nothing in the shared repository's own CI would have
caught it either. **Report what the diff shows, not what currently fails.**

**Use the same method on your own exceptions.** That consumer's other result was a negative one and
just as useful: their single scoped exception differed from the unscoped case by **exactly one
rule**, with zero rules added and zero options changed, so the narrow claim in its comment was true.
An exception block is the easiest place for scope to leak silently, and this measures it.

### Prettier — `prettier.config.js`

```js
export { default } from '@jrmoulckers/prettier-config/svelte'; // or '@jrmoulckers/prettier-config'
```

#### `.gitattributes` — required on Windows

The shared config sets `endOfLine: 'lf'`. Commit a `.gitattributes` alongside it:

```
* text=auto eol=lf

# Windows shells are the one place LF is not automatically safe.
*.bat text eol=crlf
*.cmd text eol=crlf
```

Without the first line, a Windows checkout under `core.autocrlf=true` gets CRLF in the working
tree while the index stays LF. `format:check` then **passes in CI and fails on every Windows
machine**, which reads as a broken developer setup rather than a missing file. Adding it may
reformat many files in the working tree while producing a zero-byte commit diff — that is the fix
working, not a mass rewrite.

The `*.bat` / `*.cmd` carve-out is precautionary, and it is worth being precise about why, because
the usual justification is stronger than the evidence. The claim is that `cmd.exe` misparses
LF-only batch files. Tested on Windows 11 (10.0.26100) across the shapes normally cited —
a `for` loop block, an `if`/`else` block, a forward `goto`, and `call :label` where the label is
the final line with no trailing newline — **all four ran correctly with LF endings**. So this is
not a bug you are likely to hit on a current machine.

Keep the carve-out anyway: it costs nothing, it matches the convention most `.gitattributes`
templates ship, and `cmd.exe` reads batch files by byte offset, so the tolerance is a property of
the current implementation rather than a guarantee. Just do not repeat the "it breaks parsing"
rationale as established fact — a repository that adopts a rule on a reason it never checked
cannot tell later whether the rule is still needed.

Everything else stays LF, including `.sh` and `.ps1`. Shell scripts genuinely do fail with CRLF —
that failure is real and reproducible, and `eol=lf` is what prevents it.

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
| `node.json`       | TypeScript executed directly by Node                 |

**`node.json` is the one to reach for when Node runs your `.ts` files itself** — a server started
with `node --experimental-strip-types`, or Node 24 running TypeScript natively. Node's resolver
does not remap `./x.ts` to `./x.js`, so the specifier Node requires is the one tsc rejects by
default. This variant adds `allowImportingTsExtensions` so both agree.

It is a separate variant rather than part of `base.json` on purpose. The flag is **not** inert:
TypeScript accepts it only alongside `noEmit` or `emitDeclarationOnly`, so putting it in the base
turns a working build into a hard failure for every package that emits.

```
TS5096: Option 'allowImportingTsExtensions' can only be used when
        either 'noEmit' or 'emitDeclarationOnly' is set.
```

If you need `.ts` specifiers **and** emit, add `rewriteRelativeImportExtensions: true` locally —
it rewrites `./a.ts` to `./a.js` on the way out. It is not shipped in the variant because it
arrived in TypeScript 5.7, and 5.5 and 5.6 reject an unknown compiler option outright rather than
ignoring it (`TS5023`), which would break consumers still inside the declared peer range. Setting
it locally means you also own the TypeScript floor it implies.

`node.json` and `vite-node.json` both set `types: ["node"]`, so install `@types/node` alongside
them. Without it the first run fails with `TS2688: Cannot find type definition file for 'node'`,
which reads like a broken preset rather than a missing dev dependency.

#### Replacing an existing root `tsconfig.base.json`

If your repository already has a root TypeScript config, two things decide the migration, and
they are documented in different sections — so read both before opening the PR.

1. **`tsconfig` is a registry package and does need a token** (§1). An earlier revision of this
   list said the opposite — that replacing a local base added no registry dependency and was never
   blocked on package access. That was wrong, and a consumer's CI proved it with `403
permission_denied: read_package` on `@jrmoulckers/tsconfig/0.2.0`. If you are waiting on the
   visibility grant, this migration waits with it.
2. **Pick the variant per package, not per repository.** A repository whose server runs `.ts`
   directly and whose web app emits needs `node.json` for the former and `base.json` for the
   latter. That is the normal shape, not a workaround.

**Do not add a flag to cancel a flag.** When a setting you dislike arrives by inheritance from the
config you are replacing, the fix is the replacement, not a neutralizing override. A consumer asked
whether to set `sourceMap: false` to counter a `true` inherited from a third-party base, and
answered it correctly themselves: the line disappears when `extends` moves to the preset, so adding
an override today means deleting it again later, and in the meantime the file states an opinion the
repository does not hold. Where the inherited setting is already inert — theirs was, because the
package sets `noEmit` on its own line — there is nothing to fix at all. **Confirm the flag is
actually doing something before you act on it**; provenance makes a setting look load-bearing
(a third-party base that sets it deliberately, with a rationale) when only measurement can say
whether it is.

> **The justification comment is more durable than the setting.** A second consumer had not merely
> inherited `sourceMap` — they had explicitly ported it into a new config with a comment restating
> the upstream rationale, written by copying that rationale rather than testing it. Their own
> assessment is the one to keep: an inherited default is invisible and gets re-derived whenever the
> base changes, but **a hand-written line with a justification reads as deliberate and already
> verified**, so the next reader preserves it out of respect for reasoning nobody ever checked.
> When you port a setting out of a base you are replacing, port the measurement too, or drop the
> comment and leave the setting bare.
>
> They also named the general class, and it is the most useful thing to come out of this:
> **wrong-but-inert statements survive precisely because nothing contradicts them.** There is no
> failing test to motivate removal and no symptom to trace, so the only pressure on them is someone
> deciding to check. Four instances so far, in four different artifact types — a config flag with
> a false rationale, a false claim that a principle area did not apply, a summary line naming a
> version many releases stale, and a measurement defending a setting by comparing it against
> itself rather than against what it prevents. The argument for removing any of them is not that
> they break something; it is that a false statement nothing refutes is a standing invitation to
> preserve it. Treat "this is harmless" as a reason to check it sooner, not later.
>
> **The review heuristic that falls out of all four: when a config value carries a rationale
> comment, the test is not "does it do what it says" but "what breaks if I remove it."** Every one
> of these failures is consistent with the artifact it describes — the flag really does set what
> the comment claims, the version string really is a version, the measurement really did run. The
> artifact never contradicts you, because it is not the thing in question. Only an experiment
> designed around what the setting _prevents_ can. Contributed by a consumer who applied it to
> their own ported comment first.

**Diff the old base against the preset before deleting it, option by option**, and treat any
option the preset lacks as a finding rather than an oversight. The presets are deliberately not
supersets. A concrete case: a repository fixing a Node 24 `ERR_MODULE_NOT_FOUND` had added
`allowImportingTsExtensions` to its own base; `base.json` does not set it, so a straight
replacement would have reintroduced the bug the option was added to fix. The answer was
`node.json` for that package — not hoisting the option into the base, which breaks every
emitting consumer with `TS5096` as shown above.

State the delta in the PR description. "Adopted the shared base" hides a regression; "adopted
the shared base; server moves to `node.json` to keep `.ts` specifiers working" does not.

**And keep each verification inside the tool it was run with.** A consumer who proved their ESLint
migration lost **zero rules** — a real, careful, rule-by-rule resolved-config diff — flagged that
the same number was at risk of being quoted as though it covered their toolchain. It does not. A
rule-level diff says nothing about `tsconfig`, and that repository's own `allowImportingTsExtensions`
gap is the counter-example: ESLint lossless, TypeScript config not. A clean typecheck under the new
flags is likewise a statement about the _code_, not about whether the config is a superset.

Three separate claims, three separate proofs: rules preserved, options preserved, code still
compiles. Report them separately or the strongest one silently vouches for the other two.

**On TypeScript 6, `baseUrl` stops the compiler before it checks anything — and the run looks
clean.** This is the single most dangerous interaction with these presets, because it produces a
success-shaped result rather than a failure. TS 6 promoted `baseUrl` from a deprecation warning to
a hard error, and a config error aborts the run before any file is loaded:

```
tsconfig.json(2,24): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in
TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

Measured on TypeScript 6.0.3 against a file containing two blatant errors — a `string` assigned to
`number`, and an unguarded index read. **Neither was reported.** Total output: one line, about the
config. A consumer keeping the ordinary path-alias shape (`baseUrl` plus `paths`) therefore sees
**one error and zero type diagnostics**, which reads as "essentially clean under the shared base"
when in fact nothing was type-checked at all.

**Do not take the compiler's own advice here.** `ignoreDeprecations: "6.0"` silences it on TS 6,
but on TypeScript 5.5 the same line fails with `error TS5103: Invalid value for
'--ignoreDeprecations'` — verified — which aborts the run in exactly the same way. Since these
presets support `^5.5 || ^6 || ^7`, putting it in a shared base would trade a false clean on one
half of the supported range for a false clean on the other. It is safe only in a consumer pinned
to TS 6, and even then it defers work rather than doing it.

**The fix is to drop `baseUrl` and make `paths` tsconfig-relative**, which is what TS 6 wants and
what removes the deprecation instead of hiding it:

```jsonc
// before — aborts the run on TS 6
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }

// after — checks files on 5.5, 6 and 7 alike
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

Both forms were verified to check files and report the two planted errors on 6.0.3.

> **Whenever a type-check comes back clean or near-clean after a config change, prove it ran.**
> Plant an obvious error — `const x: number = "s"` — and confirm it is reported. A count that
> collapses to zero or one is far more often a config abort than a healthy codebase, and every
> other signal here (exit code, output shape, brevity) looks the same in both cases. This is the
> same family as an empty token that 401s and a truncated lint config that lints nothing: the
> mechanism reports success-shaped output while doing no work.

**`types` replaces, it does not merge.** `vite-app.json` sets `types: ["vite/client"]`, and TypeScript
does not concatenate `types` across `extends` — a consumer inheriting it loses `node`,
`vitest/globals`, `@testing-library/jest-dom` and anything else it relied on. Restate the full list,
including `vite/client`:

```jsonc
{ "compilerOptions": { "types": ["vite/client", "node", "vitest/globals"] } }
```

Unlike the `baseUrl` case this one fails loudly — `TS2591: Cannot find name 'process'`, naming the
fix — so it costs a confusing few minutes rather than a wrong conclusion.

**`allowImportingTsExtensions` is deliberately absent from `base.json`, and cannot be added there.**
A consumer whose previous config set it asked for it in the base, correctly noting that the shared
base is therefore **not a superset** of what it replaces. It is not an oversight. The option is only
legal when `noEmit` or `emitDeclarationOnly` is set, so putting it in a base that every preset
inherits hard-breaks any consumer that emits. Measured on TypeScript 5.9.3, base with the flag and a
consumer setting `noEmit: false`:

```
tsconfig.json(1,26): error TS5096: Option 'allowImportingTsExtensions' can only be used
when either 'noEmit' or 'emitDeclarationOnly' is set.
```

This is the `ignoreDeprecations` shape again: a fix in the shared base that repairs one half of the
supported range by breaking the other. Set it in your own `tsconfig.json`, next to the `noEmit` that
makes it legal. It fails loudly and names the fix, so it is the cheap class of error.

The general point matters more than this flag. **The presets are a considered baseline, not a
superset of every config they replace**, and an adoption that reports "nothing lost" has usually
measured one tool. The consumer above was explicit that their own "0 lost" result covered ESLint
only and was being cited as the reference for six other repositories — say which tool your result
covers, because the next repository will read it as covering all of them.

`@tsconfig/svelte` sets it, explaining it is needed "to have warnings/errors of the Svelte
compiler at the correct position" — a rationale that predates Svelte 5. Measured on svelte-check
4.7.5 with svelte 5, diagnostic positions are identical with and without it, both for TS errors
inside `<script>` and for compiler warnings such as a11y and unused CSS. It could not have
worked regardless: `base.json` sets `noEmit`, so tsc writes no output and therefore no source
maps. Porting the flag would imply a behaviour it does not provide. Vite build sourcemaps are a
separate setting (`build.sourcemap` in `vite.config.ts`) and are unaffected.

**Independently reproduced on a second toolchain.** A consumer declined to take the result on
faith, correctly noting it came from a different repository on a different svelte-check patch. They
re-measured on svelte-check 4.7.4 / svelte 5.56.8 / TypeScript 6.0.3, with a probe designed to
expose mapping drift — a TS error in a `<script>` placed _below_ both markup and a `<style>` block:

| Diagnostic             | `sourceMap: true` | `sourceMap: false` |
| ---------------------- | ----------------- | ------------------ |
| TS error in `<script>` | `14:9`            | `14:9`             |
| a11y missing alt       | `2:1`             | `2:1`              |
| unused CSS selector    | `8:3`             | `8:3`              |

Byte-identical. Two toolchains, one mechanism explaining why it could not be otherwise. This is the
standard to hold shared-repository measurements to: **re-measure on your own versions rather than
adopting a number, especially when the conclusion is "delete this."**

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
# Pin to a release tag. <latest-tag> is a placeholder, not a version — it will
# not resolve, which is the point: a literal version copied out of a document is
# stale one release later, and can be actively wrong. Resolve the newest:
#
#   gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name
#
# Without gh, sort by version — the tags API does not order by version, and
# sorting lexically puts v0.9.0 above v0.11.0:
#
#   git ls-remote --tags --refs https://github.com/jrmoulckers/engineering.git \
#     | sed 's:.*refs/tags/::' | grep '^v' | sort -V | tail -1
#
ENGINEERING_REF=<latest-tag>

tmp=$(mktemp)
curl -fsSL --retry 3 \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${ENGINEERING_REF}/configs/golangci.yml" \
  -o "$tmp"

# Validate before publishing to the destination.
[ -s "$tmp" ] || { echo "empty config fetched" >&2; exit 1; }
grep -q '^version:' "$tmp" || { echo "not a golangci config" >&2; exit 1; }
grep -q '^linters:' "$tmp" || { echo "not a golangci config" >&2; exit 1; }

mv "$tmp" .golangci.yml
```

The ref above is a placeholder that will visibly fail rather than a version that quietly lags.
That is deliberate. A literal version written into a document does not merely go stale — it can
go _wrong_: `v0.2.3` shipped a `configs/golangci.yml` comment telling consumers to **copy** the
file, which a later release reversed to "fetch at a pinned tag". A consumer who
copied the literal out of this guide would have adopted the behaviour the guide exists to
prevent. A placeholder cannot do that, because it does not run.

**Resolve the newest tag, but never resolve it at fetch time.** Pinning must stay an edit in your
repository's history. If CI resolved `latest` on every run, a tag pushed here would change your
lint rules with no commit on your side, surfacing on whichever unrelated PR happened to be open —
and `git log` would no longer explain why a green PR went red. Make the pin easy to update and
loud when it is stale; never make it automatic.

Six details carry the weight here:

**Write it to the repository root.** This is required, not cosmetic. golangci-lint's default
`run.relative-path-mode: cfg` resolves reported paths relative to the config file's directory,
so a config held outside the repository produces diagnostics with paths like
`../../elsewhere/file.go`. Root placement also lets editor integrations discover the config without
configuration of their own.

**Invoke it as `golangci-lint run --config .golangci.yml ./...`, never bare.** Because the fetched
config is deliberately untracked, a contributor who runs the linter before running the fetch has no
`.golangci.yml` — and golangci-lint does not treat that as an error. It swallows the
`ConfigFileNotFoundError` and falls back to its **built-in defaults**, a strictly smaller set
(roughly `errcheck`, `govet`, `ineffassign`, `staticcheck`, `unused`) with none of the shared
settings. The run looks clean locally and goes red in CI, with nothing explaining the gap. Naming
the path makes the file read directly rather than searched for, so its absence fails loudly. Better
still, wire the fetch and the run into one `make lint` target so the config cannot be missing;
`--config` is the backstop for anyone bypassing it.

**The blessed `make lint` form.** Treat the fetch as a **prerequisite of linting**, not as a CI
step that happens to run first — that framing is what keeps a fresh clone or a `git clean` from
producing a silently weaker run:

```make
ENGINEERING_REF ?= <latest-tag>

.golangci.yml:
	@scripts/fetch-golangci.sh

.PHONY: lint
lint: .golangci.yml
	golangci-lint run --config .golangci.yml ./...

.PHONY: lint-refresh
lint-refresh:
	@rm -f .golangci.yml && $(MAKE) .golangci.yml
```

Expressing the config as a **file target** rather than a phony step is the part that matters: Make
creates it when absent and skips the network when present, so `make lint` is correct on a fresh
clone and cheap afterwards. Keep it gitignored, and use `lint-refresh` to move refs — editing
`ENGINEERING_REF` alone will not re-fetch an existing file.

**The defaults exclude the linters most worth having.** A consumer measured this on a real rebase:
running against built-in defaults reported clean, while the pinned config found **five** issues the
merge was silent about — three `unused` (dead on `main`, invisible to `go vet`), one `errcheck`,
and one `nilerr`. `nilerr` is **not** in the default set, so a contributor who skipped the fetch
would have shipped a `nilerr` violation believing they had linted.

**Pin to a tag, never `main`.** An unpinned fetch means an unrelated commit here can turn a
consumer's build red with no change on their side, which is the same failure mode `GH-ACT-003`
pins action SHAs to avoid.

**`-f` is not optional — or capture the status instead.** Without `-f`, `curl` writes the error
body to the output file and exits zero, so lint then runs against a config that is HTML. That
passes, which is worse than failing. Capturing the status explicitly is strictly better where you
control the script, because `-f` gives a non-zero exit but not the code, so a missing tag and an
outage are indistinguishable — and a missing tag is the failure people actually hit:

```bash
code="$(curl -sSL -w '%{http_code}' -o "$tmp" "$url")"
[ "$code" = 200 ] || { echo "$url returned HTTP $code; check ref '$ENGINEERING_REF' exists" >&2; exit 1; }
```

**Check the shape, not just the size.** `-f` catches a non-200 and `-s` catches a truncated
transfer, but neither catches a **200 carrying the wrong body** — a redirect landing somewhere
unexpected, or a proxy's error page served with a success status. Asserting the payload has
top-level `version:` and `linters:` keys is what separates "we received bytes" from "we received
a golangci config".

**Stage, validate, then move.** Fetching straight to `.golangci.yml` means a failed or partial
run leaves a corrupt file exactly where the linter will read it, and the next run lints against
it. Writing to a temporary file and moving only after every check passes makes a failed fetch
leave the previous state untouched.

Do not vendor the file into the repository. golangci-lint has no config inheritance — no
`extends`, no include, no remote config (`extends:` is rejected outright as an unknown property)
— so the file must arrive on disk one way or another, and a committed copy silently drifts from
the shared config. The drift is invisible precisely because nothing fails.

Add the fetched path to `.gitignore`. That is what makes the previous paragraph structural rather
than advisory: a file that cannot be committed cannot fork.

**Budget for the first run.** On a Go repository with no prior lint configuration, expect roughly
**20 findings per 30 files**, overwhelmingly mechanical — unchecked errors, `%w`/`%v` misuse, and
`staticcheck` simplifications. Fix them in the adopting change rather than suppressing them; a
`//nolint` added during adoption is a permanent exemption bought to save an afternoon.

## Non-npm configuration generally

The same reasoning applies to any config this repository publishes that has no package-manager
channel — Go today, shell or Python later. Fetch by tag from `raw.githubusercontent.com`, fail
loudly on a non-200, validate the payload's shape rather than only its size, write to a temporary
file and move it into place only after every check passes, and add the destination to
`.gitignore` so the fetched copy cannot be committed.

**Every pinned fetch needs a staleness notice, whatever the artifact.** A pin is a decision and
should stay one — resolving the newest ref at fetch time means a commit here reddens your build
with no change on your side. But a pin also has no expiry and no lockfile, so nothing tells you it
has aged. This has now cost four repositories real work, in four different mechanisms and always in
the same direction: they reported defects that had already been fixed, and in two cases did work to
satisfy rules that had already been withdrawn.

- A Go consumer pinned at `v0.2.3` rewrote ten call sites to satisfy `errcheck`'s `check-blank`,
  which a later release had already turned off as contradicting `practices/go.md`.
- Two consumers ran a citation checker fetched at `v0.2.11` and reported two features as missing
  that had shipped in the twenty-plus releases since.
- Four consumers read `packages/*/package.json` **at a repository tag** and reported peer ranges as
  too narrow that had already been widened. A repository tag is not a package version; `versions.json`
  is the CI-verified authority.
- One consumer audited a stale `origin/main` and re-reported a deviation they had themselves fixed.

The notice is four lines and belongs beside every fetch:

```bash
latest=$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)
[ "$latest" = "$ENGINEERING_REF" ] || echo "::notice::pinned $ENGINEERING_REF; newest is $latest"
```

`::notice::`, never a non-zero exit — a tag pushed here must not redden an unrelated PR, or pinning
stops being a decision and becomes a default someone bumps to get green.

**Compare against the newest release, not the next tag.** Adjacent tags are usually identical, so a
diff against `N+1` almost always shows nothing and is read as "my pin is current". That is precisely
the comparison that let the `check-blank` rewrite happen.

**Self-identify what you can.** `check-citations.mjs` prints its version and the checks it ran;
`configs/golangci.yml` carries a `config-revision` marker bumped whenever a rule's verdict changes.
Both exist so a fetched artifact can answer "what am I?" without a diff. Note the limit, though: a
copy old enough to predate the marker cannot report that the marker is missing, so **absence is
itself the signal** — if the artifact you fetched says nothing about its own version, assume it is
old.

## Citing principles

Replace prose that restates a rule with a citation to its ID. Three things make a citation wrong
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
REF="$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)"

curl -fsSL -o /tmp/check-citations.mjs \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/scripts/check-citations.mjs"

node /tmp/check-citations.mjs . --review \
  --index "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/principles/index.json"
```

**Re-resolve `REF` each time; do not sort tags yourself.** Resolve it from the releases API, as
above. A pinned ref you wrote down once is a snapshot, and this repository has shipped many
releases in a day. Lexical tag sorting is also wrong here — `v0.2.9` sorts _after_ `v0.2.11`, and
`v0.2.11` is a different and much older release than `v0.21.1`, which is one transposed character
away. A consumer pinned at `v0.2.11` spent two rounds reporting features as missing that had
shipped in the twenty releases since.

**If the run prints no version line at all, you are older than `v0.21.1`.** This is the one
staleness the version line cannot report, because a copy that predates it has nothing to print —
so the _absence_ is the signal. There is no version to compare, no list of checks, and no
indication that either is missing. Treat a silent summary as a stale copy and re-fetch before
concluding anything about your repository.

**That recipe is for a local pre-PR run, not for CI.** A consumer declined to wire it into their
workflow and was right to: `curl | node` from a tag, inside a job holding a token, is a
supply-chain seam, and a tag is mutable — it can be moved to point at different code after you
reviewed it. If you do want it in CI, pin `REF` to a **commit SHA** rather than a tag, so the
fetched bytes cannot change under you. Nothing here needs to run in CI to be useful; the check
exists to be run before you open the PR, when there is still a cheap moment to fix a citation.

**Confirm which checks actually ran — the script is fetched, not installed, so a stale copy is
invisible.** Every run now prints its own identity:

```
checker v7; checks run: IDs, stated names, link paths. Index: <url>
```

If that line is missing, or names fewer checks than you expected, you are running an old copy and
your clean result covers less than you think. A consumer reported link-path validation as a missing
feature after it had shipped several releases earlier, having fetched the script once and kept it —
their output could not tell them so, and neither could the exit code. Re-fetch at the latest tag
rather than reusing a downloaded copy, and treat `--no-links` as a claim you have to justify: it
announces itself as `(link paths SKIPPED via --no-links)` for exactly that reason.

This is the same failure family as the aborted type-check and the missing lint config: **a tool
reporting success while doing less than you assume.** The general defence is to make the tool state
what it did, rather than to remember what it should have done.

**Read the `--review` output; do not just check the exit code.** The exit code only catches an
ID that does not exist, and that is the rarer mistake. A real ID used for the wrong rule
exits 0. `--review` prints each principle's real title and its full statement, plus the
neighbouring lines, against every citation:

```
    171  ENG-PERF-009   Assurance precedence
         says: Reject performance changes that weaken correctness, accessibility,
               privacy, or security.
         keyboard control and correctly labelled transport controls.
      >  [`ENG-PERF-009`](…/assurance/performance.md)
         additionally forbids trading accessibility away for performance.
```

The neighbouring lines are the point. A wrapped markdown link leaves the citing line a bare URL,
so the claim being checked sits on the line above or below it. Judging that citation from the
URL line alone is not possible — and reading a summary of it instead of the file is how a
correct citation gets mistaken for a wrong one.

**The statement is printed because a three-word title pattern-matches too easily — but do not
treat it as automatically safer.** A statement can name a concern in passing, and a keyword match
then reads as confirmation. `ENG-PERF-009` "Assurance precedence" is the standing example: its
statement contains the literal word **accessibility**, so it will appear to confirm any citation
placed near an accessibility claim, whether or not it governs one.

So the question to ask is not "does this principle mention the topic" but **"does this principle
govern this claim?"** `ENG-PERF-009` governs _changes made for performance_. It correctly supports
"a performance change may not trade accessibility away" and does not support "this project
commits to WCAG 2.2 AA", which no ratified principle requires.

**The reviewer's false positive is a failure mode too, and it costs more than it looks.** All three
worked examples that previously appeared here were wrong. A repository was flagged for citing
`ENG-PERF-009` at an accessibility rule, `ENG-TEST-003` at test colocation, and `ENG-ARCH-003` at a
tier boundary. Reading the file settled it: every one was already scoped correctly in the prose —
"`ENG-PERF-009` **additionally** forbids trading accessibility away for performance", "**a libro
convention**; the obligation it serves is `ENG-TEST-003`", and an `ENG-ARCH-003` citation pointing
at the ADR that discharges it. The citations were exemplary. The flag was not.

Two things caused it, and both are worth avoiding:

- **Judging a citation from one line.** A wrapped markdown link leaves the citing line a bare URL,
  so the qualifying clause sits on the next line. The selection effect is perverse: a long URL is
  the single most likely thing to get a line of its own, so line-oriented review is least reliable
  exactly where citations are most carefully written. `--review` prints a context window for this
  reason — but the reviewer who reported this had been shown a summary, not the file.
- **Generalizing from an unverified flag.** The false conviction was then written into this guide
  as an observed pattern and broadcast to other repositories, one of which spent a full audit
  looking for a defect that never existed. A wrong finding propagates exactly like a right one.

**None of that is an argument for not challenging.** The repository that was wrongly convicted made
the point better than I can: the retraction is what surfaced the `--review` context hole, and the
grep they ran to answer the challenge found a real version inconsistency in their own `AGENTS.md`.
A wrong challenge that gets **checked against the artifact** is still productive; the cost lands
only when the challenge is checked against nothing and then relayed onward. So the rule is not
"flag less", it is **flag freely, verify before you generalize, and never broadcast an unverified
flag** — which is also the argument for keeping `--review` cheap enough that checking is the easy
path.

**A broadcast finding survives independent checking, because nobody re-checks the premise.** The
repository that spent an audit on the phantom defect did re-run the checker, read its own citations,
and correctly report itself clean — _against the three examples_, which it took as established fact
without opening the file they came from. Their own summary of it is the sharpest statement of this
whole failure mode: the same shortcut, one level down. No tool helps there. A finding you received
is an artifact you have not read, and the fact that it arrived from an authority is precisely what
makes it feel already-verified.

**An empty area cannot be disagreed with, so "declines nothing" means less than it sounds.** One
consumer evaluated all 66 principles individually and declined none — then pointed out that three of
its four platforms are native and no principle addresses them at all. Silence there is not
agreement; it is absence. When you report which principles you decline, say which areas had nothing
to decline, or a reader will count an unwritten rule as an accepted one.

the two you wrote.** `ENG-OBS-001`–`ENG-OBS-007` was scanned as two citations; the five in between
were never resolved, never compared against anything, and counted toward a clean result. That is
the worst possible shape for a blind spot: a range asserts something about **every** member while
showing the reader only the endpoints, so it is exactly where a wrong-meaning citation survives
longest — and `--review` looked exhaustive while omitting them. One consumer had two such ranges
concealing five IDs, resolved all five by hand, and found them correct only because an adjacent
gloss happened to list the titles in the right order.

The checker now expands ranges within an area and treats an interior member exactly like a literal
citation: it must exist, and `--review` prints it marked `via range` — _the range asserts this, but
the text never names it_. A range whose interior does not exist now fails. Ranges spanning two
different areas are left alone, since a dash between areas is prose rather than a range.

**Prefer an enumerated, glossed list over a range** where the members matter. A range is compact for
the author and lossy for the reader, who cannot tell whether you checked the interior or assumed it.

**The same shape appears outside citations, and there the answer is different.** A consumer read the
catalog span `ENG-PERF-001` through `ENG-PERF-009` as asserting nine implemented principles, and
reported that it concealed three with no implementing guide. The three are real —
`ENG-PERF-003`, `ENG-PERF-004`, `ENG-PERF-009` — but they are **not** concealed: they are enumerated
in [`practices/uncovered.json`](../practices/uncovered.json), `check-coverage` fails if that ledger
and reality disagree, and `practices/performance-budgets.md` names them in prose as ratified but not
yet implemented.

That contrast is the useful part, so state the rule by what separates the two cases rather than by
the syntax:

> A span is safe exactly when something machine-checked enumerates its exceptions. A citation range
> asserted meaning for interior members with nothing tracking them, so it had to be expanded. A
> catalog range asserts membership, and a separate ledger records which members are unimplemented —
> so the span stays, and the ledger is what you read.

If you inherit a span with no ledger behind it, expand it. If you are writing one, write the ledger
first — a span backed by nothing is a claim about members nobody verified, which is the failure both
instances share.

**A third instance sharpens the rule, because the machine-checked thing was itself the victim.** A
consumer's coverage ratchet read a header span `ENG-BUILD-001`–`ENG-BUILD-008` as covering both
endpoints while the body implemented one, and so counted four principles as covered that no one had
written a technique for. The ledger was correct; the _counter_ resolved the span naively. Their
corrected number came out **lower** than the wrong one, which is the signature of a real fix to a
counting error.

So "machine-checked" is not sufficient on its own — a checker that treats a span as two tokens
inherits exactly the defect the span creates. **Resolve ranges to their members before counting
anything, and never let a heading be the source of a coverage claim.** The same defect has now
appeared in a citation scanner, a practices header, and a coverage counter: three artifacts, three
independent discoveries, one shape — **an inclusive-looking span asserts coverage of members nobody
enumerated.** It recurs because the span is cheaper to write than the enumeration and reads as more
authoritative than either.

**Wrap so a citation never sits alone on a line.** Keep the qualifying clause on the same line as
the link. It is a one-line authoring convention that makes any line-oriented review of your file
sound, and it costs nothing.

Do not assume you were unaffected because a review of your file read correctly. One consumer
checked their two link-bearing citations specifically and found both had put the ID on the claim
line — then reported the right conclusion: they **got lucky rather than being immune**. Whether a
line-oriented reader sees your claim depends on where your wrap width happened to fall, which is
not a property you control or notice. Adopt the convention deliberately rather than inheriting it
by accident.

The statement-over-title case survives all of this, on better evidence: judging by title alone, one
consumer would have wrongly convicted `ENG-SEC-007` "Secure failure" for guarding a short API token
(the statement — "reject unsafe configuration before service" — clears it), while missing a real
`ENG-SEC-005` defect. Read the statement, then ask whether it governs.

**When an ID appears more than once, judge each use independently.** `--review` marks repeated
citations `[use k of n]` for this reason. A consumer found a wrong `ENG-SEC-005` citation in a file
that also cited `ENG-SEC-005` **correctly** ninety-eight lines earlier — right for the runtime
parsers guarding an unchecked request body, wrong for a server-side authorization invariant. Their
diagnosis of why it survived two reviews is worth repeating: a correct nearby use makes the ID read
as _known-good for this file_, so the second use is confirmed by association instead of re-derived.
That is a reviewer failure the exit code cannot reach, since both uses are of a real ID.

**Run `--by-id` as well as `--review`.** It groups every use of an ID together, most-cited first,
instead of walking files in order. Two consumers independently hit the same defect from opposite
directions: one cited an ID correctly and then wrongly ninety-eight lines later in the _same file_,
the other cited one ID four times across _four files_ with two different meanings. File-ordered
review misses both, for the same reason — the uses are never adjacent, so the divergence is never a
comparison. Grouped, the question becomes one you can answer at a glance: do all of these lines
claim the same rule?

**A cluster of miscitations usually has one cause, not several.** The four-file case was one ID
used for one wrong idea, not four independent misreadings — so it was one fix, and its author found
it by asking what the uses had in common. When `--by-id` shows a group that splits cleanly in two,
you have found a single mistake, not a run of bad luck.

**Before concluding a rule is uncovered, search by the mechanism rather than by the feeling.** That
same consumer concluded no principle covered "no environment residue — machine paths, drive letters,
home directories — in committed artifacts", having checked the security and privacy principles
because a stray home directory _feels_ like leakage. It is covered, just not there:
`ENG-ARCH-004` requires equivalent declared inputs to produce equivalent outputs, and `ENG-TEST-005`
requires generated or distributed interfaces to reproduce deterministically. An artifact carrying
the path of the machine that produced it fails both — two developers with identical inputs produce
different bytes. The residue is a **reproducibility** defect that presents as a privacy one.

This is the third instance of the same search failure: `ENG-DATA-*` is scoped by durability rather
than by data-ness, `ENG-INT-*` by external input rather than by having a service, and here the
governing principle is filed under construction rather than under secrets. **Searching the area that
matches the feeling finds the principle that matches the feeling** — which is exactly how a
plausible wrong ID gets chosen. Search the statements for the mechanism you are actually asserting.

**Fetch before you audit, and audit the ref you think you are auditing.** A consumer's first run
reported a deviation their repository had already fixed: their `origin/main` was stale, so the
checker faithfully reported a state that no longer existed. This is a second, independent staleness
from the one the tool's version line addresses — that one is a stale _checker_, this is a stale
_tree_ — and it fails in the more expensive direction, because re-reporting a fixed defect sends
someone to re-fix it. `git fetch` first, and say which ref your result covers.

The same
author convicted their own `ENG-SEC-001` citation by observing that you cannot _rotate_ a home
directory path, and that the rationale — "deleting a leaked value does not revoke copies" — says
nothing about one. A principle you are citing for one clause should still make sense in its other
clauses. Where it does not, you have matched a topic rather than a rule.

The same consumer proposed flagging multi-use IDs as a
smell. Measured before adopting: in this repository **100% of cited IDs appear more than once**
(495 citations across 66 principles), and in the smallest consumer audited, 4 of 5. A flag firing on
nearly every citation is a flag nobody reads. It would also have been wrong on their own best
example — they cite `ENG-ARCH-001` for both "one canonical record" and "components never touch
storage", which _sounds_ like one must be wrong, and both are correct because the statement carries
both halves ("each fact in one authoritative home" **and** "the smallest explicit boundary that keeps
dependencies acyclic"). So the marker states the fact and leaves the verdict to the reader.

That case is also the cleanest argument for printing statements rather than titles. Judging by title
alone, that consumer would have raised two false positives — `ENG-SEC-007` "Secure failure" looks
unrelated to rejecting a short API token until the statement says "reject unsafe configuration before
service" — while missing the one real defect.

out to git, so a miscitation already merged to `main` is invisible from a feature branch that does
not touch that file. A clean run means _the tree you are standing in_ is clean. To clear a
repository rather than a branch, run it against a checkout of `main` as well — the repository that
reported the cleanest result was clean partly because every one of its citations was still
unmerged, which is the case least likely to hide anything and therefore the case that proves the
least.

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

### Write the name next to the ID, and it gets checked

`--review` is advisory: it prints the truth and trusts a human to read it. That is not enough,
because the reviewer most likely to skip it is the one who wrote the citation from memory. So
state the principle's name in parentheses and the checker verifies it for you:

```md
Adapters are required by [`ENG-INT-001` (Thin typed adapters)](../principles/platforms/integration-boundaries.md).
```

A wrong name now fails the build with a diff:

```
1 citation(s) state the wrong principle name:

  docs/architecture.md:12  ENG-SEC-001
      claimed:  Minimal directed boundaries
      actual:   Secret lifecycle
```

This converts the only error class that survived every other check into a mechanical one.
**Every miscitation in the seven-repo migration had the same shape** — a real ID, correctly
formatted, resolving to a different rule. Existence checks pass, link checks pass, and the
sentence still misleads.

The name is optional; omitting it is not a failure. Add it wherever a citation carries weight —
a principle named in an ADR, a `## Compliance` table, a rule you are asking another repo to
follow. Only parenthesised text beginning with a capital is read as a name claim, so ordinary
prose (`per ENG-SEC-008 — never a real record`) is untouched. That restraint is deliberate:
an early version also parsed em-dashed text and produced a false positive on that exact line,
and a checker that cries wolf is a checker somebody turns off.

**Cite nothing rather than the nearest-sounding ID.** If no principle states the obligation,
state it as your own rule. But check before concluding one is absent — read the **Statement**,
not the title. `ENG-INT-001` is titled _Thin typed adapters_, which does not sound like a rule
about framework-free domain logic; its Statement requires you to "isolate provider or framework
behavior behind thin single-purpose adapters", which is exactly that rule seen from the other
side. Titles are labels, not the obligation, and a search over titles alone will conclude a
principle does not exist when it does.

**Link paths are checked for you.** IDs and locations are independent, and the area prefix is not
derivable from the ID: of eleven prefixes, only `ARCH` lives under a directory named after it.
`ENG-INT-001` is under `principles/platforms/`, not `principles/architecture/`. A hand-written
path therefore produces a valid-looking citation with a dead link, and an ID-only check passes
because the ID is right.

`check-citations.mjs` validates link paths by default. It compares any markdown link whose text
names an `ENG-*` ID against that principle's `source` field in `index.json`:

```text
docs/architecture/connectors.md:14  ENG-INT-001 -> .../principles/architecture/integration.md
    expected a path ending in principles/platforms/integration-boundaries.md
```

Links pointing at a practice guide are left alone — naming an ID while linking to the technique is
correct as written. Pass `--no-links` to disable the check, though the only good reason is a
corpus you do not control.

Three separate repositories wrote a correct ID with a wrong path before this was enforced, one of
them in a document whose two links were both wrong while both IDs were right. Do not hand-write the
path; copy `source` from `index.json`.

**A fourth found one that 404s and reported it as link rot. It was not.** They had cited
`v0.2.0/principles/testing.md` and diagnosed it as stale — valid once, broken when the tree gained
its `assurance/`, `architecture/`, `operations/` and `platforms/` subdirectories. Checked against
the actual history: those subdirectories **already existed at `v0.2.0`**, and `principles/testing.md`
has never existed at any ref in this repository. The path was not stale, it was **never valid**.

Worth separating, because the two have different causes and different fixes:

|             | Rotted                              | Never valid                                     |
| ----------- | ----------------------------------- | ----------------------------------------------- |
| Cause       | the target moved after you cited it | the path was constructed by pattern, not copied |
| Implies     | pin the ref, add a redirect         | verify at authoring time                        |
| Detected by | re-checking old citations           | checking the citation when it is written        |

Diagnosing a never-valid path as rot sends you to fix history that was never broken, and leaves
the actual defect — a plausible-looking path assembled from the ID rather than copied from
`source` — in place to recur. It is the same defect the link check exists for, and pinning a tag
does not prevent it: `v0.2.0` is a perfectly good pin pointing at a file that was never there.

Their generalized warning stands and is the reason this matters: **a citation that 404s is worse
than no citation.** It carries the authority of a reference while being uncheckable, and the
reader who follows it cannot tell whether the principle is missing or the link is. Sweeping every
engineering link in a repository is cheap — theirs was fifteen — and worth doing once per repo.

**If no principle covers it, cite nothing.** A near-miss citation is the one failure mode this
whole scheme cannot survive: it transfers authorship of a rule to this repository, which never
agreed to it, and the next reader treats it as ratified. Restated prose is recoverable; a false
citation is not.

Two shapes that stay honest when nothing covers the subject:

- **Name it as yours.** "Colocate tests … a libro convention; the obligation it serves is
  `ENG-TEST-003` (Regression boundaries)." The convention is local, the cited principle is the
  real obligation beneath it, and neither is misattributed.
- **Record it as a decision.** A constraint with no principle behind it is an ADR, and
  `ENG-ARCH-003` is what requires you to write one before treating it as durable. Cite
  `ENG-ARCH-003` for the _recording_, not for the constraint.

**Cite `ENG-ARCH-003` once, on the index — not on each ADR.** This is the natural misreading of the
construction and it produces wrong citations at roughly eleven times the rate of getting it right
once. A consumer with eleven ADRs put the citation on the index and stated the direction outright:

> Recording these discharges `ENG-ARCH-003` … The principle covers the recording, not the content:
> every decision below is Docket's own, and no `ENG-*` rule mandates any particular one of them.

Attaching it to individual ADRs would assert that a ratified principle backs each decision's
**content** — the database choice, the auth model, the log design — when the principle governs only
that the decision was written down. That is the same meaning mismatch as citing a principle whose
statement does not govern your claim, arrived at from the opposite direction: not a wrong ID, but a
correct ID pointed at the wrong half of the sentence. **Ask what the principle obliges, then check
that the thing you attached it to is that thing.**

**Cite `ENG-ARCH-003` only if you actually keep ADRs.** It is the construction most likely to be
misused, precisely because it is available to any repository that writes anything down. A consumer
worked through all three shapes above looking for one that fit, and rejected this one on the
grounds that their repository has no `docs/architecture/` and no ADRs anywhere — so citing it would
assert a practice they do not follow. That is aspiration dressed as compliance, and it is worse
than silence, because the citation now reads as evidence that the obligation is discharged.

Their broader conclusion is the right default: **"no change" is a legitimate result.** Adding an ID
because a construction _permits_ one is the same failure as adding one because it sounds right.
The same repository also declined to manufacture a case for the other two shapes, and reported that
instead. If none of the three fit, cite nothing and say so.

**Two IDs side by side with nothing between them assert that your rule _is_ those principles.** That
is a stronger claim than citing either alone, and it is usually not the one you mean. One consumer
supported "the bridge never persists a user's library" with a bare pair of `ENG-SEC-008` and
`ENG-SEC-004`. Both IDs were correct and the checker was silent, because per-principle scoping makes
a bare pair _permissible_. But only the data-minimization half of `ENG-SEC-008` binds — its
lifecycle-evidence half has nothing to attach to, precisely because the bridge retains nothing — and
`ENG-SEC-004` binds something else entirely, the bridge's own credentials. Their fix names the rule
as a local convention, cites the obligation genuinely beneath it, says which half does not bind and
why, and marks the second ID as _additionally_ binding. **Permissible and accurate are not the same
test**, and stopping at the first is easy because nothing objects.

`--review` now prints `note: adjacent IDs, no connective` when two principle links share a line with
no scoping word between them. It is an annotation and never affects the exit code: a bare pair is
often correct, so this is a prompt to check, not a finding. It is also deliberately narrow — an
earlier version looked for IDs across a context window and fired on a third of this repository's own
citations, nearly all of them prose _discussing_ principles rather than citing them. A checker that
cries wolf is a checker somebody turns off.

**State a boundary by file kind, not by directory, and grep before you assert it.** Framework
isolation is the case where this bites. `ENG-INT-001` requires framework behaviour to sit behind
adapters, and the natural way to write that down — "nothing under `lib/` imports the framework" —
is **false for any repository that colocates components with the logic they serve**. A repository
that wrote exactly that sentence disproved it with one grep: two `.svelte` files under `lib/`
import `svelte`, while every `.ts` module under the same directory is framework-free.

The accurate claim was by file kind, and it is both true and checkable:

```bash
# every .ts module under lib/ is framework-free; .svelte files are the edge
rg -l "from 'svelte'" src/lib --glob '*.ts' | wc -l   # expect 0
```

A directory-shaped claim also fails silently the first time someone colocates a component, with
no test to catch it. Whatever boundary you state, write down the command that proves it and put
that command in CI — an invariant nothing checks is a comment.

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

The whole rule, in one sentence, if you need something quotable for a review:

> A `platforms/` principle binds a repository when the repository is on that platform and the
> principle's specific subject applies to it; being outside one principle's subject does not
> release the sibling principles in the same file, nor the platform-independent parts of the
> principle itself.

Key on the **subject**, not the directory. `ENG-LOCAL-001` is about where the system of record
lives; `002`, `003` and `004` are about the sync seam. A repository can answer the first
question differently while owing all three of the others, which is exactly docket's position.

**Say it where the architecture is described**, not in a compliance appendix — and word it as
scope rather than as a departure, because a reader who finds it later will otherwise read it as
an admission. docket's phrasing is the model:

> This is **not a departure from `ENG-LOCAL-001`** — that principle governs products whose
> device store is the system of record, and Docket answers that question differently because the
> self-hosted server is the product. Out of scope is not non-compliant.

If a principle genuinely does not apply, say so plainly rather than citing it, and tell
Engineering. Only the repository owner may ratify a change to principle text, so a real scope
gap needs a decision record rather than an edit.

### The false exemption, and why it survives review

The dangerous direction is not citing a principle you do not follow — that gets caught. It is
**declaring a whole area inapplicable when it binds**, because nothing then contradicts it.

The mechanism is always the same: **an area name reads like an architectural precondition, so a
repository infers exemption from the name rather than from any principle's Statement.**

A pure-client repository declared all five `ENG-INT-*` principles vacuous — "we have no
integration boundary to govern" — on the strength of the words _integration boundaries_. Reading
the Statements, four of the five bind it: `ENG-INT-001` is scoped by **external input and
framework**, not by owning a service, and that repository parses EPUB containers, OPF metadata
and OPDS feeds. Only `ENG-INT-005`, about credential proxies, was genuinely out of scope.

**It survived because the repository already complied.** Every one of the four was satisfied by
existing code, so no review, lint or test could contradict the exemption. That is the property
that makes this class dangerous, and it inverts the usual risk:

> A false exemption costs nothing for code that exists and everything for code that does not.

The compliant components were never at risk. The exemption's real effect is on the next
component written under it — in that case, provider adapters under active development — which
inherits a documented licence to skip a principle nobody will re-check.

**So audit exemptions by Statement, one principle at a time.** Two questions, and an area-level
answer to either is a finding:

1. Does the principle's Statement name a subject this repository has? Not: does the area name
   sound like us.
2. If it binds, do we satisfy it **today**, by evidence? Compliance you cannot point at is
   indistinguishable from an exemption.

This is the same failure the `platforms/` rule above describes, one level up: there, scope keys
on the principle's subject rather than its file; here, on its Statement rather than its area
name. If a repository got one wrong it will usually have got the other wrong too, so check both
in the same pass.

### Record what you evaluated and excluded, not only what binds

Every adopter so far has cited the principles that bind and said nothing about the rest. That is
the natural thing to do and it loses the more valuable half of the work, because **silence reads
identically whether a principle was considered and excluded or never read at all** — and the
second is much more common.

The consequence is that no reviewer can distinguish them either. An area quietly absent from a
repository's citations is exactly what a false exemption looks like from the outside, so the one
case worth catching is invisible.

So state your exclusions. A line each is enough, and the reason is the part that matters:

```markdown
Evaluated and out of scope:

- ENG-LOCAL-002 (Optional sync seam) — no sync; re-evaluate if multi-device lands.
- ENG-DATA-001 (Owned durable integrity) — no durable store beyond the browser cache.
- ENG-INT-005 (Credential proxy isolation) — no server-side proxy by construction (ADR-0007).
```

Three properties make this worth the lines. It is **falsifiable** — a reader who knows the
repository can object to a specific claim rather than to an absence. It is **re-checkable** when
the repository changes, because "re-evaluate if X lands" names the trigger, and the false
exemption's whole danger is to code that does not exist yet. And it distinguishes _considered_
from _unread_ at the moment the distinction is cheap.

Two failure modes to avoid. Do not write exclusions by area — `ENG-INT-*` as a block is the
false exemption in its usual form, and one repository declared exactly that while four of the
five bound and were already satisfied. And do not claim an exclusion you have not checked: an
unverified exclusion is worse than silence, because it converts an open question into a settled
one.

### Watch the asymmetry: complying on paper is cheaper than disagreeing

An adopter that found a principle contradicted its architecture observed that citing the
principle anyway would have cost **one line and looked compliant to every reader**, while saying
so cost several rounds of argument. That asymmetry is real, it runs the wrong way, and it is the
reason to expect quiet citation rather than disagreement from repositories that never push back.

Two things follow, and they are directed at different people.

If you are adopting: **a citation you cannot defend is worse than a gap**, because a gap is
visible and a false citation is not. The section above exists to make disagreement structurally
cheap — an exclusion with a reason is a line of Markdown, not an argument.

If you own the practices: treat a repository that never disagrees as **unverified rather than
compliant**. Every substantive correction to this guide arrived from a repository whose
architecture contradicted something and which said so instead of citing around it — the
`ENG-LOCAL-001` scope rule, the false-exemption section above, the two-channel delivery split,
and the triage guidance for `noUncheckedIndexedAccess` all originated that way. A guide that only
hears agreement stops improving and cannot tell that it has.

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

### An ADR records a choice you made, not a fact you discovered

`ENG-ARCH-003` is about consequential **tradeoffs**, so the test for whether something belongs in
a decision record is whether you could have chosen otherwise.

A consuming repository was asked to record third-party behaviour it had just characterised —
that `npm audit` transmits dependency names to the default registry — and declined, on the
grounds that an ADR records _its_ decision, while this is inherent behaviour of a tool it neither
controls nor chose. Recording it locally would misattribute an external constraint as a local
decision. That reasoning is right, and it generalises:

| What you have                                                                     | Where it goes                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A tradeoff you chose, with alternatives you rejected                              | an ADR in your repository                                    |
| Behaviour of a tool or platform you don't control                                 | this guide, or a practice note — not an ADR                  |
| A choice **about** that behaviour (accept it, work around it, forbid the command) | an ADR — the decision is yours, the behaviour is its context |

The failure this prevents is subtle and cumulative. An ADR corpus whose entries are mostly
observed facts stops being a record of judgement, and its readers stop expecting the "why" that
makes a record worth keeping. Worse, the fact goes stale — the tool changes, and a document
framed as a decision now misstates the world while carrying the authority of a decision nobody
revisits.

**If the constraint affects every repository, it belongs here, once.** A repository noticing
shared behaviour should report it rather than document it locally, so it lands in one place
instead of seven divergent ones. Cite the shared guidance from your ADR when you make a decision
under it.

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

A third shape is worth naming because it does **not** crash. A router matching
`/^\d{4}$/.test(segs[1])` against a possibly-absent segment does not throw — `.test()` coerces
`undefined` to the string `"undefined"`, which simply fails the match. The result is a silently
wrong route rather than an error, so it survives every test that does not specifically exercise the
short path. **Not every finding is a latent crash; some are permanently wrong answers**, and those
are the ones no amount of runtime testing was ever going to surface.

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

**The test carve-out is conditional on the assertion that justifies it, and nothing enforces
that.** `expect(r).toHaveLength(2)` followed by `r[0]!.name` is sound only because of the line
above it. Delete or weaken that line later — narrow the case, change the fixture, split the test —
and the `!` stays behind, now asserting something no longer established. The test still fails, but
as a `TypeError: Cannot read properties of undefined` at an arbitrary line instead of a named
assertion failure. So the cost of a stale `!` in tests is not a hidden production bug; it is a
worse diagnostic at the moment you most need a good one.

Two things follow. First, if you are adding these in bulk, **verify the tail rather than the
sample** — "every one of them follows a length assertion" is exactly the claim that is true of the
twenty you looked at and false of the hundred you did not. Second, prefer a helper where the
guard is not literally the previous line:

```ts
function assertDefined<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`expected ${what} to be defined`);
  return v;
}
```

It costs one line, survives edits to the surrounding test, and fails with a sentence instead of a
stack trace. Bulk-converting an existing, genuinely-guarded set of assertions to it is not worth
the churn — this is guidance for what you write next.

So treat the burst as a one-time debt payment. Fix at the call site — add the guard, narrow the
type, handle the absent case. Do **not** widen with `!` or `as` in production code, and do not
disable the flag in your `tsconfig.json`: both re-hide exactly the class of bug the flag exists
to find. If a diagnostic is genuinely wrong rather than inconvenient, that is worth reporting
here.

**A third repository hit 368 across 91 files and turned the flag off**, with a comment and a
tracking issue. That is the honest failure mode of the advice above, so it is worth stating what
to do instead of repeating "don't".

The scale is real: three data points are 109, 152 and 368, and the last is not a tail — it is
what a large codebase with pervasive indexing looks like. Turning the flag off repo-wide is still
the worst option, because it silently covers new code as well as old, and the tracking issue
outlives the memory of what it was for.

Stage it instead. `exclude` is the wrong lever, but a scoped override is not:

```jsonc
// tsconfig.json — flag stays on everywhere it currently passes
{
  "extends": "./config/engineering/tsconfig/vite-app.json",
  "include": ["src"],
}
```

```jsonc
// tsconfig.legacy.json — the not-yet-clean subset, shrinking over time
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noUncheckedIndexedAccess": false },
  "include": ["src/games/**"],
}
```

Typecheck both. The difference from disabling it globally is that the excluded set is **named and
finite**, new directories are covered by default, and progress is a shrinking `include` rather
than a closed issue. If even that is too much at once, keep the flag off but record the error
count in the tracking issue so the number is a ratchet rather than a memory.

### Triage the list; the bug-to-appeasement ratio is not predictable

That third repository then audited its suppression rather than defending it, and the result
changes the advice above more than the count did. Under `tsc` it had **263 diagnostics, 87 of
them in production code, and exactly one was a bug.**

Set against the earlier reports, the spread is the finding:

| Repository | Production diagnostics | Real bugs found |
| ---------- | ---------------------- | --------------- |
| First      | 109                    | 19              |
| Third      | 87                     | 1               |
| Fourth     | 838                    | 0 found so far  |

Same flag, same language, two orders of magnitude apart in yield. **So do not plan from either
number.** "A three-figure count is not noise" is true, and its corollary is equally true: most of
a given list may be compiler appeasement, and you cannot tell which case you are in without
reading it. Triage the list. Production first, in file-sized batches.

The fourth repository makes the point sharpest, and it is the reason a raw count must never be
reported on its own. It measured **2,691 diagnostics — roughly 25× the first repository's 109** —
and is almost certainly _less_ bug-dense: 69% were in tests, and a sample of every riskiest-code
diagnostic in production found no active crash. Left as a bare number, that repository looks
twenty-five times more alarming than the one with nineteen real bugs. Someone comparing the two
would reasonably conclude the flag is unusable and switch it off, which is the outcome this whole
section exists to prevent.

**A fifth repository measured zero, and it explains all four other numbers.** It applied the
shared base's genuinely-new flags — `moduleDetection: force`, `noUnusedLocals`,
`noUnusedParameters` — and typechecked four workspaces including `svelte-check
--fail-on-warnings`: **0 diagnostics**. Not a small repository, and not a lucky one. It already
set `noUncheckedIndexedAccess` in its own base, and had for longer than this migration.

That converts the whole range from a planning risk into a **one-command precheck**:

```bash
grep -rn 'noUncheckedIndexedAccess' --include='tsconfig*.json' .
```

A repository that already sets it measures approximately zero, because it has been paying this
debt continuously all along. A repository that does not measures somewhere in 109–2,691, and the
spread within that band is the shape question below, not a size question. Nothing else in the
shared base produces diagnostics at that scale.

So the honest planning advice is not a range at all — it is: **run the grep, and only then decide
whether you need a migration slot.** Four repositories reported counts before anyone asked the
question that predicts them.

**What separates the two is the shape of the read, not the number of them.** The same repository
supplied the discriminator after sampling its own worst cases: an index read is dangerous when it
is indexed by something other than the collection's own bounds check — a cross-collection zip,
a key from one map used to index another, an offset carried in from a caller. Those are the
`getAllKeys()`/`getAll()` shape, where two sequences are assumed to correspond and nothing enforces
it. What is almost always safe is `arr[i]` inside a loop bounded by that same array's `length`, a
regex group behind a successful-match guard, or `split()` of a key the code itself constructed.
Sort the list by that question before reading it, and a four-figure count usually collapses to a
handful of sites worth arguing about.

### The discriminator: what is the index derived from?

Counting diagnostics is the wrong axis. The useful question is where the index came from:

> **The dangerous shape is a read indexed by something other than the collection's own bounds
> check** — two collections zipped positionally, or collection `A` indexed by a value found in `B`.
> A read indexed against its own `length` guard is noise.

That single test explains every case reported so far. It is why nineteen of the first
repository's findings were real: they were cross-collection reads, `allSettled` results zipped by
position and `getAllKeys()` against `getAll()`. It is why the third repository's lone bug was real
— a palette indexed by a position found in a _different_ palette. And it is why the fourth
repository's 838 are mostly noise: `arr[i]` inside `for (i < arr.length)`, regex capture groups
behind a match guard, destructuring a `split('|')` of a key the same function built two lines
earlier. In-bounds by construction, unprovable to the compiler.

Apply the test first and the four idioms below become a consequence of it rather than a list to
memorize — each is a read indexed by its own bounds.

The reason the ratio moves is that a large share of diagnostics come from idioms where the
invariant is real and local but inexpressible to the checker:

| Idiom                     | Example                                        |
| ------------------------- | ---------------------------------------------- |
| Loop-guarded indexing     | `while (i < xs.length) { xs[i].v }`            |
| Paired-swap destructuring | `[a[i], a[j]] = [a[j], a[i]]`                  |
| Modulo indexing           | `words[h % words.length]` on a non-empty array |
| Fixed-size typed arrays   | `new Uint32Array(1)` then `buf[0]`             |

None is a latent crash. Clearing them is refactoring for provability, not bug-fixing — worth
doing, but it is not the same work as fixing the one real defect hiding among them, and it should
not be scheduled as though it were.

**This is where the "no `!` in production" rule needs its honest edge.** The rule exists because
`!` re-hides the bug class the flag finds. Against a provably-safe idiom there is no bug to
re-hide, so the rule is protecting nothing — but you cannot tell the two apart by looking at the
`!`, which is exactly why the rule is unconditional. Resolve it by making the invariant visible
instead of asserting past it: destructure the element once (`const row = xs[i]; if (!row) break;`),
hoist the pair out of the swap, or keep the scoped `tsconfig` override above for a directory that
is dense with one idiom. A runtime guard helper is right in tests and wrong in a hot loop; the
scoped override is the better lever there, because it is named, finite, and shrinking.

**Audit before you suppress, not after.** The third repository's single bug was found only
because it flipped the flag back on and read the output, and it was the same shape as the first
repository's worst finding — **two arrays indexed by a position derived from each other, correct
only while their lengths agree**. In the first it was `getAllKeys()` zipped against `getAll()`; in
the third, a palette indexed by a position found in a _different_ palette, which returns
`undefined` typed as `string` the moment someone adds one entry without its counterpart.

Two of three repositories carried that shape. The third searched for it specifically and found
none — it had no positional zip anywhere, because every read either consumed a whole array or
keyed a map by a field on the record. That negative is worth as much as the positives: the search
is cheap, bounded, and its answer is trustworthy either way. Grep for it directly rather than
waiting for the compiler to raise it — any `b[i]` where `i` came from `a.indexOf(...)`,
`a.findIndex(...)`, or a loop over `a` — and note that **keying by a field instead of a position
removes the shape entirely**, which is the durable fix rather than a guard at each site.
