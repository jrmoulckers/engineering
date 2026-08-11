# API and backend services

Implements `ENG-API-002`, `ENG-API-003`, `ENG-API-004`, and `ENG-INT-005`. This guide adds no
rules.

`ENG-API-001` (typed versioned contracts) is implemented in
[Go services and tools](go.md#contracts-eng-arch-002-eng-api-001). Authorization technique that is
not backend-specific — the default-deny router shape, the five credential test categories, and
boot-time configuration rejection — lives in [Security](security.md) under `ENG-SEC-004` and
`ENG-SEC-007`. This guide covers what those leave open at a service boundary.

## Name the store owner before the query (`ENG-API-002`)

`ENG-API-002` requires service code to name its store owner and data contract. The practical form
is a module that owns a table and is the only thing permitted to write it, with every other
caller reaching it through exported functions rather than through the query builder.

The reason it is worth the indirection is not layering aesthetics. It is that migration safety in
the next section is only checkable if the set of statements that touch a table is enumerable. A
repository where any handler may issue any query has no answer to "what breaks if this column
changes", and no amount of testing recovers it.

```ts
// orders/store.ts — the only module that writes `orders`.
export async function recordOrder(order: Order): Promise<OrderId> { ... }
export async function findOrder(id: OrderId): Promise<Order | undefined> { ... }
```

Access is typed and parameterized, which is the same obligation
[`ENG-SEC-005`](security.md#validate-at-the-boundary-encode-at-the-sink-eng-sec-005) places on the
SQL sink. Parameterization here is not a second rule; it is the same one, seen from the service
side.

## Forward-safe means both versions run at once (`ENG-API-002`)

The clause that carries the weight is that **old and new service versions tolerate the migration
sequence**. During any rolling deploy both versions serve traffic simultaneously, so a migration is
forward-safe only if the schema is compatible with the code on either side of it.

That rules out the single-step rename, which is the change most likely to be attempted:

| Step          | Schema change                   | Safe because                                     |
| ------------- | ------------------------------- | ------------------------------------------------ |
| 1. Expand     | Add the new column, nullable    | Old code ignores it; new code tolerates null     |
| 2. Backfill   | Populate it from the old column | No reader depends on it yet                      |
| 3. Dual-write | New code writes both            | Either version can serve any row                 |
| 4. Migrate    | Readers move to the new column  | Old column is still populated, so rollback works |
| 5. Contract   | Drop the old column, later      | No deployed version reads it                     |

Steps 4 and 5 must land in **separate releases**. Combining them is what makes a rollback
impossible: the moment the old column is gone, the previous artifact cannot serve, and
`ENG-BUILD-008` (rollback-compatible releases) is violated by a change that never touched the
release pipeline.

The evidence clause asks for a deployment test, not an argument. The cheap version runs the
**previous** service version's test suite against the **migrated** schema:

```bash
git stash && git checkout "$(git describe --tags --abbrev=0)"
npm test -- --grep 'store'   # previous artifact, new schema
```

A pass means the expand step is genuinely additive. A failure at this point costs a code review;
the same failure after deploy costs an outage during the window when both versions are live.

## Credentials come from configuration, and the deny is structural (`ENG-API-003`)

`ENG-API-003` binds two obligations together — secrets sourced outside code, and default-deny
server-side authorization — because either alone leaves the resource reachable.

For the deny shape, the router-level opt-in and the five test categories are in
[Security](security.md#default-deny-eng-sec-004). Two additions specific to a service:

**Machine-triggered operations are in scope.** The principle says server resources _or
machine-triggered operations_. Cron handlers, queue consumers, and webhook receivers frequently
sit outside the middleware that protects the HTTP routes, because they did not arrive through the
router. An unauthenticated webhook endpoint that mutates state is the same defect as an
unauthenticated route, and it is systematically missed because the authorization tests target the
router.

**Denied requests perform no protected action**, which is an ordering property. Authorize before
the side effect. A handler that writes and then authorizes has already written; see
[`ENG-SEC-007`](security.md#fail-closed-and-say-nothing-useful-eng-sec-007).

For secrets, the mechanism is configuration parsed at boot, so a missing credential fails before
the service accepts traffic rather than at the first request that needs it. That parse belongs to
`ENG-SEC-007` and is shown there. What `ENG-API-003` adds is the response side: **no secret is
committed or returned**, which includes error bodies. A provider error echoed verbatim to a client
can carry the request it was given, and the request carried the key.

## Idempotency is a uniqueness constraint, not a lookup (`ENG-API-004`)

`ENG-API-004` requires repeated write fixtures to produce one effect. The implementation that
looks correct and is not:

```ts
// WRONG — two concurrent retries both see no row and both proceed.
const seen = await db.findByKey(key);
if (seen) return seen.response;
await performWrite();
```

Check-then-act has a window between the two statements, and retries are precisely the traffic that
arrives concurrently — a client timeout followed by a retry commonly races the original request,
which is still running. The property has to be enforced by the store:

```sql
CREATE TABLE idempotency (
  key         text PRIMARY KEY,
  response    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

```ts
const inserted = await db.insertIfAbsent(key, placeholder); // relies on the PK
if (!inserted) return await db.awaitResponse(key); // a concurrent caller owns this write
await performWriteAndStoreResponse(key);
```

The recorded response matters as much as the suppressed write. A replay that performs no effect
but returns a different result — `404`, or a fresh error — tells the client the operation failed
after it succeeded, and a well-behaved client will retry again.

Two things worth stating because they are usually discovered late:

- **The key comes from the client and must be bounded and validated** like any other untrusted
  input (`ENG-SEC-005`). A server-generated key cannot work; the whole point is that it survives
  the client's retry.
- **Retention is data with a lifecycle.** The table holds request-derived content, so it needs a
  stated retention under `ENG-DATA-003`, and expiry has to exceed the client's maximum retry
  window or the guarantee lapses exactly when a slow retry uses it.

Testing this needs concurrency, not repetition. Sequential calls pass against the broken version
above:

```ts
await Promise.all([submit(key), submit(key), submit(key)]);
expect(await countEffects()).toBe(1);
```

## Every dependency carries a bound and a declared degraded result (`ENG-API-004`)

The principle names four bounds — **timeout, backoff, rate, and degraded-result behavior**. The
first three are widely implemented and the fourth is usually absent, which is what turns a bounded
failure into an unbounded one: a call that times out correctly and then throws has converted a slow
dependency into an error for the caller, with no decision recorded about what the caller should
have seen instead.

Declare all four together at the seam, so a dependency cannot be added without answering the
fourth:

```ts
export const pricing = dependency({
  timeout: 2_000,
  retries: { max: 3, backoff: 'exponential', jitter: true },
  rate: { perSecond: 20 },
  degraded: () => ({ status: 'stale' as const, prices: lastKnownPrices() }),
});
```

Jitter is not decoration. Synchronised retries from many clients reproduce the load spike that
caused the failure; unsynchronised ones do not. Retries also require the write to be idempotent —
which is why `ENG-API-004` states both halves in one principle, and why adding a retry policy to a
non-idempotent write is a way of causing duplicate effects rather than tolerating failure.

The adapter shape that returns failure as a value rather than throwing is in
[Resilience](resilience.md#degrade-do-not-throw-eng-local-004-eng-int-001) under `ENG-INT-001` and
`ENG-INT-003`; the degraded result is what fills its `failed` branch.

Product owns which degraded outcomes are acceptable and Studio owns how they are shown. Engineering
owns only that a distinct degraded state exists and is reachable.

## Telemetry needs three outcomes, not two (`ENG-API-004`)

The evidence clause requires telemetry to distinguish **success, degradation, and failure**. A
boolean `ok` field collapses the middle case, and the middle case is the one that matters
operationally: a service serving stale prices to every request is not failing any health check and
is not doing its job.

```ts
log.info({ dependency: 'pricing', outcome: 'degraded', reason: 'timeout', ms: 2001 });
```

Emit the outcome as an enumerated field on a structured event, per
[`ENG-OBS-001`](observability.md), and keep the payload out of it — `ENG-OBS-005` and `ENG-INT-004`
both prohibit capturing sensitive bodies at a seam. `ENG-OBS-007` (predictable degradation) is the
consumer of this signal; if degradation is not emitted distinctly it cannot be alerted on, and the
first report arrives from a user.

## The proxy that must not become a backend (`ENG-INT-005`)

When a browser needs a third-party provider that requires a secret, the credential stays
server-side behind a proxy. `ENG-INT-005` constrains that proxy in three ways, and the third is
the one that erodes.

**Allowlist origins and operations separately.** Origin alone is insufficient: any page on an
allowed origin, including one reached through an XSS, can then invoke every provider operation the
credential permits. Enumerate the operations too.

```ts
const ALLOWED_ORIGINS = new Set(['https://app.example.com']);
const ALLOWED_OPERATIONS = new Set(['geocode', 'reverseGeocode']); // not 'batch', not 'admin'
```

Both lists are literal sets in one reviewable place. A pattern match — an origin regex, an
operation prefix — is how `admin.*` becomes reachable later without a diff that looks like a
change in authority.

**No user-data persistence.** The proxy forwards; it does not store. The moment it keeps request
bodies for caching or debugging convenience, it holds user data under a component that has no
retention obligation, no owner recorded under `ENG-DATA-003`, and usually no backup or erasure
path — an undeclared backend, which is precisely what the principle names. If a cache is genuinely
needed, that is an explicit seam cache under `ENG-INT-002`, with its own declared bounds.

The evidence is mechanical and worth automating, because "no secret in the client" is a claim that
decays with every bundle change:

```bash
grep -rE '(api[_-]?key|secret|token)\s*[:=]' dist/ && exit 1  # fails the build if it matches
```

Pair it with proxy tests asserting an unlisted origin and an unlisted operation are both rejected,
and a storage inspection confirming nothing was written.

## Verifying this guide

| Principle     | Minimum evidence                                                                   |
| ------------- | ---------------------------------------------------------------------------------- |
| `ENG-API-002` | Store owner named; previous version's suite passes against the migrated schema     |
| `ENG-API-003` | Machine-triggered paths covered by authorization tests; no secret in any response  |
| `ENG-API-004` | Concurrent replays produce one effect; every dependency declares a degraded result |
| `ENG-API-004` | Telemetry distinguishes success, degradation, and failure as distinct values       |
| `ENG-INT-005` | Unlisted origin and unlisted operation both rejected; no user data written         |
