# Performance

## Reproducible measurements

- ID: ENG-PERF-001
- Status: Draft
- Statement: Measure every performance claim with a reproducible command, controlled environment, declared cold or warm state, baseline, and before-and-after delta.
- Rationale: Uncontrolled observations cannot distinguish an implementation effect from cache, hardware, network, or workload variance.
- Evidence: Results record command, revision, platform, workload, state, repetitions, summary statistic, baseline, and delta.
- Owner and ratification: Engineering owns this Draft's performance-measurement mechanism; only the repository owner may change it to Ratified.
- Handoff: Product supplies business and experience priorities; Studio supplies UI-specific measurement scenarios, and `jrmoulckers/.github` owns benchmark automation.
- Legacy inputs: `studio-legacy:performance:1`

## Versioned performance budgets

- ID: ENG-PERF-002
- Status: Draft
- Statement: Define versioned, owned, method-specific performance budgets and review them when architecture or target platforms materially change.
- Rationale: A threshold without scope, ownership, and measurement method cannot govern regressions consistently.
- Evidence: Each budget names metric, workload, platform, method, threshold, owner, version, and review trigger; deterministic signals block while unstable lab signals remain advisory.
- Owner and ratification: Engineering owns this Draft's generic performance-budget mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns experience and business thresholds; Studio owns UI-specific budgets, and `jrmoulckers/.github` implements gates.
- Legacy inputs: `studio-legacy:performance:2`

## Minimal package surface

- ID: ENG-PERF-003
- Status: Draft
- Statement: Budget package, export, and dependency cost while preserving minimal tree-shakeable entry points.
- Rationale: Consumers should not pay delivery or initialization cost for unrelated capabilities.
- Evidence: Package and route analyses attribute bytes and dependencies to entry points; unused exports are removable; regressions identify the introducing change.
- Owner and ratification: Engineering owns this Draft's generic package-surface mechanism; only the repository owner may change it to Ratified.
- Handoff: Product prioritizes capability tradeoffs; Studio owns design-package surfaces, and `jrmoulckers/.github` owns package distribution.
- Legacy inputs: `studio-legacy:performance:3`

## Correctness-preserving caches

- ID: ENG-PERF-004
- Status: Draft
- Statement: Use content-addressed bounded caches only to accelerate deterministic work, and preserve correctness and diagnosability on miss, staleness, or bypass.
- Rationale: A cache is an optimization, not an authority or substitute for verification.
- Evidence: Keys include all declared inputs; hit, miss, stale, invalidation, and bypass tests produce correct results; telemetry distinguishes cache outcomes.
- Owner and ratification: Engineering owns this Draft's cache-correctness mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns acceptable freshness; Studio owns stale-state UX, and `jrmoulckers/.github` owns workflow-cache implementation.
- Legacy inputs: `studio-legacy:performance:4`, `studio-legacy:devops:4`

## Foreground responsiveness

- ID: ENG-PERF-005
- Status: Draft
- Statement: Prefer foreground responsiveness over background throughput and make background work yield under active demand.
- Rationale: Aggregate throughput is not useful when current interaction becomes blocked or unpredictable.
- Evidence: Concurrent-load tests bound foreground latency; schedulers yield or prioritize foreground work; background throughput remains observable.
- Owner and ratification: Engineering owns this Draft's responsiveness mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines critical interactions; Studio owns perceived-performance expression, and `jrmoulckers/.github` owns automated load execution.
- Legacy inputs: `studio-legacy:performance:6`, `studio-legacy:frontend:6`

## Bounded fallible work

- ID: ENG-PERF-006
- Status: Draft
- Statement: Bound long or fallible operations with explicit progress, timeout, cancellation or failure, and a signal that distinguishes progressing from stuck.
- Rationale: Unbounded work consumes resources and leaves callers unable to decide whether to wait, retry, or recover.
- Evidence: Timeout and cancellation tests terminate work; progress advances monotonically or reports an explicit indeterminate state; stuck detection is exercised.
- Owner and ratification: Engineering owns this Draft's time-bounding mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable completion windows; Studio owns progress and recovery UX, and `jrmoulckers/.github` owns automation timeouts.
- Legacy inputs: `studio-legacy:performance:6`, `studio-legacy:frontend:5`, `studio-legacy:backend:6`

## Platform-native profiling

- ID: ENG-PERF-007
- Status: Draft
- Statement: Profile suspected bottlenecks with the platform-native tool and record a recipe that another engineer can reproduce.
- Rationale: Optimization without attributed runtime evidence often moves cost or treats a symptom rather than its cause.
- Evidence: Profiles retain workload, tool, platform, revision, capture settings, and attributed hot path; the same recipe confirms the change.
- Owner and ratification: Engineering owns this Draft's profiling mechanism; only the repository owner may change it to Ratified.
- Handoff: Product supplies impact priority; Studio owns UI-platform profiling specialization, and `jrmoulckers/.github` owns retained automation artifacts.
- Legacy inputs: `studio-legacy:performance:7`

## Quantified regression triage

- ID: ENG-PERF-008
- Status: Draft
- Statement: Reproduce, quantify, bisect, and route every material performance regression to the owning boundary before changing its budget.
- Rationale: Moving a threshold hides regressions when the cause and accountable component remain unknown.
- Evidence: Triage records baseline, magnitude, first bad revision or bounded range, owner, disposition, and confirming measurement.
- Owner and ratification: Engineering owns this Draft's performance-regression triage mechanism; only the repository owner may change it to Ratified.
- Handoff: Product owns priority and accepted impact; Studio owns UI-specific regressions, and `jrmoulckers/.github` owns bisect and benchmark automation.
- Legacy inputs: `studio-legacy:performance:8`

## Assurance precedence

- ID: ENG-PERF-009
- Status: Draft
- Statement: Reject performance changes that weaken correctness, accessibility, privacy, or security.
- Rationale: Faster incorrect or exclusionary behavior is a regression, not an optimization.
- Evidence: Optimization reviews assess each precedence property; tests show preserved behavior; exceptions are not accepted as performance tradeoffs.
- Owner and ratification: Engineering owns this Draft's performance-precedence mechanism for correctness, privacy, and security; only the repository owner may change it to Ratified.
- Handoff: Studio owns accessibility and UI evidence; Product owns outcome obligations and risk acceptance, while Engineering does not waive either authority's requirements.
- Legacy inputs: `studio-legacy:performance:9`
