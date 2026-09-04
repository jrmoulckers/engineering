import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards for `docs/architecture/`, both of which failed silently before.
 *
 * Two records shared `0001` for five days. Nothing caught it, because a
 * duplicate number is not a broken link: both files exist, both parse, and a
 * bare `ADR-0001` resolves to a real document — just not reliably to the
 * intended one. That is the ADR form of a wrong-but-real reference, and
 * existence checking cannot see it.
 *
 * Two records also carried a bare `# NNNN:` heading while `README.md` requires
 * `ADR-NNNN` in headings and prose, the filename being the only place the
 * prefix is dropped.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const architectureDir = join(repoRoot, 'docs', 'architecture');
const linkedDirs = [architectureDir, join(repoRoot, 'docs', 'proposals')];

async function decisionRecords() {
  const names = (await readdir(architectureDir)).filter((name) => /^\d{4}-.+\.md$/.test(name));
  return Promise.all(
    names.map(async (name) => ({
      name,
      number: name.slice(0, 4),
      source: await readFile(join(architectureDir, name), 'utf8'),
    })),
  );
}

test('no two decision records claim the same number', async () => {
  const records = await decisionRecords();
  assert.ok(records.length > 0, 'the directory should hold decision records');

  const byNumber = new Map();
  for (const { name, number } of records) {
    byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
  }

  const collisions = [...byNumber].filter(([, names]) => names.length > 1);
  assert.deepEqual(
    collisions,
    [],
    'the earlier record keeps its number; the later one takes the next free one',
  );
});

test('every record heading carries the ADR- prefix, matching its filename number', async () => {
  for (const { name, number, source } of await decisionRecords()) {
    const heading = source.split('\n').find((line) => line.startsWith('# '));
    assert.match(
      heading ?? '',
      new RegExp(`^# ADR-${number}: \\S`),
      `${name}: heading should read "# ADR-${number}: …" — the bare number is ambiguous in prose`,
    );
  }
});

test('every relative Markdown link in a record or proposal resolves on disk', async () => {
  for (const dir of linkedDirs) {
    for (const name of (await readdir(dir)).filter((entry) => entry.endsWith('.md'))) {
      const source = await readFile(join(dir, name), 'utf8');
      for (const [, target] of source.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/.test(target)) continue;
        await access(resolve(dir, target)).catch(() => {
          assert.fail(`${name}: link target ${target} does not exist`);
        });
      }
    }
  }
});
