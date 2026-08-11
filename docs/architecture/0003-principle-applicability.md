# 0003: Record principle applicability instead of inferring it from silence

- Status: Proposed
- Date: 2026-08-11
- Owner: repository owner

## Context

`docket` holds an Accepted architecture decision (`ADR-0001: One canonical server, explicit
connector adapters`) that directly contradicts the Ratified `ENG-LOCAL-001`, which requires the
device's durable store to be the system of record. `docket` has a device durable store and has
deliberately placed authority on the server.

No principle in the catalog states the conditions under which it applies. That has been harmless for
the other platform areas because their non-applicability is vacuous — a headless service has no
browser, so `ENG-WEB-*` has no subject to rule on. `ENG-LOCAL-001` is the first case where the
subject exists and the ruling was declined on purpose.

The observable consequence is that `docket` cites `ENG-LOCAL-001` zero times. A repository that
considered a principle and declined it with a written reason is today indistinguishable from one
that never read it. Both are silent, and silence is currently read as compliance.

This is not a defect in `ENG-LOCAL-001`, which is correct and load-bearing for a local-first
product. It is a missing mechanism.

## Decision

Deferred to the repository owner. This record exists to hold the analysis and to keep the proposal
outside `principles/`, which is sealed by path and by content hash and which only the owner may
change.

The proposal is
[`docs/proposals/eng-local-001-applicability.md`](../proposals/eng-local-001-applicability.md). It
records three options — amend `ENG-LOCAL-001` with a scope clause; add a per-repository declared-
applicability record with a checker; or keep the status quo — and recommends the second with the
first folded in, so that the amendment can reference the mechanism rather than invent bespoke
wording the mechanism would later contradict.

One constraint is not optional under any option: scoping `ENG-LOCAL-001` must not scope away
`ENG-LOCAL-002` through `004`. `docket`'s ADR-0001 satisfies or exceeds all three — declared
directionality, idempotent keying, tombstones, a documented both-sides-changed rule, and a
reconciliation path — and a declared conflict model is more load-bearing when replication is the
normal case, not less.

## Consequences

**Easier.** A repository can be visibly, reviewably in disagreement with a principle, with a link to
the decision that disagrees. Coverage and citation numbers start describing practice rather than
intent.

**Harder.** A per-repository applicability record is a new artifact and a new checker landing while
consumers are still absorbing the package and workflow migration. If its reason field accepts free
text it degrades into a compliance checkbox, which argues for requiring a link to an Accepted
decision record.

**Constrained.** Amending a Ratified principle is not a single-file edit. The semantic hash for
`platforms/local-first.md` must be recomputed in `.github/scripts/validate-principles.ps1`, a new
ratification record is required, and `principles/index.json` must be regenerated rather than
hand-edited. The declared-applicability option changes no hash and adds no principle.

## Evidence

The contradiction is established by reading both documents rather than inferring it: `docket`
ADR-0001 states there is "no client-owned truth"; `ENG-LOCAL-001` requires the device store to be
the system of record. The silence claim is established by code search across the consuming
repositories, which returns zero `ENG-LOCAL-001` citations in `docket`.

Validation of either option is that a repository which declines a principle produces an artifact
naming the declining decision, and a repository which never considered it does not — so the two
cases stop being observationally identical.
