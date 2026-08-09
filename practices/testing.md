# Testing

Implements `ENG-TEST-001`–`ENG-TEST-010` and `ENG-ARCH-002`. This guide adds no
rules; it records the technique the product repositories use to satisfy them.

## Layer the portfolio (`ENG-TEST-001`)

Three layers, sized as a pyramid:

| Layer | Runs against | Where it lives |
| --- | --- | --- |
| Domain | Pure functions, no framework, no network, no DOM | Beside the module |
| Integration | One real owned seam (storage, HTTP handler, migration) | `test/` or beside the seam |
| End-to-end | Named critical outcomes only | `e2e/` |

## Keep domain logic framework-free (`ENG-ARCH-002`, `ENG-TEST-001`)

Anything decidable without a renderer belongs in a plain `.ts` module with a
sibling `.test.ts`. The test imports the module directly — never a component
harness, and never a running server.

```
src/lib/scoring/rules.ts
src/lib/scoring/rules.test.ts   ← sibling, same directory
```

This is what makes the domain layer fast enough to be the widest part of the
pyramid. A domain test that needs `mount()` or `fetch` has escaped its layer;
move the logic out of the component instead of moving the test up a layer.

## Assert contracts, not structure (`ENG-TEST-002`)

Assert on public inputs, outputs, thrown errors, serialized schemas, and
migration results. Do not assert on private fields, call counts of internal
helpers, or snapshot blobs whose diff nobody reads. A refactor that preserves
observable behavior must not turn the suite red.

## Write the regression test first, at the narrowest boundary (`ENG-TEST-003`)

For every defect:

1. Write a test that **fails**, at the layer where the rule is actually obeyed.
2. Confirm it fails for the reason named in the defect, not an unrelated one.
3. Fix the code.
4. Confirm it passes.

A fix landed without step 1 has no evidence and regresses through the next
caller.

## Separate static signals from behavior tests (`ENG-TEST-004`)

Type-check, lint, format-check, build, and security scan each report
independently. None of them counts as test coverage, and a green lint stage is
never reported as proof of behavior.

The commands are uniform across the TypeScript repositories:

```bash
npm run lint          # eslint  — @jrmoulckers/eslint-config
npm run format:check  # prettier — @jrmoulckers/prettier-config
npm run typecheck     # tsc --noEmit — @jrmoulckers/tsconfig
npm test              # behavior only
npm run build
```

## Test both polarities (`ENG-TEST-007`)

Every guard needs a pair: one fixture that is accepted and one that is rejected.
A passing happy path alone does not prove the guard ran — it may prove the
fixture never reached the branch. For stateful operations, run the operation
twice and assert the invariant survives.

## Derive expected values independently (`ENG-TEST-009`)

A fixture must never compute its expectation by calling the implementation under
test; both then agree on the same defect. Use a hand-computed constant, an
independent oracle, or a stated invariant.

When a test pins an external real-world fact, record its revision, the date
observed, the method, and what should trigger a recheck.

## Make documented procedures executable (`ENG-TEST-010`)

If a verification procedure is written down and repeatable, it becomes an
assertion. Two worked examples from the product repositories:

- **Offline guarantee.** Rather than a doc saying "the app works offline", a test
  stubs `fetch` to reject and asserts it is never called during a core flow.
- **Error isolation.** Rather than a doc saying "a failing connector must not
  break the others", a test registers a throwing connector and asserts the
  registry records the failure against that connector alone and returns it as a
  value.

Where a manual step is genuinely unavoidable, name its owner, its evidence
format, and its expiry.
