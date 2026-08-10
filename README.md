# Engineering

Private authority for ratified engineering principles and reusable implementations. This
repository is proprietary and unlicensed; no permission to use, copy, modify, or distribute its
contents is granted.

## Owns

- Architecture and browser, frontend, API, backend, and data engineering
- Security and privacy mechanisms; testing, performance, and observability
- Local-first systems, build and release mechanisms, and shared libraries/configuration

## Does not own

- Product outcomes, obligations, or strategy
- Studio design systems, visual language, or UI expression
- Organization-wide GitHub, Copilot, agent, skill, or AI implementation

## Handoff model

Product defines outcomes. Engineering implements mechanisms and evidence. Studio expresses the
UI. `jrmoulckers/.github` automates the work. The repository owner alone ratifies engineering
principles; agents may only propose changes.

## Layout

| Layer                                            | What it is                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`principles/`](principles/README.md)            | Ratified `ENG-*` principles. Normative. Immutable once ratified; hash-validated in CI. |
| [`principles/index.json`](principles/index.json) | Generated machine-readable index of every principle ID, title, area, and path.         |
| [`practices/`](practices/README.md)              | How-to guidance. States no new rules; every normative sentence cites an `ENG-*` ID.    |
| [`packages/`](packages/)                         | Shared toolchain presets published to GitHub Packages as `@jrmoulckers/*`.             |
| [`configs/`](configs/)                           | Shared configuration for non-npm toolchains (currently `golangci.yml`).                |
| [`docs/adopting.md`](docs/adopting.md)           | How a consuming repository wires all of the above up.                                  |

## Status

The architecture, software platform, assurance, and operations principles are cataloged as
**Ratified** under [`principles/`](principles/README.md). Their Ratification becomes effective
only when the repository owner merges the matching
[Ratification decision](docs/ratification/2026-08-09-engineering-principles.md); an unmerged
status change is only a proposal.

Three shared configuration packages are published from this repository:
`@jrmoulckers/eslint-config`, `@jrmoulckers/prettier-config`, and `@jrmoulckers/tsconfig`. See
[`docs/adopting.md`](docs/adopting.md).

## Consuming this repository

Cite principles by ID (`ENG-LOCAL-003`), never by copying their text — no authority may restate
another authority's normative text in its own source tree. Resolve IDs to paths through
`principles/index.json`. Install the shared presets from GitHub Packages as devDependencies.
Full instructions live in [`docs/adopting.md`](docs/adopting.md).

## Working in this repository

```sh
npm ci
npm test                 # shared configuration package tests
npm run principles:check # fail if principles/index.json has drifted
npm run principles:index # regenerate the index after adding a principle
```

Ratified principle `.md` files must not be edited: CI enforces an immutable semantic hash over
each one.

## Near-term roadmap

1. Apply the ratified principles through reviewed engineering decisions.
2. Record consequential implementation decisions as ADRs.
3. Migrate the product repositories onto the shared presets and `ENG-*` citations.
