# Proposal: applicability for `ENG-LOCAL-001`, and for platform areas generally

- Status: Proposed — not Ratified, not in force, and deliberately outside `principles/`.
- Requested by: the `docket` repository during centralized-practice adoption.
- Decision record:
  [`docs/architecture/0003-principle-applicability.md`](../architecture/0003-principle-applicability.md)

This file is a **proposal only**. Nothing here binds any repository, and no wording in it is
Ratified. Only the repository owner may ratify a change to `principles/`, which is sealed by path
and by content hash.

## The report

`docket` is a task system whose `ADR-0001: One canonical server, explicit connector adapters` states:

> **One canonical server owns task state.** Every client — the web PWA, the future SwiftUI iPhone
> app, any script — is a client of that server. There is no peer-to-peer path and no
> client-owned truth.

`ENG-LOCAL-001` states:

> Treat the device's durable store as the system of record, persist before reflecting success, and
> keep portable data exportable.

These cannot both hold. `docket` stores task data on the device — it has a durable local store —
and has decided, in a recorded and Accepted architecture decision, that the local store is **not**
the system of record.

## The distinction this exposes

The catalog holds 66 Ratified principles in 11 areas, five of which are platform areas: `WEB`,
`API`, `DATA`, `INT`, `LOCAL`. **No principle in any area states the conditions under which it
applies.** Every principle is written as an unconditional imperative, and the validator, the
citation checker, and the coverage ratchet all treat them that way.

For four of the five platform areas that has never caused trouble, because non-applicability is
**vacuous**:

- A headless CLI has no browser, so `ENG-WEB-002` ("detect optional browser capabilities before
  use") has no subject. Nobody claims a violation; there is nothing to violate.

`ENG-LOCAL-001` is different, and this is the whole finding:

- `docket` **does** have the subject. It has a device durable store, it persists to it, and it has
  deliberately assigned authority elsewhere. The principle is not vacuous for `docket` — it is
  **contradicted**, by a decision the repository made on purpose and wrote down.

**Vacuity self-scopes. Contradiction does not.** A principle with no subject needs no applicability
mechanism; a principle whose subject exists but whose ruling was deliberately declined does. That is
why `LOCAL` surfaced this and `WEB` did not, and it is why the fix is not "add a sentence to
`ENG-LOCAL-001`" without deciding the general question first.

## `docket` is not the lax case — it is the strict one

The tempting reading is that a server-canonical product is a local-first product that gave up. The
evidence says the opposite. `ENG-LOCAL-002`, `003`, and `004` demand a narrow sync seam, a declared
conflict model, and safe degradation. `docket`'s ADR-0001 requires, per connector and in writing:

| `docket` ADR-0001 requirement                                                                                  | Principle it satisfies or exceeds                            |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Connectors sit behind a registry and error boundary; a broken provider degrades one connector, never the Inbox | `ENG-LOCAL-002` (narrow seam), `ENG-LOCAL-004` (degradation) |
| Declared directionality per connector — `import`, `export`, or `two-way`, "never implied"                      | `ENG-LOCAL-002`                                              |
| Idempotent imports keyed on `(providerId, externalId)`; re-running updates, never duplicates                   | `ENG-LOCAL-003`                                              |
| Deletions replicate as tombstones so upstream deletes do not reappear                                          | `ENG-LOCAL-003`, named explicitly by its Evidence clause     |
| A documented rule for both-sides-changed, with the canonical record winning by default                         | `ENG-LOCAL-003`                                              |
| Reconciliation path to re-derive the mapping from scratch after failure                                        | beyond `ENG-LOCAL-003`                                       |
| Provenance fields on the canonical record from day one                                                         | beyond the area                                              |

So a repository that fails `ENG-LOCAL-001` here is one that satisfies the rest of the area more
rigorously than most local-first products do. Scoping `ENG-LOCAL-001` therefore must not scope away
`002`–`004`: they are exactly the principles a server-canonical product most needs, because a
declared conflict model is more load-bearing when replication is the normal case rather than the
exceptional one.

## The defect is silence, not disagreement

Searched across the consuming repositories: **`docket` cites `ENG-LOCAL-001` zero times.** It has
the one architecture in the fleet that directly contradicts it, and its citation record is
indistinguishable from a repository that never read the principle.

That is the actual harm, and it is the same shape as two other findings from this migration:

- A clean `react-hooks/rules-of-hooks` run means "no violations of the shape this rule recognises",
  not "no defects" — a repository reads absence of findings as evidence of correctness.
- A native repository that instruments only the lab channel believes it satisfies `ENG-PERF-008`
  and does not, because a P95 across real hardware is non-reproducible by construction.

In all three, **silence is read as compliance**. Today the catalog cannot distinguish "we considered
`ENG-LOCAL-001` and our ADR-0001 declines it, here is why" from "we have never opened
`principles/platforms/local-first.md`". Both produce zero citations and zero findings. Any
applicability mechanism worth adding must make the first one _louder_ than the second, not quieter.

## Options

### Option A — amend `ENG-LOCAL-001` with a scope clause

Add applicability to the statement, roughly: apply the device-as-system-of-record ruling to products
whose declared operating model is local-first or offline-primary, and require a recorded decision
otherwise.

- **For:** smallest change; fixes the one instance that has actually bitten a repository.
- **Against:** it changes the meaning of a Ratified principle that other repositories already cite,
  so every existing citation must be re-read against new wording. It also solves the case we found
  rather than the class, and the next contradiction — plausibly `ENG-DATA-*` or `ENG-INT-*` in a
  repository with a deliberate exception — arrives with no precedent to lean on.

### Option B — a declared-applicability record per consuming repository (recommended)

Each consuming repository records which platform areas it claims, and for each area or principle it
declines, the architecture decision that declines it. Engineering ships the checker; the repository
owns the declaration.

- **For:** turns non-applicability from silence into a reviewable artifact with a named reason and a
  link. It generalises: the same record answers `WEB` for a CLI, `LOCAL` for `docket`, and whatever
  arrives next. It leaves all 66 Ratified statements untouched and unre-ratified, so no existing
  citation changes meaning. And it produces the loudness asymmetry above: a declining repository has
  a file naming the ADR, and a repository that never looked has nothing.
- **Against:** a new artifact and a new checker for every consumer, at a point in the migration where
  consumers are still absorbing the package and workflow changes. It also risks becoming a
  compliance checkbox if the reason field is allowed to be thin — which argues for requiring a link
  to an Accepted decision record rather than free text.

### Option C — do nothing, and let repositories stay silent

Recorded because it is the status quo and should be rejected explicitly rather than by default. Its
cost is that the catalog's coverage numbers keep describing intent rather than practice, and the one
repository with a considered, better-than-required answer looks identical to one with no answer.

## Recommendation

**Option B, with Option A folded into it as the first entry.**

`ENG-LOCAL-001` is a genuine instance and should not wait for the general mechanism — but the
amendment should be written _after_ the applicability convention exists, so its scope clause can
point at the mechanism instead of inventing bespoke wording that the mechanism later contradicts.
That ordering also avoids re-ratifying `ENG-LOCAL-001` twice.

If the owner prefers the narrow path, Option A alone is defensible and strictly better than the
status quo. What should not happen is scoping `ENG-LOCAL-001` in a way that also releases a
server-canonical product from `ENG-LOCAL-002` through `004`.

## What ratification would require

Either option touches sealed material, so a partial change fails validation loudly rather than
landing half-applied. For Option A, in `.github/scripts/validate-principles.ps1`:

1. `$expectedSemanticHashes` — recompute the SHA-256 for `platforms/local-first.md`. Semantic
   content is every line **except** those matching `^- Status:`, joined with `\n` and given a
   trailing newline, so editing a Statement does change the hash.
2. `docs/ratification/` — an amending decision record. The existing record is itself hash-pinned
   via `$expectedDecisionHash`, so it cannot be edited in place without updating that constant.
3. `principles/index.json` is generated by `scripts/build-principles-index.mjs`; regenerate rather
   than hand-edit.

Counts do not move: the area stays at four principles and the catalog at 66.

Option B adds no principle and changes no hash. Its cost is a schema, a checker, and a
`docs/adopting.md` section — all outside `principles/`.

## What this proposal does not claim

It does not claim `ENG-LOCAL-001` is wrong. For a local-first product it is the correct and
load-bearing rule, and weakening it generally would remove the one principle that makes the area
mean anything.

It also does not claim `docket`'s architecture is right — that is the owner's judgment and
`docket`'s, not this repository's. The claim is narrower and, I think, uncontested: a repository
holding an Accepted decision that contradicts a Ratified principle should be visibly in that
position, and today it is invisibly in it.
