#!/usr/bin/env node
/**
 * Report which ratified principles have no implementing technique guide.
 *
 * A principle states an obligation; a practice guide states how to satisfy it.
 * When a principle has neither, consumers have nothing to cite and tend to
 * restate the rule locally instead — which is what ADR-0003 forbids.
 *
 * This is a ratchet, not a gate on perfection. `practices/uncovered.json`
 * records the known gaps. CI fails when that list grows, or when it names a
 * principle that is now covered, so the baseline cannot quietly drift.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const practicesDir = join(repoRoot, 'practices');
const indexPath = join(repoRoot, 'principles', 'index.json');
const baselinePath = join(practicesDir, 'uncovered.json');

export async function coverage() {
  const { principles } = JSON.parse(await readFile(indexPath, 'utf8'));

  // README.md is an index, not a technique guide. Counting it would let a
  // table of contents masquerade as coverage.
  const guides = (await readdir(practicesDir)).filter(
    (name) => name.endsWith('.md') && name !== 'README.md',
  );

  const text = (
    await Promise.all(guides.map((name) => readFile(join(practicesDir, name), 'utf8')))
  ).join('\n');

  const covered = [];
  const uncovered = [];
  for (const p of principles) {
    (text.includes(p.id) ? covered : uncovered).push(p.id);
  }

  return { covered, uncovered, total: principles.length, guides };
}

function byArea(ids) {
  const areas = {};
  for (const id of ids) (areas[id.split('-')[1]] ??= []).push(id);
  return areas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { covered, uncovered, total } = await coverage();
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const known = new Set(baseline.uncovered);

  const regressions = uncovered.filter((id) => !known.has(id));
  const stale = baseline.uncovered.filter((id) => covered.includes(id));

  const pct = ((covered.length / total) * 100).toFixed(0);
  console.log(`${covered.length}/${total} principles (${pct}%) have an implementing guide.`);

  if (process.argv.includes('--list')) {
    for (const [area, ids] of Object.entries(byArea(uncovered)).sort()) {
      console.log(`  ${area} (${ids.length}): ${ids.join(', ')}`);
    }
  }

  if (regressions.length > 0) {
    console.error(
      `\nUncovered principles not in the baseline:\n  ${regressions.join(', ')}\n` +
        'Either implement them in a practice guide, or add them to practices/uncovered.json\n' +
        'with a reason. Do not add them silently.',
    );
    process.exit(1);
  }

  if (stale.length > 0) {
    console.error(
      `\nBaseline names principles that are now covered:\n  ${stale.join(', ')}\n` +
        'Remove them from practices/uncovered.json so the ratchet keeps its value.',
    );
    process.exit(1);
  }

  console.log(`${uncovered.length} known gap(s), matching the recorded baseline.`);
}
