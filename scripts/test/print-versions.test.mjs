import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../print-versions.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// Tag lookups only mean anything in a checkout that has tags. A --no-tags clone
// would make every assertion below vacuously pass, which is the failure mode
// these tests exist to prevent, so establish the precondition first.
const hasTag = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
};

describe('print-versions --tag resolves a repo tag to package versions', () => {
  test('the tags this suite depends on are present', () => {
    for (const ref of ['v0.16.0', 'v0.1.0']) {
      assert.ok(
        hasTag(ref),
        `tag ${ref} is missing — run \`git fetch --tags\`. Without it these tests prove nothing.`,
      );
    }
  });

  test('a repo tag reports the package versions it actually ships', () => {
    const { code, out } = run(['--tag', 'v0.16.0']);
    assert.equal(code, 0);
    assert.match(out, /@jrmoulckers\/eslint-config\s+0\.9\.0/);
  });

  test('a tag whose number looks like a package version says both readings exist', () => {
    const { out } = run(['--tag', 'v0.16.0']);
    assert.match(out, /"0\.16\.0" is also a well-formed package version/);
  });

  test('a tag that ships its own number does not raise the ambiguity note', () => {
    // v0.1.0 is the only tag whose number matches a package version it ships
    // (all three packages were at 0.1.0), so the string is not misleading there.
    // I first wrote this against v0.4.0 on the assumption it shipped tsconfig
    // 0.4.0; it ships 0.3.0. Asserting an unverified premise is the same defect
    // this whole feature exists to catch.
    const { out } = run(['--tag', 'v0.1.0']);
    assert.doesNotMatch(out, /is also a well-formed package version/);
  });

  test('an unknown ref refuses by name rather than reporting an absence', () => {
    const { code, out } = run(['--tag', 'v9.99.99']);
    assert.equal(code, 1);
    assert.match(out, /Unknown ref: v9\.99\.99/);
    // Removing the rev-parse guard leaves the exit code at 1 but changes the
    // message to "No packages/ directory exists", which asserts something false
    // about a ref that does not exist. Pin the claim, not just the status.
    assert.doesNotMatch(out, /No packages\/ directory exists/);
  });

  test('--tag without a ref is an error, not a default', () => {
    const { code, out } = run(['--tag']);
    assert.equal(code, 1);
    assert.match(out, /--tag requires a ref/);
  });

  test('the default report still prints the published column', () => {
    const { code, out } = run([]);
    assert.equal(code, 0);
    assert.match(out, /package\s+workspace\s+published\s+consumers pin/);
  });
});
