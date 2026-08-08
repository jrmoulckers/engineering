# Data systems

- ID: ENG-DATA-001
- Status: Draft
- Statement: Design owned, versioned data systems that preserve integrity while collecting and retaining only the data an authorized obligation requires.
- Rationale: Durable schemas outlive individual features, so ownership, migration safety, privacy minimization, and evidence must be designed into the storage and event model.
- Evidence: Every store and schema has an owner; constraints and access paths are tested; migrations are reviewed and forward-safe; event schemas are versioned and cardinality-bounded; collection, retention, export, erasure, and audit mechanisms are verified against Product-defined obligations.
- Owner and ratification: Engineering owns this Draft's persistence, migration, event-schema, and privacy-enforcement mechanisms; the repository owner alone may ratify it.
- Handoff: Product owns metrics, hypotheses, consent and retention obligations, and permitted collection; Studio owns any UI that communicates or controls those obligations; `jrmoulckers/.github` owns automation.
- Legacy inputs: `studio-legacy:backend:2`, `studio-legacy:backend:3`, `studio-legacy:backend:7`, `studio-legacy:data-analytics:1`, `studio-legacy:data-analytics:2`, `studio-legacy:data-analytics:3`, `studio-legacy:data-analytics:4`, `studio-legacy:data-analytics:6`, `studio-legacy:data-analytics:7`

## Rule

- Assign one authoritative owner to each durable store and schema; enforce invariants with typed access, parameterization, constraints, and indexes.
- Make migrations reviewed, forward-safe, observable, and recoverable before relying on a new schema.
- Version event and interchange schemas, bound names and cardinality, and reject unrecognized shapes rather than inferring them.
- Minimize at collection: prefer scoped identifiers, enums, aggregates, and buckets over raw identity or free text, and prevent reversible cross-product identity graphs.
- Implement consent gates, retention, export, erasure, anonymization, and auditability only from explicit Product-owned obligations; do not invent the obligation in Engineering.
