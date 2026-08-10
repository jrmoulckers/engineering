import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { coverage } from '../check-coverage.mjs';

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
