#!/usr/bin/env node
/**
 * Refuses to cut a release from a commit whose CI is not green.
 *
 * This exists because `main` was red for **five consecutive runs** and five
 * releases were cut and broadcast to seven repositories across that window,
 * each one reported as verified. The local evidence was true and complete on
 * its own terms — 386 tests and every documentation gate exiting 0 — and it was
 * blind to the failure, because the failing gate was `versions:check`, which
 * needs a registry token and therefore **cannot run locally at all**.
 *
 * That is the general shape, and it will recur with any future gate that needs
 * a secret: a maintainer's local run is not a weaker version of CI, it is a
 * different set of checks. "I ran the tests" cannot stand in for "CI passed" no
 * matter how many tests there are. So this asks the only question that covers
 * gates nobody remembered to run: did the checks actually pass, on this exact
 * commit?
 *
 * What was published in the meantime was worse than a red build. `versions.json`
 * advertised `tsconfig@0.4.0` while the registry served `0.5.0`, and that file is
 * specifically the fallback consumers read when they cannot query the registry.
 * The stale entry looked authoritative, and at least one consumer reported it
 * back as a registry-verified reading.
 *
 * Three rules, each one a failure this repository has already had:
 *
 *   1. **No run found is a failure, not a pass.** An unpushed commit, a shallow
 *      clone, a typo'd workflow name and a genuinely clean history are
 *      indistinguishable from "zero red runs". Reporting success from an empty
 *      comparison is the vacuous pass that `check-release-lag.mjs` guards
 *      against for tags and that the vendoring lock guards against for configs.
 *
 *   2. **Newest run per workflow, not all runs.** A superseded or cancelled run
 *      from a rapid push is not evidence of anything, and failing on one would
 *      make the gate noisy enough to be bypassed — which is how a gate stops
 *      working without anyone deciding to stop using it.
 *
 *   3. **Fail closed on an API error.** The usual rule in this repository is
 *      that a network check should fail open, because a blip should not block a
 *      merge. A release gate inverts it: refusing to tag costs one retry, and
 *      tagging a red commit costs a fleet-wide broadcast of an unverified
 *      release. The asymmetry decides it.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// A run that is still going is not evidence yet. It is reported separately from
// a failure because the remedy differs: wait, versus fix.
export const PENDING = 'pending';
export const FAILED = 'failed';
export const MISSING = 'missing';

/**
 * Pure verdict over a run list, so the decision is testable without a network.
 *
 * `runs` are objects with `name`, `status`, `conclusion`, `createdAt` and
 * `headSha`, matching the `gh run list --json` field names.
 */
export function verdict(runs, sha) {
  const mine = runs.filter((run) => run.headSha === sha);

  if (mine.length === 0) {
    return { ok: false, kind: MISSING, problems: [] };
  }

  // Newest per workflow. A re-run or a superseded attempt should not be able to
  // veto a subsequent green, and an old green should not cover a later red.
  const newest = new Map();
  for (const run of mine) {
    const seen = newest.get(run.name);
    if (seen === undefined || run.createdAt > seen.createdAt) newest.set(run.name, run);
  }

  const problems = [];
  for (const run of [...newest.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    if (run.status !== 'completed') {
      problems.push({ name: run.name, state: run.status, kind: PENDING });
    } else if (run.conclusion !== 'success') {
      problems.push({ name: run.name, state: run.conclusion, kind: FAILED });
    }
  }

  if (problems.length === 0) return { ok: true, kind: null, problems: [] };

  // A single pending workflow is a different instruction than a red one, but a
  // mix is a failure — the red does not become provisional by sharing a commit
  // with something still running.
  const kind = problems.every((problem) => problem.kind === PENDING) ? PENDING : FAILED;
  return { ok: false, kind, problems };
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function fetchRuns(sha) {
  const out = execFileSync(
    'gh',
    [
      'run',
      'list',
      '--commit',
      sha,
      '--limit',
      '50',
      '--json',
      'name,status,conclusion,createdAt,headSha',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return JSON.parse(out);
}

async function main() {
  // Resolve through git first. `gh run list --commit` matches the full SHA only,
  // so an abbreviated argument returns an empty list — which this check reports
  // as "no runs found", correctly failing closed but failing *every* time. A gate
  // that is always red is a gate that gets bypassed, so this is not a cosmetic
  // fix. Found by running the CLI against a commit already known to be green.
  // Resolving also accepts tags and branch names, which is what a release
  // actually has in hand.
  let sha;
  const ref = process.argv[2] ?? 'HEAD';
  try {
    sha = git('rev-parse', ref);
  } catch {
    process.stderr.write(`error: '${ref}' is not a ref this repository knows.\n`);
    process.exitCode = 1;
    return;
  }

  let runs;
  try {
    runs = fetchRuns(sha);
  } catch (error) {
    process.stderr.write(
      `error: could not read CI runs for ${sha.slice(0, 8)}: ${error.message}\n\n` +
        `Refusing to report a release as ready from a failed lookup. A merge check may\n` +
        `fail open on a blip; a release check may not, because the cost is asymmetric —\n` +
        `a retry here, against a fleet-wide broadcast of an unverified release there.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const result = verdict(runs, sha);

  if (result.ok) {
    process.stdout.write(`CI is green on ${sha.slice(0, 8)}. Safe to tag.\n`);
    return;
  }

  if (result.kind === MISSING) {
    process.stderr.write(
      `error: no CI runs found for ${sha.slice(0, 8)}.\n\n` +
        `This is a failure, not a pass. An unpushed commit, a renamed workflow and a\n` +
        `genuinely clean history all look identical from here — "no red runs" is not\n` +
        `"the checks passed". Push the commit and let CI run before tagging.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const lines = result.problems.map((problem) => `  ${problem.name}: ${problem.state}`).join('\n');

  if (result.kind === PENDING) {
    process.stderr.write(
      `error: CI has not finished on ${sha.slice(0, 8)}:\n${lines}\n\n` +
        `Wait for it. Tagging now would publish before the checks that gate publishing.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stderr.write(
    `error: CI is not green on ${sha.slice(0, 8)}:\n${lines}\n\n` +
      `Do not tag. A local run cannot stand in for this: gates that need a secret —\n` +
      `\`versions:check\` needs a registry token — cannot run on your machine at all, so\n` +
      `a full-green local suite is silent about them rather than reassuring.\n\n` +
      `  gh run list --commit ${sha.slice(0, 8)}\n`,
  );
  process.exitCode = 1;
}

// `file://${argv[1]}` does not round-trip on Windows: a drive path yields
// file://C:/... where Node produces file:///C:/..., so the guard never fires and
// the script exits 0 having printed nothing. This file was written with that bug
// and it is the third time in this repository, which is why it is now a comment
// rather than a memory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
