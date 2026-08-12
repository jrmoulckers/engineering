import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SCRIPT = join(REPO, 'scripts', 'check-contradictions.mjs');

// The checker reads the files it guards relative to its own location, so a case is
// built by copying the script into a throwaway repo alongside synthetic targets.
// That keeps these tests from depending on the real documents' wording, which is
// the thing most likely to change underneath them.
function runAgainst(body, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'contradictions-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    copyFileSync(SCRIPT, join(dir, 'scripts', 'check-contradictions.mjs'));
    if (body !== null) writeFileSync(join(dir, 'docs', 'adopting.md'), body, 'utf8');
    // A case must supply every file the checker guards. Omitting one is how this
    // suite first went red: the script grew a second target and the harness was
    // still writing one file.
    if (opts.versions !== null) {
      writeFileSync(join(dir, 'versions.json'), opts.versions ?? '{ "packages": {} }\n', 'utf8');
    }
    try {
      const stdout = execFileSync(
        process.execPath,
        [join(dir, 'scripts', 'check-contradictions.mjs')],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      return { code: 0, out: stdout };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('check-contradictions', () => {
  test('passes on a document that mentions nothing retired', () => {
    const r = runAgainst('# Adopting\n\nUse `^0.17.0`. Report the resolved version.\n');
    assert.equal(r.code, 0);
    assert.match(r.out, /No retired guidance found/);
  });

  // The point of the check. A green run means nothing unless a genuine
  // reintroduction reddens it, so both retired literals are asserted directly
  // rather than trusted because the checker exists.
  test('fails when the retired wide 0.x range is recommended again', () => {
    const r = runAgainst(
      '# Adopting\n\nSet the range to `>=0.4.0 <1.0.0` so updates arrive automatically.\n',
    );
    assert.equal(r.code, 1);
    assert.match(r.out, /wide 0\.x range/);
    assert.match(r.out, /say instead/);
  });

  test('fails when the two-case 403 tell is reintroduced', () => {
    const r = runAgainst(
      '# Adopting\n\nThe tell for a 403 is that metadata resolves and only the tarball fails.\n',
    );
    assert.equal(r.code, 1);
    assert.match(r.out, /misfiles a scope 403/);
  });

  // Hard-wrapped prose puts the exempting clause on a different line from the
  // literal. Matching a single line was this checker's own first bug: it reported
  // two lines whose explanatory phrase sat immediately above.
  test('does not fire when the exempting clause is on a neighbouring line', () => {
    const r = runAgainst(
      [
        '# Adopting',
        '',
        'It recommended',
        '`>=x.y.z <1.0.0` so that updates would arrive — which this passage used to end',
        'with, and which is now reversed.',
        '',
      ].join('\n'),
    );
    assert.equal(r.code, 0);
  });

  test('reports the file and line so the offending text can be found', () => {
    const r = runAgainst('# Adopting\n\nfiller\n\nUse `>=0.4.0 <1.0.0` everywhere.\n');
    assert.equal(r.code, 1);
    assert.match(r.out, /docs\/adopting\.md:5/);
  });

  test('the real document passes its own check', () => {
    const r = runAgainst(readFileSync(join(REPO, 'docs', 'adopting.md'), 'utf8'), {
      versions: readFileSync(join(REPO, 'versions.json'), 'utf8'),
    });
    assert.equal(r.code, 0, r.out);
  });

  // A checker that goes green when its target is gone is worse than no checker,
  // because the green is now evidence of nothing while still reading as evidence.
  test('a missing target fails rather than passing vacuously', () => {
    const r = runAgainst(null);
    assert.equal(r.code, 1);
    assert.match(r.out, /file not found/);
  });

  test('guards versions.json too, not only the adoption guide', () => {
    const r = runAgainst('# Adopting\n', {
      versions: '{ "$comment": ["Copy range literally. Do not rewrite it as a caret."] }\n',
    });
    assert.equal(r.code, 1);
    assert.match(r.out, /versions\.json/);
  });
});
