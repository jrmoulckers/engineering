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
      /a test used to REJECT carets/i,
      /WHAT CHANGED, AND WHY/i,
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
  {
    // versions.json is the file consumers are told to paste from, and its legend
    // instructed them not to use a caret while the values six lines below it were
    // carets and the test enforcing those values required carets. Anyone following
    // the legend would have rewritten a correct value into the retired one.
    id: 'anti-caret-instruction',
    pattern:
      /(?:Do not rewrite it as a caret|rejects caret(?: and tilde)? forms|records an explicit upper bound)/gi,
    why: 'versions.json now records a caret and its test requires one; staleness is closed by pins:check, not by a wider range.',
    replacement: 'copy the recorded range literally, whatever shape it has',
    exempt: [/used to/i, /WHAT CHANGED/i, /it now records/i],
  },
  {
    // An identifier is a claim about another repository. This one was transcribed
    // from a proposal written before the backbone was implemented, and never read
    // back out of the workflow. Passing an undeclared secret name to a reusable
    // workflow is rejected at the caller, so a reader following it got a startup
    // failure before any of the surrounding diagnosis could apply.
    id: 'nonexistent-secret-name',
    pattern: /packages-read-token/g,
    why: 'No such secret exists. The reusable workflows declare NODE_AUTH_TOKEN; an undeclared secret name is rejected at the caller.',
    replacement:
      'secrets.NODE_AUTH_TOKEN, which falls back to github.token when registry-url is set',
    exempt: [/There is no such secret/i, /from a proposal/i, /fails on the wrong name/i],
  },
  {
    // The sixth instance of superseded text found in this document, and the second
    // for this particular claim. The carve-out was retracted with a controlled
    // measurement in one section while a paragraph 40 lines away still told readers
    // a block-less caller "sails through". Retracting against a heading leaves the
    // other occurrences; retract against the artefact.
    //
    // Measured: default_workflow_permissions is `read` on all seven repositories in
    // this fleet, granting contents + packages only -- so a block-less caller is
    // still short pull-requests: read for reusable-ci-lint and id-token: write for
    // reusable-deploy-pages, and fails exactly like one with a block.
    id: 'blockless-caller-immune',
    pattern:
      /(?:inherits a permissive\s+default and sails through|sails through|no block is immune|is therefore immune|unaffected by (?:this|the) ceiling)/gi,
    why: 'A caller with no permissions: block inherits default_workflow_permissions, measured as `read` fleet-wide, and fails identically against any callee needing more.',
    replacement:
      'compute the block as the union of what every callee declares; there is no exemption for omitting it',
    exempt: [
      /used to (?:say|follow|end)/i,
      /is wrong and it is retracted/i,
      /had been told/i,
      /has been told/i,
      /close to backwards/i,
      /The conclusion drawn from that/i,
      /pointed away from/i,
    ],
  },
  {
    // `nextConfig()` imported only the Next plugin plus hooks through 0.12.0.
    // From 0.13.0 it composes the shared React layer, which imports
    // eslint-plugin-react and eslint-plugin-jsx-a11y directly, so a Next repo
    // needs four plugins. A consumer on 0.9.0 quoted the old two-plugin row
    // back -- correctly for their version -- against a broadcast of mine that
    // said three. The fact is version-dependent; any unqualified statement of
    // it is wrong for some reader.
    id: 'next-plugin-count-unversioned',
    pattern:
      /Next(?:\.js)?[^.\n]{0,40}(?:needs|requires|install(?:s)?)[^.\n]{0,40}(?:two|2) plugins/gi,
    why: 'nextConfig() composes the React layer from 0.13.0, so a Next repo needs four plugins; the two-plugin form is true only for <=0.12.0 and describes the release that silently dropped 17 react/* and 6 jsx-a11y/* rules.',
    replacement: 'state the version boundary: two plugins through `0.12.0`, four from `0.13.0`',
    exempt: [
      /outdated, see below/i,
      /Through `0\.12\.0`/i,
      /their two was right/i,
      /is a symptom, not a recipe/i,
    ],
  },
  {
    // A preset advertising `esModuleInterop` re-creates the audit confusion that
    // caused it to be removed. The option is inert under this family's `bundler`
    // resolution and `noEmit`, deprecated on TS 6 and removed on TS 7 -- so any
    // copy claiming a variant "adds" it is describing a state we deliberately left.
    id: 'esmoduleinterop-as-a-feature',
    pattern: /(?:adds?|sets?|includes?|enables?)[^.\n]{0,60}`?esModuleInterop`?/gi,
    why: 'no tsconfig variant sets esModuleInterop: `moduleResolution: "bundler"` implies allowSyntheticDefaultImports and `noEmit` retires the emit half, so it is inert on TS 5.x; TS 6 deprecates `false` (TS5107) and TS 7 removes it (TS5108).',
    replacement:
      'drop the mention, or state why it is absent rather than describing it as something a preset adds',
    exempt: [
      /Obsoleted by the language/i,
      /earns its row/i,
      /is set nowhere/i,
      /becoming the only value/i,
      /can only be default-imported/i,
    ],
  },
];

const FILES = ['docs/adopting.md', 'versions.json', 'packages/tsconfig/README.md'];

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
