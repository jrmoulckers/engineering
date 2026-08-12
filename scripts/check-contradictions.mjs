#!/usr/bin/env node
// Proves that text this repository has retired is actually gone.
//
// Written after three consumers hit superseded guidance in docs/adopting.md on a
// single day, on two unrelated topics. In every case a correction had been written
// and argued well, and the text it reversed was left in place, so which advice a
// reader got depended on where they entered the document.
//
// The rule this enforces is deliberately narrow: it cannot tell whether an argument
// is sound, only whether a literal we said we had stopped recommending still appears
// somewhere that reads as a recommendation. That is the mechanical half, and it is
// the half all three instances failed.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Each entry is a literal we have retired, plus the places allowed to still mention
// it. Allowances are prose that explains why the literal was retired -- a blockquote
// recording the reversal is the documented way to keep the history, so it must not
// trip the check that keeps the history honest.
const RETIRED = [
  {
    id: 'wide-zero-x-range',
    pattern: />=\s*(?:x\.y\.z|\d+\.\d+\.\d+)\s*<\s*1\.0\.0/g,
    why: 'A wide 0.x range accepts breaking minors sight-unseen, and does not upgrade a locked install anyway.',
    replacement: 'the caret (^0.x.y) plus pins:check',
    // Sentences that are *about* the retirement, rather than advocating it.
    exempt: [
      /used to say it was/i,
      /this passage used to end/i,
      /A consumer widened/i,
      /widened `?\^?0\.8\.0`?/i,
      /A `?>=0\.9\.0 <1\.0\.0`? range accepts/i,
      /\| `?>=0\.2\.0 <1\.0\.0`?/,
      /gave it away/i,
      /resolves to `?0\.17\.0`?/i,
      /Both are now deleted/i,
      /reverses on the evidence/i,
      /recommended\s*$/i,
      /Topic\s*\| Correction lived in/i,
      /Grep for the artefact/i,
    ],
  },
  {
    id: 'two-case-403',
    pattern: /metadata resolves and only the tarball(?: download)? fails/gi,
    why: 'That tell identifies a read_package 403 and silently misfiles a scope 403, which fails on metadata too.',
    replacement: 'the three-case table (401 / scope 403 / read_package 403)',
    exempt: [
      /was written for/i,
      /silently misfile/i,
      /gave the tell as/i,
      /wrong as a general rule/i,
    ],
  },
];

const FILES = ['docs/adopting.md'];

const isExempt = (line, entry) => entry.exempt.some((r) => r.test(line));

// Prose here is hard-wrapped, so the clause that marks a mention as explanatory is
// routinely on a different line from the literal itself. Matching a single line was
// the checker's own first bug: it reported two lines whose exempting phrase sat one
// line above. Judge a window, not a line.
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 2;

const contextOf = (lines, i) =>
  lines
    .slice(Math.max(0, i - WINDOW_BEFORE), Math.min(lines.length, i + WINDOW_AFTER + 1))
    .join(' ');

const findings = [];

for (const rel of FILES) {
  let text;
  try {
    text = await readFile(join(ROOT, rel), 'utf8');
  } catch {
    findings.push({ file: rel, line: 0, id: 'missing', text: 'file not found' });
    continue;
  }
  const lines = text.split(/\r?\n/);

  for (const entry of RETIRED) {
    lines.forEach((line, i) => {
      entry.pattern.lastIndex = 0;
      if (!entry.pattern.test(line)) return;
      if (isExempt(contextOf(lines, i), entry)) return;
      findings.push({ file: rel, line: i + 1, id: entry.id, text: line.trim(), entry });
    });
  }
}

if (findings.length === 0) {
  console.log(
    `No retired guidance found in ${FILES.length} file(s). ${RETIRED.length} literal(s) checked.`,
  );
  process.exitCode = 0;
} else {
  console.error('Retired guidance is still present and reads as a recommendation:\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.text}`);
    if (f.entry) {
      console.error(`    retired because: ${f.entry.why}`);
      console.error(`    say instead:     ${f.entry.replacement}`);
    }
    console.error('');
  }
  console.error(
    'If this line explains why the guidance was retired rather than advocating it,\n' +
      'add a narrower exemption to scripts/check-contradictions.mjs -- do not widen the pattern.',
  );
  process.exitCode = 1;
}
