# Performance budgets

Implements `ENG-WEB-003`, `ENG-PERF-001`, `ENG-PERF-002`, `ENG-PERF-005`– `ENG-PERF-008`, and
`ENG-TEST-004`. This guide adds no rules.

`ENG-PERF-003` (minimal package surface), `ENG-PERF-004` (correctness-preserving caches), and
`ENG-PERF-009` (assurance precedence) are **ratified but not yet implemented by any technique
guide**. They are obligations without a recipe; until one exists, satisfy them by recorded
judgment rather than by citing this file.

## Two budgets, not one (`ENG-WEB-003`)

`ENG-WEB-003` requires **separate delivery and runtime budgets**. A bundle-size gate alone
satisfies half the principle: a small bundle can still block the main thread, and a repository
that measures only kilobytes has no signal for the half that users actually feel.

| Budget   | Measures                               | Enforced by                               |
| -------- | -------------------------------------- | ----------------------------------------- |
| Delivery | Transferred bytes per route            | Bundle-size gate in CI                    |
| Runtime  | Interaction responsiveness, long tasks | Lighthouse or an equivalent runtime probe |

## Delivery budget

Set it per route, not only for the whole application — a single heavy route is invisible in an
aggregate total. Current baselines in use:

| Application shape                               | Budget  |
| ----------------------------------------------- | ------- |
| Offline-capable PWA with local storage and sync | 2048 KB |
| Web client with a server backend                | 1536 KB |

These are **starting points, not targets to grow into**. Raising a budget is a decision that
needs a recorded reason; a budget that only ever ratchets upward is a budget in name only.

## Runtime budget

Foreground interaction outranks background work (`ENG-WEB-003`). Background tasks — sync,
indexing, prefetch — yield under foreground load rather than competing with it.

Every fallible operation carries a timeout and a progress signal. Without both, a slow path and
a hung path are indistinguishable to the user and to the operator.

## Profile with the platform-native tool (`ENG-PERF-007`)

`ENG-PERF-001` says measure before optimizing; `ENG-PERF-007` says **which instrument**, and it
is deliberately not "whatever the web guide suggests". A wall-clock timer around a suspect
function attributes cost to the function you already suspected, which is why the principle asks
for a profiler and a reproducible recipe instead.

Use the profiler that ships with the platform. A cross-platform wrapper reports its own overhead
as application cost:

| Stack             | Tool                                                                    | Capture                                         |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| Web (main thread) | Chrome DevTools Performance                                             | Record interaction, export the `.json` trace    |
| Node              | Built-in `node --cpu-prof`, or `--heap-prof` for allocation             | Load the `.cpuprofile` in DevTools              |
| Go                | `pprof` (`go test -cpuprofile`, or `net/http/pprof` for a live service) | `go tool pprof -http=: cpu.prof`                |
| JVM / Kotlin      | Async-profiler, or JFR for a long-running service                       | Flame graph from the `.jfr` or collapsed stacks |
| Android           | Android Studio CPU Profiler (system trace for jank)                     | Perfetto trace                                  |
| Apple platforms   | Instruments — Time Profiler, Allocations for memory                     | `.trace` bundle                                 |

**Record a recipe, not a conclusion.** `ENG-PERF-007`'s evidence clause is the demanding half: a
profile is only useful later if someone else can re-capture it. Retain the workload, tool and
version, platform, revision, capture settings, and the attributed hot path — then confirm the
fix with the _same_ recipe. A before-profile captured under a different workload than the
after-profile measures the workload change, not the code change.

Profile a **release-shaped** build. Debug builds and development servers carry instrumentation,
disabled optimization, and unminified code, so their hot paths are frequently not the shipped
ones.

## Route regressions before rebudgeting (`ENG-PERF-008`)

When a budget goes red, the ordering is fixed: **reproduce, quantify, bisect, route** — and only
then discuss the budget. Raising the number first ends the alert while keeping the regression.

- **Reproduce** on a known-good revision too. A regression that will not reproduce is a
  measurement-environment finding, and chasing it as a code defect wastes the profile.
- **Quantify** in the unit the budget is written in, with the same method that produced the
  baseline.
- **Bisect** to a revision. CI history usually beats `git bisect` here, since the budget gate
  already ran on every commit.
- **Route** to the boundary that owns the code, not to whoever caught it.

A budget change is a recorded decision with the triage attached (`ENG-PERF-002`). "The budget
was tight" is a conclusion, not evidence.

## Measure before optimizing (`ENG-PERF-001`)

Record a baseline, change one thing, re-measure with the same method. An optimization with no
before-measurement cannot be shown to have worked, and is just as likely to have cost complexity
for nothing.

## Budget failures are build failures (`ENG-TEST-004`)

A budget that reports without blocking is documentation. It gates the merge, or it does not
exist.

The gate belongs in CI, which `jrmoulckers/.github` owns and implements. Engineering owns the
budget values and the measurement method; the workflow wiring is `.github`'s.
