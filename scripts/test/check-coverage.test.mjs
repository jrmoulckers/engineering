import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { coverage, stripClaim } from '../check-coverage.mjs';

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

  const body = stripClaim(guide);
  assert.ok(body.includes('ENG-BUILD-001'), 'a genuine body citation still counts');
  assert.ok(!body.includes('ENG-BUILD-008'), 'a claimed-but-unimplemented endpoint does not');
  assert.ok(body.includes('# Builds') && body.includes('Body text.'), 'only the claim is removed');
});

test('a guide with no Implements line is left intact', () => {
  const guide = '# Notes\n\nSee `ENG-OBS-001`.';
  assert.equal(stripClaim(guide), guide);
});
