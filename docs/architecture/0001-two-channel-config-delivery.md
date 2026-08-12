# ADR-0001: Deliver shared configuration over two channels, not one

- Status: Accepted
- Date: 2026-08-11
- Deciders: repository owner
- Principles: `ENG-ARCH-003`, `ENG-BUILD-002`

`ENG-SEC-001` is deliberately **not** cited. Reducing how many people must hold a credential is a
welcome side effect, but that principle governs the lifecycle of secrets that exist — keeping them
out of source, injecting at runtime, rotating on exposure — and this decision implements none of
that. The `.npmrc` guidance in `docs/adopting.md` is where `ENG-SEC-001` actually binds.

## Context

The shared configuration was originally delivered as three npm packages published to GitHub
Packages: `@jrmoulckers/eslint-config`, `@jrmoulckers/prettier-config`, `@jrmoulckers/tsconfig`.
Adoption required each consumer to commit an `.npmrc` routing the `@jrmoulckers` scope to
`npm.pkg.github.com`.

A consuming repository rejected that during adoption, and the objection turned out to be
structural rather than local:

**GitHub Packages authenticates every read, including reads of a public package.** There is no
anonymous access to its npm registry. Package visibility changes _authorization_ — whether a given
token is allowed — but never removes the requirement to send one.

The consequence is that routing the scope puts a credential in the install path for **everyone**,
not just CI. For a self-hosted product, that means a person cloning the repository to run it
cannot `install` until they have created a GitHub account and minted a classic personal access
token. That is an onboarding regression, and it is the one property the pending
package-visibility change does **not** improve.

Two further facts shaped the decision:

- The repository already operates a working non-registry channel. `configs/golangci.yml` is
  fetched over HTTP at a pinned ref by Go consumers, with no token. The pattern is proven; it was
  simply undocumented and each consumer had written its own fetch script.
- The three packages are not alike. `tsconfig` is pure JSON and `prettier-config` is
  dependency-free ES modules. `eslint-config` declares four runtime dependencies — `@eslint/js`,
  `typescript-eslint`, `eslint-config-prettier`, `globals` — plus peer plugins.

## Decision

Deliver the configuration over **two channels**, chosen per package.

- `@jrmoulckers/tsconfig` and `@jrmoulckers/prettier-config` are **vendored at a pinned ref** by
  `scripts/vendor-configs.mjs`. No registry, no token.
- `@jrmoulckers/eslint-config` remains on **the registry**.

Both remain published; vendoring is additive, so repositories already installing from the registry
are not forced to move.

The split is drawn on dependency ownership, not on file format. Vendoring `eslint-config` would
copy source that is meaningless without four transitive packages, pushing those version choices
back onto every consumer — reintroducing exactly the drift centralization was created to end. A
package manager is the correct tool for a dependency graph, and the token cost is justified where
one exists. Where none exists, it is not.

To keep the version signal that vendoring normally destroys, the script writes
`engineering-configs.lock.json` recording the ref and the SHA-256 of every file, and writes the
files **byte-identical** to source with no generated header. Drift is therefore a diff, and an
upgrade is a reviewable one.

## Alternatives rejected

**Registry for all three.** Simplest to document and gives the strongest version signal. Rejected
because it imposes a mandatory credential on contributors and self-hosters of every consuming
repository, including repositories whose only need is a JSON file with no dependencies. The cost
falls on people who receive no benefit from it.

**Vendoring for all three.** Consistent, and removes the token entirely. Rejected because
`eslint-config` cannot be vendored honestly: the consumer would still have to declare and version
four dependencies by hand, and those versions would drift per repository and silently change lint
results. It converts a solved problem back into an unsolved one.

**Publish to npmjs.com instead.** Would make public reads anonymous and preserve one channel.
Rejected as a larger change than the problem requires — a second registry account, a second
publish credential, and a public namespace for configuration that is not intended for outside
consumption. Reconsider if the packages ever become externally useful.

**Leave it per-repository.** Rejected explicitly. The objection applies identically to all seven
consumers, so deciding it once is the point; otherwise each repository litigates it separately and
the fleet ends up mixed.

## Consequences

- Repositories with no ESLint dependency — Go services, docs sites — need no registry access at
  all. This is a strict improvement for them.
- Repositories using all three still need a token, but only for one package.
- **Verifying "no token needed" requires a cold cache.** npm satisfies an install from its
  local cache without contacting the registry at all, so a machine that has ever authenticated
  once will install the remaining registry package with every credential removed and exit 0. One
  adopter measured exactly this: `npm ci` passed with 599 packages added, and the same tree with
  an empty cache returned `E401 ... authentication token not provided`. The pass was real and the
  conclusion drawn from it was false. Verify with `npm ci --cache <fresh-dir>`, because CI always
  has a cold cache and the first contributor will too — which is precisely the onboarding
  regression this decision exists to remove.
- A vendored file can be edited locally. The lock file makes that visible as a hash mismatch.
  Originally nothing forced a check; `scripts/vendor-configs.mjs --check` now does, and consumers
  should run it in CI. It fails on drift and only warns on staleness — a tag pushed here must
  never redden a consumer's unrelated PR, because that turns pinning from a decision into a
  default.
- Upgrades are no longer a version-range bump. Someone must re-run the script with a newer tag,
  which is more deliberate and more visible, but will not happen automatically.
- The repository now owns a fetch script as a supported interface, and its failure modes matter as
  much as its success path. It treats a non-200, an empty body, and a 200 carrying the wrong
  payload as fatal, and writes nothing until every file passes — a partial write would leave tools
  running against a mix of refs while reporting success.
