# Browser and frontend

- ID: ENG-WEB-001
- Status: Draft
- Statement: Build browser mechanisms that protect trust seams, detect capabilities, and preserve a safe usable baseline when enhancements fail.
- Rationale: Browsers are untrusted, uneven execution environments, so optional capabilities and deployments must not compromise data, security, or core operation.
- Evidence: No deployable client contains secrets; boundary inputs are validated and safely rendered; capability tests cover unavailable APIs; performance budgets are measured; update tests preserve durable state and do not replace assets under a running session.
- Owner and ratification: Engineering owns this Draft's browser and frontend mechanisms; the repository owner alone may ratify it.
- Handoff: [Studio](https://github.com/jrmoulckers/studio/tree/efe6aa3/principles) owns themes, components, visual behavior, accessibility UX, and user-facing update/error expression; Product defines outcome obligations; `jrmoulckers/.github` owns deployment automation.
- Legacy inputs: `studio-legacy:architecture:13`, `studio-legacy:frontend:2`, `studio-legacy:frontend:5`, `studio-legacy:frontend:6`, `studio-legacy:frontend:7`, `studio-legacy:frontend:8`, `studio-legacy:frontend:9`, `studio-legacy:performance:2.2`, `studio-legacy:performance:6`, `studio-legacy:performance:6.1`, `studio-legacy:security:1`

## Rule

- Treat browser code and rendered input as a trust boundary: ship no secrets, constrain executable sources, and validate or encode untrusted content.
- Detect optional browser capabilities before use and degrade to a safe baseline without making core work depend on an enhancement.
- Keep consumption seams runtime-neutral where practical and enforce separate client-size and runtime-responsiveness budgets.
- Prioritize foreground interaction over background work; give fallible operations timeouts and a technical signal that distinguishes progress from a stuck state.
- Make application updates atomic from the running session's perspective; commit durable state before activating replacement assets.
- Expose technical loading, empty, failure, and update states through contracts that Studio can express without Engineering prescribing their UI.
