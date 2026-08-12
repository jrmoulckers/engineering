import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  headingsOf,
  isStructural,
  overlapsIn,
  similarity,
  topicTokens,
} from '../check-practice-overlap.mjs';

test('a citation does not make two identical headings look different', () => {
  const a = topicTokens(
    '### Profile to diagnose, benchmark to gate (`ENG-PERF-002`, `ENG-PERF-007`)',
  );
  const b = topicTokens('## Profile to diagnose, benchmark to gate (`ENG-PERF-007`)');
  assert.equal(similarity(a, b), 1);
});

test('structural headings repeat by design and are exempt', () => {
  for (const h of ['## Verifying this guide', '## Handoffs', '### Scope']) {
    assert.equal(isStructural(h), true, h);
  }
  assert.equal(isStructural('## Profile to diagnose, benchmark to gate'), false);
});

test('structural headings are dropped before comparison', () => {
  const found = headingsOf('## Verifying this guide\n\n## Something real\n');
  assert.deepEqual(
    found.map((h) => h.text.trim()),
    ['## Something real'],
  );
});

test('the document title is not a section', () => {
  assert.deepEqual(headingsOf('# Native profiling\n\ntext\n'), []);
});

test('a duplicate heading in the same file is not reported as cross-file overlap', () => {
  const all = [
    { file: 'a.md', text: '## Profile to diagnose, benchmark to gate', line: 1 },
    { file: 'a.md', text: '## Profile to diagnose, benchmark to gate', line: 9 },
  ];
  assert.deepEqual(overlapsIn(all), []);
});

test('the real regression: PR #72 duplicating native-profiling is caught', () => {
  const all = [
    {
      file: 'native-profiling.md',
      text: '## Profile to diagnose, benchmark to gate (`ENG-PERF-007`)',
      line: 77,
    },
    {
      file: 'performance-budgets.md',
      text: '### Profile to diagnose, benchmark to gate (`ENG-PERF-002`, `ENG-PERF-007`)',
      line: 158,
    },
  ];
  const found = overlapsIn(all);
  assert.equal(found.length, 1);
  assert.equal(found[0].score, 1);
});

test('distinct sections that share a principle are left alone', () => {
  // This is why citation overlap was rejected as a signal: both of these
  // legitimately cite ENG-PERF-002 and neither duplicates the other.
  const all = [
    {
      file: 'native-profiling.md',
      text: '## Profile release builds on named baseline hardware (`ENG-PERF-002`)',
      line: 1,
    },
    {
      file: 'performance-budgets.md',
      text: '## Set a delivery budget per route (`ENG-PERF-002`)',
      line: 1,
    },
  ];
  assert.deepEqual(overlapsIn(all), []);
});

test('similarity is zero against an empty token set rather than dividing by zero', () => {
  assert.equal(similarity(new Set(), new Set(['a'])), 0);
  assert.equal(similarity(new Set(['a']), new Set()), 0);
});

test('the check is honest about what it cannot see', () => {
  // Measured, not assumed: well-written headings on the same topic share almost
  // no words. Heading similarity catches renamed-file duplication, not rewritten
  // duplication, and this test records that limit so nobody trusts it further.
  const score = similarity(
    topicTokens('### Carry the correlation identifier into the trace region (`ENG-OBS-004`)'),
    topicTokens('## Correlate traces with the observability seam (`ENG-OBS-004`)'),
  );
  assert.ok(score < 0.7, `expected a miss, scored ${score}`);
});
