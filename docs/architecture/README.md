# Architecture decisions

Use ADRs only for consequential decisions with durable tradeoffs. Do not create ADRs for
hypothetical systems, routine implementation details, or decisions owned by Product, Studio, or
`jrmoulckers/.github`.

Name records `NNNN-short-title.md`. Keep them concise and use this structure:

```markdown
# ADR-NNNN: Decision title
```

**The `NNNN-` form governs filenames only. Keep `ADR-NNNN` in headings and prose.** A consumer
asked for an explicit ruling rather than restyling eleven records on an inference, which was the
right call — the template previously showed a bare `# NNNN:` heading and so implied the opposite.
The reasoning is theirs and it is correct: a bare number is ambiguous in running text, where "see
0009" reads as a quantity, while a filename has directory context and needs no prefix. The label is
doing real work in prose and none in the path.

```markdown
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

> **The collision is not hypothetical, and the qualifier is required rather than tidy.** `ADR-0003`
> currently denotes at least two different decisions — `jrmoulckers/.github`'s and a product
> repository's `0003-decky-v1-abi-preservation.md` — and this repository's `ADR-0001` (two-channel
> delivery) collides with another repository's two-tree topology.
>
> A consumer had to point out that this section's own two rules — numbers are repo-local, and
> decisions are cited by ID — make a bare `ADR-NNNN` **ambiguous by construction**. It had already
> misled a reader into looking for a third repository's record. Bare numbers are safe **only inside
> the repository that owns them**, which is why the fenced examples elsewhere in these docs show
> consumers writing bare IDs in their own files.
>
> Two places the rule is easy to break because they do not look like documents: **anything written
> to another repository** — a message, a review comment, an issue — and **any document a consumer
> reads**, such as `docs/adopting.md`. Both are cross-repository citations even when the file lives
> here, and a bare number in either is resolved against the reader's repository, not the author's.

**Rename and link rewrite land in one commit.** Dropping an `adr-` prefix is a one-line change per
file and a large number of dead links otherwise — one repository counted 49 inbound occurrences
across 9 files, most of them in a single architecture overview. Grep for the old form before
committing, not after.

**Count the records before scoping the rename.** A second repository was told to rename six and
had eleven. A script scoped to the count someone else is holding leaves the remainder
non-conforming _and_ its links broken, and that state lints clean, typechecks, tests and builds.
Derive the count from `ls docs/architecture/`, never from an instruction.

**Assert that every link target resolves on disk — no standard gate does this.** The same
repository ran lint, `format:check`, typecheck, tests and build green, then separately checked
that all 48 rewritten `NNNN-*.md` targets resolved relative to their referring file. A rename that
silently drops a link passes all five gates without complaint. If you ask a repository to do this
work, ask for the link check explicitly, because "gates green" does not cover it.

Two details from that pass worth carrying:

- **Source comments cite records too.** Three `file:line` citations lived in application source,
  not in docs, and used the old stem. A doc-scoped pass would not have touched them and nothing
  would have failed.
- **`git mv`, then verify the rename was detected.** `git diff -M` reporting renames rather than
  rewrites is what preserves history; confirm the content diff is zero bytes.

### Duplicate numbers are an allocation race, not a discipline problem

When two records claim the same number, the useful framing is not "numbers must be unique" — the
author of the second `0003` believed theirs was unique. Both authors read the index in parallel,
both saw `0002` as the highest, and both were correct at the moment they looked.

**Claim the number in the index in a separate commit before writing the record.** The collision
then surfaces as a merge conflict, which is loud, rather than as two valid-looking files that both
pass review. Restating the uniqueness rule does not prevent the race; sequencing the claim does.

When a duplicate has already landed, keep the earlier record at its number with a forward pointer,
give the later one a fresh number, and cross-link both. Renumbering the earlier record breaks every
inbound citation to it, including any in source comments.
