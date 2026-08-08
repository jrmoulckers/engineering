# Boundaries and contracts

- ID: ENG-ARCH-001
- Status: Draft
- Statement: Design the smallest explicit boundary that preserves acyclic dependencies, stable contracts, and reproducible outcomes.
- Rationale: Narrow, directional seams keep systems understandable and allow implementations to change without surprising consumers.
- Evidence: Dependency graphs are acyclic; public contracts are typed and versioned; compatibility tests cover additive evolution; consequential tradeoffs have ADRs; equivalent inputs produce equivalent build outputs.
- Owner and ratification: Engineering owns this Draft's generic architecture and contract mechanisms; the repository owner alone may ratify it.
- Handoff: Product defines required outcomes, Studio owns UI and design contracts, and [`jrmoulckers/.github`](https://github.com/jrmoulckers/.github/blob/main/docs/architecture/0003-four-authority-topology.md) owns GitHub, Copilot, AI, automation, sync, and distribution.
- Legacy inputs: `studio-legacy:architecture:1`, `studio-legacy:architecture:2`, `studio-legacy:architecture:3`, `studio-legacy:architecture:4`, `studio-legacy:architecture:5`, `studio-legacy:architecture:6`, `studio-legacy:architecture:7`, `studio-legacy:architecture:8`, `studio-legacy:architecture:9`, `studio-legacy:architecture:10`, `studio-legacy:architecture:11`, `studio-legacy:architecture:12`, `studio-legacy:architecture:13`, `studio-legacy:security:3`, `studio-legacy:testing:1.4`

## Rule

- Point dependencies inward toward stable policy; split cycles rather than hiding them.
- Put explicit typed contracts at module, process, and platform seams. Evolve them additively and reserve breaking changes for a declared version boundary.
- Choose the simplest boundary that meets current evidence, expose the least data and surface needed, and keep each fact in one authoritative home.
- Name assets, entry points, and trust boundaries before adding a package, build step, or externally fed input.
- Record consequential, durable tradeoffs as ADRs, not routine implementation choices.
- Treat deterministic builds as an architectural invariant. E1.2 may define implementation mechanics without weakening reproducibility.
- Keep public contracts and policy modules consumer-runtime-neutral when practical; let each platform render through its own implementation and test rules without a renderer.
