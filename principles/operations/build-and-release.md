# Build and release

## Declared deterministic build graph

- ID: ENG-BUILD-001
- Status: Ratified
- Statement: Build only through a declared acyclic dependency graph whose equivalent inputs produce equivalent outputs.
- Rationale: Hidden ordering and undeclared state make failures irreproducible and artifacts untraceable.
- Evidence: Graph validation finds no cycles or undeclared edges; generated output is regenerated and matches source; clean repeated builds match by digest or documented normalization; parallel scheduling preserves results.
- Owner and ratification: Engineering owns this Draft's deterministic build-graph mechanism; only the repository owner may change it to Ratified.
- Handoff: `jrmoulckers/.github` owns workflow implementation and runner scheduling; Product owns release timing.
- Legacy inputs: `studio-legacy:architecture:1`, `studio-legacy:architecture:10`, `studio-legacy:devops:5`

## Immutable versioned artifacts

- ID: ENG-BUILD-002
- Status: Ratified
- Statement: Produce immutable versioned artifacts and never mutate or rebuild an already identified release.
- Rationale: A release identifier is trustworthy only when it always resolves to the same bytes and provenance.
- Evidence: Registries reject replacement; repeated retrieval matches the recorded digest; corrections create a new version and artifact.
- Owner and ratification: Engineering owns this Draft's artifact-immutability mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns whether to ship a version; `jrmoulckers/.github` owns registry and distribution automation.
- Legacy inputs: `studio-legacy:devops:8`, `studio-legacy:process:5`, `studio-legacy:process:6`

## Additive semantic evolution

- ID: ENG-BUILD-003
- Status: Ratified
- Statement: Version public contracts with SemVer intent at authoring time and evolve them additively until a declared migration permits a breaking release.
- Rationale: Consumers need compatibility expectations before a change reaches packaging or release.
- Evidence: Change records classify patch, minor, and major intent; compatibility tests exercise supported versions; breaking changes include migration and deprecation evidence.
- Owner and ratification: Engineering owns this Draft's software-versioning and migration mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns rollout and support obligations; Studio owns versioning of its published contracts, and `jrmoulckers/.github` owns release automation.
- Legacy inputs: `studio-legacy:architecture:4`, `studio-legacy:devops:8`, `studio-legacy:process:3`

## Generated changesets and changelogs

- ID: ENG-BUILD-004
- Status: Ratified
- Statement: Record release intent in reviewed changesets and generate versions and changelogs from those records instead of editing release output by hand.
- Rationale: Author-time intent is more accurate and auditable than reconstructing user-visible changes at publish time.
- Evidence: Releasable changes include a reviewed change record; generation is deterministic; each changelog entry resolves to its change and pull request.
- Owner and ratification: Engineering owns this Draft's changeset and changelog mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns customer-facing release meaning and go/no-go; `jrmoulckers/.github` owns generation and publishing automation.
- Legacy inputs: `studio-legacy:devops:8`, `studio-legacy:process:3`, `studio-legacy:process:5`

## Clean reproducible environments

- ID: ENG-BUILD-005
- Status: Ratified
- Statement: Run authoritative build and release checks in clean environments with pinned toolchains, frozen dependencies, and no production credentials.
- Rationale: Residual files, floating tools, and live secrets make release evidence irreproducible and unsafe.
- Evidence: Authoritative checks emit required evidence for every pull request and release candidate; a clean install and build succeed from declared inputs; tool and dependency versions are recorded; fixtures replace production credentials.
- Owner and ratification: Engineering owns this Draft's reproducible build-environment mechanism; only the repository owner may change it to Ratified.
- Handoff: `jrmoulckers/.github` owns runner images, workflow permissions, and secret delivery; Product owns release readiness decisions.
- Legacy inputs: `studio-legacy:architecture:10`, `studio-legacy:devops:1`

## Build dependency hygiene

- ID: ENG-BUILD-006
- Status: Ratified
- Statement: Keep build dependencies minimal, locked, reviewed, and free of unnecessary install-time execution.
- Rationale: Every build dependency expands compromise, nondeterminism, maintenance, and licensing surface.
- Evidence: Dependency review records purpose and provenance; frozen installation succeeds with lifecycle scripts disabled unless justified; stale or duplicate tools are removed.
- Owner and ratification: Engineering owns this Draft's build-dependency hygiene mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns license and accepted-risk obligations; `jrmoulckers/.github` owns dependency update and scanner automation.
- Legacy inputs: `studio-legacy:security:2`, `studio-legacy:devops:6`, `studio-legacy:compliance:5`

## Release artifact identity

- ID: ENG-BUILD-007
- Status: Ratified
- Statement: Bind every release artifact to its version, commit revision, source change records, checks, and runtime-reported identity.
- Rationale: Operators cannot verify or diagnose a deployment when the running bytes cannot be traced to reviewed source and evidence.
- Evidence: Provenance resolves artifact digest to version, commit, changesets, pull requests, and required checks; runtime identity matches the deployed artifact.
- Owner and ratification: Engineering owns this Draft's release-provenance and artifact-identity mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns release approval and communication; `jrmoulckers/.github` owns provenance generation, repository checks, and distribution.
- Legacy inputs: `studio-legacy:devops:8`, `studio-legacy:devops:9`, `studio-legacy:process:5`, `studio-legacy:process:6`

## Rollback-compatible releases

- ID: ENG-BUILD-008
- Status: Ratified
- Statement: Preserve rollback compatibility across code, contract, schema, and artifact activation boundaries for the declared recovery window.
- Rationale: Rollback is unsafe when a newer release irreversibly changes state or consumers before recovery can complete.
- Evidence: Release tests exercise old and new versions through migration and rollback order; activation is atomic; recovery instructions name compatibility limits and artifact identity.
- Owner and ratification: Engineering owns this Draft's rollback-compatibility mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns the go/no-go and rollback decision; Studio owns user-facing recovery states, and `jrmoulckers/.github` owns deployment automation.
- Legacy inputs: `studio-legacy:backend:3`, `studio-legacy:frontend:9`
