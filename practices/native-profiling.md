# Native profiling

Implements `ENG-PERF-007`, and the native halves of `ENG-PERF-001`, `ENG-PERF-002`,
`ENG-PERF-008`, and `ENG-OBS-004`. This guide adds no rules.

[Performance budgets](performance-budgets.md) already names the platform-native profiler for each
stack and requires a reproducible recipe. This guide is the part that does not transfer from the
web: **on native, the tool that measures cannot be the tool that gates, and the tool that runs in
CI cannot tell you why.**

> **The premise this guide was written against was half right, and the correction is worth
> keeping.** A consumer reported that the budgets guide is "Lighthouse-shaped" and that
> `ENG-PERF-007` therefore had "no executable path behind it". The first half is a real finding and
> the rest of this guide is theirs. The second half is not: that guide already carries a
> per-platform tool table naming Android Studio's CPU Profiler, Instruments, `pprof`, JFR and
> async-profiler, and already requires release-shaped builds. The gap was never that no native tool
> was named — it was that **three separable things were collapsed into one**, which is invisible
> while you are on the web and load-bearing the moment you leave it.

## One tool on the web is three tools everywhere else

Lighthouse conflates the **harness** that drives the app to a measurable state, the **metric** that
comes out, and the **gate** that fails the build. A practice written against it never has to name
them separately, because one command gives you all three. On every native platform they are three
different tools, and guidance that does not separate them is not actionable.

## Lab and field are different instruments, and you need both (`ENG-PERF-001`, `ENG-PERF-008`)

| Platform      | Lab — reproducible, pre-merge                            | Field — distributional, post-release      |
| ------------- | -------------------------------------------------------- | ----------------------------------------- |
| Android       | Studio Profiler, System Trace                            | Play Vitals, custom metrics collector     |
| Apple         | Instruments — Time Profiler, Allocations, Core Animation | MetricKit, `MXAppLaunchMetric` histograms |
| Windows / JVM | JFR, VisualVM, Windows Performance Analyzer              | custom metrics collector                  |
| Web           | DevTools Performance panel                               | RUM, `PerformanceObserver`                |

`ENG-PERF-001` asks for a reproducible command, a controlled environment, and a declared cold or
warm state. Only the **lab** channel can supply that. `ENG-PERF-008` asks you to reproduce and
quantify a material regression before rebudgeting, and a P95 across real devices **is not
reproducible by construction** — that is the **field** channel, and nothing in the lab substitutes
for it.

Web hides the split because Lighthouse plus RUM covers both without either being named. The
consequence on native is specific and worth stating: **a repository that instruments only the lab
channel will believe it satisfies `ENG-PERF-008` and will not.** Both channels, or say which
obligation you are not meeting.

## Profile release builds on named baseline hardware (`ENG-PERF-002`)

Debug builds mislead on every native platform, each for its own reason: Android debug skips R8
shrinking and runs more interpreted, Apple Debug disables optimization and keeps assertions live, a
JVM debug run has an unwarmed JIT. These are not merely noisy — they are wrong in a _direction_,
flattering some code and damning other code.

- **Release configuration only** for any number that reaches a budget.
- **Name the baseline device in the budget itself.** On the web, throttling is a property of the
  tool. On native, the device is a property of the **budget**, and a native budget without one is
  unfalsifiable — any result can be defended by asserting different hardware.

`ENG-PERF-002` asks for versioned, method-specific budgets. **On native the device is part of the
method**, and a hardware change is one of the material changes that triggers review.

Naming the device is necessary but not sufficient, because the same device is not the same
instrument twice. Three variables belong in the recipe `ENG-PERF-007` asks you to retain, and
each one silently invalidates it when omitted:

- **Device tier.** Profile the lowest supported tier, not the development machine. A flagship
  hides the regression the budget exists to catch — and it is the device the engineer writing
  the profile is holding, so this omission is the default rather than the exception.
- **Thermal and power state.** Sustained load throttles. The same capture run twice in
  succession can differ by more than the regression under investigation. Record the state and
  let the device settle between runs.
- **Emulator versus hardware.** An emulator runs a different CPU and a fundamentally different
  GPU path. It is a correctness environment, not a performance one.

Cold-versus-warm state is already mandated by `ENG-PERF-001` and is not repeated here.

## Profile to diagnose, benchmark to gate (`ENG-PERF-007`)

This is the executable content, and the piece the budgets guide is missing. Native profilers are
interactive, attach to a running process, and emit traces for a human to read. **None of them can
fail a build.**

| Platform         | Interactive profiler — diagnosis | CI harness — gate                                                                        |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| Android          | Studio Profiler                  | Jetpack Macrobenchmark — `StartupBenchmark`, `StartupMode.COLD`, P50/P95 over iterations |
| Apple            | Instruments                      | XCTest performance metrics — `XCTApplicationLaunchMetric`                                |
| JVM / Windows    | VisualVM, JFR                    | JMH-style benchmark task                                                                 |
| KMP shared logic | —                                | `jvmTest` benchmark suites over the common source set                                    |

A repository that owns only profilers has **no regression protection**, however carefully it
profiles. A repository that owns only benchmarks can detect a regression but not explain it.
`ENG-PERF-007` needs both, and its evidence clause — workload, tool, platform, revision, capture
settings, attributed hot path — is discharged by the profiler, not by the gate.

**The KMP row carries more weight than its size suggests.** Shared business logic can be gated on
the JVM, cheaply, in ordinary CI, with no device and no emulator. For a multiplatform repository
that is the highest value-per-effort performance gate available, and it is the one most often left
unbuilt because the platform-specific gates look like the real work.

## Correlate traces with the observability seam (`ENG-OBS-004`)

Every native platform provides a way to annotate a trace with an application-level operation:
`os_signpost` on Apple, `Trace.beginSection` on Android, custom JFR events on the JVM. **Use the
same operation names as the structured logs.**

`ENG-OBS-004` asks for propagated identifiers that correlate work across boundaries, and the
profiler boundary is where correlation is routinely lost: the trace says `40 ms in
NumberFormatter.init`, the logs say `dashboard loaded`, and nothing joins them. A worked example
from the consumer's own iOS audit — the finding was a `NumberFormatter` allocation inside a
scrolling cell, and the signpost bracketing `Dashboard Load` is what made it **attributable**
rather than merely visible.

## Handoffs

| Principle      | Section                                      |
| -------------- | -------------------------------------------- |
| `ENG-PERF-001` | Lab and field — the lab channel              |
| `ENG-PERF-002` | Release builds and named baseline hardware   |
| `ENG-PERF-007` | Profile to diagnose, benchmark to gate       |
| `ENG-PERF-008` | Lab and field — the field channel            |
| `ENG-OBS-004`  | Correlate traces with the observability seam |
