# Engineering practices

Practices are the **how**. Each guide translates one or more ratified
[principles](../principles/README.md) into concrete, reviewable technique for the stacks in use
across the product repositories.

## The rule that keeps this layer honest

A practice guide **never states a new rule**. Every normative sentence here must trace to an
`ENG-*` principle by ID. If a guide needs a rule that no principle covers, that is a signal to
propose a principle — not to write the rule here. Only the repository owner may ratify a
principle; see [`AGENTS.md`](../AGENTS.md).

Practices may change freely as tooling changes. Principles may not.

| Layer         | Answers                                        | Changes when                  | Ratified |
| ------------- | ---------------------------------------------- | ----------------------------- | -------- |
| `principles/` | What must be true, and what evidence proves it | Rarely, by owner ratification | Yes      |
| `practices/`  | How to satisfy it in a given stack             | Whenever tooling changes      | No       |
| `packages/`   | Executable enforcement of the above            | Continuously, by semver       | No       |

## Guides

| Guide                                         | Principles it implements                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Testing](testing.md)                         | `ENG-TEST-001`–`ENG-TEST-010`, `ENG-ARCH-002`                                                |
| [Resilience](resilience.md)                   | `ENG-LOCAL-004`, `ENG-WEB-002`, `ENG-INT-001`–`ENG-INT-005`                                  |
| [Observability](observability.md)             | `ENG-OBS-001`–`ENG-OBS-007`                                                                  |
| [Frontend layering](frontend-layering.md)     | `ENG-ARCH-001`, `ENG-WEB-004`                                                                |
| [Local-first sync](local-first-sync.md)       | `ENG-LOCAL-001`–`ENG-LOCAL-004`, `ENG-DATA-001`–`ENG-DATA-003`                               |
| [Performance budgets](performance-budgets.md) | `ENG-WEB-003`, `ENG-PERF-001`, `ENG-PERF-002`, `ENG-PERF-005`–`ENG-PERF-008`, `ENG-TEST-004` |
| [Go services and tools](go.md)                | `ENG-ARCH-001/002/004`, `ENG-API-001`, `ENG-TEST-001/004/007/010`, `ENG-BUILD-001`           |

## Coverage is measured, not asserted

`npm run coverage:check` reports how many ratified principles have an implementing guide and
fails if the known gaps grow. It deliberately **ignores each guide's leading `Implements` line**
and counts only body citations, because a header can claim a principle that no section delivers.
Range notation made that failure concrete: `ENG-BUILD-001`–`ENG-BUILD-008` marked both endpoints
covered while implementing only the first, and said nothing at all about the six in between.

Run `npm run coverage:list` to see the current gaps by area. A principle with no guide is not a
licence to write the rule locally — it is a signal to propose a technique here.

## Boundaries

These guides describe Engineering mechanisms only. Reference, but never restate:

- **Product** — outcome obligations and acceptance criteria.
- **Studio** — visual, interaction, accessibility expression, and design tokens.
- **`jrmoulckers/.github`** — GitHub, Actions, Copilot, agents, and distribution.
