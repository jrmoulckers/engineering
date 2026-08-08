# Testing

## Layered test portfolio

- ID: ENG-TEST-001
- Status: Draft
- Statement: Build a test pyramid with many isolated domain tests, fewer real-seam integration and contract tests, and thin end-to-end coverage of critical paths.
- Rationale: Fast direct feedback and selective seam realism find different failures without making every check depend on the whole system.
- Evidence: Domain rules run without framework or network setup; integration tests cross real owned seams; end-to-end tests are limited to named critical outcomes.
- Owner and ratification: Engineering owns this Draft's general test-portfolio mechanism; only the repository owner may change it to Ratified.
- Handoff: Product names critical outcomes; Studio owns visual, accessibility, and design-token test specialization, and `jrmoulckers/.github` runs the gates.
- Legacy inputs: `studio-legacy:testing:1`

## Contract-focused assertions

- ID: ENG-TEST-002
- Status: Draft
- Statement: Test stable public behavior and producer-consumer contracts instead of incidental implementation structure.
- Rationale: Refactoring should not break assurance when externally observable behavior remains correct.
- Evidence: Assertions exercise public inputs, outputs, errors, schemas, compatibility, migrations, and distributed artifacts without reaching private internals.
- Owner and ratification: Engineering owns this Draft's behavior-and-contract testing mechanism; only the repository owner may change it to Ratified.
- Handoff: Product supplies outcome contracts; Studio owns its visual and accessibility contracts, and `jrmoulckers/.github` owns distribution-gate automation.
- Legacy inputs: `studio-legacy:testing:2`, `studio-legacy:backend:1`, `studio-legacy:backend:3`

## Regression boundaries

- ID: ENG-TEST-003
- Status: Draft
- Statement: Add a failing regression test at the narrowest authoritative boundary for every new behavior, corrected defect, or changed shared contract.
- Rationale: A fix without evidence at the decision boundary can regress through another caller or implementation path.
- Evidence: The test fails before the fix, passes after it, names the defect cause, and exercises the layer where the rule is obeyed.
- Owner and ratification: Engineering owns this Draft's regression-testing mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns intended outcomes and priority; Studio owns UI-specific regression evidence, and `jrmoulckers/.github` runs blocking checks.
- Legacy inputs: `studio-legacy:testing:3`, `studio-legacy:testing:7`

## Distinct static signals

- ID: ENG-TEST-004
- Status: Draft
- Statement: Separate type, lint, build, format, and security checks from behavior tests, and make statically decidable invariants blocking at the narrowest scope.
- Rationale: Static checks and executable tests prove different properties and should fail with actionable ownership.
- Evidence: CI reports each signal independently; a fixture demonstrates each rule can fail; no green static stage is reported as test coverage.
- Owner and ratification: Engineering owns this Draft's static-assurance classification; only the repository owner may change it to Ratified.
- Handoff: Studio owns its specialized visual and accessibility checks; `jrmoulckers/.github` implements and runs repository gates.
- Legacy inputs: `studio-legacy:testing:4`

## Clean deterministic verification

- ID: ENG-TEST-005
- Status: Draft
- Statement: Run release-blocking verification from a clean declared environment and require generated or distributed interfaces to reproduce deterministically.
- Rationale: Local residue and nondeterministic generation can hide missing inputs or publish output that source does not explain.
- Evidence: Clean repeated runs pass with frozen dependencies; generated interfaces match committed or packaged output by digest or documented normalization.
- Owner and ratification: Engineering owns this Draft's deterministic-verification mechanism; only the repository owner may change it to Ratified.
- Handoff: `jrmoulckers/.github` owns clean-runner and gate implementation; Product owns release readiness decisions.
- Legacy inputs: `studio-legacy:testing:5`, `studio-legacy:architecture:10`

## Risk-based meaningful coverage

- ID: ENG-TEST-006
- Status: Draft
- Statement: Require changed behavior, defect causes, and shared contracts to cover meaningful branches and edge conditions in proportion to risk.
- Rationale: Line totals can increase while the decisions most likely to harm users remain untested.
- Evidence: Change review links risks to named assertions; coverage reports show decision and branch gaps; exclusions record a scoped rationale and owner.
- Owner and ratification: Engineering owns this Draft's risk-based coverage mechanism; only the repository owner may change it to Ratified.
- Handoff: Product identifies outcome impact and risk tolerance; Studio owns risk within visual and accessibility behavior, and `jrmoulckers/.github` runs thresholds.
- Legacy inputs: `studio-legacy:testing:6`

## Positive and negative polarity

- ID: ENG-TEST-007
- Status: Draft
- Statement: Test both accepted and rejected behavior, assert the named-path preconditions, and repeat stateful operations where idempotence or persistence matters.
- Rationale: A passing happy path does not prove the guard ran, the fixture reached the intended branch, or repetition preserved invariants.
- Evidence: Paired fixtures prove allow and deny outcomes; preconditions identify the exercised path; repeat tests detect duplicate effects and lost state.
- Owner and ratification: Engineering owns this Draft's polarity-and-precondition testing mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines permitted outcomes; Studio owns interaction-specific polarity, and `jrmoulckers/.github` executes the suite.
- Legacy inputs: `studio-legacy:testing:8`, `studio-legacy:backend:5`

## Discriminating mutation evidence

- ID: ENG-TEST-008
- Status: Draft
- Statement: Verify important tests can fail by killing a targeted behavior-changing mutation and naming the assertions that discriminate it.
- Rationale: Executed tests can remain green while never observing the behavior they claim to protect.
- Evidence: A scoped mutation changes one risk-bearing decision; the expected test fails for the named reason; evidence records assertions rather than fragile aggregate counts.
- Owner and ratification: Engineering owns this Draft's test-failability mechanism; only the repository owner may change it to Ratified.
- Handoff: Product supplies impact priorities; Studio owns mutation targets for its specialized contracts, and `jrmoulckers/.github` owns automation.
- Legacy inputs: `studio-legacy:testing:8`

## Independent real-world evidence

- ID: ENG-TEST-009
- Status: Draft
- Statement: Derive expected values independently from the recorded result and pin offline real-world observations with revision, date, method, and recheck trigger.
- Rationale: Self-derived expectations and stale external facts can make tests agree with the same defect or obsolete referent.
- Evidence: Tests cite an independent oracle or invariant; recorded observations include provenance and expiry conditions; fixtures do not call the implementation to compute their expected result.
- Owner and ratification: Engineering owns this Draft's independent-test-evidence mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns domain truth and update obligations; Studio owns independently sourced design referents, and `jrmoulckers/.github` owns fixture distribution.
- Legacy inputs: `studio-legacy:testing:9`

## Executable procedures

- ID: ENG-TEST-010
- Status: Draft
- Statement: Convert every repeatable documented verification procedure into an executable assertion with a known failure mode.
- Rationale: Manual prose drifts and cannot continuously prove the property it describes.
- Evidence: Documentation links the executable check; a negative fixture demonstrates failure; unavoidable manual steps name an owner, evidence format, and expiration.
- Owner and ratification: Engineering owns this Draft's executable-verification mechanism; only the repository owner may change it to Ratified.
- Handoff: Studio retains human review for visual and accessibility judgment; `jrmoulckers/.github` runs executable repository checks, and Product owns release decisions.
- Legacy inputs: `studio-legacy:testing:10`
