import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verdict, PENDING, FAILED, MISSING } from '../check-release-ready.mjs';

const SHA = 'c82e4944aaaabbbbccccddddeeeeffff00001111';
const OTHER = '9c36c30b11112222333344445555666677778888';

function run(overrides = {}) {
  return {
    name: 'Validate',
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-08-12T19:00:00Z',
    headSha: SHA,
    ...overrides,
  };
}

test('a green run on the commit is safe to tag', () => {
  assert.deepEqual(verdict([run()], SHA), { ok: true, kind: null, problems: [] });
});

test('a failing run blocks the tag', () => {
  const result = verdict([run({ conclusion: 'failure' })], SHA);
  assert.equal(result.ok, false);
  assert.equal(result.kind, FAILED);
  assert.deepEqual(result.problems, [{ name: 'Validate', state: 'failure', kind: FAILED }]);
});

test('an unfinished run blocks the tag, and says so differently from a failure', () => {
  const result = verdict([run({ status: 'in_progress', conclusion: null })], SHA);
  assert.equal(result.ok, false);
  assert.equal(result.kind, PENDING);
});

// The whole reason this check exists is that "nothing looked red" was treated as
// evidence. An empty list must never be a pass.
test('no runs for the commit is a failure, not a vacuous pass', () => {
  const result = verdict([], SHA);
  assert.equal(result.ok, false);
  assert.equal(result.kind, MISSING);
});

test('runs belonging to a different commit do not vouch for this one', () => {
  const result = verdict([run({ headSha: OTHER })], SHA);
  assert.equal(result.ok, false, 'a green run on another commit is not evidence about this one');
  assert.equal(result.kind, MISSING);
});

// A rapid second push cancels the first attempt. Failing on that would make the
// gate noisy, and a noisy release gate gets bypassed.
test('a cancelled attempt superseded by a green re-run passes', () => {
  const runs = [
    run({ conclusion: 'cancelled', createdAt: '2026-08-12T19:00:00Z' }),
    run({ conclusion: 'success', createdAt: '2026-08-12T19:10:00Z' }),
  ];
  assert.equal(verdict(runs, SHA).ok, true);
});

// The inverse, and the more dangerous direction: an earlier green must not cover
// a later red on the same commit.
test('an earlier green does not cover a later failure', () => {
  const runs = [
    run({ conclusion: 'success', createdAt: '2026-08-12T19:00:00Z' }),
    run({ conclusion: 'failure', createdAt: '2026-08-12T19:10:00Z' }),
  ];
  const result = verdict(runs, SHA);
  assert.equal(result.ok, false);
  assert.equal(result.kind, FAILED);
});

// This is the live case: Publish succeeded on every one of the five commits
// while Validate failed, so looking at one workflow would have reported ready.
test('a green publish does not excuse a red validate on the same commit', () => {
  const runs = [
    run({ name: 'Publish packages', conclusion: 'success' }),
    run({ name: 'Validate', conclusion: 'failure' }),
  ];
  const result = verdict(runs, SHA);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, [{ name: 'Validate', state: 'failure', kind: FAILED }]);
});

test('a red workflow is not made provisional by a sibling still running', () => {
  const runs = [
    run({ name: 'Validate', conclusion: 'failure' }),
    run({ name: 'Publish packages', status: 'in_progress', conclusion: null }),
  ];
  assert.equal(verdict(runs, SHA).kind, FAILED, 'a mixed result reports the red, not the wait');
});
