# Event and data contracts

Implements `ENG-DATA-002` and `ENG-DATA-003`. This guide adds no rules.

`ENG-DATA-001` (owned durable integrity) is implemented in
[Local-first sync](local-first-sync.md#record-shape-eng-local-003-eng-data-001). The **evidence**
side of the data lifecycle — the nine-attribute inventory, synthetic-data rights tests, and
payload-free audit records — is in [Security](security.md#data-lifecycle-evidence-eng-sec-008)
under `ENG-SEC-008`. This guide covers the collection and schema mechanisms those two leave open.

## Version the envelope, not the documentation (`ENG-DATA-002`)

A schema version that lives only in a document cannot be checked by anything. Put it in the
payload, so a consumer reading a single event knows which contract produced it:

```ts
const Envelope = z.object({
  event: z.enum(EVENT_NAMES), // closed set — see below
  version: z.literal(2),
  occurredAt: z.string().datetime(),
  props: z.record(z.unknown()),
});
```

Within a version, evolution is additive — the same constraint `ENG-BUILD-003` places on released
artifacts, for the same reason: an existing consumer must keep working. A field that changes
meaning or type is a new version, not an edit, because the old and new forms are
indistinguishable to a consumer that only reads the value.

## The event name list is a closed set (`ENG-DATA-002`)

`ENG-DATA-002` requires **bounded names** and the rejection of unrecognized shapes. Both follow
from one decision: the set of event names is enumerated in code, and anything outside it is
rejected rather than forwarded.

```ts
export const EVENT_NAMES = ['recipe.created', 'recipe.shared', 'sync.completed'] as const;
```

An open string field here is the usual origin of taxonomy drift. `recipe_created`,
`recipeCreated`, and `recipe.created` all arrive, all look plausible in a dashboard, and none of
them can be reconciled afterwards because the events are already recorded.

Rejecting unknown **shapes** is a separate decision from rejecting unknown names, and it is the
one most often missed, because permissive parsing is the default in most libraries:

```ts
const Props = z.object({ surface: Surface, itemCount: z.number().int() }).strict();
```

Without `.strict()`, an extra key passes validation and flows to every downstream consumer. That
is how an unreviewed field — frequently one carrying personal data — reaches a warehouse without
appearing in any schema change.

## Bound cardinality at the type, not in review (`ENG-DATA-002`)

Unbounded cardinality is the failure the principle names, and it does not announce itself: the
pipeline works, the dashboards render, and cost and query time grow until someone investigates.
The cause is almost always a property whose value space is unbounded — an identifier, a free-text
string, a raw duration.

Make the bound structural, so an unbounded value cannot be expressed:

| Instead of        | Use                                      | Cardinality                           |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| `userId: string`  | omit it, or a scoped pseudonymous ID     | unbounded → out of the property space |
| `query: string`   | `queryLength: bucket(['0-10', '11-50'])` | bounded                               |
| `ms: number`      | `durationBucket: bucket([...])`          | bounded                               |
| `country: string` | `country: z.enum(ISO_3166)`              | bounded                               |

Then assert it, since a type only bounds what it was given:

```ts
test('no event property exceeds its cardinality budget', () => {
  for (const [prop, values] of distinctValuesByProperty(fixtures)) {
    assert.ok(values.size <= BUDGET[prop], `${prop} has ${values.size} distinct values`);
  }
});
```

The evidence clause requires **schema validation before release** and **compatibility fixtures
covering supported versions**. Keep one recorded fixture per supported version and parse each with
the current parser on every run — that is what makes "we still support v1" a fact rather than an
intention:

```
fixtures/events/v1/recipe.created.json
fixtures/events/v2/recipe.created.json
```

A fixture is deleted only when its version is genuinely no longer accepted, and that deletion is
the visible moment support ended.

## Minimize where the event is emitted (`ENG-DATA-003`)

Minimization is a property of the **call site**, not the pipeline. Filtering fields downstream
means the data was collected, transmitted, and buffered before being dropped — so every hop before
the filter held it, and the logs of those hops may still.

The principle names the preferred shapes directly: **scoped identifiers, enums, aggregates, and
buckets**.

```ts
// Before — three unbounded, identifying properties.
track('recipe.shared', { userId, recipientEmail, recipeTitle });

// After — bounded, non-identifying, and still answers the product question.
track('recipe.shared', {
  actor: scopedId(userId),
  channel: 'email',
  titleLength: bucket(title),
});
```

The question a reviewer should ask is not "is this field sensitive" but **"which recorded Product
question does this field answer"**. A property that answers none is collected because it was
available, which is the definition the principle is written against.

## Scoped identifiers must not be reversible (`ENG-DATA-003`)

**Cross-product identity is not reversible** — so a per-product identifier is derived, and the
derivation is not a lookup:

```ts
const scopedId = (userId) => hmac(PRODUCT_SALT, userId); // salt per product, never shared
```

Two mistakes defeat this while looking like they satisfy it:

- **A mapping table.** Storing `scopedId → userId` makes the pseudonym reversible by anyone with
  the table, which is exactly the linkage the principle prohibits. If reversal is genuinely
  required for a Product obligation, that is a named obligation with an owner, not a convenience
  table.
- **A shared salt.** One salt across products makes the same user's identifier identical
  everywhere, which reconstitutes the cross-product identity the scoping exists to prevent. Bare
  hashing without a salt is worse still — the input space of a user ID is small enough to
  enumerate.

## Do not invent the obligation (`ENG-DATA-003`)

The binding phrase is that consent, retention, export, erasure, anonymization, and audit
mechanisms are implemented **only from an explicit authorized obligation**. Engineering builds the
mechanism; Product owns whether it is required and on what basis.

In practice this cuts both ways, and the second direction is the one that gets missed:

- Do not add a 90-day retention sweep because it seems prudent. An unrequested deletion destroys
  data another obligation may require retained.
- Do not omit one because no ticket asked. If a Product obligation names retention, the mechanism
  is owed, and its absence is a gap rather than a decision.

Make the link mechanical by naming the obligation in the test, so the mechanism and its basis
cannot drift apart:

```ts
test('erasure removes recipe content within the obligation window [PRIV-014]', async () => {
  // Synthetic subject, per ENG-SEC-008 — never a real record.
  await requestErasure(synthetic.id);
  assert.equal(await countRecipes(synthetic.id), 0);
});
```

When the obligation changes, the failing test names the identifier to look up. A lifecycle test
that cites no obligation cannot be evaluated for correctness — it asserts a behaviour nobody can
confirm is the required one.

## Verifying this guide

| Principle      | Minimum evidence                                                                 |
| -------------- | -------------------------------------------------------------------------------- |
| `ENG-DATA-002` | Version in the envelope; event names a closed set; parsing is strict             |
| `ENG-DATA-002` | Cardinality budget asserted in a test; one fixture per supported version parses  |
| `ENG-DATA-003` | Every property answers a recorded Product question; identifiers are scoped       |
| `ENG-DATA-003` | No pseudonym-to-identity mapping; salts are per product                          |
| `ENG-DATA-003` | Each lifecycle test names the obligation it verifies and uses synthetic subjects |
