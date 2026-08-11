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

| Guide                                         | Principles it implements                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Testing](testing.md)                         | `ENG-TEST-001`–`ENG-TEST-010`, `ENG-ARCH-002`                                                                 |
| [Resilience](resilience.md)                   | `ENG-LOCAL-004`, `ENG-WEB-002`, `ENG-INT-001`–`ENG-INT-003`                                                   |
| [API and backend services](api-services.md)   | `ENG-API-002`–`ENG-API-004`, `ENG-INT-005`                                                                    |
| [Observability](observability.md)             | `ENG-OBS-001`–`ENG-OBS-007`                                                                                   |
| [Security](security.md)                       | `ENG-SEC-002`–`ENG-SEC-008`                                                                                   |
| [Build and release](build-and-release.md)     | `ENG-BUILD-002`–`ENG-BUILD-008`                                                                               |
| [Frontend layering](frontend-layering.md)     | `ENG-ARCH-001`, `ENG-WEB-004`                                                                                 |
| [Local-first sync](local-first-sync.md)       | `ENG-LOCAL-001`–`ENG-LOCAL-004`, `ENG-DATA-001`                                                               |
| [Event and data contracts](data-contracts.md) | `ENG-DATA-002`, `ENG-DATA-003`                                                                                |
| [Performance budgets](performance-budgets.md) | `ENG-WEB-003`, `ENG-PERF-001`, `ENG-PERF-002`, `ENG-PERF-005`, `ENG-PERF-007`, `ENG-PERF-008`, `ENG-TEST-004` |
| [Native profiling](native-profiling.md)       | `ENG-PERF-007`, and the native halves of `ENG-PERF-001`, `ENG-PERF-002`, `ENG-PERF-008`, `ENG-OBS-004`        |
| [Go services and tools](go.md)                | `ENG-ARCH-001/002/004`, `ENG-API-001`, `ENG-TEST-001/004/007/010`, `ENG-BUILD-001`                            |

## Coverage is measured, not asserted

`npm run coverage:check` reports how many ratified principles have an implementing guide and
fails if the known gaps grow. It counts **only the principle IDs named in a guide's section
headings**, because a heading is where a guide declares what a section delivers. Three shapes
contain an ID without implementing anything, and all three were live here:

- A leading `Implements` claim. Range notation made it concrete: `ENG-BUILD-001`–`ENG-BUILD-008`
  marked both endpoints covered while implementing only the first, and said nothing at all about
  the six in between.
- A cross-reference to the guide that does implement it.
- A sentence stating a principle is **not** implemented yet. `performance-budgets.md` named three
  such principles in prose and the ratchet scored all three as covered — reading the note as its
  own refutation.

So implementing a principle means saying so in a heading. That is the discipline the guides
already follow, and it makes the reported number mean what it says.

Run `npm run coverage:list` to see the current gaps by area. A principle with no guide is not a
licence to write the rule locally — it is a signal to propose a technique here.

## Boundaries

These guides describe Engineering mechanisms only. Reference, but never restate:

- **Product** — outcome obligations and acceptance criteria.
- **Studio** — visual, interaction, accessibility expression, and design tokens.
- **`jrmoulckers/.github`** — GitHub, Actions, Copilot, agents, and distribution.
