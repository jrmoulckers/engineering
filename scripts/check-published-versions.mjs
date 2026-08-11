#!/usr/bin/env node
/**
 * Verifies `versions.json` against what is actually published.
 *
 * Consumers read this repository when they cannot query the registry, and several have
 * read `packages/<name>/package.json` at a tag and concluded a fix was missing when it had
 * shipped releases earlier. A tag reports the source tree at that moment; it is not a
 * package version. The instinct to read the repository is not going away, so this check
 * makes the repository correct instead: `versions.json` records published state, and CI
 * fails if it drifts.
 *
 * Two checks, because they fail for different reasons and only one needs the network:
 *
 *   1. Coverage (offline, always hard) — every publishable package under `packages/` has an
 *      entry. A new package that nobody records is the silent case; a consumer never learns
 *      it exists.
 *
 *   2. Registry (online) — the recorded version and peer ranges match the published
 *      manifest. Peer ranges are included because they are what consumers actually ask
 *      about: three separate reports have been "does this support my TypeScript major",
 *      answered by reading a stale tag.
 *
 * A registry that cannot be reached is reported as unknown and does not fail, so an outage
 * or a missing token does not block unrelated work. Drift is a hard failure. The
 * distinction matters: reporting unknown is honest, whereas passing silently would let this
 * file rot into exactly the stale authority it exists to replace.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Compare two dotted numeric versions. Returns >0 if `a` is newer than `b`. */
function compareVersions(a, b) {
  const parse = (v) =>
    String(v)
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

/** Compare peer ranges as recorded vs published, ignoring key order. */
function diffPeers(recorded = {}, published = {}) {
  const keys = [...new Set([...Object.keys(recorded), ...Object.keys(published)])].sort();
  return keys
    .filter((k) => recorded[k] !== published[k])
    .map((k) => ({ name: k, recorded: recorded[k], published: published[k] }));
}

/**
 * Reads the packument directly rather than shelling out to `npm view`.
 *
 * Spawning the npm CLI is not portable here: on Windows the binary is `npm.cmd`, and
 * current Node refuses to spawn `.cmd` without a shell (EINVAL). A plain fetch also makes
 * the auth failure explicit as a 401/403 status instead of a message to be pattern-matched.
 */
async function publishedManifest(name, registry) {
  const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN || '';
  const url = `${registry.replace(/\/$/, '')}/${name.replace('/', '%2F')}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    return { ok: false, unreachable: true, message: `${error.message}` };
  }

  // GitHub Packages authenticates every read, including of public packages, so a missing
  // or unscoped token is a 401/403 rather than a 404. That is indistinguishable from a
  // package that does not exist, so it is treated as unknown rather than as drift.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, unreachable: true, message: `HTTP ${response.status}` };
  }
  if (!response.ok) {
    return { ok: false, unreachable: false, message: `HTTP ${response.status}` };
  }

  const packument = await response.json();
  const latest = packument['dist-tags']?.latest;
  if (!latest) {
    return { ok: false, unreachable: false, message: 'no dist-tags.latest in packument' };
  }
  return {
    ok: true,
    data: {
      version: latest,
      peerDependencies: packument.versions?.[latest]?.peerDependencies ?? {},
    },
  };
}

const manifest = JSON.parse(await readFile(join(root, 'versions.json'), 'utf8'));
const registry = manifest.registry;
const recorded = manifest.packages;

const entries = await readdir(join(root, 'packages'), { withFileTypes: true });
const problems = [];
const unknown = [];
let verified = 0;

// 1. Coverage.
for (const entry of entries.filter((e) => e.isDirectory())) {
  const pkgPath = join(root, 'packages', entry.name, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  } catch {
    continue;
  }
  if (pkg.private === true) continue;
  if (!recorded[pkg.name]) {
    problems.push(`${pkg.name} is publishable but has no entry in versions.json`);
  }
}

// 2. Registry.
for (const [name, entry] of Object.entries(recorded)) {
  const result = await publishedManifest(name, registry);

  if (!result.ok) {
    if (result.unreachable) {
      unknown.push(name);
      continue;
    }
    problems.push(`${name}: could not read the published manifest\n    ${result.message}`);
    continue;
  }

  const { version, peerDependencies } = result.data;
  if (version !== entry.version) {
    // Name the direction. The two are not the same failure, and the generic
    // "update versions.json" advice is actively wrong for one of them.
    //
    // Recorded ahead of the registry means this file names a version nobody can
    // install. It is the dangerous direction, and it usually means a version
    // bump was written here in the same change as the package bump — which this
    // file cannot carry, because it records what is published.
    //
    // Recorded behind means a publish has landed and the follow-up has not.
    // Every version named here still resolves, so consumers are merely stale.
    const ahead = compareVersions(entry.version, version) > 0;
    problems.push(
      ahead
        ? `${name}: versions.json says ${entry.version}, registry publishes ${version}\n` +
            `    versions.json is AHEAD of the registry, so it names a version that cannot be\n` +
            `    installed. This file records published state and cannot lead a publish: revert\n` +
            `    it here, merge, push the tag so publish.yml runs, then update it in a follow-up.`
        : `${name}: versions.json says ${entry.version}, registry publishes ${version}\n` +
            `    versions.json is BEHIND the registry — a publish landed and this file was not\n` +
            `    updated. Set it to ${version}. Consumers are reading a stale version right now.`,
    );
  }

  for (const peer of diffPeers(entry.peerDependencies, peerDependencies)) {
    problems.push(
      `${name}: peer "${peer.name}" recorded as ${peer.recorded ?? '(absent)'}, ` +
        `published as ${peer.published ?? '(absent)'}`,
    );
  }

  if (version === entry.version) verified += 1;
}

if (problems.length > 0) {
  console.error('versions.json does not match what is published:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nThis file is what consumers read when they cannot query the registry. ' +
      'Stale entries here are worse than none, because they look authoritative.',
  );
  // Set the code rather than calling process.exit(): an abrupt exit while the fetch
  // agent still holds sockets aborts the process on Windows with a libuv assertion, which
  // replaces the intended exit code 1 with a crash code. A gate that fails for the wrong
  // reason is indistinguishable from one that works.
  process.exitCode = 1;
}

if (unknown.length > 0) {
  console.warn(
    `Registry unreachable; ${unknown.length} package(s) reported as unknown rather than ` +
      `verified: ${unknown.join(', ')}`,
  );
  console.warn('This is not a failure, but those entries were not confirmed on this run.');
}

if (problems.length === 0) {
  const total = Object.keys(recorded).length;
  console.log(
    verified === 0
      ? `versions.json was not confirmed against the registry on this run (${total} entries).`
      : `versions.json matches the registry for ${verified} of ${total} package(s).`,
  );
}
