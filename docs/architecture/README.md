# Architecture decisions

Use ADRs only for consequential decisions with durable tradeoffs. Do not create
ADRs for hypothetical systems, routine implementation details, or decisions
owned by Product, Studio, or `jrmoulckers/.github`.

Name records `NNNN-short-title.md`. Keep them concise and use this structure:

```markdown
# NNNN: Decision title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Owner: repository owner

## Context

What forces require a decision?

## Decision

What will Engineering do?

## Consequences

What becomes easier, harder, or constrained?

## Evidence

How will the decision be validated?
```

Agents may author `Proposed` records. Only the repository owner may mark one
`Accepted`; superseding records must link the decision they replace.
