# 0001: Native platform principle area

<!-- check-citations: allow-unknown ENG-NATIVE-004 ENG-WEB-042 -->

- Status: Proposed
- Date: 2026-08-10
- Owner: repository owner

## Context

The Ratified catalog holds 66 principles across 11 areas, five of which are platform areas: `API`,
`WEB`, `DATA`, `INT`, and `LOCAL`. None addresses a native application surface. `WEB` is
browser-framed in all four of its principles, reasoning about browser code, optional browser
capabilities, per-route delivery budgets, and assets beneath a running session.

The `finance` repository raised this during centralized-practice adoption. It ships four platforms,
three of them native, so one of its four surfaces is covered by a platform area.

The gap is structural rather than cosmetic, and the catalog already shows the seam. A grep of the
entire principles corpus for `mobile|Android|iOS|desktop|Kotlin|Swift|multiplatform|native` returns
three lines, all belonging to `ENG-PERF-007` "Platform-native profiling". That principle **obliges**
engineers to profile with the platform-native tool and record a reproducible recipe — an obligation
aimed at a platform the catalog otherwise never acknowledges. An assurance area is asking for
evidence about a surface no platform area defines.

Two facts constrain any response. Only the repository owner may ratify a principle, so an agent may
propose but not adopt. And the catalog is sealed: `.github/scripts/validate-principles.ps1` pins
every principle file by path, by per-file semantic-content hash, and by expected count, and pins the
Ratification decision record by its own hash. Adding an area is therefore a deliberate, multi-part
change that cannot land incrementally by accident.

## Decision

Propose a fifth platform area, `ENG-NATIVE-*`, at `principles/platforms/native-app.md`, containing
four principles: store-gated release, interruption-safe application lifecycle, platform-mediated
capability and secret custody, and a declared platform support floor.

The full proposed text is in
[`docs/proposals/eng-native-principle-area.md`](../proposals/eng-native-principle-area.md), written
in exact catalog format and carrying `Status: Draft`.

Hold the proposal **outside** `principles/`. This keeps the sealed catalog and its hash manifest
untouched while the proposal is under review, so the repository on `main` never contains an
unratified principle that tooling or a consumer could mistake for one in force. Ratification then
becomes a file move plus the manifest updates enumerated in the proposal, not a rewrite.

Extending `WEB` was considered and rejected. Its mechanisms are browser mechanisms, not incidentally
browser-flavored ones. Widening them would either dilute the statements into vagueness or silently
change the meaning of principles that seven repositories already cite.

## Consequences

Native repositories gain a place to record obligations that currently have none, and `ENG-PERF-007`
gains a surface to attach to — profiling "the platform" is undefined until the supported platforms
are named, which `ENG-NATIVE-004` would fix.

The catalog grows from 66 to 70 principles and from 11 to 12 areas. Every consumer that quotes the
total, including the existing Ratification record, becomes stale on the day this is ratified.

Coverage regresses before it improves. `scripts/check-coverage.mjs` ratchets against
`practices/uncovered.json`; four new IDs with no implementing guide raise the recorded gap count
from 7 to 11. A `practices/native-apps.md` should therefore land with, or immediately after,
ratification. The `ENG-PERF-007` native-profiling write-up already offered by `finance` is a natural
first section.

Ratification is not a one-file change. It requires `$expectedPrefixes`, `$expectedCounts`, and
`$expectedSemanticHashes` entries, a status flip from `Draft` to `Ratified`, a new Ratification
decision record, and a regenerated `principles/index.json`. Partial application fails validation
loudly, which is the intended behavior.

If the proposal is declined, the `ENG-PERF-007` obligation remains attached to no platform area and
native repositories keep citing browser principles by analogy. That is the status quo, and it should
be chosen deliberately rather than by inaction.

## Evidence

The four draft principles were validated with the repository's own
`.github/scripts/validate-principles.ps1`, run from a mimic script root against a scratch principle
root where `Draft` status is legal, with a single added `$expectedPrefixes` entry so the new path
resolved. No file in this repository was modified. Result: `Validated 4 principle IDs`, exit 0 —
covering all eight required fields, ID format and namespace, the imperative-verb rule, the
owner-and-ratification wording, and the handoff-authority rules.

A passing validator proves nothing on its own, so the check was mutation-tested. Five mutations,
each applied and reverted, with the applied-ness asserted rather than assumed:

| Mutation                                                    | Result       |
| ----------------------------------------------------------- | ------------ |
| Statement no longer starts with an imperative verb          | rejected     |
| ID moved to the wrong namespace (`ENG-WEB-042`)             | rejected     |
| Owner wording lets Engineering ratify                       | rejected     |
| Required `Rationale` field renamed                          | rejected     |
| `Product sets` changed to `Engineering sets` in one handoff | **accepted** |

The fifth was investigated rather than excused. It passed because the rest of that sentence still
named Studio and `jrmoulckers/.github`, which satisfies the rule as written — the handoff assigned
external authority regardless. Replacing the whole handoff with an Engineering-only sentence is
correctly rejected. So the validator is sound and the mutation was weak; it is recorded here because
the weak version is the one that looks convincing in a summary.

Validation of the draft is a well-formedness result only. Whether these are the right four
obligations is a judgment reserved to the repository owner.
