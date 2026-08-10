import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePrinciples } from '../build-principles-index.mjs';

const UNWRAPPED = `# Area

## Typed versioned APIs

- ID: ENG-API-001
- Status: Ratified
- Statement: Parse every API request into a typed, versioned contract and return only structured safe responses and errors.
- Rationale: Trust-boundary validation lets clients evolve.
- Evidence: Contract tests cover accepted and rejected payloads.
`;

// What Prettier produces from UNWRAPPED with proseWrap: always.
const WRAPPED = `# Area

## Typed versioned APIs

- ID: ENG-API-001
- Status: Ratified
- Statement: Parse every API request into a typed, versioned contract and return only
  structured safe responses and errors.
- Rationale: Trust-boundary validation lets clients evolve.
- Evidence: Contract tests cover accepted and rejected payloads.
`;

test('parses a single-line principle', () => {
  const [p] = parsePrinciples(UNWRAPPED, 'principles/x.md');
  assert.equal(p.id, 'ENG-API-001');
  assert.equal(p.title, 'Typed versioned APIs');
  assert.equal(
    p.statement,
    'Parse every API request into a typed, versioned contract and return only structured safe responses and errors.',
  );
});

test('a wrapped field keeps its full value, not just the first line', () => {
  const [wrapped] = parsePrinciples(WRAPPED, 'principles/x.md');
  const [flat] = parsePrinciples(UNWRAPPED, 'principles/x.md');

  // The regression: continuation lines were dropped, silently truncating the
  // statement at the wrap column. Reflowing a file must not change meaning.
  assert.equal(wrapped.statement, flat.statement);
  assert.deepEqual(wrapped, flat);
});

test('a continuation does not leak into the following field', () => {
  const [p] = parsePrinciples(WRAPPED, 'principles/x.md');
  assert.equal(p.rationale, 'Trust-boundary validation lets clients evolve.');
  assert.equal(p.evidence, 'Contract tests cover accepted and rejected payloads.');
});

test('a blank line closes an open field', () => {
  const source = `## Title

- ID: ENG-X-001
- Statement: First line
  continued here.

  Loose prose that is not part of the list.
`;
  const [p] = parsePrinciples(source, 'principles/x.md');
  assert.equal(p.statement, 'First line continued here.');
});

test('unknown fields are ignored and do not capture continuations', () => {
  const source = `## Title

- ID: ENG-X-001
- Note: something irrelevant
  that wraps onto a second line.
- Statement: Real statement.
`;
  const [p] = parsePrinciples(source, 'principles/x.md');
  assert.equal(p.statement, 'Real statement.');
  assert.equal(p.note, undefined);
});

test('sections without an ID are not emitted', () => {
  const source = `## Preamble

Some prose with no fields.

## Real

- ID: ENG-X-002
- Statement: Kept.
`;
  const parsed = parsePrinciples(source, 'principles/x.md');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'ENG-X-002');
});
