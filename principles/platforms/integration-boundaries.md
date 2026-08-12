# Integration boundaries

## Thin typed adapters

- ID: ENG-INT-001
- Status: Ratified
- Statement: Parse external input into a typed, versioned contract and isolate provider or framework behavior behind thin single-purpose adapters.
- Rationale: External systems change independently, so their assumptions must stop at a narrow replaceable seam.
- Evidence: Contract tests cover invalid and prior-version input; middleware ordering is explicit; internal modules do not expose vendor types; adapter replacement tests preserve the contract.
- Owner and ratification: Engineering owns this integration-contract and adapter mechanism; only the repository owner may change a ratified principle.
- Handoff: Product selects integrations and outcomes, Studio owns their UI contracts, and `jrmoulckers/.github` owns GitHub-specific integrations and fleet automation.
- Legacy inputs: `studio-legacy:middleware:1`, `studio-legacy:middleware:2`, `studio-legacy:middleware:3`, `studio-legacy:security:3`, `studio-legacy:security:5`

## Explicit seam caches

- ID: ENG-INT-002
- Status: Ratified
- Statement: Make every integration cache explicit, keyed, bounded, and invalidatable without allowing it to become the source of truth.
- Rationale: Hidden or unbounded cache behavior turns temporary optimization into stale authority.
- Evidence: Cache tests cover key isolation, expiry, invalidation, misses, and upstream recovery; bypassing the cache preserves correctness.
- Owner and ratification: Engineering owns this integration-cache mechanism; only the repository owner may change a ratified principle.
- Handoff: Product defines acceptable freshness outcomes, Studio owns stale/offline UI expression, and `jrmoulckers/.github` owns cache automation used by its workflows.
- Legacy inputs: `studio-legacy:middleware:4`

## Typed retry-safe failures

- ID: ENG-INT-003
- Status: Ratified
- Statement: Propagate typed safe integration errors and make retryable seam operations idempotent with explicit degraded and failed results.
- Rationale: Boundary failures must remain actionable without leaking internals, duplicating effects, or returning success-shaped fallbacks.
- Evidence: Error mapping is exhaustive; logs and responses omit sensitive data; repeated-operation fixtures produce one effect; degradation tests distinguish success from failure.
- Owner and ratification: Engineering owns this integration error, retry, and degradation mechanism; only the repository owner may change a ratified principle.
- Handoff: Product defines acceptable degradation and Studio owns its user-facing expression; `jrmoulckers/.github` owns operational automation.
- Legacy inputs: `studio-legacy:middleware:5`, `studio-legacy:middleware:6`, `studio-legacy:security:7`

## Observable seams

- ID: ENG-INT-004
- Status: Ratified
- Statement: Observe integration latency, outcome, cache behavior, and upstream health without recording secrets or sensitive payloads.
- Rationale: A seam cannot be operated or degraded deliberately when its behavior is indistinguishable from internal work.
- Evidence: Boundary telemetry identifies the integration and typed outcome; dashboards or traces expose latency and upstream health; payload review finds no secret or sensitive body capture.
- Owner and ratification: Engineering owns this integration-observability mechanism; only the repository owner may change a ratified principle.
- Handoff: Product defines operational outcome expectations, Studio owns any status UI, and `jrmoulckers/.github` owns automation that consumes the evidence.
- Legacy inputs: `studio-legacy:middleware:7`

## Credential proxy isolation

- ID: ENG-INT-005
- Status: Ratified
- Statement: Keep third-party credentials server-side behind a narrow proxy with explicit origin and operation allowlists and no user-data persistence.
- Rationale: A constrained proxy enables browser integration without exposing credentials or becoming an undeclared backend.
- Evidence: Clients contain no provider secret; proxy tests reject unlisted origins and operations; storage inspection confirms no user-data persistence; credentials are sourced outside code.
- Owner and ratification: Engineering owns this third-party credential-proxy mechanism; only the repository owner may change a ratified principle.
- Handoff: Product selects the integration, Studio owns its UI contract, and `jrmoulckers/.github` owns deployment automation rather than the product proxy behavior.
- Legacy inputs: `studio-legacy:architecture:14`, `studio-legacy:security:1`
