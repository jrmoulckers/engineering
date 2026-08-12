import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../check-pins.mjs', import.meta.url));
const VERSIONS = fileURLToPath(new URL('../../versions.json', import.meta.url));

const dir = mkdtempSync(join(tmpdir(), 'check-pins-'));

/** Run the real script against a synthetic package.json and versions manifest. */
function run(deps, versions = VERSIONS) {
  const pkg = join(dir, 'package.json');
  writeFileSync(pkg, JSON.stringify({ name: 'probe', devDependencies: deps }));
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, pkg, '--versions', versions], {
      encoding: 'utf8',
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function manifest(name, packages) {
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify({ packages }));
  return file;
}

// A consumer pinned below the floor gets a clean install, a satisfied range and
// no useful `npm outdated` line. Eleven repositories reached that state; several
// then rediscovered and escalated defects that had already been fixed in a
// release their own caret excluded. Nothing in npm reports this, so the check
// has to, and these tests are what keep it able to.
describe('check-pins detects ranges that cannot reach the published version', () => {
  test('a 0.x caret below the floor is reported stale, not ok', () => {
    const { code, stdout } = run({ '@jrmoulckers/eslint-config': '^0.3.0' });
    assert.equal(code, 1, 'a range that excludes the published version must fail');
    assert.match(stdout, /STALE\s+@jrmoulckers\/eslint-config/);
    assert.doesNotMatch(stdout, /^\s*ok\s/m);
  });

  test('the recommended replacement range it prints actually reaches the version', () => {
    const stale = run({ '@jrmoulckers/eslint-config': '^0.3.0' });
    const suggested = /use:\s+(.+)$/m.exec(stale.stdout)?.[1].trim();
    assert.ok(suggested, 'a stale row must carry a replacement range');

    // Advice that is never executed is advice that is never checked. Feed the
    // suggestion back through the checker and require it to pass.
    const fixed = run({ '@jrmoulckers/eslint-config': suggested });
    assert.equal(fixed.code, 0, `the suggested range ${suggested} does not itself pass`);
    assert.match(fixed.stdout, /ok\s+@jrmoulckers\/eslint-config/);
  });

  test('a range that does reach the published version passes', () => {
    const versions = manifest('ok.json', {
      '@jrmoulckers/tsconfig': { version: '0.4.0', range: '>=0.4.0 <1.0.0' },
    });
    const { code, stdout } = run({ '@jrmoulckers/tsconfig': '>=0.4.0 <1.0.0' }, versions);
    assert.equal(code, 0);
    assert.match(stdout, /ok\s+@jrmoulckers\/tsconfig/);
  });

  test('an unparseable range is reported as unevaluated and still fails', () => {
    const { code, stdout } = run({ '@jrmoulckers/tsconfig': '0.4.x || >=1' });
    assert.equal(code, 1, 'a range the checker cannot evaluate must not exit 0');
    assert.match(stdout, /unknown\s+@jrmoulckers\/tsconfig/);
    assert.match(stdout, /Unrecognised is not the same as fine/);
  });

  test('an unreadable manifest fails loudly instead of reporting every pin ok', () => {
    const { code, stdout } = run({ '@jrmoulckers/tsconfig': '^0.4.0' }, join(dir, 'absent.json'));
    assert.equal(code, 2, 'a manifest that cannot be read must not be treated as no findings');
    assert.doesNotMatch(stdout, /\bok\b/);
  });

  // The check must read the manifest it was given. A first draft of this suite
  // passed while silently testing the network default, because the harness
  // dropped the flag — the same shape of fault the checker exists to catch.
  test('--versions is honoured, proven by a manifest the network cannot supply', () => {
    const versions = manifest('sentinel.json', {
      '@jrmoulckers/tsconfig': { version: '9.9.9', range: '>=9.9.9 <10.0.0' },
    });
    const { code, stdout } = run({ '@jrmoulckers/tsconfig': '^0.4.0' }, versions);
    assert.equal(code, 1);
    assert.match(stdout, /CANNOT reach 9\.9\.9/, 'the supplied manifest was not the one read');
  });

  test('0.x caret semantics: the minor is pinned, so 0.3.0 cannot reach 0.4.0', () => {
    const versions = manifest('minor.json', {
      '@jrmoulckers/tsconfig': { version: '0.4.0', range: '>=0.4.0 <1.0.0' },
    });
    assert.equal(run({ '@jrmoulckers/tsconfig': '^0.3.0' }, versions).code, 1);
    assert.equal(run({ '@jrmoulckers/tsconfig': '^0.4.0' }, versions).code, 0);
  });

  test('every package in versions.json is reachable by its own recommended range', () => {
    const packages = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '-e',
          `process.stdout.write(require(${JSON.stringify(VERSIONS)}).packages ? JSON.stringify(require(${JSON.stringify(VERSIONS)}).packages) : '{}')`,
        ],
        { encoding: 'utf8' },
      ),
    );
    const names = Object.keys(packages);
    assert.ok(names.length >= 3, 'expected the three published packages to be recorded');

    const deps = Object.fromEntries(names.map((n) => [n, packages[n].range]));
    const { code, stdout } = run(deps);
    assert.equal(
      code,
      0,
      `versions.json recommends a range that excludes its own version:\n${stdout}`,
    );
  });
});
