// citations-check: ignore-file -- asserts on principle IDs as search fixtures.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(HERE, '..', 'find-principle.mjs');
const index = path.join(HERE, '..', '..', 'principles', 'index.json');

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args, '--index', index], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('find-principle', () => {
  // Two repositories concluded no principle covered framework-free domain logic
  // after searching Statements. ENG-ARCH-002 carries it in Evidence.
  test('finds an obligation that lives only in Evidence', () => {
    const { code, out } = run(['framework|renderer']);
    assert.equal(code, 0);
    assert.match(out, /ENG-ARCH-002/, 'the Evidence-only match is the whole point');
    assert.match(out, /matched in Evidence only/);
  });

  test('a Statement-only search misses what the whole-record search finds', () => {
    const all = run(['framework|renderer']);
    const stmt = run(['framework|renderer', '--field', 'statement']);
    assert.equal(stmt.code, 0);
    assert.doesNotMatch(stmt.out, /ENG-ARCH-002/);
    assert.match(all.out, /ENG-ARCH-002/);
  });

  // The script exited 0 having printed nothing on Windows because the
  // entry-point guard compared against a hand-built file:// URL.
  test('runs as a script on this platform', () => {
    const { out } = run(['framework']);
    assert.ok(out.trim().length > 0, 'produced no output at all');
  });

  test('exits non-zero when nothing matches, and says so', () => {
    const { code, out } = run(['zzz-no-such-principle-zzz']);
    assert.equal(code, 1);
    assert.match(out, /No principle matches/);
    assert.match(out, /Before concluding none exists/);
  });

  test('reports which fields were searched', () => {
    const { out } = run(['framework']);
    assert.match(out, /Searched fields:.*evidence/);
  });

  test('warns that a keyword match is not authority', () => {
    const { out } = run(['framework']);
    assert.match(out, /A match is not authority/);
  });

  test('rejects an unknown field rather than silently searching nothing', () => {
    const { code, out } = run(['framework', '--field', 'nope']);
    assert.equal(code, 2);
    assert.match(out, /Unknown field/);
  });

  test('reports a bad regular expression instead of crashing', () => {
    const { code, out } = run(['[unclosed']);
    assert.equal(code, 2);
    assert.match(out, /valid regular expression/);
  });
});
