#!/usr/bin/env node
/**
 * Flag a practice section that already exists somewhere else under `practices/`.
 *
 * A consumer was asked to write native-profiling guidance and did it well --
 * against a base that predated the two pull requests which had already written
 * it. Six of their sections duplicated `native-profiling.md` heading for
 * heading, and the two genuinely new insights were buried inside them. Nothing
 * in their PR looked wrong; the defect was entirely in the premise they were
 * given, and the cost landed on them rather than on the person who gave it.
 *
 * Duplication across files is invisible to every other gate here. Citations
 * resolve, coverage counts the principle as addressed, prose formats clean --
 * and the reader ends up with two homes for one fact, which is the condition
 * `ENG-ARCH-001` exists to prevent.
 *
 * Usage:
 *   node scripts/check-practice-overlap.mjs
 *   node scripts/check-practice-overlap.mjs --dir practices
 *
 * Exit 0 = no overlapping headings. Exit 1 = overlap found.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Words carrying no topical signal, so they cannot inflate a similarity score. */
const STOP = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'both',
  'but',
  'by',
  'do',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'its',
  'need',
  'not',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'you',
  'your',
]);

/**
 * Headings every practice file is meant to carry. These repeat by design -- each
 * file states how to verify itself and where it hands off -- so they are
 * structure rather than duplicated subject matter.
 */
const STRUCTURAL = new Set(['verifying this guide', 'handoffs', 'scope', 'further reading']);

/**
 * @param {string} heading
 * @returns {boolean}
 */
export function isStructural(heading) {
  return STRUCTURAL.has(
    heading
      .replace(/^#+\s*/, '')
      .trim()
      .toLowerCase(),
  );
}

/**
 * Reduce a heading to comparable topic tokens.
 *
 * Citations are stripped: `### Profile to diagnose (ENG-PERF-007)` and the same
 * heading citing two principles are the same section, and treating them as
 * different is how a duplicate slips through.
 *
 * @param {string} heading
 * @returns {Set<string>}
 */
export function topicTokens(heading) {
  const withoutCitations = heading.replace(
    /\(`?ENG-[A-Z]+-\d+`?(?:,\s*`?ENG-[A-Z]+-\d+`?)*\)/g,
    '',
  );
  return new Set(
    withoutCitations
      .replace(/^#+\s*/, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * @param {Set<string>} a @param {Set<string>} b
 * @returns {number} Jaccard similarity, 0..1
 */
export function similarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * @param {string} markdown
 * @returns {{text: string, line: number}[]}
 */
export function headingsOf(markdown) {
  return markdown
    .split('\n')
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => /^#{2,6}\s+\S/.test(text) && !isStructural(text));
}

/**
 * @param {{file: string, text: string, line: number}[]} all
 * @param {number} threshold
 */
export function overlapsIn(all, threshold = 0.7) {
  const found = [];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (all[i].file === all[j].file) continue;
      const score = similarity(topicTokens(all[i].text), topicTokens(all[j].text));
      if (score >= threshold) found.push({ a: all[i], b: all[j], score });
    }
  }
  return found.sort((x, y) => y.score - x.score);
}

function main(argv) {
  const dirIndex = argv.indexOf('--dir');
  const dir = dirIndex === -1 ? 'practices' : argv[dirIndex + 1];

  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const all = files.flatMap((file) =>
    headingsOf(readFileSync(join(dir, file), 'utf8')).map((h) => ({ ...h, file })),
  );

  const overlaps = overlapsIn(all);
  console.log(`Checked ${all.length} heading(s) across ${files.length} file(s) in ${dir}/.`);

  if (overlaps.length === 0) {
    console.log('No section is duplicated across files.');
    return 0;
  }

  console.log('\nThese sections cover the same topic in two files:\n');
  for (const { a, b, score } of overlaps) {
    console.log(`  ${(score * 100).toFixed(0)}%  ${a.file}:${a.line}`);
    console.log(`        ${a.text.trim()}`);
    console.log(`        ${b.file}:${b.line}`);
    console.log(`        ${b.text.trim()}\n`);
  }
  console.log(
    'One fact, one home. Move the material into whichever file owns the topic and\n' +
      'leave a link behind, or narrow one of the headings so they are genuinely\n' +
      'different sections.',
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
