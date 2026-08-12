#!/usr/bin/env node
/**
 * Vendor the dependency-free shared configuration from `jrmoulckers/engineering`
 * at a pinned ref, without a package registry.
 *
 * Why this exists: GitHub Packages authenticates *every* read, including reads
 * of a public package. For a self-hosted product that means each contributor
 * and each self-hoster must mint a token before `install` succeeds — a real
 * onboarding regression, and one the package-visibility setting does not fix.
 * `@jrmoulckers/tsconfig` and `@jrmoulckers/prettier-config` have no runtime
 * dependencies, so they can be fetched directly and committed.
 *
 * `@jrmoulckers/eslint-config` is deliberately NOT vendorable here: it depends
 * on `@eslint/js`, `typescript-eslint`, `eslint-config-prettier` and `globals`
 * at runtime. Copying its source would push four version choices back onto
 * every consumer, which is the drift the shared layer exists to remove. Install
 * that one from the registry.
 *
 * Vendoring usually trades away the version signal a registry gives you. It
 * does not here: every fetch writes `engineering-configs.lock.json` recording
 * the ref and the SHA-256 of each file, so drift is detectable and a refresh is
 * a reviewable diff.
 *
 * Usage:
 *   node scripts/vendor-configs.mjs <ref> [--dest <dir>] [--set tsconfig,prettier]
 *
 * Files are written byte-identical to source — no generated header — so that
 * `git diff` after a re-run shows exactly what upstream changed and nothing
 * else. Provenance lives in the lock file instead.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = 'jrmoulckers/engineering';
const LOCK = 'engineering-configs.lock.json';

export const SETS = {
  tsconfig: {
    // `extends` between these is relative, so a partial fetch produces a config
    // that resolves to nothing. The set is all-or-nothing on purpose.
    from: 'packages/tsconfig',
    files: [
      'base.json',
      'vite-app.json',
      'vite-node.json',
      'vite-react.json',
      'next.json',
      'node.json',
    ],
  },
  prettier: {
    from: 'packages/prettier-config',
    // The declarations ship alongside the modules they describe. Without them,
    // importing the vendored config from TypeScript fails with TS7016 and the
    // config widens to `any`.
    //
    // The trigger is `allowJs: false`, which is the default and what
    // @jrmoulckers/tsconfig leaves in place -- NOT `checkJs`. With allowJs on,
    // TypeScript reads the .js directly and infers a usable type, so the
    // failure disappears; measured both ways before writing this.
    files: ['index.js', 'index.d.ts', 'svelte.js', 'svelte.d.ts'],
  },
};

class VendorError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

/**
 * Throw rather than `process.exit()`. Exiting from inside an in-flight `fetch`
 * tears down a socket the runtime still owns, which on Windows surfaces as a
 * libuv assertion and a 0xC0000409 exit code instead of the message and the 1
 * that a consumer's CI can act on.
 */
function fail(message, hint) {
  throw new VendorError(message, hint);
}

/**
 * Lock keys are always forward-slashed so a tree vendored on Windows and one
 * vendored on Linux produce the same lock, and `--check` matches either way.
 */
function lockKey(path) {
  return path.split('\\').join('/');
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * A repo-wide `prettier --write` rewrites the vendored files, which breaks every
 * recorded hash. That does not merely disable drift detection — it inverts it:
 * the next `--check` reports files as drifted, and the obvious reading of that
 * is "someone hand-edited vendored files" rather than "the formatter did."
 *
 * A repository only escapes this while the vendored config happens to agree
 * with upstream's own formatting on every vendored file, which is luck rather
 * than a property anyone maintains.
 *
 * The check is deliberately literal — a prefix match against non-comment lines,
 * not gitignore semantics — so it can say plainly what it looked for and stay
 * a warning rather than a gate.
 */
async function warnIfFormatterWillRewrite(dest) {
  const normalized = lockKey(dest).replace(/^\.\//, '').replace(/\/+$/, '');
  let ignore;
  try {
    ignore = await readFile('.prettierignore', 'utf8');
  } catch {
    // No .prettierignore at all. If Prettier is not used here there is nothing
    // to say, and a repository that formats without one has a larger problem
    // than this script can diagnose.
    return;
  }

  const covered = ignore
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .some((line) => {
      const entry = line.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
      return entry !== '' && (normalized === entry || normalized.startsWith(`${entry}/`));
    });

  if (!covered) {
    process.stderr.write(
      `\nwarning: '${normalized}' is not matched by any line in .prettierignore.\n` +
        `These files are written byte-identical to upstream and pinned by SHA-256, so a\n` +
        `repo-wide format rewrites them and breaks every recorded hash. --check then\n` +
        `reports drift that reads as a local edit rather than as the formatter.\n` +
        `Add this line:\n\n  ${normalized}/\n`,
    );
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dest' || arg === '--set') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail(`${arg} requires a value`);
      flags[arg.slice(2)] = value;
      i += 1;
    } else if (arg === '--check') {
      flags.check = true;
    } else if (arg.startsWith('--')) {
      fail(
        `unknown option ${arg}`,
        'Usage: vendor-configs.mjs <ref> [--dest <dir>] [--set a,b] | vendor-configs.mjs --check',
      );
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

/**
 * Report whether a newer release exists. Never throws and never fails the
 * caller: a tag pushed upstream must not turn an unrelated PR red. Returns null
 * when the answer cannot be determined, which is treated the same as "fine" —
 * an offline or rate-limited runner is not a staleness signal.
 */
async function latestRef() {
  // Seam for tests. Staleness reporting depends on an unauthenticated API call
  // that is rate-limited to 60/hour per IP, so a test asserting the notice
  // against the real endpoint passes or fails according to how many other calls
  // ran that hour. That is a test whose result is not about the code.
  const api = process.env.VENDOR_API_BASE ?? 'https://api.github.com';
  try {
    const response = await fetch(`${api}/repos/${REPO}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body.tag_name === 'string' ? body.tag_name : null;
  } catch {
    return null;
  }
}

/**
 * Verify the vendored tree still matches the lock, then report staleness.
 *
 * The split in severity is the whole point. Drift is a local integrity failure
 * — someone edited a generated file, or a write was lost — so it exits non-zero.
 * Staleness is an upstream event the consumer has not acted on yet, so it only
 * warns. Failing on staleness would make pinning automatic in effect: a red
 * build pressures the next person into bumping the ref without deciding to
 * accept the change, which is the property pinning exists to protect.
 */
async function check() {
  let raw;
  try {
    raw = await readFile(LOCK, 'utf8');
  } catch {
    fail(`no ${LOCK} found`, 'Run: node scripts/vendor-configs.mjs <ref>');
  }

  // A corrupt lock and an absent one are different problems with different
  // fixes, and reporting "not found" for a file sitting right there sends the
  // reader looking for the wrong thing.
  let lock;
  try {
    lock = JSON.parse(raw);
  } catch (error) {
    fail(
      `${LOCK} exists but is not valid JSON: ${error.message}`,
      'Restore it from version control, or re-run the vendor step to rewrite it.',
    );
  }

  const entries = Object.entries(lock.files ?? {});
  if (entries.length === 0) fail(`${LOCK} records no files`, 'Re-run the vendor step.');

  const drifted = [];
  for (const [dest, meta] of entries) {
    // A lock entry carrying no usable hash cannot verify anything. Comparing
    // against it would report "content differs", sending the reader to re-vendor
    // a file that may be perfectly correct — and if the comparison were ever
    // loosened, `undefined === undefined` would pass every file silently.
    // The lock is the input to this check, so it gets the same validation the
    // fetched payload does.
    const expected = typeof meta?.sha256 === 'string' ? meta.sha256 : null;
    if (!expected) {
      drifted.push(`${dest}: lock entry has no usable sha256, so nothing can be verified`);
      continue;
    }

    let text;
    try {
      text = await readFile(dest, 'utf8');
    } catch {
      drifted.push(`${dest}: missing`);
      continue;
    }
    if (sha256(text) !== expected) drifted.push(`${dest}: content differs from the lock`);
  }

  if (drifted.length > 0) {
    fail(
      `${drifted.length} vendored file(s) drifted from ${LOCK}:\n  ${drifted.join('\n  ')}`,
      `These files are generated. Do not edit them — re-run: node scripts/vendor-configs.mjs ${lock.ref}`,
    );
  }

  process.stdout.write(`${entries.length} vendored file(s) match ${LOCK} at ${lock.ref}.\n`);

  const latest = await latestRef();
  if (latest && latest !== lock.ref) {
    process.stdout.write(
      `\nNotice: pinned at ${lock.ref}; newest release is ${latest}.\n` +
        `This is not a failure. Update deliberately when you choose to:\n` +
        `  node scripts/vendor-configs.mjs ${latest}\n`,
    );
  }
}

/**
 * A fetch can fail in three ways and only the first is obvious. A non-200 is
 * loud. An empty 200 is quiet. A 200 carrying the wrong bytes — an HTML error
 * page, a redirect landing page, an LFS pointer — is silent, and it is the one
 * that leaves a file on disk that tools then "successfully" read as empty
 * configuration. All three are fatal here.
 */
function assertPayload(path, text) {
  if (text.trim() === '') {
    fail(`${path} came back empty`, 'The ref may exist but not contain this file.');
  }
  if (path.endsWith('.json')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail(
        `${path} is not valid JSON`,
        'This is usually an HTML error page served with status 200.',
      );
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.compilerOptions) {
      fail(
        `${path} has no "compilerOptions"`,
        'It parsed, but it is not a TypeScript configuration.',
      );
    }
  } else if (path.endsWith('.d.ts')) {
    // A declaration file that carries no declaration is indistinguishable from
    // a stub, and a stub silently widens every consumer's types to `any`.
    if (!/^(export )?declare |^export type |^export interface /m.test(text)) {
      fail(
        `${path} declares nothing`,
        'It downloaded, but it is not a TypeScript declaration file.',
      );
    }
  } else if (!/^export /m.test(text)) {
    fail(`${path} exports nothing`, 'It downloaded, but it is not an ES module configuration.');
  }
}

async function fetchFile(ref, path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`;
  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    fail(`could not reach ${url}`, String(cause.message ?? cause));
  }
  if (!response.ok) {
    // A .d.ts 404 has one overwhelmingly likely cause, and the generic hint
    // sends people looking for a typo instead. Declarations were added to
    // prettier-config at v0.112.0; every earlier ref carries the modules
    // without them.
    if (response.status === 404 && path.endsWith('.d.ts')) {
      fail(
        `${url} returned HTTP 404`,
        `Declarations ship from v0.112.0 onward. Ref '${ref}' predates them; vendor a newer tag.`,
      );
    }
    fail(
      `${url} returned HTTP ${response.status}`,
      `Check that ref '${ref}' exists in ${REPO} and contains this path.`,
    );
  }
  const text = await response.text();
  assertPayload(path, text);
  return text;
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.check) {
    if (positional.length > 0) {
      fail('--check takes no ref', 'It verifies the ref already recorded in the lock file.');
    }
    await check();
    return;
  }
  const ref = positional[0];
  if (!ref) {
    fail('a ref is required', 'Pass a tag, not a branch: node scripts/vendor-configs.mjs v1.2.3');
  }
  const dest = flags.dest ?? 'config/engineering';
  const names = (flags.set ?? Object.keys(SETS).join(',')).split(',').map((s) => s.trim());
  for (const name of names) {
    if (!SETS[name]) fail(`unknown set '${name}'`, `Known sets: ${Object.keys(SETS).join(', ')}`);
  }

  // Fetch and validate everything before writing anything. A partial write is
  // worse than a failed one: the tools would run against a mix of refs and
  // report success.
  const staged = [];
  for (const name of names) {
    const { from, files } = SETS[name];
    for (const file of files) {
      const path = `${from}/${file}`;
      const text = await fetchFile(ref, path);
      staged.push({ name, path, file, text, dest: join(dest, name, file) });
    }
  }

  for (const item of staged) {
    await mkdir(dirname(item.dest), { recursive: true });
    await writeFile(item.dest, item.text, 'utf8');
  }

  const lock = {
    repository: REPO,
    ref,
    fetchedAt: new Date().toISOString(),
    refresh: `node scripts/vendor-configs.mjs <newer-ref>`,
    files: Object.fromEntries(
      staged.map((item) => [lockKey(item.dest), { source: item.path, sha256: sha256(item.text) }]),
    ),
  };

  let previous = null;
  try {
    previous = JSON.parse(await readFile(LOCK, 'utf8'));
  } catch {
    // No previous lock: this is a first vendor.
  }

  await writeFile(LOCK, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');

  process.stdout.write(`Vendored ${staged.length} file(s) from ${REPO}@${ref} into ${dest}/\n`);
  if (previous && previous.ref !== ref) {
    // A file the previous lock never recorded is new, not changed. Counting it
    // as changed overstates the diff exactly when the dest or set moved, which
    // is when the number is read most closely.
    const known = staged.filter((item) => previous.files?.[lockKey(item.dest)]);
    const changed = known.filter(
      (item) => previous.files[lockKey(item.dest)].sha256 !== sha256(item.text),
    );
    const added = staged.length - known.length;
    process.stdout.write(
      `Ref moved ${previous.ref} -> ${ref}; ${changed.length} file(s) changed content` +
        `${added > 0 ? `, ${added} newly tracked` : ''}.\n`,
    );
  }

  // The lock replaces rather than merges, so files from a previous run at a
  // different --dest or --set stop being tracked. They stay on disk, and
  // --check then passes while covering none of them.
  if (previous) {
    const stale = Object.keys(previous.files ?? {}).filter((key) => !lock.files[key]);
    const orphans = [];
    for (const key of stale) {
      if (await exists(key)) orphans.push(key);
    }
    if (orphans.length > 0) {
      process.stderr.write(
        `\nwarning: ${orphans.length} file(s) from the previous run are no longer tracked:\n` +
          `  ${orphans.join('\n  ')}\n` +
          `The lock records only this run, so --check no longer covers them and drift in\n` +
          `them is undetectable. Delete them, or re-run without --dest/--set so one run\n` +
          `covers everything you vendor.\n`,
      );
    }
  }

  await warnIfFormatterWillRewrite(dest);

  // Staleness was only reported by --check, which runs later and on a different
  // day. The moment a ref is chosen is the moment the choice can still be
  // changed cheaply, and four repositories have now vendored a ref far behind
  // latest without anything saying so. Same contract as --check: a newer
  // release is information, never a failure.
  const latest = await latestRef();
  if (latest && latest !== ref) {
    process.stdout.write(
      `\nNotice: you vendored ${ref}; the newest release is ${latest}.\n` +
        `This is not a failure — pinning to an older ref is a valid choice.\n` +
        `If it was not deliberate, resolve the tag rather than typing one:\n` +
        `  gh api repos/${REPO}/releases/latest --jq .tag_name\n`,
    );
  }

  process.stdout.write(`Recorded ref and SHA-256 of each file in ${LOCK}. Commit both.\n`);
}

// Running `main()` on import would make the module untestable and would fire a
// network fetch on any `import`. The guard keeps the CLI behaviour identical
// while letting tests read SETS directly rather than regex the source.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof VendorError)) throw error;
    process.stderr.write(`error: ${error.message}\n`);
    if (error.hint) process.stderr.write(`       ${error.hint}\n`);
    process.exitCode = 1;
  }
}
