# API and backend

## Typed versioned APIs

- ID: ENG-API-001
- Status: Draft
- Statement: Parse every API request into a typed, versioned contract and return only structured safe responses and errors.
- Rationale: Trust-boundary validation and deliberate versions let clients and services evolve without admitting ambiguous data.
- Evidence: Contract tests cover accepted, rejected, unknown, and prior-version payloads; breaking changes use a declared version; errors omit secrets, stack traces, and internal identifiers.
- Owner and ratification: Engineering owns this Draft's API contract and validation mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines service obligations, Studio owns client-facing error and recovery UX, and `jrmoulckers/.github` owns release automation.
- Legacy inputs: `studio-legacy:backend:1`, `studio-legacy:security:5`, `studio-legacy:security:7`

## Persistence-aware services

- ID: ENG-API-002
- Status: Draft
- Statement: Access persistence through an owned data contract and deploy schema-dependent service behavior only after a forward-safe migration path exists.
- Rationale: Service correctness depends on storage ownership and schema compatibility even when persistence is implemented behind another module.
- Evidence: Service code names its store owner and data contract; access is typed and parameterized; deployment tests prove old and new service versions tolerate the migration sequence.
- Owner and ratification: Engineering owns this Draft's backend-to-persistence mechanism; only the repository owner may change it to Ratified.
- Handoff: Apply `ENG-DATA-001` for store integrity; reference Product for lifecycle obligations, Studio for migration-facing UX, and `jrmoulckers/.github` for deployment automation.
- Legacy inputs: `studio-legacy:backend:2`, `studio-legacy:backend:3`

## Server-enforced authorization

- ID: ENG-API-003
- Status: Draft
- Statement: Source secrets outside code and enforce authentication and authorization server-side with default-deny decisions.
- Rationale: Client checks and missing configuration cannot protect server resources or machine-triggered operations.
- Evidence: Authorization tests cover absent, invalid, and insufficient credentials; denied requests perform no protected action; no secret is committed or returned.
- Owner and ratification: Engineering owns this Draft's backend authentication and authorization mechanism; only the repository owner may change it to Ratified.
- Handoff: Reference Product for access policy and Studio for authentication UX; `jrmoulckers/.github` owns repository automation, while Engineering retains runtime secret and authorization mechanisms.
- Legacy inputs: `studio-legacy:backend:4`, `studio-legacy:security:1`

## Retry-safe service degradation

- ID: ENG-API-004
- Status: Draft
- Statement: Make retryable writes idempotent and bound every service dependency with explicit timeout, backoff, rate, and degraded-result behavior.
- Rationale: Partial failure and retries are normal distributed-system conditions and must not duplicate effects or masquerade as success.
- Evidence: Repeated write fixtures produce one effect; dependency tests exercise timeout, rate limit, and unavailable states; telemetry distinguishes success, degradation, and failure.
- Owner and ratification: Engineering owns this Draft's backend retry and degradation mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable degraded outcomes, Studio owns their UI expression, and `jrmoulckers/.github` owns operational automation.
- Legacy inputs: `studio-legacy:backend:5`, `studio-legacy:backend:6`
