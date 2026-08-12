# Browser and frontend

## Browser trust seam

- ID: ENG-WEB-001
- Status: Ratified
- Statement: Treat browser code, rendered input, and client-visible configuration as an untrusted seam.
- Rationale: Anything delivered to or accepted by a browser can be inspected, modified, or replayed.
- Evidence: Deployable clients contain no secrets; executable sources are constrained; untrusted content is validated or encoded; browser security tests exercise the seam.
- Owner and ratification: Engineering owns this Draft's browser-security mechanism; only the repository owner may change it to Ratified.
- Handoff: Reference Studio for safe visual and interaction expression, Product for security obligations, and `jrmoulckers/.github` for deployment automation.
- Legacy inputs: `studio-legacy:frontend:7`, `studio-legacy:security:1`

## Capability-safe enhancement

- ID: ENG-WEB-002
- Status: Ratified
- Statement: Detect optional browser capabilities before use and preserve a safe operational baseline when they are absent or fail.
- Rationale: Browser support, permissions, and runtime resources vary independently of application intent.
- Evidence: Capability tests disable each optional API; core paths still complete; enhancement failures do not corrupt durable state or block unrelated work.
- Owner and ratification: Engineering owns this Draft's browser capability and degradation mechanism; only the repository owner may change it to Ratified.
- Handoff: Studio owns the accessibility, visual, and user-facing expression of baseline and enhanced states; Product defines which core outcomes must remain available.
- Legacy inputs: `studio-legacy:architecture:13`, `studio-legacy:frontend:8`
- Legacy input scope: `studio-legacy:architecture:13` contributes capability-safe baseline mechanics only; Studio retains reduced-motion, contrast, and other accessibility expression.

## Measured foreground performance

- ID: ENG-WEB-003
- Status: Ratified
- Statement: Enforce separate delivery and runtime budgets while prioritizing foreground interaction over background work.
- Rationale: A small bundle can still run poorly, and background work must not leave active interaction unknown or stuck.
- Evidence: Per-route size and runtime responsiveness are measured independently; fallible operations have timeouts and progress signals; background work yields under foreground load.
- Owner and ratification: Engineering owns this Draft's browser-performance mechanism; only the repository owner may change it to Ratified.
- Handoff: Product sets outcome thresholds and Studio owns perceived-performance and progress UX; Engineering measures the mechanism without defining those experiences.
- Legacy inputs: `studio-legacy:frontend:6`, `studio-legacy:performance:2`, `studio-legacy:performance:6`

## Session-safe frontend state

- ID: ENG-WEB-004
- Status: Ratified
- Statement: Expose typed frontend states and activate application updates only at a boundary that cannot replace assets beneath a running session.
- Rationale: Explicit states and atomic activation prevent ambiguous UI behavior and mixed-version execution.
- Evidence: Contracts enumerate loading, empty, failure, and update states; update tests commit durable state before activation and keep a running session on one asset version.
- Owner and ratification: Engineering owns this Draft's frontend-state and update-safety mechanism; only the repository owner may change it to Ratified.
- Handoff: Reference Studio for the visual, accessibility, wording, and user-choice contracts applied to these states; `jrmoulckers/.github` owns deployment automation.
- Legacy inputs: `studio-legacy:frontend:2`, `studio-legacy:frontend:5`, `studio-legacy:frontend:9`
