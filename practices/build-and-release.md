# Build and release

Implements `ENG-BUILD-002`, `ENG-BUILD-003`, `ENG-BUILD-004`, `ENG-BUILD-005`, `ENG-BUILD-006`,
`ENG-BUILD-007`, and `ENG-BUILD-008`. This guide adds no rules.

`ENG-BUILD-001` (reproducible builds from a declared graph) is implemented in
[Go services and tools](go.md#reproducible-builds-eng-arch-004-eng-build-001).

Most of what follows is what this repository already does to publish `@jrmoulckers/*`. Where it
does something differently from the recommendation, that is called out rather than hidden.

## A published version is immutable (`ENG-BUILD-002`)

Once `@jrmoulckers/eslint-config@0.3.0` exists, those bytes are what `0.3.0` means forever. A
fix ships as `0.3.1`. This is not a preference — consumers have the old bytes in a lockfile with
an integrity hash, so republishing different content under the same version breaks
`npm ci --frozen-lockfile` for everyone who already installed it, with an integrity error that
names no cause.

The practical consequence is that **a re-run of the release job must not attempt a republish**.
Tag pushes get re-run for reasons unrelated to the artifact: a flaky network step, a maintainer
clicking "re-run all jobs" to clear an unrelated failure. This repository handles it by asking
the registry first:

```bash
for dir in packages/*/; do
  name="$(node -p "require('./${dir}package.json').name")"
  version="$(node -p "require('./${dir}package.json').version")"
  if npm view "${name}@${version}" version --registry https://npm.pkg.github.com >/dev/null 2>&1; then
    echo "skip ${name}@${version} (already published)"
    continue
  fi
  npm publish --workspace "${name}"
done
```

Skipping is the correct behaviour, not a workaround: the artifact already exists and is already
immutable, so there is nothing to do and the job should stay green. The alternative — letting
`npm publish` fail with `EPUBLISHCONFLICT` — turns a correct no-op into a red build that trains
people to ignore red builds.

This also removes the need to keep package versions in lockstep. Each package publishes only
when its own version changed, so a release that touches one package does not force version bumps
in the other two.

### Never move a tag

`git tag -f v0.4.0 && git push --force` re-points a release at different code while every
changelog, issue, and audit record still refers to it by name. Anyone who fetched the old tag
keeps the old commit and has no signal that it changed. If a tag is wrong, cut the next one.

## Version public contracts at authoring time (`ENG-BUILD-003`)

SemVer intent is decided when the change is written, not reconstructed at release time by
someone reading a diff. By then the person who knew whether the change was breaking has moved on.

For the shared configuration packages, the contract is wider than the exported function
signatures. **Enabling a lint rule is a breaking change** even though no API changed: a consumer
who upgrades gets new errors and a red build. That is the same experienced outcome as removing an
export, so it takes the same version treatment.

| Change to a shared config                  | Version |
| ------------------------------------------ | ------- |
| Enable a rule, or raise `warn` to `error`  | major   |
| Add a stricter `compilerOption`            | major   |
| Add a new exported preset                  | minor   |
| Disable a rule, or lower `error` to `warn` | minor   |
| Widen a peer dependency range              | minor   |
| Narrow a peer dependency range             | major   |
| Fix a preset that never loaded             | patch   |

Narrowing a peer range is breaking because it can make an existing, working install unresolvable
— the failure appears in `npm install` rather than in code, but it still stops a consumer who
did nothing wrong.

### Evolve additively until a migration exists

The rule is to grow the contract sideways and remove later, under a declared migration. For lint
configuration that means a new strictness lands as its own export first:

```js
export function base(options) {
  /* unchanged */
}
export function baseStrict(options) {
  /* base + the new rules */
}
```

Consumers adopt `baseStrict` when they have time, on a minor upgrade that cannot break them. The
rules fold into `base` at the next major, once the migration path has been available long enough
to use. The alternative — turning the rules on in `base` directly — is correct SemVer and still a
bad experience, because it forces every consumer to deal with it on the same day.

## Generate versions and changelogs from reviewed records (`ENG-BUILD-004`)

Release notes written at release time describe what someone remembers. Release notes generated
from records written alongside each change describe what happened.

The record is created in the same pull request as the change, so it is reviewed by the people
reviewing the change, who are the only people positioned to catch "this is a patch" on something
that is plainly a major.

This repository is currently the **weakest example** of this principle it documents. Versions are
edited by hand in `package.json` and the tag is cut manually. That works at three packages and
one maintainer, and it will not survive a fourth package or a second maintainer, because nothing
mechanically connects the version bump to the change that justified it. A repository adopting
this practice fresh should use Changesets rather than copy what is here:

```bash
npx changeset          # records intent, in the PR, reviewed with the diff
npx changeset version  # applies bumps and writes CHANGELOG.md
```

The half this repository does implement is the important half: **release output is generated, not
edited.** No one hand-writes a changelog entry, and no one edits a published artifact.

## Release checks run in a clean environment (`ENG-BUILD-005`)

Four separable obligations. The failure they prevent is the release that works only on the
machine of whoever released it.

**Clean.** A fresh runner every time. Never a self-hosted runner carrying state from the previous
job, and never a developer laptop with tools that got installed a year ago for something else.

**Pinned toolchain.** State the version in a file the build reads, so it cannot drift:

```yaml
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
  with:
    node-version: 20
```

Go repositories use `go-version-file: go.mod` so the toolchain is pinned in exactly one place.

**Frozen dependencies.** `npm ci`, never `npm install`. `npm ci` fails when the lockfile disagrees
with `package.json`; `npm install` silently rewrites the lockfile, so a release job that uses it
can ship a dependency tree nobody reviewed.

**No production credentials.** The release job holds a publish token and nothing else. It does
not hold database credentials or cloud keys, because a compromised dependency in a release job
should be able to publish a bad package — bad, but recoverable — rather than reach production
data.

The same job runs the same checks as a pull request. A release that skips tests to go faster is
the one release where the tests mattered most.

## Build dependencies stay minimal and inert (`ENG-BUILD-006`)

The build's dependency graph is production attack surface, because it executes with a publish
token in the environment.

```bash
npm ci --ignore-scripts
```

`--ignore-scripts` is the part most repositories miss. A `postinstall` script runs arbitrary code
from every transitive dependency, before any test or scan, with whatever credentials the job
holds. It is the shortest path from a compromised package to a compromised release. Add it back
only for the specific packages that genuinely need a native build, and record why.

Verify it works before adopting it: a repository whose dependencies genuinely require install
scripts will fail loudly, which is the desired outcome — you then know which ones and can scope
the exception rather than blanket-permitting execution.

Keep the graph small. Every build dependency is one more maintainer who can end your release, and
a build tool that saves twenty lines of script is rarely worth that.

## Bind the artifact to its origin (`ENG-BUILD-007`)

Given a released artifact, it must be possible to determine which commit produced it, which
checks passed, and what it reports about itself at runtime. Without that, a production incident
begins with an argument about what is deployed.

**Source binding.** Every published package declares where it came from, including the
subdirectory in a monorepo:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/jrmoulckers/engineering.git",
  "directory": "packages/eslint-config"
}
```

**Build binding.** A cryptographic attestation links the artifact's digest to the workflow run and
commit that produced it, which a `repository` field alone cannot do — anyone can write that field.

```yaml
permissions:
  contents: read
  packages: write
  id-token: write # required: the OIDC token identifies the workflow

steps:
  - uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4
    with:
      subject-path: '*.tgz'
```

Use the GitHub attestation rather than `npm publish --provenance` when publishing to GitHub
Packages. npm provenance is documented against `registry.npmjs.org`, where the registry itself
generates a publish attestation and `npm audit signatures` verifies it; there is no equivalent
documented behaviour for GitHub Packages, and this was **not** verified here — a `--dry-run`
skips provenance generation entirely, so it proves nothing either way. The
`actions/attest-build-provenance` route stores the attestation in GitHub rather than in the
registry, so it works regardless of where the package is published.

**Runtime binding.** A running service reports the same version and commit the artifact was built
from, injected at build time rather than read from a tracked file that can drift:

```bash
go build -ldflags "-X main.version=${VERSION} -X main.commit=${GITHUB_SHA}"
```

Expose it on the health endpoint. "Which version is running?" should be answerable from outside
the process, during the incident, without a deploy log.

This repository currently implements the source binding only. The attestation step is not yet in
`publish.yml`, and the packages are configuration rather than services, so runtime identity does
not apply.

## Rollback stays possible across every boundary (`ENG-BUILD-008`)

Rollback is not "deploy the previous artifact". It is that decision remaining _available_ across
four boundaries that fail independently.

**Code.** The previous artifact still exists and is still installable. This follows from
`ENG-BUILD-002` — immutability is what makes the old version fetchable at all. Never unpublish.

**Contract.** A deployed client must keep working against the rolled-back server. This is why
`ENG-BUILD-003`'s additive evolution matters operationally rather than only aesthetically: a
purely additive change is rollback-safe, because the old server ignores fields it never knew
about. A field that is removed and reused for a different meaning is not.

**Schema.** The old code must run against the new database. That forbids the destructive migration
deployed with the code that needs it, and requires the expand/contract sequence:

1. Add the new column, nullable, and deploy. Old code ignores it.
2. Write both, read old. Deploy. Rollback still works.
3. Read new. Deploy. Rollback still works.
4. Drop the old column — only after the recovery window has passed.

Step 4 is the step that gets skipped and then done in a hurry weeks later, which is exactly when
it becomes an outage. It is a separate, scheduled change, and it is the point after which
rollback past it is no longer possible.

**Activation.** Rolling back the artifact does not roll back a feature flag or a migrated data
record. Anything that changes state independently of deploys needs its own reversal path, tested
before it is needed.

Rollback compatibility is a property with an expiry: it holds for the declared recovery window,
not forever. Declare the window explicitly — otherwise every schema change accumulates
compatibility shims nobody is allowed to remove, and the codebase never sheds anything.
