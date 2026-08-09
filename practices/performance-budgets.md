# Performance budgets

Implements `ENG-WEB-003` and `ENG-PERF-001`–`ENG-PERF-009`. This guide adds no
rules.

## Two budgets, not one (`ENG-WEB-003`)

`ENG-WEB-003` requires **separate delivery and runtime budgets**. A bundle-size
gate alone satisfies half the principle: a small bundle can still block the main
thread, and a repository that measures only kilobytes has no signal for the half
that users actually feel.

| Budget | Measures | Enforced by |
| --- | --- | --- |
| Delivery | Transferred bytes per route | Bundle-size gate in CI |
| Runtime | Interaction responsiveness, long tasks | Lighthouse or an equivalent runtime probe |

## Delivery budget

Set it per route, not only for the whole application — a single heavy route is
invisible in an aggregate total. Current baselines in use:

| Application shape | Budget |
| --- | --- |
| Offline-capable PWA with local storage and sync | 2048 KB |
| Web client with a server backend | 1536 KB |

These are **starting points, not targets to grow into**. Raising a budget is a
decision that needs a recorded reason; a budget that only ever ratchets upward
is a budget in name only.

## Runtime budget

Foreground interaction outranks background work (`ENG-WEB-003`). Background
tasks — sync, indexing, prefetch — yield under foreground load rather than
competing with it.

Every fallible operation carries a timeout and a progress signal. Without both,
a slow path and a hung path are indistinguishable to the user and to the
operator.

## Measure before optimizing (`ENG-PERF-001`)

Record a baseline, change one thing, re-measure with the same method. An
optimization with no before-measurement cannot be shown to have worked, and is
just as likely to have cost complexity for nothing.

## Budget failures are build failures (`ENG-TEST-004`)

A budget that reports without blocking is documentation. It gates the merge, or
it does not exist.

The gate belongs in CI, which `jrmoulckers/.github` owns and implements.
Engineering owns the budget values and the measurement method; the workflow
wiring is `.github`'s.
