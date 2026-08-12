import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../check-release-lag.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const source = await readFile(SCRIPT, 'utf8');

// Read the FETCHED_PATHS array itself rather than grepping the whole file.
//
// The first version of this helper did grep the file, and it was vacuous: a
// mutation removing 'versions.json' from the array still passed, because the
// script mentions `join(ROOT, 'versions.json')` elsewhere for an unrelated
// reason. The test was matching that. A membership assertion has to be made
// against the list, not against the text that happens to contain it.
const FETCHED_PATHS = (() => {
  const block = /const FETCHED_PATHS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('could not locate the FETCHED_PATHS array in check-release-lag.mjs');
  // Strip line comments first. The array carries an explanatory comment, and an
  // apostrophe in ordinary prose ("somebody else's CI") pairs with the next
  // string quote and corrupts every entry after it. Caught because the suite
  // went red with the array unmodified.
  const code = block[1].replace(/\/\/[^\n]*/g, '');
  return [...code.matchAll(/'([^']+)'/g)].map((m) => m[1]);
})();

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
  //
  // Then it happened again, to `scripts/check-pins.mjs` and `versions.json`.
  // The rule that catches all three: if adopting.md gives a consumer a URL for
  // it, or a script they run fetches it, a change to it is consumer-visible and
  // belongs here -- whether or not it is a package.
  const required = [
    'scripts/vendor-configs.mjs',
    'scripts/check-pins.mjs',
    'versions.json',
    'configs/',
    'practices/',
    'principles/',
    'docs/',
  ];

  for (const path of required) {
    test(`${path} counts as content a consumer fetches at a ref`, () => {
      assert.ok(
        FETCHED_PATHS.includes(path),
        `${path} is not in FETCHED_PATHS (found: ${FETCHED_PATHS.join(', ')}). A change ` +
          'there reaches nobody until a tag is pushed, and this check would stay silent ' +
          'about it.',
      );
    });
  }

  test('the array this suite reads is the one the script uses', () => {
    // Guards the extraction above. If the regex stopped finding the array, every
    // membership test would fail loudly -- but if it found the WRONG array, or an
    // empty one, they could pass or fail for reasons unrelated to the script.
    assert.ok(FETCHED_PATHS.length >= required.length, 'extracted FETCHED_PATHS looks truncated');
    assert.ok(
      FETCHED_PATHS.every((p) => source.includes(`'${p}'`)),
      'extraction produced an entry that is not in the source',
    );
  });

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
