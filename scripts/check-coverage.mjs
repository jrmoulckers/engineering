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

  const claimed = new Set();
  for (const name of guides) {
    for (const id of implementedIds(await readFile(join(practicesDir, name), 'utf8'))) {
      claimed.add(id);
    }
  }

  const covered = [];
  const uncovered = [];
  for (const p of principles) {
    (claimed.has(p.id) ? covered : uncovered).push(p.id);
  }

  return { covered, uncovered, total: principles.length, guides };
}

/**
 * Collect the principle IDs a guide's section headings declare.
 *
 * Counting every occurrence of an ID anywhere in the file overstates coverage
 * twice over, and both cases were live in this repository:
 *
 * 1. A leading "Implements ..." claim. Range notation made it concrete —
 *    `ENG-BUILD-001`-`ENG-BUILD-008` marked both endpoints covered while
 *    implementing only the first, and said nothing about the six between.
 * 2. A passing prose mention. A cross-reference, or a sentence explicitly
 *    stating that a principle is *not* implemented here, both contain the ID.
 *    `performance-budgets.md` named three unimplemented principles in exactly
 *    that shape and the ratchet scored all three as covered.
 *
 * A heading is where a guide declares what a section delivers, so that is what
 * is counted. The cost is that implementing a principle now requires saying so
 * in a heading, which is the same discipline the guides already follow.
 */
export function implementedIds(source) {
  const ids = new Set();
  for (const line of source.split('\n')) {
    if (!/^#{2,6}\s/.test(line)) continue;
    for (const match of line.matchAll(/ENG-[A-Z]+-\d+/g)) ids.add(match[0]);
  }
  return ids;
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
