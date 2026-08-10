# Testing

Implements `ENG-TEST-001`–`ENG-TEST-010` and `ENG-ARCH-002`. This guide adds no rules; it
records the technique the product repositories use to satisfy them.

## Layer the portfolio (`ENG-TEST-001`)

Three layers, sized as a pyramid:

| Layer       | Runs against                                           | Where it lives             |
| ----------- | ------------------------------------------------------ | -------------------------- |
| Domain      | Pure functions, no framework, no network, no DOM       | Beside the module          |
| Integration | One real owned seam (storage, HTTP handler, migration) | `test/` or beside the seam |
| End-to-end  | Named critical outcomes only                           | `e2e/`                     |

## Keep domain logic framework-free (`ENG-ARCH-002`, `ENG-TEST-001`)

Anything decidable without a renderer belongs in a plain `.ts` module with a sibling `.test.ts`.
The test imports the module directly — never a component harness, and never a running server.

```
src/lib/scoring/rules.ts
src/lib/scoring/rules.test.ts   ← sibling, same directory
```

This is what makes the domain layer fast enough to be the widest part of the pyramid. A domain
test that needs `mount()` or `fetch` has escaped its layer; move the logic out of the component
instead of moving the test up a layer.

## Assert contracts, not structure (`ENG-TEST-002`)

Assert on public inputs, outputs, thrown errors, serialized schemas, and migration results. Do
not assert on private fields, call counts of internal helpers, or snapshot blobs whose diff
nobody reads. A refactor that preserves observable behavior must not turn the suite red.

## Write the regression test first, at the narrowest boundary (`ENG-TEST-003`)

For every defect:

1. Write a test that **fails**, at the layer where the rule is actually obeyed.
2. Confirm it fails for the reason named in the defect, not an unrelated one.
3. Fix the code.
4. Confirm it passes.

A fix landed without step 1 has no evidence and regresses through the next caller.

## Separate static signals from behavior tests (`ENG-TEST-004`)

Type-check, lint, format-check, build, and security scan each report independently. None of them
counts as test coverage, and a green lint stage is never reported as proof of behavior.

The commands are uniform across the TypeScript repositories:

```bash
npm run lint          # eslint  — @jrmoulckers/eslint-config
npm run format:check  # prettier — @jrmoulckers/prettier-config
npm run typecheck     # tsc --noEmit — @jrmoulckers/tsconfig
npm test              # behavior only
npm run build
```

## Verify from a clean environment, and prove generated output reproduces (`ENG-TEST-005`)

A release-blocking check is only evidence if it runs somewhere that carries nothing from the last
run. Two separate obligations hide in this principle, and the second is the one repositories skip.

**Clean and frozen.** A fresh runner, a pinned toolchain, and `npm ci` rather than `npm install`.
`npm ci` fails when the lockfile disagrees with `package.json`; `npm install` rewrites the
lockfile to make the disagreement go away, so a suite that passes under it has verified an
unreviewed dependency tree. A check that passes twice in a row on the same dirty machine and
fails on a clean one was never evidence.

**Generated interfaces reproduce deterministically.** Anything derived — a generated client, a
schema, an index, a lockfile — must be reproducible from its source and byte-identical to what is
committed. Otherwise the committed copy is a claim rather than an artifact, and it drifts silently
until someone regenerates it during an unrelated change and finds a diff nobody can explain.

The check is: regenerate, then compare against the committed copy, and fail on any difference.
This repository does it for the principle index, which is derived from the principle files:

```bash
npm run principles:check   # regenerates the index and fails if it differs from the committed one
```

That check runs in `publish.yml` **before** the packages are published, because publishing an
artifact built from a stale derived file is exactly the failure this prevents.

Where output is legitimately non-deterministic — an embedded timestamp, a build path — normalize
it explicitly and document the normalization. "It differs but only in ways that don't matter" is
only acceptable when the ways are named in code that enforces it.

## Cover in proportion to risk, not to a percentage (`ENG-TEST-006`)

A global coverage percentage is the wrong instrument, because it is satisfied most cheaply by
testing the code that matters least. Getters and mappers are easy to cover and carry no risk;
the decision branch that reconciles conflicting records is hard to cover and carries all of it.
A repository can hit 90% and have never executed the branch that will page someone.

Three things earn tests regardless of what the percentage says:

- **Behaviour that changed in this pull request.** Not the file — the behaviour.
- **The cause of a defect.** The test asserts the cause, not the symptom that was reported.
- **A shared contract.** Anything another repository or another layer depends on, because its
  blast radius is not local and its breakage surfaces far from its cause.

Read coverage reports for **branch and decision gaps**, not the headline number. An uncovered
branch is a specific question — "what happens when this is null?" — and the report is most useful
as a list of questions nobody has answered yet.

Exclusions are legitimate and must be scoped, justified, and owned:

```js
/* c8 ignore next 3 — platform bridge, exercised by the e2e suite; owner: @jrmoulckers */
```

An exclusion with no rationale is indistinguishable from an oversight six months later, and an
unowned one never gets revisited.

## Test both polarities (`ENG-TEST-007`)

Every guard needs a pair: one fixture that is accepted and one that is rejected. A passing happy
path alone does not prove the guard ran — it may prove the fixture never reached the branch. For
stateful operations, run the operation twice and assert the invariant survives.

## Prove the test can fail (`ENG-TEST-008`)

A passing suite proves the tests ran. It does not prove any of them would notice if the behaviour
broke. The way to establish that is to break the behaviour on purpose and confirm a specific test
fails for a specific reason.

Do it as a scoped, deliberate mutation rather than as an aggregate mutation score. A percentage
across a codebase is expensive to produce and tells you almost nothing actionable; one mutation
against one risk-bearing decision, with the discriminating assertion named, is cheap and is
evidence.

A worked example from this repository. `scripts/check-coverage.mjs` calls `stripClaim()` to remove
a guide's leading `Implements …` header before counting citations — the whole reason coverage is
measured from what a guide _does_ rather than what it _claims_. That is a risk-bearing decision,
so it should be provably tested. Mutate it to a no-op, which is precisely the pre-fix behaviour
that once hid four phantom-covered principles:

```js
export function stripClaim(source) {
  return source; // mutation: the header is no longer stripped
}
```

Then run the suite:

```
✖ a guide header cannot cover a principle its body never implements
✔ a guide with no Implements line is left intact
```

Exactly one test fails, it is the one whose name describes the mutated behaviour, and the other
does not — which shows the assertion discriminates this defect rather than merely being sensitive
to any change. That named failure is the evidence; "mutation score 74%" is not.

Restore the source immediately and confirm the suite is green again. The mutation is a probe, and
a probe that gets committed becomes a defect.

Reach for this when a test is load-bearing and cheap to fool: security guards, permission checks,
reconciliation and conflict-resolution logic, and any assertion whose fixture was built by
copying the implementation's output. If a mutation survives, the test is decorative — the useful
outcome, since a decorative test is worse than no test for reading as protection that isn't there.

**The same doubt applies to lint rules, which are tests you did not write.** A clean run proves a
rule found nothing; it does not prove the rule can see the thing you are relying on it to catch.
A measured example: a codebase had seven hook wrappers evading React's rules-of-hooks contract,
and `react-hooks/rules-of-hooks` flagged **two**. It matches the destructured form,

```js
const { goals } = useGoals(); // flagged
```

but not the inline one, which is the same violation:

```js
return { goals: useGoals().goals }; // not flagged
```

Nobody would have known from the run. Before treating a rule as a control, mutate a file to
introduce the violation it supposedly catches and confirm it fires in _the shape your code
actually takes_ — then rely on it only for that shape.

## Derive expected values independently (`ENG-TEST-009`)

A fixture must never compute its expectation by calling the implementation under test; both then
agree on the same defect. Use a hand-computed constant, an independent oracle, or a stated
invariant.

When a test pins an external real-world fact, record its revision, the date observed, the
method, and what should trigger a recheck.

## Make documented procedures executable (`ENG-TEST-010`)

If a verification procedure is written down and repeatable, it becomes an assertion. Two worked
examples from the product repositories:

- **Offline guarantee.** Rather than a doc saying "the app works offline", a test stubs `fetch`
  to reject and asserts it is never called during a core flow.
- **Error isolation.** Rather than a doc saying "a failing connector must not break the others",
  a test registers a throwing connector and asserts the registry records the failure against
  that connector alone and returns it as a value.

Where a manual step is genuinely unavoidable, name its owner, its evidence format, and its
expiry.
