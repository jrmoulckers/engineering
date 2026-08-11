import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { coverage, implementedIds } from '../check-coverage.mjs';

test('every principle is classified exactly once', async () => {
  const { covered, uncovered, total } = await coverage();
  assert.equal(covered.length + uncovered.length, total);
  assert.equal(new Set([...covered, ...uncovered]).size, total);
});

test('the recorded baseline matches reality', async () => {
  const { covered, uncovered } = await coverage();
  const baseline = JSON.parse(
    await readFile(new URL('../../practices/uncovered.json', import.meta.url), 'utf8'),
  );

  const regressions = uncovered.filter((id) => !baseline.uncovered.includes(id));
  const stale = baseline.uncovered.filter((id) => covered.includes(id));

  assert.deepEqual(regressions, [], 'uncovered principles missing from the baseline');
  assert.deepEqual(stale, [], 'baseline names principles that are now covered');
});

test('README is not counted as an implementing guide', async () => {
  const { guides } = await coverage();
  assert.ok(!guides.includes('README.md'), 'an index of guides is not itself a guide');
  assert.ok(guides.length > 0);
});

test('a guide header cannot cover a principle its body never implements', () => {
  // The exact shape that produced phantom coverage: a range whose endpoints
  // were counted, and whose interior was invisible.
  const guide = [
    '# Builds',
    '',
    'Implements `ENG-BUILD-001`-`ENG-BUILD-008`. This guide adds no rules.',
    '',
    '## Deterministic graph (`ENG-BUILD-001`)',
    '',
    'Body text.',
  ].join('\n');

  const ids = implementedIds(guide);
  assert.ok(ids.has('ENG-BUILD-001'), 'a heading citation counts');
  assert.ok(!ids.has('ENG-BUILD-008'), 'a claimed-but-unimplemented endpoint does not');
});

test('a passing prose mention is not an implementation', () => {
  // Both shapes were live in practices/. A cross-reference points elsewhere,
  // and a not-yet-implemented note says the opposite of what a substring
  // match concludes — yet each contains the ID.
  const guide = [
    '# Resilience',
    '',
    '`ENG-INT-005` is implemented in [API services](api-services.md).',
    '',
    '## Degrade, do not throw (`ENG-INT-001`)',
    '',
    '`ENG-PERF-009` is ratified but not yet implemented by any technique guide.',
  ].join('\n');

  const ids = implementedIds(guide);
  assert.deepEqual([...ids], ['ENG-INT-001']);
});

test('every heading level can declare an implementation', () => {
  // security.md nests technique under `###`; counting only `##` would drop it.
  const ids = implementedIds('### Pin actions (`ENG-SEC-002`)\n#### Detail (`ENG-SEC-003`)');
  assert.deepEqual([...ids].sort(), ['ENG-SEC-002', 'ENG-SEC-003']);
});

test('a title is not a declaration', () => {
  // `#` is the document title. Letting it count would restore the header
  // claim this model exists to reject, one line higher up.
  assert.deepEqual([...implementedIds('# Security (`ENG-SEC-002`)')], []);
});
