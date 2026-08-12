# Security and privacy

## Secret lifecycle

- ID: ENG-SEC-001
- Status: Ratified
- Statement: Keep secrets out of source, artifacts, logs, and clients; inject them at runtime, detect exposure independently, and rotate every exposed value.
- Rationale: Deleting a leaked value does not revoke copies or protect environments that accepted it.
- Evidence: Repository, artifact, client, and log scans find no secret; runtime injection is documented; exposure drills revoke and replace the value.
- Owner and ratification: Engineering owns this Draft's secret-lifecycle mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns access obligations and risk acceptance; `jrmoulckers/.github` owns repository scanners and workflow secret delivery.
- Legacy inputs: `studio-legacy:security:1`, `studio-legacy:frontend:7`

## Verified supply chain

- ID: ENG-SEC-002
- Status: Ratified
- Statement: Verify a minimal locked dependency chain, suppress unneeded install execution, pin external build actions immutably, and resolve exploitable or prohibited inputs before release.
- Rationale: Build dependencies and automation execute with the product's trust even when application code does not call them directly.
- Evidence: Frozen lockfile installation succeeds; dependency review records necessity, provenance, vulnerabilities, licenses, and lifecycle scripts; exploitable HIGH or CRITICAL findings block release until remediation or Product-owned risk acceptance; external actions use immutable revisions.
- Owner and ratification: Engineering owns this Draft's software supply-chain mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns risk acceptance and license obligations; `jrmoulckers/.github` owns platform scanners, workflow permissions, and action implementation.
- Legacy inputs: `studio-legacy:security:2`, `studio-legacy:architecture:11`, `studio-legacy:devops:6`, `studio-legacy:compliance:5`

## Boundary threat models

- ID: ENG-SEC-003
- Status: Ratified
- Statement: Record assets, entry points, trust boundaries, abuse paths, and mitigations before introducing or materially changing a security boundary.
- Rationale: Security controls cannot be reviewed coherently when the protected assets and attacker paths remain implicit.
- Evidence: Boundary changes link a reviewed threat model; named mitigations map to tests or operational evidence; unresolved risks name an owner.
- Owner and ratification: Engineering owns this Draft's threat-modeling mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns impact, obligations, and risk acceptance; Studio owns UI-specific abuse-resistant interaction, and `jrmoulckers/.github` owns GitHub-platform threat controls.
- Legacy inputs: `studio-legacy:security:3`

## Least authority

- ID: ENG-SEC-004
- Status: Ratified
- Statement: Enforce default-deny authentication and authorization with the least privilege, scope, and credential lifetime needed for each operation.
- Rationale: Broad or implicit authority turns one compromised identity or component into unrelated access.
- Evidence: Authorization tests cover absent, invalid, cross-tenant, cross-role, and cross-resource access; credentials and file permissions are scoped and time-bounded.
- Owner and ratification: Engineering owns this Draft's least-authority mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines permitted actors and actions; Studio owns access UX, and `jrmoulckers/.github` owns workflow token permissions.
- Legacy inputs: `studio-legacy:security:4`, `studio-legacy:architecture:7`, `studio-legacy:backend:4`

## Trust-boundary validation

- ID: ENG-SEC-005
- Status: Ratified
- Statement: Parse, schema-check, and bound every trust-boundary input, then parameterize or encode it for the exact storage, execution, path, or output context.
- Rationale: Untrusted data becomes dangerous when its shape, size, path, or interpretation reaches a more privileged sink.
- Evidence: Negative tests reject malformed, oversized, traversal, injection, and unsupported input; paths remain under declared roots; output tests verify context-appropriate encoding.
- Owner and ratification: Engineering owns this Draft's input-and-output validation mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns accepted domain meaning; Studio owns UI validation expression, and `jrmoulckers/.github` owns platform-input validation.
- Legacy inputs: `studio-legacy:security:5`, `studio-legacy:backend:1`, `studio-legacy:backend:2`, `studio-legacy:architecture:14`, `studio-legacy:frontend:7`

## Risk-focused security review

- ID: ENG-SEC-006
- Status: Ratified
- Statement: Run an OWASP-aligned security review when authentication, input, dependency, or build boundaries change, and track each finding through remediation or explicit risk acceptance.
- Rationale: Passing automated checks does not prove that design-level abuse paths or contextual vulnerabilities were considered.
- Evidence: Triggering changes link a review; findings record category, severity, exploitability, impact, owner, disposition, and regression evidence.
- Owner and ratification: Engineering owns this Draft's application-security review mechanism; only the repository owner may change it to Ratified.
- Handoff: Product alone accepts residual risk and owns compliance obligations; `jrmoulckers/.github` owns platform scanner execution.
- Legacy inputs: `studio-legacy:security:6`

## Secure failure

- ID: ENG-SEC-007
- Status: Ratified
- Statement: Fail closed at security decisions, reject unsafe configuration before service, and map faults once to stable errors that disclose no sensitive internals.
- Rationale: Ambiguous startup and success-shaped fallbacks can bypass controls while verbose failures leak exploitable context.
- Evidence: Boot and request tests reject missing critical configuration; denied operations produce no protected effect; responses, logs, caches, and artifacts omit stacks, queries, internal IDs, and secrets.
- Owner and ratification: Engineering owns this Draft's secure-failure mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable unavailable outcomes; Studio owns safe recovery UX, and `jrmoulckers/.github` owns automation failure presentation.
- Legacy inputs: `studio-legacy:security:7`

## Privacy-minimizing lifecycle evidence

- ID: ENG-SEC-008
- Status: Ratified
- Statement: Minimize personal data and produce auditable lifecycle evidence for each authorized collection, use, retention, export, correction, deletion, consent, and processor control.
- Rationale: Privacy mechanisms are trustworthy only when they implement an explicit obligation and prove effects across derived stores without exposing payloads.
- Evidence: An obligation-linked inventory names source, category, purpose, owner, control, retention, residency, processor, and evidence; rights and consent tests use synthetic data; audit records contain actor, action, target, and time but no payload.
- Owner and ratification: Engineering owns this Draft's privacy-minimization and lifecycle-evidence mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns legal basis, policy, retention, residency, rights, metrics, and risk acceptance; Studio owns disclosure and consent UX.
- Legacy inputs: `studio-legacy:backend:7`, `studio-legacy:compliance:1`, `studio-legacy:compliance:2`, `studio-legacy:compliance:3`, `studio-legacy:compliance:4`, `studio-legacy:compliance:6`, `studio-legacy:compliance:7`, `studio-legacy:compliance:8`
