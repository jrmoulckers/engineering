#!/usr/bin/env node
// Search every field of every principle record, and say which field matched.
//
// Two repositories independently concluded "no principle covers framework-free
// domain logic" after searching all 66 Statements. Both were wrong the same
// way: `ENG-ARCH-002`'s Statement is about typed versioned contracts, and its
// *Evidence* reads "policy modules run without a renderer or consumer
// framework". A Statement search cannot see it.
//
// The repository shipped a checker for a principle you have already named and
// nothing for finding one, so every consumer improvised the search -- and the
// obvious improvisation excludes the field where checkable obligations tend to
// live. Reporting the matching field is the point: it tells the reader whether
// the hit is the principle's purpose (Statement) or the thing they must be able
// to show (Evidence).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INDEX = path.join(HERE, '..', 'principles', 'index.json');

// Ordered so the most obligation-bearing fields print first.
const FIELDS = ['statement', 'evidence', 'rationale', 'title', 'id'];

function parseArgs(argv) {
  const opts = { terms: [], index: DEFAULT_INDEX, json: false, field: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--index') {
      opts.index = argv[i + 1];
      i += 1;
    } else if (arg === '--field') {
      opts.field = (argv[i + 1] || '').toLowerCase();
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      opts.terms.push(arg);
    }
  }
  return opts;
}

const USAGE = `Usage: node scripts/find-principle.mjs <pattern> [--field <name>] [--json]

Searches id, title, statement, rationale and evidence. The pattern is a
JavaScript regular expression, matched case-insensitively.

  node scripts/find-principle.mjs 'framework|renderer'
  node scripts/find-principle.mjs 'tombstone' --json

Searching only Statements is how two repositories concluded a principle did not
exist when it did; --field exists for narrowing a known-good search, not for
the initial one.`;

function loadRecords(index) {
  if (Array.isArray(index.principles)) return index.principles;
  return Object.values(index.principles ?? {}).flat();
}

function excerpt(text, re) {
  const m = re.exec(text);
  if (!m) return text.slice(0, 140);
  const start = Math.max(0, m.index - 55);
  const end = Math.min(text.length, m.index + m[0].length + 85);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help || opts.terms.length === 0) {
    console.log(USAGE);
    return opts.help ? 0 : 2;
  }

  let index;
  try {
    index = JSON.parse(await readFile(opts.index, 'utf8'));
  } catch (err) {
    console.error(`Cannot read principle index at ${opts.index}: ${err.message}`);
    return 2;
  }

  let re;
  try {
    re = new RegExp(opts.terms.join(' '), 'i');
  } catch (err) {
    console.error(`Not a valid regular expression: ${err.message}`);
    return 2;
  }

  const fields = opts.field ? [opts.field] : FIELDS;
  if (opts.field && !FIELDS.includes(opts.field)) {
    console.error(`Unknown field "${opts.field}". Known: ${FIELDS.join(', ')}`);
    return 2;
  }

  const records = loadRecords(index);
  const hits = [];
  for (const p of records) {
    const matched = fields.filter((f) => re.test(String(p[f] ?? '')));
    if (matched.length > 0) hits.push({ id: p.id, title: p.title, matched, record: p });
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        { pattern: re.source, searchedFields: fields, total: records.length, hits },
        null,
        2,
      ),
    );
    return hits.length > 0 ? 0 : 1;
  }

  if (hits.length === 0) {
    console.log(`No principle matches /${re.source}/i in ${fields.join(', ')}.`);
    console.log(
      `Searched ${records.length} record(s). Before concluding none exists, try a broader\n` +
        `pattern -- a principle states its purpose in different words than you would.`,
    );
    return 1;
  }

  console.log(`${hits.length} of ${records.length} principle(s) match /${re.source}/i:\n`);
  for (const h of hits) {
    console.log(`${h.id}  ${h.title}`);
    for (const f of h.matched) {
      const re2 = new RegExp(re.source, 'ig');
      console.log(`  ${f.padEnd(9)} ${excerpt(String(h.record[f]), re2)}`);
    }
    // The distinction that produced this tool: purpose versus obligation.
    if (!h.matched.includes('statement') && h.matched.includes('evidence')) {
      console.log(
        `  ${''.padEnd(9)} ^ matched in Evidence only -- the Statement does not mention this,\n` +
          `  ${''.padEnd(9)}   so a Statement-only search would miss it.`,
      );
    }
    console.log('');
  }
  console.log(`Searched fields: ${fields.join(', ')}.`);
  console.log(
    'A match is not authority. Read the whole record and confirm the principle governs\n' +
      'your claim rather than merely sharing its vocabulary.',
  );
  return 0;
}

// `file://${argv[1]}` does not round-trip on Windows -- a drive path yields
// file://C:/... where Node produces file:///C:/..., so the guard silently
// never fires and the script exits 0 having printed nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
