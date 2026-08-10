# Security

Implements `ENG-SEC-002`–`ENG-SEC-008`. This guide adds no rules.

`ENG-SEC-001` (secret lifecycle) is implemented in
[Go services and tools](go.md#committed-artifacts-carry-no-environment-residue-eng-sec-001).

## Supply chain (`ENG-SEC-002`)

Four separable obligations. Repositories usually satisfy the first and skip the rest.

### Install frozen, and without executing anything

```bash
npm ci --ignore-scripts   # or: pnpm install --frozen-lockfile --ignore-scripts
```

`npm ci` fails when the lockfile disagrees with `package.json`, which is what makes the chain
_locked_ rather than merely recorded. `npm install` silently rewrites the lockfile instead, so a
CI job that uses it verifies nothing.

`--ignore-scripts` is the part `ENG-SEC-002` names as **suppressing unneeded install execution**.
A `postinstall` script runs arbitrary code from every transitive dependency, before any test or
scan, with the credentials present in the job. It is the shortest path from a compromised
package to a compromised runner. Add it back only for the specific packages that genuinely need
a native build, and record why.

### Pin external actions to an immutable revision

```yaml
- uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
```

A tag is a mutable pointer: `v5` can be repointed at new code without your repository changing.
Only a full commit SHA is immutable, which is what the principle requires. Keep the version in a
trailing comment so the pin stays legible and updatable.

`.github` reusable workflow references need the same treatment. Note that Dependabot updates
SHA pins and rewrites that comment, so pinning does not mean freezing.

### Make the severity gate mean something

`ENG-SEC-002` blocks release on **exploitable** HIGH or CRITICAL findings, with the escape hatch
being **Product-owned risk acceptance** — not an engineering override. Two consequences worth
stating plainly:

- A HIGH in a dev-only dependency that never reaches a runtime path may not be exploitable. The
  determination has to be recorded, not assumed silently by whoever wanted the build green.
- Accepting a risk is Product's call because it is an outcome trade. An engineer who cannot ship
  should escalate, not add an ignore entry.

Dependency review records **necessity, provenance, vulnerabilities, licenses, and lifecycle
scripts**. Licenses and lifecycle scripts are the two most often dropped, and they are the two
that a vulnerability scanner will never tell you about.

## Threat models at boundaries (`ENG-SEC-003`)

The trigger is narrow and worth reading precisely: **before introducing or materially changing a
security boundary**. Not every PR. A boundary is where trust changes — a new external input, a
new authentication path, a new processor receiving data, a new privilege level.

Record five things:

| Element          | Question                                                 |
| ---------------- | -------------------------------------------------------- |
| Assets           | What is worth stealing or corrupting here?               |
| Entry points     | Where does untrusted input arrive?                       |
| Trust boundaries | Where does data cross from less trusted to more trusted? |
| Abuse paths      | How would an attacker use the feature as designed?       |
| Mitigations      | What stops each path, and where is the evidence?         |

The clause that makes this more than a document: **named mitigations map to tests or operational
evidence**, and **unresolved risks name an owner**. A threat model whose mitigations are prose is
a record of intent. Link each one to the test that would fail if the mitigation were removed.

"Abuse paths" means the feature working as designed, used adversarially — an export endpoint used
to enumerate, a password reset used to probe which accounts exist. Those do not show up as bugs.

## Default deny (`ENG-SEC-004`)

Default-deny is a property of the _shape_ of the code, not the diligence of its authors. If
authorization is a check each handler must remember, the first handler that forgets is
unauthenticated and nothing signals it. Put the check where forgetting is impossible — a
middleware that denies unless a route opts in, with the opt-in enumerated in one reviewable list.

The evidence clause names five test categories, and the last three are the ones usually missing:

| Category       | Asserts                                                        |
| -------------- | -------------------------------------------------------------- |
| Absent         | No credential is rejected                                      |
| Invalid        | A malformed or expired credential is rejected                  |
| Cross-tenant   | Tenant A cannot read tenant B's resource                       |
| Cross-role     | A lower-privileged role cannot perform a higher-privileged act |
| Cross-resource | A valid credential cannot reach a resource it does not own     |

Cross-tenant and cross-resource failures are the ones that reach production, because the happy
path and the logged-out path both behave correctly. The bug is a query filtered by resource ID
without also filtering by owner — authenticated, authorized in the abstract, wrong record.

**Scope and time-bound credentials.** In GitHub Actions this is concrete:

```yaml
permissions: {} # deny everything at the top level

jobs:
  build:
    permissions:
      contents: read # then grant, per job, only what the job uses
```

A workflow with no `permissions:` block inherits broad defaults, so every job carries write
authority it does not use. Declaring `{}` at the top and granting per job is the least-authority
shape.

One field note, since it costs hours the first time: **omitting a needed permission fails
unreadably.** A job missing `packages: read` reports `startup_failure` with no log output and no
message naming the permission. If a job fails with no logs at all, suspect the permissions block
before suspecting the job.

## Validate at the boundary, encode at the sink (`ENG-SEC-005`)

`ENG-SEC-005` has two halves, and satisfying only the first is the classic mistake.

**Parse, don't validate.** At each trust boundary, convert untrusted input into a typed value
whose existence proves it was checked. A boolean `isValid()` leaves the unchecked value in scope
and available to the next line.

```ts
const Order = z.object({
  quantity: z.number().int().positive().max(1000), // bounded, per the principle
  sku: z.string().regex(/^[A-Z0-9-]{1,32}$/),
});

export function parseOrder(input: unknown): Order {
  return Order.parse(input); // throws; downstream code cannot see unparsed input
}
```

Bounds are explicit in the principle. An unbounded string or array is a denial-of-service input
even when it is well-formed.

**Then encode for the exact sink.** Validation does not make a value safe _everywhere_ — safety
is a property of the destination, so a value validated once still needs the right treatment at
each context:

| Context    | Mechanism                                                                    |
| ---------- | ---------------------------------------------------------------------------- |
| SQL        | Parameterized query — never string interpolation, never an escape helper     |
| Shell      | `execFile` with an argument array; no shell string                           |
| Filesystem | Resolve, then assert the result is under the declared root                   |
| HTML       | Contextual escaping; a value safe in text is not safe in an attribute or URL |

Path handling is worth spelling out, because stripping `../` is the fix that does not work —
`....//` survives one pass, and encoded and symlinked forms bypass string checks entirely.
Resolve first, then compare:

```ts
const target = path.resolve(root, userPath);
if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('outside root');
```

The evidence clause requires **negative tests**: malformed, oversized, traversal, injection, and
unsupported input. Positive tests prove the parser accepts good input; only negative tests prove
it rejects bad input, and rejection is the security property.

## Review when the boundary moves (`ENG-SEC-006`)

The triggers are named: **authentication, input, dependency, or build** boundary changes. Reviews
are OWASP-aligned so findings use a shared vocabulary rather than each reviewer's taxonomy.

Each finding records **category, severity, exploitability, impact, owner, disposition, and
regression evidence**. Two of those carry the weight:

- **Exploitability is separate from severity.** A CRITICAL that requires authenticated admin
  access ranks differently from a MEDIUM reachable anonymously. Recording only severity produces
  a queue sorted by the wrong key.
- **Regression evidence** means a fixed finding leaves behind a test. Otherwise the same defect
  returns in the next refactor and the review has to find it again.

Dispositions are remediation **or explicit risk acceptance** — with an owner. "Won't fix" without
a name is how a finding disappears.

## Fail closed, and say nothing useful (`ENG-SEC-007`)

Three obligations, each with a distinct failure mode.

**Reject unsafe configuration before service.** Validate required configuration at boot and
refuse to start. A service that starts with a missing signing key and fails at the first
authenticated request has already accepted traffic it cannot serve safely — and in a rolling
deploy it will pass the health check and take the fleet.

```ts
const Config = z.object({
  SESSION_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
});

export const config = Config.parse(process.env); // fails at boot, not at request 1
```

**Denied operations produce no protected effect.** Ordering, not just outcome: authorize before
the side effect, not after. A handler that writes and then checks has already written, and the
error response hides that from everyone including the operator.

**Map faults once to stable errors.** A single boundary translates internal faults into a small
set of client-facing errors. Ad-hoc mapping at each call site is how stack traces reach clients.

The disclosure list in the evidence clause is broader than most implementations check —
**responses, logs, caches, and artifacts** must omit stacks, queries, internal IDs, and secrets.
Logs and caches are the ones usually forgotten. Sanitizing the response body while logging the
raw exception satisfies the visible half and leaves the payload in the log pipeline, which is
exactly what [`ENG-OBS-005`](observability.md#redact-at-the-producing-boundary-eng-obs-005)
addresses from the other side.

Internal IDs count as disclosure: sequential primary keys in errors let a caller infer volume and
enumerate records.

## Data lifecycle evidence (`ENG-SEC-008`)

The binding constraint is **"each authorized collection"** — mechanisms are implemented _from an
explicit authorized obligation_, never invented here. Engineering builds the mechanism; the
obligation to have it comes from Product and Compliance. Do not add a retention period to a
schema because it seems prudent; cite the obligation that requires it.

The inventory names nine attributes per data category:

|           |           |           |
| --------- | --------- | --------- |
| source    | category  | purpose   |
| owner     | control   | retention |
| residency | processor | evidence  |

`purpose` and `processor` are the two that make it auditable. Data collected without a stated
purpose cannot be evaluated for minimization, and an unlisted processor is an undisclosed
transfer.

Two mechanical requirements from the evidence clause:

- **Rights and consent tests use synthetic data.** Testing erasure against real records either
  destroys them or leaves real personal data in a test fixture.
- **Audit records contain actor, action, target, and time but no payload.** An audit log that
  embeds the deleted record defeats the deletion it exists to prove — the same shape as
  `ENG-OBS-005`'s audit clause, and for the same reason.

## Verifying this guide

| Principle     | Minimum evidence                                                             |
| ------------- | ---------------------------------------------------------------------------- |
| `ENG-SEC-002` | Frozen install succeeds; every `uses:` is a full SHA; review record exists   |
| `ENG-SEC-003` | Boundary changes link a model; each mitigation links a test                  |
| `ENG-SEC-004` | Absent, invalid, cross-tenant, cross-role, cross-resource all rejected       |
| `ENG-SEC-005` | Negative tests: malformed, oversized, traversal, injection, unsupported      |
| `ENG-SEC-006` | Findings record exploitability separately, and fixes leave a regression test |
| `ENG-SEC-007` | Boot rejects missing config; denied ops leave no effect; no stacks anywhere  |
| `ENG-SEC-008` | Inventory is obligation-linked; rights tests use synthetic data              |
