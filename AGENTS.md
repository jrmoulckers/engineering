# Agent instructions

Use the canonical agent definitions, skills, and organization-wide instructions
from [`jrmoulckers/.github`](https://github.com/jrmoulckers/.github). Do not copy
them into this repository.

Treat ratified local engineering principles as required instructions once their
Ratification is effective through repository-owner merge of a matching decision
record. On unmerged branches, Ratified metadata remains a proposal. Do not infer
engineering rules from Studio's legacy taxonomy.

Agents may propose principles and ADRs, but only the repository owner may ratify
them. Keep proposals within Engineering's authority and preserve the Product to
Engineering to Studio to `.github` handoff.

## Repository layers

- `principles/` — normative `ENG-*` principles. **Never edit a ratified
  principle `.md` file**; CI enforces an immutable semantic hash over each one.
  Propose changes as a new principle plus a ratification decision record.
- `principles/index.json` — generated. Regenerate with
  `npm run principles:index` whenever a principle is added.
  `npm run principles:check` fails the build on drift.
- `practices/` — how-to guidance. Practices must not introduce rules. Every
  normative sentence must cite the `ENG-*` ID it derives from.
- `packages/` — shared toolchain presets published as `@jrmoulckers/*`. Changes
  need a test in the package's `test/` directory and a version bump.
- `configs/` — shared configuration for non-npm toolchains.

Run `npm test` and `npm run principles:check` before proposing changes.
