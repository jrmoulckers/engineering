#!/usr/bin/env node
/**
 * Decide whether a proposed workflow re-pin actually moves a consumer forward.
 *
 * Five consecutive recommendations were sent to one repository on a premise that
 * was 14-19 commits stale. Each argument was internally sound; every premise was
 * wrong. The fifth would have removed an input the consumer passes
 * (`exclude-glob`), and GitHub rejects an undeclared `with:` input outright, so
 * the advice would have turned a green perf job red.
 *
 * Nothing in a well-reasoned argument signals a stale premise, so the defence has
 * to be mechanical and has to run *before* the recommendation is written. One
 * field settles it:
 *
 *   compare <proposed>...<their-pin>  ->  behind_by === 0
 *
 * means their pin already contains the proposal and the recommendation is
 * backwards. That fires without the sender already suspecting anything, which is
 * the property a file-list comparison lacks.
 *
 * Usage:
 *   node scripts/check-repin.mjs --repo owner/name --propose <sha>
 *   node scripts/check-repin.mjs --repo owner/name --propose <sha> --ref <branch>
 *   node scripts/check-repin.mjs --fixture <file.json> --propose <sha>   # hermetic
 *
 * Exit 0 = the proposal moves them forward (or there is nothing to say).
 * Exit 1 = the proposal is backwards or would drop a declared input.
 * Exit 2 = bad input.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const UPSTREAM = 'jrmoulckers/.github';

/**
 * Extract every pinned reusable-workflow reference from a workflow file.
 *
 * @param {string} yaml
 * @returns {{workflow: string, sha: string, line: number}[]}
 */
export function parsePins(yaml) {
  const out = [];
  const lines = yaml.split('\n');
  for (const [i, line] of lines.entries()) {
    const m = line.match(
      /uses:\s*([\w.-]+\/[\w.-]+)\/(\.github\/workflows\/[\w.-]+\.ya?ml)@([0-9a-f]{7,40})/,
    );
    if (m) out.push({ workflow: m[2], sha: m[3], line: i + 1 });
  }
  return out;
}

/**
 * Extract the `with:` input names a caller passes to each reusable workflow.
 *
 * Indentation-scoped rather than regex-over-the-file: an input belongs to the
 * nearest preceding `uses:` at a shallower indent, which is what makes it
 * possible to say *which* callee would reject it.
 *
 * @param {string} yaml
 * @returns {Map<string, Set<string>>} workflow path -> input names
 */
export function parsePassedInputs(yaml) {
  /** @type {Map<string, Set<string>>} */
  const byWorkflow = new Map();
  const lines = yaml.split('\n');
  /** @type {string | null} */
  let current = null;
  let usesIndent = 0;
  let inWith = false;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const uses = line.match(/uses:\s*[\w.-]+\/[\w.-]+\/(\.github\/workflows\/[\w.-]+\.ya?ml)@/);
    if (uses) {
      current = uses[1];
      usesIndent = indent;
      inWith = false;
      if (!byWorkflow.has(current)) byWorkflow.set(current, new Set());
      continue;
    }
    if (current === null) continue;
    if (indent <= usesIndent && !/^\s*with:/.test(line)) {
      // Dedented back out of this job's `uses:` block.
      if (indent < usesIndent) current = null;
      inWith = false;
      continue;
    }
    if (/^\s*with:\s*$/.test(line)) {
      inWith = true;
      continue;
    }
    if (inWith) {
      const kv = line.match(/^\s*([\w-]+):/);
      if (kv) byWorkflow.get(current)?.add(kv[1]);
    }
  }
  return byWorkflow;
}

/**
 * Names every input a reusable workflow declares under `workflow_call`.
 *
 * @param {string} yaml
 * @returns {Set<string>}
 */
export function parseDeclaredInputs(yaml) {
  const out = new Set();
  const lines = yaml.split('\n');
  let inInputs = false;
  let inputsIndent = 0;
  for (const line of lines) {
    if (/^\s*inputs:\s*$/.test(line)) {
      inInputs = true;
      inputsIndent = line.length - line.trimStart().length;
      continue;
    }
    if (!inInputs) continue;
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= inputsIndent) {
      inInputs = false;
      continue;
    }
    if (indent === inputsIndent + 2) {
      const kv = line.match(/^\s*([\w-]+):/);
      if (kv) out.add(kv[1]);
    }
  }
  return out;
}

/**
 * @param {{ahead_by: number, behind_by: number}} cmp comparing proposed...pinned
 * @returns {'backwards' | 'forwards' | 'identical'}
 */
export function verdictFor(cmp) {
  if (cmp.behind_by === 0 && cmp.ahead_by === 0) return 'identical';
  // `proposed...pinned` ahead means the pin contains commits the proposal lacks.
  if (cmp.behind_by === 0 && cmp.ahead_by > 0) return 'backwards';
  return 'forwards';
}

/**
 * Inputs the consumer passes that the proposed ref does not declare.
 *
 * @param {Set<string>} passed
 * @param {Set<string>} declared
 * @returns {string[]}
 */
export function inputsLostBy(passed, declared) {
  return [...passed].filter((name) => !declared.has(name)).sort();
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });

/** @param {string} repo @param {string} path @param {string} [ref] */
function readFile(repo, path, ref) {
  const q = ref ? `${path}?ref=${ref}` : path;
  // `.content` arrives base64 and line-wrapped; joining before decoding is
  // required or the decode silently truncates.
  const raw = gh(['api', `repos/${repo}/contents/${q}`, '--jq', '.content']);
  return Buffer.from(raw.split('\n').join(''), 'base64').toString('utf8');
}

function parseArgs(argv) {
  const args = {
    repo: null,
    propose: null,
    ref: null,
    fixture: null,
    workflow: '.github/workflows/ci.yml',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    if (key in args) {
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.propose || (!args.repo && !args.fixture)) {
    console.error('usage: check-repin.mjs --repo owner/name --propose <sha> [--ref <branch>]');
    return 2;
  }

  const callerYaml = args.fixture
    ? JSON.parse(readFileSync(args.fixture, 'utf8')).caller
    : readFile(args.repo, args.workflow, args.ref ?? undefined);

  const pins = parsePins(callerYaml);
  if (pins.length === 0) {
    console.log(`No pinned reusable workflows in ${args.workflow}. Nothing to compare.`);
    return 0;
  }

  const passed = parsePassedInputs(callerYaml);
  const problems = [];

  for (const sha of [...new Set(pins.map((p) => p.sha))]) {
    const cmp = args.fixture
      ? JSON.parse(readFileSync(args.fixture, 'utf8')).compare
      : JSON.parse(
          gh([
            'api',
            `repos/${UPSTREAM}/compare/${args.propose}...${sha}`,
            '--jq',
            '{ahead_by:.ahead_by,behind_by:.behind_by}',
          ]),
        );

    const verdict = verdictFor(cmp);
    console.log(
      `compare ${args.propose.slice(0, 7)}...${sha.slice(0, 7)}  ` +
        `ahead_by=${cmp.ahead_by} behind_by=${cmp.behind_by}  -> ${verdict}`,
    );

    if (verdict === 'backwards') {
      problems.push(
        `Their pin ${sha.slice(0, 7)} is a strict descendant of your proposal ` +
          `${args.propose.slice(0, 7)} (behind_by=0, ahead_by=${cmp.ahead_by}). ` +
          'The recommendation is backwards -- they already have it.',
      );
    }

    for (const { workflow } of pins.filter((p) => p.sha === sha)) {
      const declared = args.fixture
        ? new Set(JSON.parse(readFileSync(args.fixture, 'utf8')).declared?.[workflow] ?? [])
        : parseDeclaredInputs(readFile(UPSTREAM, workflow, args.propose));
      const lost = inputsLostBy(passed.get(workflow) ?? new Set(), declared);
      if (lost.length > 0) {
        problems.push(
          `${workflow} at ${args.propose.slice(0, 7)} does not declare: ${lost.join(', ')}. ` +
            'GitHub rejects an undeclared `with:` input, so this re-pin fails the job outright.',
        );
      }
    }
  }

  if (problems.length > 0) {
    console.log('\nDo not send this recommendation:\n');
    for (const p of problems) console.log(`  - ${p}`);
    return 1;
  }

  console.log('\nProposal moves this consumer forward and drops no input they pass.');
  return 0;
}

// `import.meta.url` and a bare argv path never compare equal on Windows
// (`file://C:/...` vs `file:///C:/...`), which makes the script exit 0 printing
// nothing. Normalise through pathToFileURL.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
