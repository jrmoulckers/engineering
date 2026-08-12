import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../check-release-lag.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const source = await readFile(SCRIPT, 'utf8');

function run() {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' }),
    };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('check-release-lag knows what a consumer can actually reach', () => {
  // This list going stale is silent by construction: a path that is missing
  // produces "no unreleased consumer-visible changes", which reads as a clean
  // bill rather than as an unasked question. That is how `docs/` was missing --
  // the check stayed quiet across two commits that both edited the file
  // consumers are told to cite by section.
  const required = ['scripts/vendor-configs.mjs', 'configs/', 'practices/', 'principles/', 'docs/'];

  for (const path of required) {
    test(`${path} counts as content a consumer fetches at a ref`, () => {
      assert.match(
        source,
        new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
        `${path} is not in FETCHED_PATHS. A change there reaches nobody until a tag ` +
          'is pushed, and this check would stay silent about it.',
      );
    });
  }

  test('version ordering is by version, never lexical', () => {
    // `v0.9.0` sorts above `v0.116.0` as a string. Getting this wrong makes the
    // check compare against an ancient tag and under-report.
    assert.match(source, /--sort=-v:refname/);
  });

  test('the unreleased-commit report is a notice, not a failure', () => {
    const { code, out } = run();
    assert.equal(code, 0, 'unreleased commits must never fail a build');
    assert.match(out, /No unreleased consumer-visible changes|Notice: \d+ commit/);
  });
});
