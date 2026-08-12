# Performance budgets

Implements `ENG-WEB-003`, `ENG-PERF-001`, `ENG-PERF-002`, `ENG-PERF-005`, `ENG-PERF-007`,
`ENG-PERF-008`, and `ENG-TEST-004`. This guide adds no rules.

`ENG-PERF-003` (minimal package surface), `ENG-PERF-004` (correctness-preserving caches),
`ENG-PERF-006`, and `ENG-PERF-009` (assurance precedence) are **ratified but not yet implemented
by any technique guide**. They are obligations without a recipe; until one exists, satisfy them by
recorded judgment rather than by citing this file.

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

## Runtime budget (`ENG-PERF-005`)

Foreground interaction outranks background work (`ENG-PERF-005`, `ENG-WEB-003`). Background
tasks — sync, indexing, prefetch — yield under foreground load rather than competing with it.

Every fallible operation carries a timeout and a progress signal. Without both, a slow path and
a hung path are indistinguishable to the user and to the operator.

## Profile with the platform-native tool (`ENG-PERF-007`)

`ENG-PERF-001` says measure before optimizing; `ENG-PERF-007` says **which instrument**, and it
is deliberately not "whatever the web guide suggests". A wall-clock timer around a suspect
function attributes cost to the function you already suspected, which is why the principle asks
for a profiler and a reproducible recipe instead.

Use the profiler that ships with the platform. A cross-platform wrapper reports its own overhead
as application cost. Every stack needs **both** columns: a lab profiler to attribute cost, and a
field channel to know the cost is real.

| Stack             | Lab profiler                                                            | Capture                                         | Field channel                                          |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Web (main thread) | Chrome DevTools Performance                                             | Record interaction, export the `.json` trace    | RUM via `web-vitals`; CrUX for field percentiles       |
| Node              | Built-in `node --cpu-prof`, or `--heap-prof` for allocation             | Load the `.cpuprofile` in DevTools              | Event-loop and GC metrics exported continuously        |
| Go                | `pprof` (`go test -cpuprofile`, or `net/http/pprof` for a live service) | `go tool pprof -http=: cpu.prof`                | `runtime/metrics` scraped from the running service     |
| JVM / Kotlin      | Async-profiler, or JFR for a long-running service                       | Flame graph from the `.jfr` or collapsed stacks | JFR left recording in production, sampled continuously |
| Android           | Android Studio CPU Profiler (system trace for jank)                     | Perfetto trace                                  | Play vitals and `JankStats` from real installs         |
| Apple platforms   | Instruments — Time Profiler, Allocations for memory                     | `.trace` bundle                                 | MetricKit `MXMetricPayload` from shipping builds       |

**The field column is part of the instrument choice, not a later concern.** A lab-only setup
satisfies the letter of `ENG-PERF-007` while missing the regressions it exists to catch, because
the regression that matters is the one that appears only on hardware nobody develops on. The lab
answers _why_; the field answers _whether_, and _for whom_. Gating on a profile produces a check
that fails on an unrelated machine — a profile is a diagnosis, never a threshold. Diagnosing from
field metrics produces a guess — a p95 says a regression exists and who it reached, not which call
is responsible. A blank in that column is a visible gap; [Native profiling](native-profiling.md)
develops the split for stacks where lab and field differ in hardware rather than in load.

**Record a recipe, not a conclusion.** `ENG-PERF-007`'s evidence clause is the demanding half: a
profile is only useful later if someone else can re-capture it. Retain the workload, tool and
version, platform, revision, capture settings, and the attributed hot path — then confirm the
fix with the _same_ recipe. A before-profile captured under a different workload than the
after-profile measures the workload change, not the code change.

Profile a **release-shaped** build. Debug builds and development servers carry instrumentation,
disabled optimization, and unminified code, so their hot paths are frequently not the shipped
ones.

### Know the floor of your instrument (`ENG-PERF-001`, `ENG-PERF-008`)

Every sampling profiler in the table above — `pprof`, `node --cpu-prof`, async-profiler, the
Android Studio CPU profiler in sampled mode — resolves nothing below its sampling interval. Work
that is individually short and collectively expensive is exactly the shape this misses, and **it
does not appear as a small number**. It appears as absence, or as time attributed to a caller.

That inverts the usual reading of a profile. If a hot path is suspected and the profile is flat,
that is a signal to change instrument — tracing or instrumentation mode — not a finding that the
path is cheap. A flat profile is evidence about the instrument at least as often as it is
evidence about the code, and `ENG-PERF-008`'s reproduce-then-quantify ordering is what stops a
null result being promoted to a conclusion.

**Record which mode produced the capture**, alongside the rest of the recipe. A sampled and a
traced profile of the same workload are not comparable, and mixing them across a
before-and-after reads as a regression that no code change caused.

**On native platforms, this section is not enough on its own.** The table above names the
instrument, but a profiler cannot fail a build and a CI benchmark cannot explain a regression —
they are separate tools with separate outputs, which is invisible on the web because one command
supplies both. See [Native profiling](native-profiling.md) for the profile-versus-benchmark split,
the lab-versus-field channels that `ENG-PERF-008` depends on, and why a native budget has to name
its baseline device.

## Route regressions before rebudgeting (`ENG-PERF-008`, `ENG-PERF-002`)

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
