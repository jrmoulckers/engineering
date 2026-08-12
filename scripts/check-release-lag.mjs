#!/usr/bin/env node
/**
 * Catches changes that cannot reach a consumer.
 *
 * Merging is not shipping. `publish.yml` runs on a tag, and consumers resolve
 * `releases/latest` — so a merge to `main` changes nothing anybody can install
 * or vendor until someone cuts a tag. That is a manual step, and it was missed
 * for **30 consecutive commits** while every one of those fixes was reported to
 * seven repositories as shipped. Consumers were then told to re-pin to a release
 * that did not contain the fix they were re-pinning for.
 *
 * The irony is worth recording, because it is the reason this check exists: this
 * repository publishes a staleness notice telling consumers when they are behind
 * the latest release, while the latest release sat 30 commits behind the fixes.
 * The signal pointed outward. Nothing pointed at us.
 *
 * Two failures, because they are different and only one is about tagging:
 *
 *   1. **Unreleasable package change (hard).** `publish.yml` skips any version
 *      already on the registry, so a package whose files changed without a
 *      version bump is not published by the next tag either — it is silently
 *      skipped, and the tag reports success. This is not hypothetical: the
 *      commit adding a `./package.json` export to both packages bumped neither,
 *      so the fix for a consumer's reported defect would have been unreachable
 *      through a release cut specifically to deliver it.
 *
 *   2. **Unreleased consumer-visible commits (warn).** Everything a consumer
 *      fetches rather than installs — the vendoring script, configs, practices,
 *      principles. Warn-only because failing would block every merge until a tag
 *      was cut, which inverts the dependency: you cannot tag what you cannot
 *      merge.
 *
 * Offline by construction: git tags and `versions.json`, no registry call. A
 * check that needs the network fails open on a blip, and this one exists because
 * something failed open silently.
 */

import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Consumers fetch these at a ref rather than installing them, so a change here
// reaches nobody until a tag exists — and `scripts/vendor-configs.mjs` is the
// sharpest case, because the script a consumer runs is the one from their pinned
// ref. A fix to the tool only reaches them when they re-vendor, using the tool
// that does not yet contain the fix.
//
// `docs/` was missing here at first, and the omission was found by this check
// reporting "no unreleased consumer-visible changes" across two commits that
// both edited `docs/adopting.md`. That file is the consumer contract: repos cite
// it by section at a pinned ref, so a correction landed there is exactly as
// unreachable as a correction landed in `configs/`. Documentation is fetched
// content, not commentary about fetched content, and the same goes for the ADRs
// under `docs/architecture/` that consumers are told to cite.
const FETCHED_PATHS = [
  'scripts/vendor-configs.mjs',
  'configs/',
  'practices/',
  'principles/',
  'docs/',
];

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/**
 * Version order, not lexical: `v0.9.0` sorts above `v0.11.0` under a string
 * comparison, which is the same trap consumers are warned about elsewhere in
 * this repository.
 */
function latestTag() {
  const out = git('tag', '--list', 'v*', '--sort=-v:refname');
  return out === '' ? null : out.split('\n')[0].trim();
}

async function main() {
  const tag = latestTag();

  // No tags means the comparison cannot be made. Reporting "nothing unreleased"
  // here would be the vacuous pass this check exists to prevent — in CI it would
  // happen on any shallow clone that omits tags, and it would look identical to
  // a clean run forever.
  if (tag === null) {
    process.stderr.write(
      'error: no v* tags found, so nothing can be compared against the latest release.\n' +
        'In CI this usually means tags were not fetched: actions/checkout needs\n' +
        'fetch-depth: 0. Refusing to report a clean result from an empty comparison.\n',
    );
    process.exitCode = 1;
    return;
  }

  const versions = JSON.parse(await readFile(join(ROOT, 'versions.json'), 'utf8'));
  const dirs = (await readdir(join(ROOT, 'packages'), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const unreleasable = [];
  for (const dir of dirs) {
    const pkg = JSON.parse(await readFile(join(ROOT, 'packages', dir, 'package.json'), 'utf8'));
    if (pkg.private === true) continue;

    const changed = git('diff', '--name-only', `${tag}..HEAD`, '--', `packages/${dir}/`);
    if (changed === '') continue;

    const published = versions.packages?.[pkg.name]?.version;
    if (published === undefined) continue;

    if (pkg.version === published) {
      unreleasable.push(
        `${pkg.name}: files changed since ${tag} but version is still ${pkg.version}, ` +
          `which is already published`,
      );
    }
  }

  if (unreleasable.length > 0) {
    process.stderr.write(
      `error: ${unreleasable.length} package(s) changed without a version bump:\n` +
        unreleasable.map((line) => `  ${line}`).join('\n') +
        `\n\npublish.yml skips a version that already exists on the registry, so the next\n` +
        `tag will report success and publish nothing. Bump the version in the same change\n` +
        `that alters the package. Leave versions.json alone — it records what IS published\n` +
        `and cannot lead a publish.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const unreleased = git('log', '--oneline', `${tag}..HEAD`, '--', ...FETCHED_PATHS);
  const count = unreleased === '' ? 0 : unreleased.split('\n').length;

  if (count > 0) {
    process.stdout.write(
      `\nNotice: ${count} commit(s) since ${tag} change files consumers fetch at a ref.\n` +
        `Until a tag is pushed, none of it is reachable — "merged" is not "shipped", and\n` +
        `a consumer re-pinning to ${tag} gets a tree without these changes:\n` +
        unreleased
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n') +
        `\n\nThis is not a failure. Cut a release when the set is ready:\n` +
        `  git tag vX.Y.Z && git push origin vX.Y.Z\n`,
    );
  } else {
    process.stdout.write(`No unreleased consumer-visible changes since ${tag}.\n`);
  }
}

await main();
