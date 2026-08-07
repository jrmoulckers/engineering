# Architecture decisions

Record accepted or proposed cross-cutting technical decisions here as
`ADR-NNNN-short-title.md`. Number ADRs sequentially; never reuse a number.

An ADR must contain:

```markdown
# ADR-NNNN: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context
Decision forces, constraints, affected systems, and ownership seams.

## Decision
The chosen approach and compatibility contract.

## Consequences
Benefits, costs, risks, owners, and follow-up work.

## Recovery
Rollback or last-known-good path, including no-lockout constraints.
```

Compare viable alternatives against simplicity, least-data privacy,
platform-native behavior, performance, and recoverability. Do not create an ADR
until a concrete decision is proposed.
