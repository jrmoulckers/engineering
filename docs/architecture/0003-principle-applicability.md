# 0003: Record principle applicability instead of inferring it from silence

- Status: Proposed
- Date: 2026-08-11
- Owner: repository owner

## Context

`docket` holds Accepted architecture decisions that contradict the Ratified `ENG-LOCAL-001`, which
requires the device's durable store to be the system of record. `docket` has a device durable store
and has deliberately placed authority on the server: `ADR-0001` establishes one canonical server with
"no client-owned truth", and `ADR-0003` makes the client an optimistic cache behind a
server-authoritative mutation log.

No principle in the catalog states the conditions under which it applies. That has been harmless for
the other platform areas because their non-applicability is vacuous — a headless service has no
browser, so `ENG-WEB-*` has no subject to rule on. `ENG-LOCAL-001` is the first case where the
subject exists and the ruling was declined on purpose.

The consequence is not that `docket` is silent. `docket` wrote the declination into
`ARCHITECTURE.md`, naming the principle, the carve-out, and the reasoning, and cited `ENG-LOCAL-001`
four times. The consequence is that **an audit run by the author of the principle, one day later,
searching specifically for this, did not find it** — see Evidence. A repository that considers a
principle and declines it in prose is not discoverable at fleet scale, so its position cannot be
distinguished from one that never read it without reading every repository by hand.

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
`ENG-LOCAL-002` through `004`. `docket` satisfies or exceeds all three across two records — ADR-0001
for the connector seam (declared directionality, idempotent `(providerId, externalId)` keying,
upstream tombstones, a documented both-sides-changed rule, a reconciliation path) and ADR-0003 for
the client-server seam (`expectedVersion` conflict detection, retained tombstones, replay from
cursor `0`, per-mutation independence). A declared conflict model is more load-bearing when
replication is the normal case, not less.

A second constraint emerged from `docket`'s review and is the sharper one: **scoping `ENG-LOCAL-001`
alone does not resolve `docket`'s position.** `ENG-LOCAL-002`'s Evidence clause ends "local data
remains authoritative", and its Rationale calls sync "not the authority for local-first data" — both
restate `001`'s ruling inside a principle whose Statement is platform-independent and which `docket`
otherwise satisfies. Applicability must therefore attach per clause, or the mechanism will certify
`ENG-LOCAL-002` as satisfied for a repository that fails its Evidence clause as literally written.
Whether the remedy is a constraint on the scoping rule or a scoping amendment to `ENG-LOCAL-002`
itself is the owner's call; both are Ratified text.

Whatever is adopted must distinguish **out-of-scope** from **non-compliant**. `docket` is the first;
a repository that simply has not done the work is the second. A mechanism that cannot tell them
apart recreates the problem it is fixing, one level up.

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
the system of record.

**The original silence claim was false and is withdrawn.** It read: "established by code search
across the consuming repositories, which returns zero `ENG-LOCAL-001` citations in `docket`."
`docket` cited it four times, on `main`, including an explicit declination in `ARCHITECTURE.md`
merged 22 hours before this record was written.

The search was the defect. GitHub code search returns `total_count: 0` for every query against
`docket`, including the word `docket` itself. Across the fleet, a query for a word certain to be
present returns `0` for a private repository, `0` for a public-but-unindexed repository
(`engineering` itself), a real count for an indexed public one (`jrm-recipes`, 1204), and HTTP 403
once the search rate limit is exhausted part way through a nine-repository scan — where `--jq
'.total_count'` yields nothing, which reads as zero to any caller that does not check the status.

Three different non-answers, all shaped like "no citations". No shipped tooling in this repository
uses the search API, so nothing needs fixing in code; the defect was in the audit method. The rule
adopted going forward: **a search-based audit must carry a positive control per repository — a query
for a string known to be present — and must treat a non-2xx response as unknown rather than zero.**
Absence of results is evidence about an index, not about a repository.

That correction strengthens the case rather than weakening it. The claim is no longer "declining
repositories are silent", which one grep refuted, but "a prose declination is undiscoverable at
fleet scale, even to a motivated searcher who wrote the principle" — demonstrated by this record's
own first draft. A further demonstration comes from `docket` itself: two of its source files cited
`ENG-LOCAL-001` while describing `ENG-LOCAL-002`'s statement, a contradiction inside a single
repository that prose could not prevent and a machine-readable declination would make checkable
(`docket` issue #166, since fixed).

Validation of either option is that a repository which declines a principle produces an artifact
naming the declining decision, and a repository which never considered it does not — so the two
cases stop being observationally identical, and can be checked without a working search index.
