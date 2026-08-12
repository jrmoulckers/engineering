#!/usr/bin/env node
// Report whether a consumer's declared ranges can still reach the published
// versions of the @jrmoulckers/* packages.
//
// This exists because a stale pin is silent. `npm install` succeeds, the
// package behaves exactly as its own bug reports describe, and `npm outdated`
// says nothing useful for a range that is satisfied. Eleven repositories have
// pinned below the floor; several then rediscovered and escalated defects that
// had already shipped in a release their own caret excluded.
//
// It reads versions.json over plain HTTPS from the public repository, so it
// needs no registry token. That matters: the registry-backed check degrades to
// "registry unreachable" exactly when someone without a token is trying to find
// out why their package looks old.
//
// Usage:
//   node check-pins.mjs [path-to-package.json] [--versions <file-or-url>]
//   curl -fsSL <raw-url>/scripts/check-pins.mjs | node - ./package.json

import { readFileSync } from 'node:fs';

const DEFAULT_VERSIONS =
  'https://raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json';

const argv = process.argv.slice(2);
const versionsAt = argv.includes('--versions')
  ? argv[argv.indexOf('--versions') + 1]
  : DEFAULT_VERSIONS;
const pkgPath = argv.find((a) => !a.startsWith('--') && a !== versionsAt) ?? 'package.json';

/** Parse `1.2.3` into comparable parts. Returns null for anything else. */
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/**
 * Does `range` admit `version`?
 *
 * Returns `null` — never `true` — for a form this does not understand. A
 * checker that treats "I could not parse it" as "it is fine" reports clean on
 * exactly the inputs it failed to examine, which is the failure this repository
 * has now hit three times in its own tooling.
 */
function admits(range, version) {
  const v = parseVersion(version);
  if (!v) return null;
  const r = String(range).trim();

  // Exact pin.
  const exact = parseVersion(r);
  if (exact) return cmp(exact, v) === 0;

  // Caret. For 0.x npm pins the MINOR: ^0.2.0 means >=0.2.0 <0.3.0.
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(r);
  if (caret) {
    const lo = [Number(caret[1]), Number(caret[2]), Number(caret[3])];
    const hi = lo[0] === 0 ? [0, lo[1] + 1, 0] : [lo[0] + 1, 0, 0];
    return cmp(v, lo) >= 0 && cmp(v, hi) < 0;
  }

  // Tilde: ~0.2.0 means >=0.2.0 <0.3.0 for every major.
  const tilde = /^~(\d+)\.(\d+)\.(\d+)$/.exec(r);
  if (tilde) {
    const lo = [Number(tilde[1]), Number(tilde[2]), Number(tilde[3])];
    return cmp(v, lo) >= 0 && cmp(v, [lo[0], lo[1] + 1, 0]) < 0;
  }

  // `>=a.b.c <x.y.z`, the form versions.json records.
  const pair = /^>=\s*(\d+\.\d+\.\d+)\s+<\s*(\d+\.\d+\.\d+)$/.exec(r);
  if (pair) {
    const lo = parseVersion(pair[1]);
    const hi = parseVersion(pair[2]);
    return cmp(v, lo) >= 0 && cmp(v, hi) < 0;
  }

  return null;
}

async function loadVersions(where) {
  if (/^https?:/.test(where)) {
    const res = await fetch(where);
    if (!res.ok) throw new Error(`${where} -> HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(readFileSync(where, 'utf8'));
}

// Every exit below assigns process.exitCode rather than calling process.exit().
// On Windows, process.exit() after a fetch() aborts the process with a libuv
// assertion (`UV_HANDLE_CLOSING`, src\win\async.c) and returns 0xC0000409
// instead of the intended code, because the connection pool is still open.
// Assigning exitCode lets the pool drain; measured at 0.4s, so nothing is
// gained by forcing it.

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const declared = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };

let versions;
try {
  versions = await loadVersions(versionsAt);
} catch (err) {
  console.error(`could not read ${versionsAt}: ${err.message}`);
  process.exitCode = 2;
}

if (versions) {
  report(versions);
}

function report(versions) {
  const rows = [];
  for (const [name, meta] of Object.entries(versions.packages ?? {})) {
    const range = declared[name];
    if (!range) continue;
    const ok = admits(range, meta.version);
    rows.push({ name, range, published: meta.version, recommended: meta.range, ok });
  }

  if (rows.length === 0) {
    console.log(`no @jrmoulckers/* packages declared in ${pkgPath} — nothing to check`);
    return;
  }

  const width = Math.max(...rows.map((r) => r.name.length));
  let stale = 0;
  let unknown = 0;

  for (const r of rows) {
    if (r.ok === true) {
      console.log(`  ok       ${r.name.padEnd(width)}  ${r.range}  reaches ${r.published}`);
    } else if (r.ok === false) {
      stale++;
      console.log(`  STALE    ${r.name.padEnd(width)}  ${r.range}  CANNOT reach ${r.published}`);
      console.log(`           ${' '.repeat(width)}  use: ${r.recommended}`);
    } else {
      unknown++;
      console.log(`  unknown  ${r.name.padEnd(width)}  ${r.range}  not a form this understands`);
      console.log(`           ${' '.repeat(width)}  published ${r.published}; check by hand`);
    }
  }

  if (stale > 0) {
    console.log(
      `\n${stale} range(s) exclude the published version. For a 0.x version a caret pins the` +
        ` MINOR, so ^0.2.0 means >=0.2.0 <0.3.0 and silently refuses everything after it.`,
    );
  }
  if (unknown > 0) {
    console.log(`\n${unknown} range(s) were not evaluated. Unrecognised is not the same as fine.`);
  }

  process.exitCode = stale > 0 || unknown > 0 ? 1 : 0;
}
