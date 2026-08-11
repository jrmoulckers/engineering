# Architecture decisions

Use ADRs only for consequential decisions with durable tradeoffs. Do not create ADRs for
hypothetical systems, routine implementation details, or decisions owned by Product, Studio, or
`jrmoulckers/.github`.

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

Agents may author `Proposed` records. Only the repository owner may mark one `Accepted`;
superseding records must link the decision they replace.

## Numbering and naming across repositories

Consuming repositories use the same convention: `docs/architecture/NNNN-kebab-slug.md`, four
digits, no `adr-` prefix — the directory already says what these are.

**Numbers are repository-local.** One repository's `0001` and another's are unrelated documents,
and there is deliberately no cross-repository ADR namespace. Cite an ADR from outside its
repository by repository and number together (`docket ADR-0001`), never by bare number. Principle
IDs (`ENG-*`) are the only fleet-wide identifiers; if a decision needs to bind more than one
repository it belongs in a principle or in `jrmoulckers/.github`, not in an ADR that another
repository is expected to follow.

**Rename and link rewrite land in one commit.** Dropping an `adr-` prefix is a one-line change per
file and a large number of dead links otherwise — one repository counted 49 inbound occurrences
across 9 files, most of them in a single architecture overview. Grep for the old form before
committing, not after.
