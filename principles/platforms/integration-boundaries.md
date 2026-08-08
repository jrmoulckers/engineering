# Integration boundaries

- ID: ENG-INT-001
- Status: Draft
- Statement: Keep integration seams thin, typed, observable, and replaceable while containing vendor, cache, credential, and failure behavior.
- Rationale: External systems change independently and fail unevenly, so a narrow adapter boundary prevents their assumptions from spreading through the system.
- Evidence: Boundary contract tests cover parsing, versions, errors, retries, and degradation; middleware has one ordered purpose; adapters isolate vendor types; cache keys and invalidation are explicit; telemetry excludes secrets and sensitive payloads.
- Owner and ratification: Engineering owns this Draft's integration, middleware, adapter, and cache mechanisms; the repository owner alone may ratify it.
- Handoff: Product defines which integrations and degraded outcomes are acceptable, Studio owns their UI expression, and `jrmoulckers/.github` owns GitHub integrations, fleet sync, automation, and distribution.
- Legacy inputs: `studio-legacy:architecture:14`, `studio-legacy:middleware:1`, `studio-legacy:middleware:2`, `studio-legacy:middleware:3`, `studio-legacy:middleware:4`, `studio-legacy:middleware:5`, `studio-legacy:middleware:6`, `studio-legacy:middleware:7`, `studio-legacy:security:1`, `studio-legacy:security:3`, `studio-legacy:security:5`, `studio-legacy:security:7`

## Rule

- Parse untrusted input into a typed, deliberately versioned boundary contract before internal use.
- Compose middleware as ordered, single-purpose steps; isolate provider and framework details behind replaceable adapters.
- Make caches explicit, keyed, bounded, and invalidatable; never let a cache silently become the source of truth.
- Propagate typed safe errors, make retries idempotent, and distinguish bounded degradation from failure instead of returning success-shaped fallbacks.
- Observe boundary latency, status, cache behavior, and upstream health without recording secrets or sensitive payloads.
- Source third-party credentials outside code and keep them server-side behind a narrow proxy with explicit origin and operation allowlists; do not turn that proxy into a user-data store.
