import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePins,
  parsePassedInputs,
  parseDeclaredInputs,
  verdictFor,
  inputsLostBy,
} from '../check-repin.mjs';

// The real case this tool exists for, reduced. docket pins 6fc65a9 and passes
// `exclude-glob`, which does not exist at 4162bad -- so recommending 4162bad is
// both backwards and build-breaking.
const CALLER = `
name: CI
jobs:
  lint:
    uses: jrmoulckers/.github/.github/workflows/reusable-ci-lint.yml@6fc65a9fe7b150125ac5732fd36dbda5aab57c5a # main
    with:
      node-version: '22'
  perf:
    uses: jrmoulckers/.github/.github/workflows/reusable-perf-budget.yml@6fc65a9fe7b150125ac5732fd36dbda5aab57c5a # main
    with:
      exclude-glob: '*.map'
      bundle-budget-kb: 512
`;

describe('parsePins', () => {
  test('finds every pinned reusable workflow', () => {
    const pins = parsePins(CALLER);
    assert.equal(pins.length, 2);
    assert.deepEqual(
      pins.map((p) => p.workflow),
      ['.github/workflows/reusable-ci-lint.yml', '.github/workflows/reusable-perf-budget.yml'],
    );
    assert.ok(pins.every((p) => p.sha === '6fc65a9fe7b150125ac5732fd36dbda5aab57c5a'));
  });

  test('ignores a floating tag reference, which is not a pin', () => {
    assert.deepEqual(parsePins('    uses: jrmoulckers/.github/.github/workflows/a.yml@main'), []);
  });
});

describe('parsePassedInputs', () => {
  test('attributes each input to the workflow that receives it', () => {
    const passed = parsePassedInputs(CALLER);
    assert.deepEqual([...(passed.get('.github/workflows/reusable-perf-budget.yml') ?? [])].sort(), [
      'bundle-budget-kb',
      'exclude-glob',
    ]);
    // The lint job's input must not leak into the perf job's set, or the tool
    // reports a break against whichever callee happens to be listed first.
    assert.deepEqual(
      [...(passed.get('.github/workflows/reusable-ci-lint.yml') ?? [])],
      ['node-version'],
    );
  });
});

describe('parseDeclaredInputs', () => {
  const WORKFLOW = `
on:
  workflow_call:
    inputs:
      node-version:
        type: string
      bundle-budget-kb:
        type: number
    secrets:
      NODE_AUTH_TOKEN:
        required: false
jobs:
  measure:
    runs-on: ubuntu-latest
`;

  test('reads the declared input names', () => {
    assert.deepEqual([...parseDeclaredInputs(WORKFLOW)].sort(), [
      'bundle-budget-kb',
      'node-version',
    ]);
  });

  test('does not mistake a secret name for an input', () => {
    assert.ok(!parseDeclaredInputs(WORKFLOW).has('NODE_AUTH_TOKEN'));
  });
});

describe('verdictFor', () => {
  // The whole point of the tool: this field fires without the sender already
  // suspecting the answer.
  test('behind_by=0 with commits ahead means the recommendation is backwards', () => {
    assert.equal(verdictFor({ ahead_by: 14, behind_by: 0 }), 'backwards');
  });

  test('commits behind means the proposal genuinely moves them forward', () => {
    assert.equal(verdictFor({ ahead_by: 0, behind_by: 14 }), 'forwards');
  });

  test('diverged histories still count as forwards, not backwards', () => {
    assert.equal(verdictFor({ ahead_by: 3, behind_by: 5 }), 'forwards');
  });

  test('an identical ref is neither', () => {
    assert.equal(verdictFor({ ahead_by: 0, behind_by: 0 }), 'identical');
  });
});

describe('inputsLostBy', () => {
  test('names the input a downgrade would remove', () => {
    assert.deepEqual(
      inputsLostBy(new Set(['exclude-glob', 'bundle-budget-kb']), new Set(['bundle-budget-kb'])),
      ['exclude-glob'],
    );
  });

  test('reports nothing when the target declares everything passed', () => {
    assert.deepEqual(
      inputsLostBy(new Set(['bundle-budget-kb']), new Set(['bundle-budget-kb', 'exclude-glob'])),
      [],
    );
  });

  // A negative control. Two comparisons that both fail can agree, and agreement
  // then reads as a match -- the exact way a fleet-wide blob compare returned
  // `same=True` for every file because it was comparing two 404 error strings.
  // An empty result must be reachable only from a genuine superset.
  test('an empty declared set reports every passed input, never silence', () => {
    assert.deepEqual(inputsLostBy(new Set(['exclude-glob']), new Set()), ['exclude-glob']);
  });
});
