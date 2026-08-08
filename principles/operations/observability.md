# Observability

## Structured operational signals

- ID: ENG-OBS-001
- Status: Draft
- Statement: Emit structured, bounded operational signals that identify the component, operation, outcome, duration, and deployment version.
- Rationale: Operators cannot compare or route unstructured events reliably across versions and components.
- Evidence: Signal schemas constrain names, types, and cardinality; representative operations emit success, degradation, and failure outcomes with version identity.
- Owner and ratification: Engineering owns this Draft's operational-signal mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns metric meaning and business outcomes; `jrmoulckers/.github` owns automation that collects or routes repository signals.
- Legacy inputs: `studio-legacy:backend:6`, `studio-legacy:backend:7`, `studio-legacy:process:6`

## Live service identity

- ID: ENG-OBS-002
- Status: Draft
- Statement: Expose a cheap, time-bounded, uncached health signal that reports service state and deployed version without sensitive detail.
- Rationale: Availability evidence must identify what is running without turning a health endpoint into a costly dependency or disclosure surface.
- Evidence: External probes receive bounded responses with version and build revision; responses use no-store semantics and expose only coarse state.
- Owner and ratification: Engineering owns this Draft's service-health and identity mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines required availability outcomes; Studio owns client-visible status UX, and `jrmoulckers/.github` owns probe automation.
- Legacy inputs: `studio-legacy:devops:9`

## Bounded dependency checks

- ID: ENG-OBS-003
- Status: Draft
- Statement: Bound dependency checks with operation-specific timeouts, retry and rate limits, and explicit unconfigured, degraded, and unavailable results.
- Rationale: Unbounded checks and retries can turn one dependency failure into exhaustion or a retry storm.
- Evidence: Tests exercise absent configuration, timeout, rate limit, backoff, and recovery; health remains bounded and distinguishes intentional absence from failure.
- Owner and ratification: Engineering owns this Draft's dependency-check mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable dependency outcomes; Studio owns their user-facing expression, and `jrmoulckers/.github` owns operational automation.
- Legacy inputs: `studio-legacy:backend:6`, `studio-legacy:devops:9`

## End-to-end correlation

- ID: ENG-OBS-004
- Status: Draft
- Statement: Correlate work across trust and dependency boundaries with propagated identifiers that are unique, bounded, and unrelated to sensitive identity.
- Rationale: A failure spanning components cannot be reconstructed when each signal describes an isolated operation.
- Evidence: Traces and logs connect ingress, internal work, and egress; missing or malformed identifiers are replaced safely; identifiers reveal no user or payload data.
- Owner and ratification: Engineering owns this Draft's operational-correlation mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns user-impact interpretation; Studio owns any support-facing presentation, and `jrmoulckers/.github` owns automation correlation for its workflows.
- Legacy inputs: `studio-legacy:backend:6`, `studio-legacy:backend:7`

## Redacted observable evidence

- ID: ENG-OBS-005
- Status: Draft
- Statement: Redact secrets and sensitive payloads before telemetry leaves the producing boundary, and retain only the minimum evidence needed to diagnose behavior.
- Rationale: Central observability multiplies exposure when producers emit raw credentials, content, or regulated data.
- Evidence: Schema allowlists and adversarial fixtures reject sensitive fields; retention follows a referenced obligation; audit signals record actor, action, target, and time without payload.
- Owner and ratification: Engineering owns this Draft's telemetry-redaction mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns permitted data, retention, and compliance policy; Studio owns disclosure UX, and `jrmoulckers/.github` owns platform log handling.
- Legacy inputs: `studio-legacy:backend:7`, `studio-legacy:security:7`, `studio-legacy:security:8`, `studio-legacy:compliance:3`

## SLO evidence

- ID: ENG-OBS-006
- Status: Draft
- Statement: Define each service-level indicator with an objective, window, measurement source, and alert condition, then retain evidence for release and incident review.
- Rationale: Operational reliability cannot be evaluated from health checks or business metrics without a stable user-impact measure and objective.
- Evidence: Each SLI and SLO has a versioned definition, query or calculation, owner, alert, and retained evaluation history; business metrics remain separately owned.
- Owner and ratification: Engineering owns this Draft's SLI, SLO, and reliability-evidence mechanism; only the repository owner may change it to Ratified.
- Handoff: Product supplies acceptable user-impact objectives and owns metrics and go/no-go decisions; `jrmoulckers/.github` owns alert and evidence automation.
- Legacy inputs: none

## Predictable degradation

- ID: ENG-OBS-007
- Status: Draft
- Statement: Define and observe degraded behavior so authentication and mutations fail closed while only explicitly safe non-critical reads may fail soft.
- Rationale: Partial failure must not silently expand authority, lose writes, or masquerade as complete success.
- Evidence: Failure-mode tests classify each operation; telemetry distinguishes healthy, degraded, and failed results; recovery avoids duplicate effects and retry storms.
- Owner and ratification: Engineering owns this Draft's graceful-degradation mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable degraded outcomes; Studio owns degraded-state UX, and `jrmoulckers/.github` owns operational automation.
- Legacy inputs: `studio-legacy:backend:6`, `studio-legacy:devops:9`
