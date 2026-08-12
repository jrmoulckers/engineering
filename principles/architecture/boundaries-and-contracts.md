# Boundaries and contracts

## Minimal directed boundaries

- ID: ENG-ARCH-001
- Status: Ratified
- Statement: Choose the smallest explicit boundary that keeps dependencies acyclic and each fact in one authoritative home.
- Rationale: Narrow, directional seams limit coordination and prevent implementation details from becoming accidental contracts.
- Evidence: Dependency graphs contain no cycles; boundary records name assets, entry points, trust assumptions, and owners; duplicate sources of truth are absent.
- Owner and ratification: Engineering owns this generic dependency and boundary mechanism; only the repository owner may change a ratified principle.
- Handoff: Reference Product for required outcomes, Studio for UI and design contracts, and `jrmoulckers/.github` for GitHub, Copilot, AI, automation, sync, and distribution.
- Legacy inputs: `studio-legacy:architecture:1`, `studio-legacy:architecture:6`, `studio-legacy:architecture:7`, `studio-legacy:architecture:9`, `studio-legacy:architecture:11`, `studio-legacy:architecture:12`, `studio-legacy:security:3`

## Explicit additive contracts

- ID: ENG-ARCH-002
- Status: Ratified
- Statement: Publish typed, versioned, consumer-neutral contracts and evolve them additively until a declared breaking boundary.
- Rationale: Stable contracts let implementations and platforms change independently without surprising consumers.
- Evidence: Compatibility tests exercise old and new consumers; schemas classify additive and breaking changes; policy modules run without a renderer or consumer framework.
- Owner and ratification: Engineering owns this generic software-contract mechanism; only the repository owner may change a ratified principle.
- Handoff: Reference Studio's published UI and design contracts rather than defining their names or values; Product owns outcome obligations and `jrmoulckers/.github` owns distribution.
- Legacy inputs: `studio-legacy:architecture:2`, `studio-legacy:architecture:3`, `studio-legacy:architecture:4`, `studio-legacy:architecture:8`, `studio-legacy:architecture:13`, `studio-legacy:testing:1`
- Legacy input scope: `studio-legacy:architecture:2` contributes contract structure only, `studio-legacy:architecture:13` contributes safe-baseline mechanics only, and `studio-legacy:testing:1` contributes framework-free policy testability; Studio retains token, theme, and accessibility expression.

## Durable decisions

- ID: ENG-ARCH-003
- Status: Ratified
- Statement: Record consequential architectural tradeoffs as ADRs before treating them as durable constraints.
- Rationale: Future maintainers need the forces and consequences behind a decision, not only its surviving implementation.
- Evidence: Each consequential durable choice links to a Proposed or Accepted ADR; routine implementation choices do not create records.
- Owner and ratification: Engineering owns this architecture-decision mechanism; only the repository owner may change a ratified principle.
- Handoff: Reference Product, Studio, or `jrmoulckers/.github` decisions when they constrain Engineering; do not restate or decide another authority's policy in an Engineering ADR.
- Legacy inputs: `studio-legacy:architecture:5`

## Reproducible construction

- ID: ENG-ARCH-004
- Status: Ratified
- Statement: Require equivalent declared inputs to produce equivalent build outputs.
- Rationale: Reproducibility is an architectural property needed for trustworthy diagnosis, release, and recovery.
- Evidence: Clean repeated builds match by digest or a documented normalized comparison; undeclared environment state does not alter outputs.
- Owner and ratification: Engineering owns this deterministic-build property; only the repository owner may change a ratified principle.
- Handoff: E1.2 may define Engineering implementation mechanics; `jrmoulckers/.github` owns workflow automation and distribution that enforce the property.
- Legacy inputs: `studio-legacy:architecture:10`
