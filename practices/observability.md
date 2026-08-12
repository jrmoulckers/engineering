# Observability

Implements `ENG-OBS-001`–`ENG-OBS-007`. This guide adds no rules.

Observability was the largest uncovered area in this repository: all seven principles were
ratified with no technique guide, so consumers had nothing to cite and restated the rules
locally instead. Every normative sentence below traces to a principle by ID.

## One event shape (`ENG-OBS-001`)

`ENG-OBS-001` names five fields that must identify every operational signal: **component,
operation, outcome, duration, and deployment version**. The technique that makes this hold is a
single emitter that constructs the envelope, rather than a convention that each call site is
asked to remember.

```ts
type Outcome = 'success' | 'degraded' | 'failure';

interface Signal {
  component: string; // bounded: the module, not a request path
  operation: string; // bounded: a verb from a known set
  outcome: Outcome;
  duration_ms: number;
  version: string; // deployment identity, injected at build
}

export async function observe<T>(
  component: string,
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    const result = await run();
    emit({ component, operation, outcome: 'success', duration_ms: elapsed(started) });
    return result;
  } catch (error) {
    emit({ component, operation, outcome: 'failure', duration_ms: elapsed(started) });
    throw error;
  }
}
```

Three properties make this structural rather than aspirational:

1. `version` is injected once by the emitter from build metadata. A call site cannot omit it,
   and it cannot drift between components in the same deployment.
2. `duration_ms` is measured by the wrapper, so a failure path is timed as reliably as a
   success path. Hand-instrumented timing is the first thing dropped in a `catch`.
3. `outcome` is a closed union. A free-text status field is the usual reason two components in
   the same system cannot be compared.

**Bounded means bounded.** `ENG-OBS-001` requires bounded signals, and the evidence clause names
cardinality explicitly. Field _values_ are the risk, not field count: a `component` of
`user-service` is bounded, while an `operation` of `GET /users/8f2c…` is not — it produces one
distinct series per user and will exhaust a metrics backend. Put the identifier in a log
attribute, never in a metric label or a span name.

The `degraded` outcome exists because `ENG-OBS-001` requires representative operations to emit
all three. A system that only ever records success and failure cannot distinguish a served-from-
cache response from a fresh one, which is exactly the state `ENG-OBS-007` asks you to observe.

## Health without a dependency graph (`ENG-OBS-002`)

`ENG-OBS-002` asks for a signal that is **cheap, time-bounded, uncached, and free of sensitive
detail** — and that still reports which build is running.

```http
GET /healthz

HTTP/1.1 200 OK
Cache-Control: no-store
Content-Type: application/json

{ "status": "ok", "version": "1.8.2", "revision": "4c4af52" }
```

The failure mode this prevents is a health endpoint that fans out to every dependency on every
probe. Under load that turns the probe itself into the outage: probes arrive from each replica,
each one multiplies into N dependency calls, and the dependency falls over from health checks
alone. Keep liveness free of dependency calls entirely, and put dependency state behind a
separate readiness path built as in the next section.

`no-store` is not decoration. `ENG-OBS-002` requires the signal be uncached, and a proxy or CDN
that caches a 200 will report a dead replica as healthy for the life of the entry — the precise
inversion of what the endpoint exists to prove.

**Coarse state only.** `status` is one of a closed set; `revision` identifies the build. Neither
discloses topology, dependency hostnames, library versions, nor configuration. An unauthenticated
health endpoint is a reconnaissance surface, which is why the principle bounds its content rather
than only its cost.

## Three results, not two (`ENG-OBS-003`)

`ENG-OBS-003` requires dependency checks to distinguish **unconfigured, degraded, and
unavailable**, each under an operation-specific timeout and a retry or rate limit.

| Result         | Means                                        | Should it fail readiness? |
| -------------- | -------------------------------------------- | ------------------------- |
| `unconfigured` | Intentionally absent — no credential, no URL | No                        |
| `degraded`     | Reachable, but slow or partially functional  | Depends on the operation  |
| `unavailable`  | Configured and failing                       | Yes                       |

Collapsing `unconfigured` into `unavailable` is the common mistake, and it is why a working
deployment reports unhealthy: an optional connector that was never configured is not a failure,
and paging on it trains operators to ignore the signal. This is the observability face of
"never put an optional service on the critical path" in
[resilience.md](resilience.md#never-put-an-optional-service-on-the-critical-path-eng-local-004).

```ts
export async function checkDependency(dep: Dependency): Promise<CheckResult> {
  if (!dep.configured) return { name: dep.name, state: 'unconfigured' };

  // Per-operation, not one global value. A cache probe and a payment
  // provider probe have different meanings for "too slow".
  const signal = AbortSignal.timeout(dep.timeoutMs);
  try {
    const latency = await time(() => dep.probe(signal));
    return { name: dep.name, state: latency > dep.slowMs ? 'degraded' : 'ok', latency };
  } catch {
    return { name: dep.name, state: 'unavailable' };
  }
}
```

**Bound the retries, not just the call.** A timeout limits one attempt; without a rate limit the
check still amplifies. `ENG-OBS-003`'s evidence clause names rate limit, backoff, and recovery
together for that reason. Cache the readiness result for a few seconds and serve every probe in
that window from cache: probe volume then stops scaling with replica count, which is the term
that actually causes the retry storm.

The evidence clause also names **recovery**. A check that latches unhealthy and never re-tests is
worse than no check, because the system recovers and the signal does not.

## Correlation that is not identity (`ENG-OBS-004`)

`ENG-OBS-004` requires identifiers that are **unique, bounded, and unrelated to sensitive
identity**, propagated across trust and dependency boundaries.

Use [W3C Trace Context](https://www.w3.org/TR/trace-context/) (`traceparent`) rather than a
bespoke header. It is bounded by specification, every major tracing backend already reads it, and
adopting it means correlation survives a change of vendor.

**Never derive the identifier from a user, session, account, or email**, even hashed. `ENG-OBS-004`
requires it be unrelated to sensitive identity, and a hash is not anonymization: the input space
of user IDs is small enough to enumerate, so a stable hash is a pseudonym that links every trace
that user ever produced. Generate random bytes.

**Treat an inbound identifier as untrusted input.** It crosses a trust boundary, so validate the
shape and replace anything malformed with a fresh value rather than propagating it:

```ts
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

export function inboundTrace(header: string | undefined): string {
  return header && TRACEPARENT.test(header) ? header : newTraceparent();
}
```

Accepting it unvalidated lets a caller inject log-forging content, or collide every request onto
one trace ID and destroy the correlation for everyone. `ENG-OBS-004`'s evidence clause requires
that malformed identifiers be replaced _safely_ — dropping the request is not the behavior; a
bad header is a correlation problem, not a request failure.

## Redact at the producing boundary (`ENG-OBS-005`)

`ENG-OBS-005` requires redaction **before telemetry leaves the producing boundary**, not at the
collector. The boundary placement is the whole point: once a raw credential has been transmitted
to a central system it exists in that system's storage, backups, and access logs, and a
collector-side rule deletes the copy you know about.

**Allowlist, never blocklist.** A blocklist protects the fields someone remembered; a new field
added next sprint is exported by default. An allowlist fails in the safe direction:

```ts
const EXPORTED = ['component', 'operation', 'outcome', 'duration_ms', 'version'] as const;

export function toWire(signal: Record<string, unknown>) {
  return Object.fromEntries(
    EXPORTED.map((k) => [k, signal[k]]).filter(([, v]) => v !== undefined),
  );
}
```

`ENG-OBS-005` also names **adversarial fixtures** in its evidence clause. Test with a signal that
carries a password, a bearer token, and a full request body, and assert the wire form contains
none of them — asserting only that the expected fields are present passes even when the emitter
copies the entire input object.

### A cheap CI backstop

The allowlist governs the telemetry pipeline. It does not govern a developer writing
``logger.info(`token ${accessToken}`)``. A grep gate in CI catches that class before merge.
The design below comes from a product repository that has run it for months, and its two-tier
structure is what makes it adoptable:

````bash
set -uo pipefail
TERMS='password|access_token|refresh_token|api_key|apiKey|secret|credit_card|ssn'

files=$(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' '*.kt' '*.swift' \
  | grep -Ev '\.(test|spec)\.|__tests__/' || true)
[ -z "$files" ] && exit 0

# `|| true` and `-r` are load-bearing; see the note below.
printf '%s\n' "$files" | xargs -r grep -nE "(log|logger|print)[^)]*($TERMS)" \
  | grep -v 'SAFE:' > findings.txt || true

if [ -s findings.txt ]; then
  { echo '### Sensitive term near a logging call'; echo '```'; head -20 findings.txt; echo '```'; } \
    >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi
````

**The `|| true` is the part to copy carefully.** `grep` exits `1` when it matches nothing, which
here is the _success_ case. Under `pipefail` — and `set -e`, or a bare final `[ -s … ] && { … }`
list — that non-zero propagates and **the job fails on a clean repository**. The first version of
this script did exactly that; it was caught by running it against a repository with no violations,
not by reading it. Test the passing path, not only the failing one. `xargs -r` matters for the
same reason: with no input, GNU `xargs` would otherwise run `grep` with no file arguments, and it
blocks reading stdin.

**Test it under both shells, because `run:` has two and they are not the same.** GitHub's default
for `run:` on Linux is `bash -e {0}`. Adding `shell: bash` — for any reason, including an
unrelated one — silently switches you to `bash --noprofile --norc -eo pipefail {0}`. Measured, the
two modes diverge on exactly one pipeline shape:

| Pipeline                                          | `bash -e` | `bash -eo pipefail` |
| ------------------------------------------------- | --------- | ------------------- |
| Last command fails (`… \| grep -v` no match)      | exits `1` | exits `1`           |
| Early command fails, last succeeds (`… \| wc -l`) | exits `0` | **exits `1`**       |

So the hazard is **not** the trailing `grep -v` most people guard against — that one already
fails under plain `-e`. It is a pipeline ending in a command that always succeeds: `wc -l`,
`head`, `sort`, `tee`. Those look harmless, report success under the default shell, and start
failing the moment someone adds `shell: bash`. A guard covering the whole pipeline (`|| true`, or
`$( … || echo "" )`) holds under both modes; a guard on only the first command does not.

**And weight the two test directions differently.** A guardrail that goes red on a clean
repository is noticed within a day, because it blocks everyone. A guardrail that can no longer go
red is **silent forever** — nobody is inconvenienced by a check that always passes. The two
failures are not symmetric, and the usual fix for the loud one is to loosen the exit handling,
which is the shortest path to the silent one. Whenever you relax an exit condition, re-run the
violation fixture in the same change.

Four choices carry the design:

- **Only tier 2 blocks.** A gate that fails on every `console.warn` is turned off within a week.
  Emit tier 1 as `::warning::` and keep the hard failure for the case that actually leaks.
- **The extension list names several languages**, not one ecosystem. `ENG-OBS-005` binds the
  producing boundary wherever it is, so a check that only covers TypeScript leaves the mobile
  producers unchecked.
- **Escape hatches are greppable.** `// SAFE:` and `# nosec` mean every suppression can be
  enumerated in an audit. An untracked exclusion mechanism defeats the check silently.
- **Findings go to `$GITHUB_STEP_SUMMARY`**, capped, so a failure is diagnosable without opening
  raw logs.

Be honest about what this is: **grep is a backstop, not a substitute for review.** It catches
``logger.info(`user ${password}`)`` and misses the same value renamed to `p` one line earlier.
It lowers the floor; the allowlist is what actually satisfies the principle.

### Do not put this gate in a path-filtered workflow

The repository this design came from runs the blocking copy in an **always-on** workflow, and keeps
the path-filtered lint workflow's copy as the convenience one. That ordering is deliberate and it is
the detail most likely to be dropped when copying the script.

A `paths:` filter is a statement about _which changes are worth linting_. A leak gate is a statement
about _what must never merge_. Those are different questions, and the filter answers the wrong one:
a pull request that adds `logger.info(token)` to a file outside the filtered set is exactly the
change the gate exists for, and exactly the change the filter skips. The narrower the filter, the
larger the hole, and the gate reports green throughout because it never ran.

Put the blocking copy in a workflow with no `paths:` filter. If the same script also runs in a
filtered lint workflow for fast feedback, that is fine — just do not let the filtered one be the
only one.

> **Verified, and both plausible readings were right — for different mechanisms.** This was recorded
> here as unresolved because this repository has no protected branch. It has since been measured
> directly, and the outcome depends on _how_ the check does not run:
>
> | Mechanism                                   | Check run                     | Effect on a required check         |
> | ------------------------------------------- | ----------------------------- | ---------------------------------- |
> | `on.pull_request.paths` does not match      | **none created at all**       | stays pending — PR blocked forever |
> | workflow triggers, job-level `if:` is false | created, conclusion `skipped` | treated as **success**             |
>
> So a path filter on a required check blocks rather than bypasses, and a skipped _job_ passes. The
> two failure modes point in opposite directions, which is exactly why guessing between them was
> unsafe.
>
> The general pattern that follows: **trigger across the full protected scope, decide applicability
> inside the run, and gate the expensive job with `jobs.<job_id>.if`.** That keeps the check run
> present and satisfied while skipping the cost.
>
> **Do not apply that pattern to this gate.** Skip-with-success is a cost optimisation, and it is
> correct for builds and test matrices. A leak gate is a claim about what must never merge, and a
> `skipped` conclusion reporting success is precisely the silent bypass this section exists to
> prevent. The gate is a grep over changed files; it is cheap enough to simply always run. Reserve
> the `if:` pattern for the jobs whose cost actually motivates it.

**Also bound retention and audit content.** `ENG-OBS-005` requires retention follow a referenced
obligation — cite the governing policy, do not invent a number here — and requires audit signals
record **actor, action, target, and time without payload**. An audit entry that embeds the
changed record re-introduces the exposure the redaction removed.

## An SLI is a definition, not a dashboard (`ENG-OBS-006`)

`ENG-OBS-006` requires four things per indicator — **objective, window, measurement source, and
alert condition** — plus retained evidence. The measurement source is the one most often left
implicit, and the one that makes an SLO arguable during an incident.

Keep them in a versioned file, reviewed like code:

```yaml
- id: checkout-availability
  indicator: Share of checkout requests completing without a 5xx
  source: ingress_requests_total{route="/checkout"} # the query IS the definition
  objective: 99.5%
  window: 28d rolling
  alert: burn rate > 14.4x over 1h
  owner: payments
```

Four notes on the shape:

- **The query is the definition.** "Availability" without a query is unfalsifiable; two teams
  will compute it differently and both will believe they met it.
- **Name the window.** 99.5% over a day and over a quarter are different obligations, and an
  objective without a window cannot be evaluated at all.
- **Alert on burn rate, not on a threshold crossing.** A threshold alert on the objective fires
  after the budget is already gone. Burn rate fires while there is still time to act.
- **`owner` is a routing address.** An indicator nobody owns produces alerts nobody actions.

`ENG-OBS-006` also requires business metrics stay **separately owned**. Signups and revenue are
Product's obligations; mixing them into the reliability set means an SLO breach and a bad sales
week look the same on the same page.

Retain evaluation history. The principle requires evidence for release and incident review, and
a live dashboard showing the current window cannot answer whether the objective held during the
release you are investigating.

## Decide degradation in advance (`ENG-OBS-007`)

`ENG-OBS-007` sets the direction per operation class: **authentication and mutations fail
closed; only explicitly safe non-critical reads may fail soft.**

| Operation class                       | Direction     | Behavior when a dependency is down      |
| ------------------------------------- | ------------- | --------------------------------------- |
| Authentication, authorization         | Fail closed   | Deny. Never fall back to "allow"        |
| Mutations (write, delete)             | Fail closed   | Reject explicitly; never silently drop  |
| Non-critical reads, explicitly listed | May fail soft | Serve stale or empty, marked `degraded` |
| Everything else                       | Fail closed   | Default when unclassified               |

"Explicitly listed" is the operative phrase. `ENG-OBS-007` permits fail-soft only for operations
**named in advance**, so the default for anything unclassified is closed. Deciding at 3am under
incident pressure is how an authorization check acquires a permissive fallback.

The two failures the principle exists to prevent are worth naming directly:

- **Silent authority expansion.** An auth check that fails open when its dependency times out
  converts a dependency outage into an access-control breach.
- **A write that looks like a success.** Returning 200 for a mutation that was dropped is worse
  than an error: the client will not retry, and the loss is discovered later with no evidence of
  when it happened.

A fail-soft read must be **visible as degraded** — outcome `degraded` per `ENG-OBS-001`, and a
response marker so the caller can distinguish stale from fresh. A fail-soft path that reports
success is indistinguishable from a working one, which means the incident is discovered by a
user rather than by the telemetry.

Recovery must avoid **duplicate effects and retry storms**, per the principle's evidence clause.
Make retried mutations idempotent with a client-supplied key, and add jitter to backoff —
synchronized retries from every client are what turn a recovering dependency back into a failing
one.

## Verifying this guide

`ENG-OBS-003` and `ENG-OBS-007` both require tests, not assertions in prose. The minimum set:

| Principle     | Test                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `ENG-OBS-003` | Absent configuration, timeout, rate limit, backoff, and recovery to healthy     |
| `ENG-OBS-004` | A malformed inbound identifier is replaced, not propagated or rejected          |
| `ENG-OBS-005` | An adversarial fixture carrying a token produces a wire form without it         |
| `ENG-OBS-007` | Each operation class asserts its direction; a fail-soft read reports `degraded` |
