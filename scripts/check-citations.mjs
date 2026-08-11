#!/usr/bin/env node
// Validates ENG-* principle citations in documentation.
//
// Three failure modes, only one of which an existence check can catch:
//
//   1. The ID does not exist        -> reported as an error, exit 1.
//   2. The ID exists but the link   -> reported as an error, exit 1. The area
//      points at the wrong file        prefix does not match the directory:
//                                      only ARCH lives under architecture/,
//                                      so a hand-written path is wrong about
//                                      nine times out of ten.
//   3. The ID exists but means      -> cannot be detected mechanically. The
//      something other than the        checker prints each citation next to the
//      surrounding prose claims        principle's real title AND statement so a
//                                      human or an agent reviewing the diff sees
//                                      the mismatch.
//
// Mode 3 is the common one. Every miscitation observed during the seven-repo
// migration used a real ID that meant something else, so `--review` output is
// the point of this tool, not the pass/fail exit code. Mode 2 was found
// independently by three consuming repositories, which is why it is checked
// here rather than left to a recipe each repository has to copy.
//
// The statement is printed because a three-word title pattern-matches too
// easily. But it is not strictly safer, and the difference matters: a statement
// naming a concern in passing reads as confirmation. ENG-PERF-009 "Assurance
// precedence" is "Reject performance changes that weaken correctness,
// ACCESSIBILITY, privacy, or security" — so the one principle most often
// miscited for accessibility is the one whose statement contains the word.
// Reading for a keyword is what produced the miscitation; the statement gives
// that habit more to match on. Hence the banner: ask whether the principle
// governs the claim, not whether it mentions the topic.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const CITATION = /\bENG-[A-Z]+-\d{3}\b/g;
// `ENG-X-001 (Thin typed adapters)`. Parentheses only, and the content must
// start with a capital — a title is a proper name. An em dash is ordinary prose
// punctuation ("per ENG-SEC-008 — never a real record") and reading it as a
// naming claim produced false positives, which is how a checker gets disabled.
const TITLED = /\b(ENG-[A-Z]+-\d{3})[`*_\]]*\s*\(([A-Z][^)/#\n]{2,59})\)/g;
// A markdown link whose visible text names a principle ID.
const ID_LINK = /\[([^\]]*?)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const DEFAULT_INDEX =
  'https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json';
// Bumped whenever a check is added or its verdict changes. Printed on every
// run: this script is fetched over the network and kept nowhere, so a stale
// copy is otherwise indistinguishable from a current one — a consumer reported
// a missing check that had shipped several releases earlier, having run an old
// copy that could not tell them so.
const TOOL_VERSION = '6';
const TEXT_EXT = new Set(['.md', '.mdx', '.markdown', '.txt', '.yml', '.yaml', '.json']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.svelte-kit', 'vendor']);

function parseArgs(argv) {
  const opts = { paths: [], index: DEFAULT_INDEX, review: false, json: false, links: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--index') {
      opts.index = argv[i + 1];
      i += 1;
    } else if (arg === '--review') {
      opts.review = true;
    } else if (arg === '--by-id') {
      opts.review = true;
      opts.byId = true;
    } else if (arg === '--no-links') {
      opts.links = false;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--version' || arg === '-V') {
      opts.version = true;
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
  --by-id             Implies --review, but groups every use of an ID
                      together instead of walking files in order. One ID
                      standing for two different claims is invisible file
                      by file and obvious when the uses are adjacent.
  --no-links          Skip link-path checking. On by default: a link whose
                      text names a real ID but whose path is wrong looks
                      authoritative and 404s, and the area prefix does not
                      follow the directory layout.
  --json              Machine-readable output.
  -V, --version       Print the checker version and exit.
  -h, --help          Show this message.

Exit codes: 0 = clean, 1 = unknown IDs or wrong link paths, 2 = tool error.`;

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
  const links = [];
  const titled = [];
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const [, label, href] of text.matchAll(ID_LINK)) {
      const id = label.match(/\bENG-[A-Z]+-\d{3}\b/)?.[0];
      if (!id) continue;
      const target = href.split('#')[0].trim();
      // Only links that aim at a principle source file. A link whose text names
      // an ID but points at a practice guide is citing the technique, not the
      // principle, and is correct as written.
      if (!/(^|\/)principles\//.test(target)) continue;
      links.push({ file, line: i + 1, id, href, target });
    }

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

    // A citation that also states the principle's name — `ENG-INT-001 (Thin
    // typed adapters)` or `ENG-INT-001 — Thin typed adapters` — makes a
    // semantic claim that can be checked mechanically. Every miscitation seen
    // in this migration used a real ID that meant something else, which no
    // existence check can catch; a stated title turns that into a diff.
    for (const [, id, paren] of text.matchAll(TITLED)) {
      titled.push({ file, line: i + 1, id, claimed: paren.trim() });
    }
  });
  return { hits, links, titled };
}

// Compare loosely: case, surrounding punctuation and internal whitespace are
// presentation, not meaning. A backticked or bolded title is still the title.
function normalizeTitle(s) {
  return s
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()
    .toLowerCase();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.version) {
    console.log(TOOL_VERSION);
    return 0;
  }

  const known = await loadIndex(opts.index);

  const files = [];
  for (const target of opts.paths) files.push(...(await collectFiles(target)));

  const citations = [];
  const links = [];
  const titled = [];
  for (const file of files) {
    const scanned = await scanFile(file);
    citations.push(...scanned.hits);
    links.push(...scanned.links);
    titled.push(...scanned.titled);
  }

  const unknown = citations.filter((c) => !known.has(c.id));

  // A link that names a real ID but points at the wrong file is worse than a
  // wrong ID: it looks authoritative and 404s. The area prefix does not follow
  // the directory layout, so this is guesswork nobody wins.
  const badLinks = opts.links
    ? links
        .filter((l) => known.has(l.id))
        .map((l) => ({ ...l, want: known.get(l.id).source }))
        .filter((l) => !l.target.endsWith(l.want))
    : [];

  const badTitles = titled
    .filter((t) => known.has(t.id))
    .map((t) => ({ ...t, want: known.get(t.id).title }))
    .filter((t) => normalizeTitle(t.claimed) !== normalizeTitle(t.want));

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          checkerVersion: TOOL_VERSION,
          checksRun: ['ids', 'statedNames', ...(opts.links ? ['linkPaths'] : [])],
          index: opts.index,
          scanned: files.length,
          citations: citations.map((c) => ({
            ...c,
            title: known.get(c.id)?.title ?? null,
          })),
          unknown,
          badLinks,
          badTitles,
        },
        null,
        2,
      ),
    );
    return unknown.length > 0 || badLinks.length > 0 || badTitles.length > 0 ? 1 : 0;
  }

  if (citations.length === 0) {
    console.log(`No ENG-* citations found in ${files.length} file(s).`);
    return 0;
  }

  if (opts.review) {
    console.log(
      '\nAsk of each citation: does this principle GOVERN the claim, or does it\n' +
        'merely mention the topic? A statement can name a concern in passing —\n' +
        'ENG-PERF-009 mentions accessibility while governing performance changes\n' +
        'only — and a keyword match reads as confirmation when it is not one.\n' +
        '\n' +
        'Where a citation is marked "use k of n", judge it on its own. A repo\n' +
        'that cites an ID correctly in one place and wrongly in another is the\n' +
        'observed shape: the correct nearby use makes the ID read as known-good\n' +
        'for the file, so the second use is never re-derived. Repetition is\n' +
        'normal and is not itself a defect — most IDs here are cited more than\n' +
        'once — so this is a prompt to check, not a finding.' +
        (opts.byId
          ? '\n\nGrouped by ID. Read each group as one question: do ALL of these\n' +
            'lines claim the same rule? One ID standing for two different claims\n' +
            'is what file-ordered review misses.'
          : ''),
    );
    const useCount = new Map();
    for (const c of citations) useCount.set(c.id, (useCount.get(c.id) ?? 0) + 1);

    const printBody = (c, principle) => {
      if (principle?.statement) {
        console.log(`         says: ${principle.statement}`);
      }
      for (const l of c.window ?? [{ n: c.line, text: c.context }]) {
        console.log(`      ${l.n === c.line ? '>' : ' '}  ${l.text.trim()}`);
      }
    };

    if (opts.byId) {
      const byId = new Map();
      for (const c of citations) {
        if (!byId.has(c.id)) byId.set(c.id, []);
        byId.get(c.id).push(c);
      }
      // Most-cited first: an ID used once cannot diverge from itself, so the
      // groups that can hide a divergence are the ones worth reading first.
      const ids = [...byId.keys()].sort(
        (a, b) => byId.get(b).length - byId.get(a).length || a.localeCompare(b),
      );
      for (const id of ids) {
        const principle = known.get(id);
        const title = principle ? principle.title : '*** UNKNOWN ID ***';
        const uses = byId.get(id);
        console.log(`\n${id}  ${title}  (${uses.length} use${uses.length === 1 ? '' : 's'})`);
        if (principle?.statement) console.log(`  says: ${principle.statement}`);
        for (const c of uses) {
          console.log(`  ${c.file}:${c.line}`);
          for (const l of c.window ?? [{ n: c.line, text: c.context }]) {
            console.log(`      ${l.n === c.line ? '>' : ' '}  ${l.text.trim()}`);
          }
        }
      }
      console.log('');
    } else {
      const seen = new Map();
      let current = null;
      for (const c of citations) {
        if (c.file !== current) {
          current = c.file;
          console.log(`\n${c.file}`);
        }
        const principle = known.get(c.id);
        const title = principle ? principle.title : '*** UNKNOWN ID ***';
        const total = useCount.get(c.id);
        const nth = (seen.get(c.id) ?? 0) + 1;
        seen.set(c.id, nth);
        const marker = total > 1 ? `  [use ${nth} of ${total}]` : '';
        console.log(`  ${String(c.line).padStart(5)}  ${c.id.padEnd(14)} ${title}${marker}`);
        printBody(c, principle);
      }
      console.log('');
    }
  }

  if (unknown.length > 0) {
    console.error(`${unknown.length} unknown citation(s):\n`);
    for (const c of unknown) console.error(`  ${c.file}:${c.line}  ${c.id}`);
    console.error('\nResolve each against principles/index.json.');
    return 1;
  }

  if (badLinks.length > 0) {
    console.error(`${badLinks.length} citation link(s) point at the wrong file:\n`);
    for (const l of badLinks) {
      console.error(`  ${l.file}:${l.line}  ${l.id} -> ${l.href}`);
      console.error(`      expected a path ending in ${l.want}`);
    }
    console.error(
      '\nThe area prefix does not match the directory: only ARCH lives under\n' +
        'architecture/. Copy the "source" field from principles/index.json rather\n' +
        'than deriving the path from the ID.',
    );
    return 1;
  }

  const distinct = new Set(citations.map((c) => c.id));

  if (badTitles.length > 0) {
    console.error(`${badTitles.length} citation(s) state the wrong principle name:\n`);
    for (const t of badTitles) {
      console.error(`  ${t.file}:${t.line}  ${t.id}`);
      console.error(`      claimed:  ${t.claimed}`);
      console.error(`      actual:   ${t.want}`);
    }
    console.error(
      '\nThe ID exists, so an existence check passes and the citation still\n' +
        'misleads. Every miscitation in the seven-repo migration was this shape:\n' +
        'a real ID standing for a different rule. Take the name from\n' +
        'principles/index.json rather than from memory.',
    );
    return 1;
  }

  console.log(
    `${citations.length} citation(s) across ${distinct.size} principle(s) in ` +
      `${files.length} file(s); all IDs exist` +
      (titled.length > 0 ? `, and ${titled.length} stated name(s) match` : '') +
      '.',
  );
  console.log(
    `checker v${TOOL_VERSION}; checks run: IDs, stated names` +
      (opts.links ? ', link paths' : ' (link paths SKIPPED via --no-links)') +
      `. Index: ${opts.index}`,
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
