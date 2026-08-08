# API and backend

- ID: ENG-API-001
- Status: Draft
- Statement: Enforce typed, versioned, authorized, and retry-safe service contracts at every API boundary.
- Rationale: Explicit service behavior contains failures, prevents confused trust, and lets clients and servers evolve independently.
- Evidence: Contract tests validate accepted and rejected payloads; breaking changes use a declared version; authorization is checked server-side; write retries are idempotent; typed errors, timeouts, rate limits, and service-level telemetry are exercised.
- Owner and ratification: Engineering owns this Draft's API and backend mechanisms; the repository owner alone may ratify it.
- Handoff: Product defines service outcomes and policy obligations, Studio owns client-facing states and recovery UX, and `jrmoulckers/.github` owns deployment and release automation.
- Legacy inputs: `studio-legacy:backend:1`, `studio-legacy:backend:4`, `studio-legacy:backend:5`, `studio-legacy:backend:6`, `studio-legacy:security:1`, `studio-legacy:security:4.1`, `studio-legacy:security:5`, `studio-legacy:security:7`

## Rule

- Specify request, response, and error contracts with types and versions; prefer additive evolution and reject unknown restore or import formats.
- Parse and validate at the trust boundary, return structured safe errors, and map typed results exhaustively.
- Source secrets outside code. Authenticate and authorize on the server with default-deny decisions; machine-triggered endpoints must fail closed when required credentials are absent.
- Give state-changing operations idempotency semantics wherever retries can occur.
- Bound dependencies with timeouts, backoff, rate limits, health evidence, and an explicit degraded or failed response rather than an ambiguous success; omit secrets and internals from errors and logs.
