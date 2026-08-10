#!/usr/bin/env node
// Validates ENG-* principle citations in documentation.
//
// Two failure modes, only one of which a existence check can catch:
//
//   1. The ID does not exist        -> reported as an error, exit 1.
//   2. The ID exists but means      -> cannot be detected mechanically. The
//      something other than the        checker prints each citation next to the
//      surrounding prose claims        principle's real title so a human or an
//                                      agent reviewing the diff sees the
//                                      mismatch immediately.
//
// Mode 2 is the common one. Every miscitation observed during the seven-repo
// migration used a real ID that meant something else, so `--review` output is
// the point of this tool, not the pass/fail exit code.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const CITATION = /\bENG-[A-Z]+-\d{3}\b/g;
const DEFAULT_INDEX =
  'https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json';
const TEXT_EXT = new Set(['.md', '.mdx', '.markdown', '.txt', '.yml', '.yaml', '.json']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.svelte-kit', 'vendor']);

function parseArgs(argv) {
  const opts = { paths: [], index: DEFAULT_INDEX, review: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--index') {
      opts.index = argv[i + 1];
      i += 1;
    } else if (arg === '--review') {
      opts.review = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      opts.paths.push(arg);
    }
  }
  if (opts.paths.length === 0) opts.paths.push('.');
  return opts;
}

const USAGE = `Usage: check-citations.mjs [paths...] [options]

Options:
  --index <path|url>  principles/index.json to validate against.
                      Defaults to the copy on jrmoulckers/engineering@main.
                      Pass a pinned tag URL to match the ref you cite.
  --review            Print every citation with the principle's real title,
                      so wrong-meaning citations are visible. Use this when
                      writing citations; existence alone proves little.
  --json              Machine-readable output.
  -h, --help          Show this message.

Exit codes: 0 = no unknown IDs, 1 = unknown IDs found, 2 = tool error.`;

async function loadIndex(source) {
  let raw;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Could not fetch ${source} — HTTP ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  } else {
    raw = await readFile(source, 'utf8');
  }

  const parsed = JSON.parse(raw);
  const principles = parsed.principles;
  if (!Array.isArray(principles)) {
    throw new Error(`${source} has no top-level "principles" array`);
  }
  return new Map(principles.map((p) => [p.id, p]));
}

async function collectFiles(target) {
  const info = await stat(target);
  if (info.isFile()) return [target];

  const found = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR.has(entry.name)) continue;
        await walk(full);
      } else if (TEXT_EXT.has(path.extname(entry.name))) {
        found.push(full);
      }
    }
  };
  await walk(target);
  return found;
}

async function scanFile(file) {
  const hits = [];
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const match of text.matchAll(CITATION)) {
      hits.push({
        file,
        line: i + 1,
        id: match[0],
        context: text.trim(),
        // A wrapped markdown link puts the ID on a line of its own, with the
        // claim it supports on a neighbouring line. Showing only the citing
        // line renders as a bare URL and hides the very thing being checked.
        window: lines
          .slice(Math.max(0, i - 2), i + 3)
          .map((l, k) => ({ n: Math.max(0, i - 2) + k + 1, text: l }))
          .filter((l) => l.text.trim() !== ''),
      });
    }
  });
  return hits;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const known = await loadIndex(opts.index);

  const files = [];
  for (const target of opts.paths) files.push(...(await collectFiles(target)));

  const citations = [];
  for (const file of files) citations.push(...(await scanFile(file)));

  const unknown = citations.filter((c) => !known.has(c.id));

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          scanned: files.length,
          citations: citations.map((c) => ({
            ...c,
            title: known.get(c.id)?.title ?? null,
          })),
          unknown,
        },
        null,
        2,
      ),
    );
    return unknown.length > 0 ? 1 : 0;
  }

  if (citations.length === 0) {
    console.log(`No ENG-* citations found in ${files.length} file(s).`);
    return 0;
  }

  if (opts.review) {
    let current = null;
    for (const c of citations) {
      if (c.file !== current) {
        current = c.file;
        console.log(`\n${c.file}`);
      }
      const principle = known.get(c.id);
      const title = principle ? principle.title : '*** UNKNOWN ID ***';
      console.log(`  ${String(c.line).padStart(5)}  ${c.id.padEnd(14)} ${title}`);
      for (const l of c.window ?? [{ n: c.line, text: c.context }]) {
        console.log(`      ${l.n === c.line ? '>' : ' '}  ${l.text.trim()}`);
      }
    }
    console.log('');
  }

  if (unknown.length > 0) {
    console.error(`${unknown.length} unknown citation(s):\n`);
    for (const c of unknown) console.error(`  ${c.file}:${c.line}  ${c.id}`);
    console.error('\nResolve each against principles/index.json.');
    return 1;
  }

  const distinct = new Set(citations.map((c) => c.id));
  console.log(
    `${citations.length} citation(s) across ${distinct.size} principle(s) in ` +
      `${files.length} file(s); all IDs exist.`,
  );
  if (!opts.review) {
    console.log(
      'Existence is not correctness — re-run with --review to check each ID ' +
        'means what the surrounding text claims.',
    );
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`check-citations: ${err.message}`);
    process.exitCode = 2;
  },
);
