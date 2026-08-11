import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const script = fileURLToPath(new URL('../vendor-configs.mjs', import.meta.url));

// These exercise real fetches against raw.githubusercontent.com, because the
// failures worth guarding — a 200 carrying an HTML error page, a moved ref —
// only exist over the network and a stubbed transport would assert the stub.
// An offline contributor can skip them; CI must not.
const OFFLINE = process.env.SKIP_NETWORK_TESTS === '1';

function run(args, cwd, source = script) {
  const result = spawnSync(process.execPath, [source, ...args], {
    cwd,
    encoding: 'utf8',
    // A hung fetch must fail the test rather than the suite.
    timeout: 60_000,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function workspace() {
  return mkdtempSync(join(tmpdir(), 'vendor-configs-'));
}

/**
 * Produce a copy of the script whose file list has been rewritten, so a payload
 * can be pointed at a real URL that returns 200 with the wrong bytes. That is
 * the failure the guards exist for and it cannot be simulated with a bad ref.
 */
function variant(dir, replace) {
  const source = readFileSync(script, 'utf8');
  const mutated = replace(source);
  assert.notEqual(mutated, source, 'variant did not modify the script');
  const path = join(dir, 'variant.mjs');
  writeFileSync(path, mutated, 'utf8');
  return path;
}

describe('vendor-configs argument handling', () => {
  test('refuses to run without a ref', () => {
    const dir = workspace();
    try {
      const { code, out } = run([], dir);
      assert.equal(code, 1);
      assert.match(out, /a ref is required/);
      // The hint has to steer toward a tag: a branch ref resolves but re-points
      // later, so the lock file would record a name rather than a state.
      assert.match(out, /Pass a tag, not a branch/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('names the known sets when given an unknown one', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['v0.14.0', '--set', 'nope'], dir);
      assert.equal(code, 1);
      assert.match(out, /unknown set 'nope'/);
      assert.match(out, /tsconfig, prettier/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a flag with no value instead of consuming the ref', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['--set'], dir);
      assert.equal(code, 1);
      assert.match(out, /--set requires a value/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('vendor-configs failure modes', { skip: OFFLINE }, () => {
  // Each of these leaves the destination untouched. A partial write is worse
  // than a failed one: the tools would run against a mix of refs and report
  // success.

  test('a missing ref exits 1 and writes nothing', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['v9.9.9-nope', '--set', 'prettier'], dir);
      assert.equal(code, 1);
      assert.match(out, /returned HTTP 404/);
      assert.match(out, /ref 'v9.9.9-nope'/);
      assert.equal(existsSync(join(dir, 'config')), false);
      assert.equal(existsSync(join(dir, 'engineering-configs.lock.json')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits cleanly rather than crashing the runtime', () => {
    // Calling process.exit() from inside an in-flight fetch tears down a socket
    // the runtime still owns. On Windows that surfaced as a libuv assertion and
    // exit code 0xC0000409 instead of the message and the 1 a consumer's CI can
    // act on, so the script throws and exits at the top level instead.
    const dir = workspace();
    try {
      const { code } = run(['v9.9.9-nope', '--set', 'prettier'], dir);
      assert.equal(code, 1, 'expected a clean exit 1, not an abnormal termination');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a 200 whose JSON is not a TypeScript configuration', () => {
    // An HTML error page or a redirect landing page arrives with status 200.
    // Neither a status check nor a non-empty check catches it, and a config
    // that resolves to nothing checks nothing while reporting success.
    const dir = workspace();
    try {
      const source = variant(dir, (text) =>
        text.replace(/files: \[\s*'base\.json',[\s\S]*?\],/, "files: ['../../package.json'],"),
      );
      const { code, out } = run(['v0.14.0', '--set', 'tsconfig'], dir, source);
      assert.equal(code, 1);
      assert.match(out, /has no "compilerOptions"/);
      assert.equal(existsSync(join(dir, 'config')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a 200 that is not a module', () => {
    const dir = workspace();
    try {
      const source = variant(dir, (text) =>
        text.replace("files: ['index.js', 'svelte.js'],", "files: ['../../README.md'],"),
      );
      const { code, out } = run(['v0.14.0', '--set', 'prettier'], dir, source);
      assert.equal(code, 1);
      assert.match(out, /exports nothing/);
      assert.equal(existsSync(join(dir, 'config')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('vendor-configs success path', { skip: OFFLINE }, () => {
  test('writes the files byte-identical and records provenance', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['v0.14.0', '--set', 'prettier'], dir);
      assert.equal(code, 0, out);

      const vendored = readFileSync(join(dir, 'config/engineering/prettier/index.js'), 'utf8');
      // Byte-identical means a refresh diff shows upstream's change and nothing
      // else, and local drift shows up against the recorded hash.
      assert.match(vendored, /export const config = \{/);
      assert.doesNotMatch(vendored, /generated|do not edit/i);

      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(lock.ref, 'v0.14.0');
      assert.equal(lock.repository, 'jrmoulckers/engineering');

      const entry = lock.files['config/engineering/prettier/index.js'];
      assert.equal(entry.source, 'packages/prettier-config/index.js');
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports how many files changed when the ref moves', () => {
    // This is the version signal vendoring normally destroys. Without it an
    // upgrade is indistinguishable from a no-op.
    const dir = workspace();
    try {
      assert.equal(run(['v0.13.0', '--set', 'prettier'], dir).code, 0);
      const { code, out } = run(['v0.14.0', '--set', 'prettier'], dir);
      assert.equal(code, 0, out);
      assert.match(out, /Ref moved v0\.13\.0 -> v0\.14\.0/);
      assert.match(out, /file\(s\) changed content/);

      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(lock.ref, 'v0.14.0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('vendor-configs --check', () => {
  test('rejects a ref, because the lock file is the source of the ref', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['v1.0.0', '--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /--check takes no ref/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails with a usable hint when no lock file exists', () => {
    const dir = workspace();
    try {
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /no engineering-configs\.lock\.json found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a lock file that records no files', () => {
    const dir = workspace();
    try {
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({ ref: 'v1.0.0', files: {} }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /records no files/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Drift is detected from the lock alone, so these need no network: the lock
  // names a file and a hash, and the check reads what is on disk.
  test('detects an edited file', () => {
    const dir = workspace();
    try {
      writeFileSync(join(dir, 'vendored.json'), '{"a":1}', 'utf8');
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({
          ref: 'v1.0.0',
          files: { 'vendored.json': { source: 'x', sha256: 'deadbeef' } },
        }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /content differs from the lock/);
      // The hint must name the pinned ref, not a placeholder.
      assert.match(out, /vendor-configs\.mjs v1\.0\.0/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('detects a deleted file', () => {
    const dir = workspace();
    try {
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({
          ref: 'v1.0.0',
          files: { 'gone.json': { source: 'x', sha256: 'deadbeef' } },
        }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /gone\.json: missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('passes when disk matches the lock, and never fails on staleness', () => {
    const dir = workspace();
    try {
      const body = '{"a":1}';
      const hash = createHash('sha256').update(body, 'utf8').digest('hex');
      writeFileSync(join(dir, 'vendored.json'), body, 'utf8');
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        // A ref that will never be newest, so if staleness were fatal this
        // would fail. It must not: an upstream tag cannot redden a consumer.
        JSON.stringify({
          ref: 'v0.0.1',
          files: { 'vendored.json': { source: 'x', sha256: hash } },
        }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 0);
      assert.match(out, /1 vendored file\(s\) match/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
