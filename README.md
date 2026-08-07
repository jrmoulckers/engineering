# Engineering

Engineering is the canonical authority for JRM software-engineering principles and
reusable engineering implementations.

## Scope

This repository owns technical mechanisms and evidence for:

- architecture; browser/frontend, API/backend, and data engineering;
- security and privacy implementation, testing, performance, and observability;
- local-first behavior, build and release mechanics, shared engineering configuration;
- reusable libraries when a demonstrated need justifies a stable contract.

It does not own visual or UI language (Studio), product strategy or obligations
(Product), or GitHub, Copilot, and AI implementation (`.github`).

## Boundary model

Product defines the obligation and outcome. Engineering defines the technical
mechanism and evidence. Studio defines the user-facing expression. `.github`
automates checks and distribution.

## Status

Milestone 1, unit E0.1 establishes the authority boundary only. No engineering
principle or reusable package contract is ratified. This private repository is
**UNLICENSED**: no permission to use, copy, modify, or distribute its contents is
granted.

## Near-term roadmap

1. Propose and owner-ratify the first domain-specific engineering principles.
2. Record accepted cross-cutting decisions in `docs/architecture/`.
3. Add shared implementations only after a concrete consumer proves the need and
   contract; remain registry-free unless a later decision changes that direction.

## Repository check

Run `pwsh -NoProfile -File scripts/check-repository.ps1`.

The check verifies the required authority entry points and LF-normalized tracked
text. There is no hosted CI yet: workflow automation belongs in the canonical
`.github` authority and should be added only when that integration is defined.
