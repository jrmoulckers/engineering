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
conflict model, and safe degradation.

`docket` answers these across **two** decision records, and the split matters because both contain
tombstones and a both-sides-changed rule for **different seams**:

- **ADR-0001** governs the _connector_ seam — `docket` against upstream third-party systems. Its
  tombstones are for tasks deleted upstream. It cites no `ENG-LOCAL-*` principle.
- **ADR-0003: A server-authoritative mutation log, not a CRDT** governs the _client-server_ seam, and
  is where the area conformance is actually declared. It cites `ENG-LOCAL-002` and `ENG-LOCAL-004` at
  its line 11, and carries an explicit declaration for `ENG-LOCAL-003`: "Docket's declaration of
  ordering, tombstone, concurrency, and merge rules for every synchronised type — the evidence
  required by `ENG-LOCAL-003`."

| `docket` requirement                                                                                           | Record   | Principle it satisfies or exceeds                            |
| -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| Connectors sit behind a registry and error boundary; a broken provider degrades one connector, never the Inbox | ADR-0001 | `ENG-LOCAL-002` (narrow seam), `ENG-LOCAL-004` (degradation) |
| Declared directionality per connector — `import`, `export`, or `two-way`, "never implied"                      | ADR-0001 | `ENG-LOCAL-002`                                              |
| Idempotent imports keyed on `(providerId, externalId)`; re-running updates, never duplicates                   | ADR-0001 | `ENG-LOCAL-003`                                              |
| Upstream deletions replicate as tombstones so upstream deletes do not reappear                                 | ADR-0001 | `ENG-LOCAL-003`, named by its **Statement**                  |
| A documented rule for both-sides-changed, with the canonical record winning by default                         | ADR-0001 | `ENG-LOCAL-003`                                              |
| Reconciliation path to re-derive the mapping from scratch after failure                                        | ADR-0001 | beyond `ENG-LOCAL-003`                                       |
| Client-server deletes are tombstones, retained and replicated; replay from cursor `0` reconstructs state       | ADR-0003 | `ENG-LOCAL-003`                                              |
| `expectedVersion` per mutation; a conflict never rejects its batch neighbours                                  | ADR-0003 | `ENG-LOCAL-003`                                              |
| Offline capture accepted locally and reconciled later; outbox flush survives a lost network                    | ADR-0003 | `ENG-LOCAL-002`, `ENG-LOCAL-004`                             |

So a repository that fails `ENG-LOCAL-001` here is one that satisfies the rest of the area more
rigorously than most local-first products do. Scoping `ENG-LOCAL-001` therefore must not scope away
`002`–`004`: they are exactly the principles a server-canonical product most needs, because a
declared conflict model is more load-bearing when replication is the normal case rather than the
exceptional one.

## The authority claim does not stay inside `ENG-LOCAL-001`

Scoping `ENG-LOCAL-001` alone would **not** resolve `docket`'s position, and this is the sharpest
constraint in the proposal.

`ENG-LOCAL-002` is titled "Optional sync seam" and its Statement is genuinely
platform-independent — put sync behind one narrow contract, do not make core local operation wait for
an account, provider, or network. `docket` satisfies that. But the principle restates `001`'s
authority ruling twice outside its Statement:

- **Rationale:** "Sync is an optional replication layer, not the authority for local-first data."
- **Evidence:** "…provider contract tests cover upload, download, retry, and unavailable states;
  **local data remains authoritative**."

`docket`'s client is an optimistic cache and the server wins on conflict, so it fails that Evidence
clause as literally written, while satisfying the Statement the clause is supposed to evidence.

**Applicability is therefore per clause, not merely per principle.** A scope mechanism that attaches
only to Statements would certify `ENG-LOCAL-002` as satisfied for `docket` while its Evidence clause
says otherwise — and the record would be falsifiable by any reader in one step, on the mechanism's
first worked example. Either the constraint must be written as _scoping `001` does not release the
sync-seam obligations of `002`–`004`, and `002`'s authority clause travels with `001`_, or
`ENG-LOCAL-002`'s Evidence clause needs the same scoping treatment, because it silently restates a
neighbouring principle's subject.

This is flagged, not fixed: both are Ratified text and only the repository owner may change them.

## The defect is discoverability, not silence — and my first evidence for it was wrong

This section originally read: "Searched across the consuming repositories: `docket` cites
`ENG-LOCAL-001` zero times." **That was false, and `docket` falsified it with one grep.**

`docket` cited `ENG-LOCAL-001` four times when this proposal was opened — `ARCHITECTURE.md:166`,
`AGENTS.md:20`, `packages/domain/src/query.ts:41`, `packages/domain/src/search.ts:9` — all on
`main`, not on a branch. `ARCHITECTURE.md:163-171` is an explicit written declination naming the
principle, the carve-out, and the reason. It merged 22 hours before this proposal was opened, so
this was not a stale baseline. It was a broken search.

### Why the search returned zero

The audit used GitHub's code-search API. Re-running it against `docket` returns `total_count: 0` for
**every** query, including `Docket` — a word that appears throughout a repository named `docket`.
Testing across the fleet found three distinct ways to get a zero:

| Repository     | Visibility | Query for a word certain to be present | Actual meaning       |
| -------------- | ---------- | -------------------------------------- | -------------------- |
| `docket`       | private    | `0`                                    | not searchable       |
| `engineering`  | **public** | `0`                                    | public but unindexed |
| `jrm-recipes`  | public     | `1204`                                 | a real answer        |
| `game-library` | private    | HTTP 403 rate limit                    | no answer at all     |

All three non-answers arrive as an absence of results. The 403 is the worst of them: piped through
`--jq '.total_count'` it yields nothing, which any script treating a missing count as zero will
record as "no citations". A fleet scan across nine repositories exhausts the search rate limit part
way through, so the repositories audited _last_ return the most confident-looking zeros.

**A search index is not the repository.** Absence of results is evidence about the index; it is
evidence about the code only when the index is known to cover it. The cheap remedy is a **positive
control**: before believing any zero, search the same repository for a string certain to be present.
If the control returns zero, every other zero from that repository is uninformative and the audit
must fall back to reading contents directly. That is the same anti-vacuity discipline this
repository already enforces on its own tests — a check that cannot fail is not a check — arriving
here as a check that cannot _find_.

### The finding this replaces it with is stronger

The original argument was that `docket` is invisibly in disagreement. It is not: `docket` is the one
repository in the fleet that wrote its declination down, with reasoning, a carve-out, and a link.

The real finding is worse for the status quo:

> A declination written in prose is undiscoverable at fleet scale — including by the person who
> wrote the principle, searching specifically for it, one day after it was published.

That does not depend on any repository being silent, so it cannot be falsified by a grep. And two
further observations from the same repository sharpen it:

- **Prose did not prevent contradiction inside the same repository.** `docket`'s `query.ts` and
  `search.ts` cited `ENG-LOCAL-001` while describing "works with no network on the path" — which is
  `ENG-LOCAL-002`'s Statement, not `001`'s. `search.ts` is the sharp case: it describes an in-memory
  index built from the _replicated_ task set, citing the one principle its own mechanism declines.
  So the same author, in the same repository, declined a principle in the architecture document and
  cited it approvingly in source. (`docket` filed and fixed this as its issue #166; both files now
  cite `ENG-LOCAL-002`.)
- **A structured record makes that checkable.** Machine-readable "`docket` declines
  `ENG-LOCAL-001`" turns a positive citation of `001` inside `docket` into a detectable
  contradiction. Prose cannot do this. That is a concrete capability Option B buys beyond
  visibility, and it is the strongest argument in this proposal.

The related failure mode this section originally described still stands on its own evidence — a
clean `react-hooks/rules-of-hooks` run means "no violations of the shape this rule recognises", not
"no defects"; a native repository instrumenting only the lab channel believes it satisfies
`ENG-PERF-008` and does not. In both, **absence of findings is read as compliance.** The correction
is that the catalog's problem is not that declining repositories are silent. It is that whether they
are silent cannot currently be determined.

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
  citation changes meaning. It makes the record machine-checkable, so a repository that declines a
  principle and then cites it approvingly in source is a detectable contradiction rather than an
  accident nobody can see.
- **Against:** a new artifact and a new checker for every consumer, at a point in the migration where
  consumers are still absorbing the package and workflow changes. It also risks becoming a
  compliance checkbox if the reason field is allowed to be thin — which argues for requiring a link
  to an Accepted decision record rather than free text.

**Two properties the record must have**, both of which fall out of the corrections above:

1. **It must distinguish out-of-scope from non-compliant.** "Our Accepted decision assigns authority
   elsewhere, here it is" and "we have not done this work" are different positions with different
   remedies. A mechanism that collapses them recreates, one level up, the exact ambiguity it was
   built to remove.
2. **It must be per clause, not only per principle.** `ENG-LOCAL-002` is the worked example: its
   Statement binds `docket` and its Evidence clause does not. A record keyed only to principle IDs
   cannot express that, and would certify something a reader can falsify.

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
`docket`'s, not this repository's. The claim is narrower: a repository holding an Accepted decision
that contradicts a Ratified principle should be **discoverably** in that position. `docket` took the
trouble to be legible in prose and it still was not found, by the author of the principle, looking
for exactly that. Legibility to a reader and discoverability at fleet scale are different
properties, and only the second is missing.
