// citations-check: ignore-file -- builds deliberately-invalid citation fixtures.
import { test, describe } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
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
  const [p] = parsePrinciples(UNWRAPPED, 'principles/x.md').principles;
  assert.equal(p.id, 'ENG-API-001');
  assert.equal(p.title, 'Typed versioned APIs');
  assert.equal(
    p.statement,
    'Parse every API request into a typed, versioned contract and return only structured safe responses and errors.',
  );
});

test('a wrapped field keeps its full value, not just the first line', () => {
  const [wrapped] = parsePrinciples(WRAPPED, 'principles/x.md').principles;
  const [flat] = parsePrinciples(UNWRAPPED, 'principles/x.md').principles;

  // The regression: continuation lines were dropped, silently truncating the
  // statement at the wrap column. Reflowing a file must not change meaning.
  assert.equal(wrapped.statement, flat.statement);
  assert.deepEqual(wrapped, flat);
});

test('a continuation does not leak into the following field', () => {
  const [p] = parsePrinciples(WRAPPED, 'principles/x.md').principles;
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
  const [p] = parsePrinciples(source, 'principles/x.md').principles;
  assert.equal(p.statement, 'First line continued here.');
});

test('unknown fields are ignored and do not capture continuations', () => {
  const source = `## Title

- ID: ENG-X-001
- Note: something irrelevant
  that wraps onto a second line.
- Statement: Real statement.
`;
  const [p] = parsePrinciples(source, 'principles/x.md').principles;
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
  const parsed = parsePrinciples(source, 'principles/x.md').principles;
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'ENG-X-002');
});

test('an unrecognised field is reported, not silently dropped', () => {
  // A `Scope:` field was proposed by an adopter, added to a principle, and
  // vanished without a word: the index built clean and simply did not have it.
  // A field that does nothing is worse than one that is rejected, because the
  // author believes it took effect.
  const source = `
## Local durable ownership

- ID: ENG-X-003
- Statement: Kept.
- Scope: products whose device store is the system of record
`;
  const { principles, unknown } = parsePrinciples(source, 'principles/x.md');
  assert.equal(principles.length, 1, 'the principle itself still parses');
  assert.deepEqual(
    unknown.map((u) => u.name),
    ['Scope'],
    'the unrecognised field must be named so the author can see it did nothing',
  );
});

test('fields that are deliberately not indexed are not reported as unknown', () => {
  // Without this the guard would fire on every real principle at once, and the
  // fix would be to delete the guard.
  const source = `
## Local durable ownership

- ID: ENG-X-004
- Statement: Kept.
- Owner and ratification: Engineering owns this.
- Handoff: Reference Product.
- Legacy inputs: \`studio-legacy:local-first:1\`
- Legacy input scope: narrow
`;
  const { principles, unknown } = parsePrinciples(source, 'principles/x.md');
  assert.equal(principles.length, 1);
  assert.deepEqual(unknown, []);
});

// The catalog contradicted itself in all 66 records: `Status: Ratified` beside
// "Engineering owns this Draft's ... mechanism; only the repository owner may
// change it to Ratified." A consumer could not tell which half was authoritative,
// and a proposal that leaned on the word "Ratified" could not be evaluated. The
// owner ruled that Ratified is correct and the clause was stale boilerplate.
//
// Uniformity is what made it invisible: 66 of 66 looks like a convention rather
// than a defect, and nothing compared the two lines to each other.
describe('a principle does not contradict itself about its own status', () => {
  const dir = path.join(here, '..', '..', 'principles');

  function records() {
    const out = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) out.push([p, readFileSync(p, 'utf8')]);
      }
    };
    walk(dir);
    return out;
  }

  test('no ratified record describes itself as a Draft', () => {
    const offenders = [];
    for (const [file, text] of records()) {
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/Owner and ratification:/.test(line)) return;
        if (!/Draft/.test(line)) return;
        const near = lines.slice(Math.max(0, i - 8), i).join('\n');
        if (/Status:\s*Ratified/.test(near)) offenders.push(`${file}:${i + 1}`);
      });
    }
    assert.deepEqual(offenders, [], 'a Ratified record must not call itself a Draft');
  });

  test('no record still promises to change its status to Ratified', () => {
    const offenders = records()
      .filter(([, text]) => /may change it to Ratified/.test(text))
      .map(([file]) => file);
    assert.deepEqual(offenders, []);
  });
});
