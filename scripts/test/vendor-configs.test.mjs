import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETS, isNewerRef, escapesCwd } from '../vendor-configs.mjs';
import { createHash } from 'node:crypto';

const script = fileURLToPath(new URL('../vendor-configs.mjs', import.meta.url));

// These exercise real fetches against raw.githubusercontent.com, because the
// failures worth guarding — a 200 carrying an HTML error page, a moved ref —
// only exist over the network and a stubbed transport would assert the stub.
// An offline contributor can skip them; CI must not.
const OFFLINE = process.env.SKIP_NETWORK_TESTS === '1';

function run(args, cwd, source = script, env = {}) {
  const result = spawnSync(process.execPath, [source, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    // A hung fetch must fail the test rather than the suite.
    timeout: 60_000,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

// spawnSync blocks this process's event loop, so an in-process server can never
// answer the child and the child times out. Tests that stub the release lookup
// must use this instead.
function runAsyncIn(cwd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: { ...process.env, ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
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
        text.replace(
          "files: ['index.js', 'index.d.ts', 'svelte.js', 'svelte.d.ts'],",
          "files: ['../../README.md'],",
        ),
      );
      const { code, out } = run(['v0.115.0', '--set', 'prettier'], dir, source);
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
      const { code, out } = run(['v0.115.0', '--set', 'prettier'], dir);
      assert.equal(code, 0, out);

      const vendored = readFileSync(join(dir, 'config/engineering/prettier/index.js'), 'utf8');
      // Byte-identical means a refresh diff shows upstream's change and nothing
      // else, and local drift shows up against the recorded hash.
      assert.match(vendored, /export const config = \{/);
      assert.doesNotMatch(vendored, /generated|do not edit/i);

      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(lock.ref, 'v0.115.0');
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
      assert.equal(run(['v0.112.0', '--set', 'prettier'], dir).code, 0);
      const { code, out } = run(['v0.115.0', '--set', 'prettier'], dir);
      assert.equal(code, 0, out);
      assert.match(out, /Ref moved v0\.112\.0 -> v0\.115\.0/);
      assert.match(out, /file\(s\) changed content/);

      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(lock.ref, 'v0.115.0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the prettier set carries the declarations, not only the modules', () => {
    // A vendored config without its .d.ts fails with TS7016 the moment it is
    // imported from TypeScript, because allowJs defaults to false and
    // @jrmoulckers/tsconfig leaves it there. Measured both ways: with the
    // declarations present tsc exits 0, with them removed it reports TS7016 and
    // the config widens to `any`.
    const dir = workspace();
    try {
      const { code, out } = run(['v0.115.0', '--set', 'prettier'], dir);
      assert.equal(code, 0, out);

      for (const file of ['index.d.ts', 'svelte.d.ts']) {
        const path = join(dir, 'config/engineering/prettier', file);
        assert.ok(existsSync(path), `${file} was not vendored alongside its module`);
        assert.match(readFileSync(path, 'utf8'), /export declare const/);
      }

      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(
        lock.files['config/engineering/prettier/index.d.ts']?.source,
        'packages/prettier-config/index.d.ts',
        'the declaration must be recorded in the lock, or local drift is invisible',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a ref older than the declarations fails naming the floor, not a typo', () => {
    // v0.15.1 is a ref a consumer actually planned to vendor. The generic
    // "check that the path exists" hint sends them hunting for a mistake they
    // did not make.
    const dir = workspace();
    try {
      const { code, out } = run(['v0.15.1', '--set', 'prettier'], dir);
      assert.equal(code, 1);
      assert.match(out, /Declarations ship from v0\.112\.0 onward/);
      assert.ok(
        !existsSync(join(dir, 'config/engineering/prettier/index.js')),
        'nothing may be written when part of the set is unavailable',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a declaration file that declares nothing is rejected', () => {
    // Proves the .d.ts branch of the payload check is reached and can fail. A
    // stub declaration widens every consumer's types to `any` while looking
    // like a successful vendor.
    const dir = workspace();
    try {
      const source = variant(dir, (text) =>
        text.replace('^(export )?declare |^export type |^export interface ', '^ZZZ_NEVER_MATCHES '),
      );
      const { code, out } = run(['v0.115.0', '--set', 'prettier'], dir, source);
      assert.equal(code, 1);
      assert.match(out, /declares nothing/);
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

describe('vendor-configs lock coverage', () => {
  test("warns when a previous run's files are left untracked on disk", { skip: OFFLINE }, () => {
    const dir = workspace();
    try {
      const first = run(['v0.115.0', '--dest', 'config/engineering'], dir);
      assert.equal(first.code, 0);
      // A fresh vendor has nothing to orphan, so it must be silent. Without
      // this the warning could fire always and the test below would still pass.
      assert.doesNotMatch(first.out, /no longer tracked/);

      const moved = run(['v0.115.0', '--dest', 'vendor/engineering'], dir);
      assert.equal(moved.code, 0);
      assert.match(moved.out, /10 file\(s\) from the previous run are no longer tracked/);
      assert.match(moved.out, /config\/engineering\/tsconfig\/base\.json/);
      // The old tree is still on disk and --check now covers none of it, which
      // is why this has to be said out loud rather than silently dropped.
      assert.ok(existsSync(join(dir, 'config/engineering/tsconfig/base.json')));
      const lock = JSON.parse(readFileSync(join(dir, 'engineering-configs.lock.json'), 'utf8'));
      assert.equal(
        Object.keys(lock.files).some((k) => k.startsWith('config/engineering/')),
        false,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test(
    'a same-dest refresh reports no orphans and counts changes honestly',
    { skip: OFFLINE },
    () => {
      const dir = workspace();
      try {
        assert.equal(run(['v0.112.0', '--dest', 'config/engineering'], dir).code, 0);
        const { code, out } = run(['v0.115.0', '--dest', 'config/engineering'], dir);
        assert.equal(code, 0);
        assert.doesNotMatch(out, /no longer tracked/);
        // No vendored file has changed content since the v0.112.0 floor. A file
        // absent from the previous lock must not be counted as changed.
        assert.match(out, /Ref moved v0\.112\.0 -> v0\.115\.0; 0 file\(s\) changed content/);
        assert.doesNotMatch(out, /newly tracked/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  test('orphan detection fails if the guard is neutralised', { skip: OFFLINE }, () => {
    const dir = workspace();
    try {
      // Mutation test: if the on-disk existence check always returned false,
      // no orphan would ever be reported and the test above would be vacuous.
      const mutated = variant(dir, (s) =>
        s.replace('if (await exists(key)) orphans.push(key);', 'if (false) orphans.push(key);'),
      );
      assert.equal(run(['v0.115.0', '--dest', 'config/engineering'], dir, mutated).code, 0);
      const { out } = run(['v0.115.0', '--dest', 'vendor/engineering'], dir, mutated);
      assert.doesNotMatch(out, /no longer tracked/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('vendor-configs formatter interaction', () => {
  test('warns when the vendored tree is not prettier-ignored', { skip: OFFLINE }, () => {
    const dir = workspace();
    try {
      writeFileSync(join(dir, '.prettierignore'), 'dist/\n# config/engineering\n', 'utf8');
      const { code, out } = run(['v0.115.0', '--dest', 'config/engineering'], dir);
      assert.equal(code, 0);
      assert.match(out, /'config\/engineering' is not matched by any line in \.prettierignore/);
      // A commented-out entry must not count as coverage.
      assert.match(out, /config\/engineering\//);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test(
    'stays silent when an entry covers the tree, directly or by parent',
    { skip: OFFLINE },
    () => {
      for (const entry of ['config/engineering/', 'config/']) {
        const dir = workspace();
        try {
          writeFileSync(join(dir, '.prettierignore'), `${entry}\n`, 'utf8');
          const { code, out } = run(['v0.115.0', '--dest', 'config/engineering'], dir);
          assert.equal(code, 0);
          assert.doesNotMatch(out, /not matched by any line/, `${entry} should cover the tree`);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    },
  );

  test('says nothing when the repository has no .prettierignore', { skip: OFFLINE }, () => {
    const dir = workspace();
    try {
      const { code, out } = run(['v0.115.0', '--dest', 'config/engineering'], dir);
      assert.equal(code, 0);
      // Absence is not evidence Prettier is used, so warning here would be noise
      // on every repository that does not format at all.
      assert.doesNotMatch(out, /not matched by any line/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('vendor-configs lock validation', () => {
  // The lock is the input to --check. A checker that cannot read its own input
  // must say so: the state where extraction failed looks identical to clean.
  function withLock(contents, body) {
    const dir = workspace();
    try {
      mkdirSync(join(dir, 'cfg'), { recursive: true });
      writeFileSync(join(dir, 'cfg', 'a.json'), '{}', 'utf8');
      writeFileSync(join(dir, 'engineering-configs.lock.json'), contents, 'utf8');
      body(run(['--check'], dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test('distinguishes a corrupt lock from an absent one', () => {
    withLock('{ not json', ({ code, out }) => {
      assert.equal(code, 1);
      assert.match(out, /exists but is not valid JSON/);
      // Reporting "not found" for a file sitting right there sends the reader
      // looking for the wrong problem.
      assert.doesNotMatch(out, /no engineering-configs\.lock\.json found/);
    });
  });

  for (const [name, entry] of [
    ['null entry', 'null'],
    ['no sha256', '{"source":"x"}'],
    ['null sha256', '{"source":"x","sha256":null}'],
    ['empty sha256', '{"source":"x","sha256":""}'],
    ['string instead of object', '"deadbeef"'],
  ]) {
    test(`refuses to verify a lock entry with ${name}`, () => {
      withLock(`{"ref":"v1","files":{"cfg/a.json":${entry}}}`, ({ code, out }) => {
        assert.equal(code, 1, 'must not report success on an unverifiable entry');
        assert.match(out, /no usable sha256/);
        // "content differs" would be a false accusation: the file may be fine.
        assert.doesNotMatch(out, /content differs/);
      });
    });
  }

  test('still passes a lock that genuinely matches', () => {
    const hash = createHash('sha256').update('{}').digest('hex');
    withLock(
      `{"ref":"v1","files":{"cfg/a.json":{"source":"x","sha256":"${hash}"}}}`,
      ({ code, out }) => {
        assert.equal(code, 0);
        assert.match(out, /1 vendored file\(s\) match/);
      },
    );
  });
});

describe('vendor set covers what the packages ship', () => {
  // The two delivery channels must carry the same files. If a config is added to
  // a package and not to SETS, npm consumers get it and vendoring consumers
  // silently do not -- and nothing fails, because every file SETS names still
  // fetches successfully. That is a divergence no existing check can see.
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  // package.json and README.md are packaging metadata, not configuration.
  const NOT_CONFIG = new Set(['package.json', 'README.md']);

  for (const [name, set] of Object.entries(SETS)) {
    test(`${name}: SETS lists every config file in ${set.from ?? 'packages/prettier-config'}`, () => {
      const from = set.from ?? 'packages/prettier-config';
      const shipped = readdirSync(join(ROOT, from), { withFileTypes: true })
        .filter((e) => e.isFile() && !NOT_CONFIG.has(e.name))
        .map((e) => e.name)
        .sort();

      assert.deepEqual(
        [...set.files].sort(),
        shipped,
        `${from} and SETS.${name} disagree. Add the file to SETS, or it reaches ` +
          `npm consumers only.`,
      );
    });

    test(`${name}: every file SETS names exists`, () => {
      const from = set.from ?? 'packages/prettier-config';
      for (const file of set.files) {
        assert.ok(
          existsSync(join(ROOT, from, file)),
          `SETS.${name} names ${file}, which does not exist in ${from}`,
        );
      }
    });
  }
});

describe('vendor-time staleness notice', () => {
  // --check reports staleness, but it runs later and on a different day. The
  // moment the ref is chosen is the moment the choice is still cheap to change.
  //
  // These drive the release lookup through a local server. The first version of
  // these tests hit api.github.com directly and failed against a correct
  // implementation, because unauthenticated calls are capped at 60/hour per IP
  // and the rest of this suite had spent them. A test whose result depends on
  // how many other calls ran that hour is not a test of the code.
  const runAsync = (args, cwd, env) => runAsyncIn(cwd, args, env);

  async function withApi(tagName, body) {
    const server = createServer((req, res) => {
      if (tagName === null) {
        res.writeHead(403).end('{}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ tag_name: tagName }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const dir = workspace();
    try {
      await body((args) => runAsync(args, dir, { VENDOR_API_BASE: base }));
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('names the newer release when an older ref is vendored', { skip: OFFLINE }, async () => {
    await withApi('v0.999.0', async (exec) => {
      const { code, out } = await exec(['v0.113.0']);
      assert.equal(code, 0, 'a newer release is information, never a failure');
      assert.match(out, /Notice: you vendored v0\.113\.0; the newest release is v0\.999\.0/);
      // Point at resolution, never at a literal to copy: copying a literal out
      // of guidance is how four repositories reached a stale ref.
      assert.match(out, /releases\/latest --jq \.tag_name/);
    });
  });

  test('says nothing when the vendored ref is already the newest', { skip: OFFLINE }, async () => {
    await withApi('v0.113.0', async (exec) => {
      const { code, out } = await exec(['v0.113.0']);
      assert.equal(code, 0);
      // A notice that always fires is noise, and noise is how a real one gets
      // scrolled past.
      assert.doesNotMatch(out, /Notice: you vendored/);
    });
  });

  test('stays silent and succeeds when the release lookup fails', { skip: OFFLINE }, async () => {
    await withApi(null, async (exec) => {
      const { code, out } = await exec(['v0.113.0']);
      // A rate-limited or offline runner is not a staleness signal, and must
      // never turn vendoring into a failure.
      assert.equal(code, 0);
      assert.match(out, /Vendored 10 file\(s\)/);
      assert.doesNotMatch(out, /Notice: you vendored/);
    });
  });

  // GitHub returns the most recent release by tag DATE, not the greatest
  // version. Comparing for inequality therefore prompts a DOWNGRADE the first
  // time a patch is backported to an older line -- and it prompts every
  // consumer at once. Reported by an adopter who found it in their own notice
  // before it fired here.
  test('never prompts a move to an older release', { skip: OFFLINE }, async () => {
    await withApi('v0.15.7', async (exec) => {
      const { code, out } = await exec(['v0.115.0']);
      assert.equal(code, 0);
      assert.match(out, /Vendored 10 file\(s\)/);
      assert.doesNotMatch(
        out,
        /Notice: you vendored/,
        'v0.15.7 is older than v0.115.0; suggesting it is a downgrade prompt',
      );
    });
  });

  test('stays silent when the reported tag is not a version', { skip: OFFLINE }, async () => {
    await withApi('main', async (exec) => {
      const { code, out } = await exec(['v0.113.0']);
      assert.equal(code, 0);
      // An ordering that cannot be established is not a staleness signal.
      assert.doesNotMatch(out, /Notice: you vendored/);
    });
  });

  test('stays silent when the API is unreachable', { skip: OFFLINE }, async () => {
    // A 403 exercises the !response.ok branch; only a refused connection
    // exercises the catch. Without this, rewriting the catch to rethrow passes
    // every other test in this file -- verified.
    const dir = workspace();
    try {
      const { code, out } = await runAsync(['v0.113.0'], dir, {
        VENDOR_API_BASE: 'http://127.0.0.1:9',
      });
      assert.equal(code, 0);
      assert.match(out, /Vendored 10 file\(s\)/);
      assert.doesNotMatch(out, /Notice: you vendored/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('release ordering', () => {
  // GitHub's releases/latest returns the most recent release by tag DATE, not
  // the greatest version. These run without network so the ordering rules are
  // pinned independently of what is currently published.
  const cases = [
    ['v0.115.0', 'v0.113.0', true, 'a genuinely newer release'],
    ['v0.15.7', 'v0.115.0', false, 'a backport published after a newer minor'],
    ['v0.115.0', 'v0.115.0', false, 'the same release'],
    ['v0.15.4', 'v0.9.0', true, 'two-digit minor, where string order disagrees'],
    ['v0.9.0', 'v0.15.4', false, 'the reverse, which string order calls newer'],
    ['v1.0.0', 'v0.115.0', true, 'a major bump'],
    ['v0.115.1', 'v0.115.0', true, 'a patch bump'],
    ['0.116.0', 'v0.115.0', true, 'a tag without the v prefix'],
    [null, 'v0.115.0', false, 'no reported tag'],
    ['main', 'v0.115.0', false, 'a branch name rather than a tag'],
    ['v0.115', 'v0.115.0', false, 'a malformed version'],
  ];

  for (const [candidate, current, expected, label] of cases) {
    test(`${expected ? 'newer' : 'not newer'}: ${label}`, () => {
      assert.equal(
        isNewerRef(candidate, current),
        expected,
        `isNewerRef(${JSON.stringify(candidate)}, ${JSON.stringify(current)})`,
      );
    });
  }
});

describe('--check staleness ordering', () => {
  // The vendor-time notice and --check are separate call sites with separate
  // comparisons. Fixing one and asserting only that one leaves the other free
  // to prompt a downgrade -- confirmed by mutation: reverting --check alone
  // passed the entire suite before this block existed.
  function api(tagName) {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ tag_name: tagName }));
    });
    return server;
  }

  async function checkAgainst(reportedLatest, vendoredRef) {
    const server = api(reportedLatest);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const dir = workspace();
    try {
      const vendored = await runAsyncIn(dir, [vendoredRef], { VENDOR_API_BASE: base });
      assert.equal(vendored.code, 0, 'vendoring must succeed before --check is meaningful');
      return await runAsyncIn(dir, ['--check'], { VENDOR_API_BASE: base });
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('--check never prompts a move to an older release', { skip: OFFLINE }, async () => {
    const { code, out } = await checkAgainst('v0.15.7', 'v0.115.0');
    assert.equal(code, 0);
    assert.match(out, /vendored file\(s\) match/);
    assert.doesNotMatch(out, /Notice: pinned at/, 'v0.15.7 is older than v0.115.0');
  });

  test('--check still reports a genuinely newer release', { skip: OFFLINE }, async () => {
    const { code, out } = await checkAgainst('v0.999.0', 'v0.113.0');
    assert.equal(code, 0, 'staleness is information, never a failure');
    assert.match(out, /Notice: pinned at v0\.113\.0; newest release is v0\.999\.0/);
  });
});

describe('a scratch --dest cannot poison the lock', () => {
  const root = process.platform === 'win32' ? 'C:\\scratch\\probe' : '/tmp/probe';

  test('a dest under the working directory is not an escape', () => {
    assert.equal(escapesCwd('config/engineering', process.cwd()), false);
    assert.equal(escapesCwd('./config/engineering', process.cwd()), false);
    assert.equal(escapesCwd('.', process.cwd()), false);
  });

  test('a dest outside the working directory is an escape', () => {
    assert.equal(escapesCwd('../elsewhere', process.cwd()), true);
    assert.equal(escapesCwd(root, process.cwd()), true);
  });

  // The reported failure: a probe rewrote the real lock with absolute scratch
  // paths, and --check then passed having examined no repository file at all.
  test('--check refuses a lock whose keys leave the working directory', () => {
    const dir = workspace();
    try {
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({
          ref: 'v1.0.0',
          files: { [`${root}/tsconfig/base.json`]: { source: 'x', sha256: 'a'.repeat(64) } },
        }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1);
      assert.match(out, /outside/);
      assert.match(out, /--dest/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The dangerous case is the machine that produced the lock: every absolute
  // path still resolves there, so a hash comparison passes. Rejection must come
  // from the shape of the key, never from the file being absent.
  test('rejects an escaping key even when that file exists and matches', () => {
    const dir = workspace();
    const outside = mkdtempSync(join(tmpdir(), 'vendor-outside-'));
    try {
      const body = '{"a":1}';
      writeFileSync(join(outside, 'base.json'), body, 'utf8');
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({
          ref: 'v1.0.0',
          files: {
            [`${outside.split('\\').join('/')}/base.json`]: {
              source: 'x',
              sha256: createHash('sha256').update(body).digest('hex'),
            },
          },
        }),
        'utf8',
      );
      const { code, out } = run(['--check'], dir);
      assert.equal(code, 1, 'a resolvable absolute key must still be refused');
      assert.match(out, /outside/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  // Positive control: without it, every assertion above would also pass against
  // a --check that refused all locks.
  test('a relative lock key is still accepted', () => {
    const dir = workspace();
    try {
      const body = '{"a":1}';
      writeFileSync(join(dir, 'vendored.json'), body, 'utf8');
      writeFileSync(
        join(dir, 'engineering-configs.lock.json'),
        JSON.stringify({
          ref: 'v1.0.0',
          files: {
            'vendored.json': {
              source: 'x',
              sha256: createHash('sha256').update(body).digest('hex'),
            },
          },
        }),
        'utf8',
      );
      const { code } = run(['--check'], dir);
      assert.equal(code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe('the no-commitment probe leaves the repository alone', { skip: OFFLINE }, () => {
  test('a scratch --dest writes no lock and leaves the existing one intact', () => {
    const dir = workspace();
    const scratch = mkdtempSync(join(tmpdir(), 'vendor-probe-'));
    try {
      assert.equal(run(['v0.115.0', '--set', 'prettier'], dir).code, 0);
      const lockPath = join(dir, 'engineering-configs.lock.json');
      const before = readFileSync(lockPath, 'utf8');

      const { code, out } = run(['v0.112.0', '--set', 'prettier', '--dest', scratch], dir);
      assert.equal(code, 0, out);
      assert.match(out, /was NOT written/);
      assert.equal(readFileSync(lockPath, 'utf8'), before, 'the probe rewrote the real lock');

      // The whole point: the guard must still be armed afterwards.
      writeFileSync(join(dir, 'config/engineering/prettier/index.js'), 'tampered', 'utf8');
      const after = run(['--check'], dir);
      assert.equal(after.code, 1, 'drift went undetected after a probe');
      assert.match(after.out, /content differs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  // Keyed by destination, every lookup misses once --dest moves and the count
  // degrades to "all" or "none" -- which reads as an answer.
  test('the change count is meaningful from a scratch dest', () => {
    const dir = workspace();
    const scratch = mkdtempSync(join(tmpdir(), 'vendor-probe-'));
    try {
      assert.equal(run(['v0.112.0', '--set', 'prettier'], dir).code, 0);
      const { code, out } = run(['v0.115.0', '--set', 'prettier', '--dest', scratch], dir);
      assert.equal(code, 0, out);
      assert.match(out, /Ref moved v0\.112\.0 -> v0\.115\.0/);
      assert.doesNotMatch(out, /newly tracked/, 'same files counted as new because dest moved');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
