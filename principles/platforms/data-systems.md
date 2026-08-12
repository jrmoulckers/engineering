# Data systems

## Owned durable integrity

- ID: ENG-DATA-001
- Status: Ratified
- Statement: Give every durable store and schema one owner, enforce invariants in the data model, and migrate through reviewed forward-safe steps.
- Rationale: Durable data outlives individual service versions and needs explicit integrity and recovery boundaries.
- Evidence: Ownership is recorded; typed parameterized access, constraints, and required indexes are tested; migrations are reviewed, observable, recoverable, and compatible with their deployment sequence.
- Owner and ratification: Engineering owns this persistence-integrity and migration mechanism; only the repository owner may change a ratified principle.
- Handoff: Product owns data lifecycle obligations, Studio owns migration-facing UX, and `jrmoulckers/.github` owns deployment automation.
- Legacy inputs: `studio-legacy:backend:2`, `studio-legacy:backend:3`

## Versioned bounded data contracts

- ID: ENG-DATA-002
- Status: Ratified
- Statement: Version event and interchange schemas, bound their names and cardinality, and reject unrecognized shapes.
- Rationale: Governed schemas keep analytical and operational consumers stable while preventing accidental high-cardinality data growth.
- Evidence: Schema validation runs before release; compatibility fixtures cover supported versions; taxonomy and cardinality checks reject unknown or unbounded fields.
- Owner and ratification: Engineering owns this event and data-schema mechanism; only the repository owner may change a ratified principle.
- Handoff: Reference Product's metric definitions and hypotheses rather than defining them; Studio owns any instrumentation-related UI contract and `jrmoulckers/.github` owns automation.
- Legacy inputs: `studio-legacy:data-analytics:3`, `studio-legacy:data-analytics:4`, `studio-legacy:data-analytics:7`

## Minimized governed data

- ID: ENG-DATA-003
- Status: Ratified
- Statement: Minimize data at collection and implement consent, retention, export, erasure, anonymization, and audit mechanisms only from an explicit authorized obligation.
- Rationale: Privacy-preserving mechanics reduce exposure without letting Engineering invent the policy or legal basis for processing.
- Evidence: Payload reviews prefer scoped identifiers, enums, aggregates, and buckets; cross-product identity is not reversible; lifecycle tests verify the referenced Product-owned obligation.
- Owner and ratification: Engineering owns this data-minimization and lifecycle-enforcement mechanism; only the repository owner may change a ratified principle.
- Handoff: Reference Product for permitted collection, consent, retention, metrics, and compliance obligations; Studio owns related disclosure and control UX.
- Legacy inputs: `studio-legacy:backend:7`, `studio-legacy:data-analytics:1`, `studio-legacy:data-analytics:2`, `studio-legacy:data-analytics:6`
