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
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

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
    // These files are ESM, and upstream says so via `"type": "module"` in the
    // package we publish. Vendoring copies the files but leaves that behind,
    // so in a consumer whose root package.json has no `type` field the files
    // are nominally CommonJS and `export default` is a syntax error.
    //
    // Node >=22.7 masks this by retrying a failed CJS parse as ESM, so it
    // works while warning MODULE_TYPELESS_PACKAGE_JSON. On older Node, or any
    // resolver without that fallback, it is a hard SyntaxError raised at the
    // tool -- far from the vendoring step that caused it.
    //
    // Emitting the marker beside the files keeps module type a property of
    // what we vendored rather than of the consumer's root package.json, which
    // we must not edit. Note this is invisible to the hash check: every file
    // can be byte-identical and correct and the result still not load.
    moduleType: 'module',
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

/**
 * The lock sits at the working directory root and its keys are read relative to
 * that root, so it can only describe files underneath it. A `--dest` pointing
 * outside — a scratch directory, the documented no-commitment probe — produces
 * a lock that describes nothing in the repository. Writing it anyway replaced
 * the real lock with absolute scratch paths, and `--check` then reported
 * success having examined no repository file at all: a hand-edited vendored
 * file still passed. The guard added to close the drift hole was disarmed by
 * the evaluation command the docs recommend.
 */
export function escapesCwd(dest, cwd = process.cwd()) {
  const rel = relative(cwd, resolve(cwd, dest));
  return rel !== '' && (rel.startsWith('..') || isAbsolute(rel));
}

/**
 * Index a previous lock by upstream source path rather than by destination.
 * The destination moves whenever `--dest` does; the source path does not, so
 * this is the only key under which "did this file's content change between
 * refs?" survives being asked from a scratch directory — which is exactly
 * where the question gets asked.
 */
function hashesBySource(previous) {
  const map = new Map();
  for (const [key, meta] of Object.entries(previous?.files ?? {})) {
    if (typeof meta?.sha256 !== 'string') continue;
    map.set(typeof meta.source === 'string' ? meta.source : key, meta.sha256);
  }
  return map;
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
 * Whether `candidate` is a strictly greater version than `current`.
 *
 * The obvious test — `latest !== ref` — is wrong, and wrong in the direction
 * that produces a confident instruction to move backwards. GitHub's
 * `releases/latest` returns the most recent release by the underlying tag's
 * date, not the greatest version, so a patch backported to an older line and
 * published after a newer minor is reported as "latest". Comparing for
 * difference then tells every consumer to downgrade, simultaneously.
 *
 * Returns false when either ref is not a plain `vX.Y.Z`, because an ordering
 * that cannot be established is not a staleness signal. Silence is the correct
 * output for "I do not know", and the whole point of this function is that a
 * wrong answer here is worse than no answer.
 */
export function isNewerRef(candidate, current) {
  const parse = (ref) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(ref ?? '').trim());
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
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
 * How many releases sit between a pin and the newest one.
 *
 * Four repositories read `you vendored v0.15.4; the newest release is v0.115.0`
 * and stayed where they were. Two version strings of similar shape read as
 * adjacent — `15.4` and `115.0` look like neighbours — and the notice's own
 * "this is a valid choice" made a 116-release gap sound deliberate. A count
 * cannot be misread that way.
 *
 * Fails soft like every other network step: no number is better than a wrong
 * one, and this must never be able to redden a build.
 */
async function releaseGap(ref) {
  try {
    const response = await fetch(
      `${process.env.VENDOR_API_BASE ?? 'https://api.github.com'}/repos/${REPO}/releases?per_page=100`,
      { headers: { accept: 'application/vnd.github+json', 'user-agent': REPO } },
    );
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body)) return null;
    const newer = body.filter(
      (r) => typeof r?.tag_name === 'string' && isNewerRef(r.tag_name, ref),
    );
    // One page holds 100. Anything at the cap is reported as a floor rather
    // than as a total, because understating a gap is the failure being fixed.
    return { count: newer.length, atLeast: body.length === 100 };
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

  // The ref is validated before any hashing, because every remediation message
  // below interpolates it. An absent or malformed ref produces advice like
  // `node scripts/vendor-configs.mjs ` with nothing after it -- a command that
  // cannot work, printed confidently at the moment someone is already confused.
  // A checker whose own output is unusable is worse than one that refuses.
  if (typeof lock.ref !== 'string' || !/^\S+$/.test(lock.ref)) {
    fail(
      `${LOCK} has no usable 'ref' (found ${JSON.stringify(lock.ref ?? null)})`,
      'The lock is malformed. Restore it from version control, or re-run: ' +
        'node scripts/vendor-configs.mjs <ref>',
    );
  }

  // A key that escapes the working directory cannot be a vendored repository
  // file. Such locks were written by `--dest` runs before that was refused, and
  // they are the dangerous kind: on the machine that produced them every
  // absolute path still resolves, so the check passes green while examining
  // nothing in the repository. On CI the same lock fails as `missing`, naming a
  // path rather than the cause. Rejecting the shape says what is actually wrong.
  const escaped = entries.map(([key]) => key).filter((key) => escapesCwd(key));
  if (escaped.length > 0) {
    fail(
      `${LOCK} records ${escaped.length} path(s) outside ${process.cwd()}:\n  ${escaped.join('\n  ')}`,
      'This lock was written by a --dest run and verifies nothing in this repository. ' +
        'Re-run without --dest: node scripts/vendor-configs.mjs <ref>',
    );
  }

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

  // The tool is verified on the same terms as what it produced. Absent on locks
  // written before it was recorded, and skipping is deliberate: failing would
  // break every existing consumer over a key their vendor run never wrote, and
  // the next refresh adds it. A key that is present but unusable is not skipped
  // — that is the malformed-lock case, and it must not read as clean.
  if (lock.tool !== undefined) {
    const tool = lock.tool;
    if (typeof tool?.path !== 'string' || typeof tool?.sha256 !== 'string') {
      drifted.push('tool: lock entry is malformed, so the vendoring script cannot be verified');
    } else if (escapesCwd(tool.path)) {
      drifted.push(`tool: ${tool.path} is outside ${process.cwd()}`);
    } else {
      try {
        const text = await readFile(tool.path, 'utf8');
        if (sha256(text) !== tool.sha256) {
          drifted.push(`${tool.path}: the vendoring script has changed since it vendored`);
        }
      } catch {
        drifted.push(`${tool.path}: missing`);
      }
    }
  }

  if (drifted.length > 0) {
    // The tool is not a generated file — a consumer may legitimately update it —
    // so a blanket "do not edit" would be wrong about the one entry most likely
    // to have changed on purpose. Re-running is the remedy either way: it
    // restores generated files and re-records the tool's hash.
    fail(
      `${drifted.length} tracked file(s) drifted from ${LOCK}:\n  ${drifted.join('\n  ')}`,
      `Vendored configs are generated — do not edit them. Re-running restores them and ` +
        `re-records the script's hash: node scripts/vendor-configs.mjs ${lock.ref}`,
    );
  }

  process.stdout.write(`${entries.length} vendored file(s) match ${LOCK} at ${lock.ref}.\n`);

  const latest = await latestRef();
  if (isNewerRef(latest, lock.ref)) {
    process.stdout.write(
      `\nNotice: pinned at ${lock.ref}; newest release is ${latest}${await gapPhrase(lock.ref)}.\n` +
        `This is not a failure. Update deliberately when you choose to:\n` +
        `  node scripts/vendor-configs.mjs ${latest}\n`,
    );
  }
}

/**
 * Renders the gap, or nothing at all when it cannot be established. An empty
 * string is deliberate: a notice that says "0 releases behind" because a
 * request failed is worse than one that stays quiet about the count.
 */
async function gapPhrase(ref) {
  const gap = await releaseGap(ref);
  if (!gap || gap.count === 0) return '';
  return `, ${gap.atLeast ? 'at least ' : ''}${gap.count} release(s) newer`;
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

/**
 * `validate` applies the config-payload assertions. They are right for the
 * files being vendored and wrong for anything else: the vendoring script is not
 * required to export anything, and asserting that it does rejected a perfectly
 * good download.
 */
async function fetchFile(ref, path, validate = true) {
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
  if (validate) assertPayload(path, text);
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
    const { from, files, moduleType } = SETS[name];
    for (const file of files) {
      const path = `${from}/${file}`;
      const text = await fetchFile(ref, path);
      staged.push({ name, path, file, text, dest: join(dest, name, file) });
    }
    if (moduleType) {
      // The declared type is a literal here, so it can silently diverge from
      // the package it claims to mirror. Check it against the ref rather than
      // trusting it: a marker that confidently states the wrong module type is
      // worse than none, because it defeats Node's own detection fallback.
      const upstream = await fetchFile(ref, `${from}/package.json`, false).catch(() => null);
      if (upstream === null) {
        process.stderr.write(
          `\nwarning: could not read ${from}/package.json at ${ref}.\n` +
            `Emitting "type": "${moduleType}" unverified. If upstream changed its module\n` +
            `type, the marker now states the wrong one, which is worse than omitting it:\n` +
            `an explicit wrong type defeats Node's own CJS/ESM detection fallback.\n`,
        );
      } else {
        let declared;
        try {
          declared = JSON.parse(upstream).type;
        } catch {
          declared = undefined;
        }
        if (declared !== moduleType) {
          fail(
            `${from} declares type '${declared ?? 'none'}' at ${ref}, but this script emits '${moduleType}'`,
            'Upstream changed its module type. Update SETS to match before vendoring.',
          );
        }
      }
      staged.push({
        name,
        // Derived from upstream's package.json rather than copied from it, so
        // it carries a distinct source key. It is staged like any other file
        // so the lock covers it -- a marker outside the lock is exactly the
        // unhashed workaround this replaces.
        path: `${from}/package.json#type`,
        file: 'package.json',
        text: `${JSON.stringify({ type: moduleType }, null, 2)}\n`,
        dest: join(dest, name, 'package.json'),
      });
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
    tool: await toolEntry(ref),
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

  // A lock whose keys point outside the working directory cannot be verified
  // from it, so writing one destroys the only record that can be. The probe
  // stays read-only and still answers the question it was run to answer.
  const isProbe = escapesCwd(dest);
  if (!isProbe) await writeFile(LOCK, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');

  process.stdout.write(`Vendored ${staged.length} file(s) from ${REPO}@${ref} into ${dest}/\n`);
  if (previous && previous.ref !== ref) {
    // Compare by upstream source, not by destination. Keyed by destination,
    // every lookup misses the moment --dest moves, and the count degrades to
    // "all of them" or "none of them" — a reading that looks like an answer.
    const before = hashesBySource(previous);
    const known = staged.filter((item) => before.has(item.path));
    const changed = known.filter((item) => before.get(item.path) !== sha256(item.text));
    const added = staged.length - known.length;
    process.stdout.write(
      `Ref moved ${previous.ref} -> ${ref}; ${changed.length} file(s) changed content` +
        `${added > 0 ? `, ${added} newly tracked` : ''}.\n`,
    );
  }

  if (isProbe) {
    process.stdout.write(
      `\n${LOCK} was NOT written: ${dest} is outside ${process.cwd()}.\n` +
        `A lock there could not describe anything in this repository, and writing it\n` +
        `would leave --check verifying files no runner has. Nothing here is committable —\n` +
        `re-run without --dest once you have decided on a ref.\n`,
    );
    await warnIfFormatterWillRewrite(dest);
    await reportStaleness(ref);
    return;
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
  await reportStaleness(ref);

  process.stdout.write(`Recorded ref and SHA-256 of each file in ${LOCK}. Commit both.\n`);
}

/**
 * Record the vendoring script itself alongside what it vendored.
 *
 * `--check` verified the config files but not the tool that produced them, and
 * that asymmetry is silent in one direction: reformat a vendored file and every
 * hash breaks loudly, reformat this script and nothing breaks at all — it forks
 * from the upstream copy it exists to reproduce, and the only thing that would
 * catch it is the byte comparison the reformat has already corrupted.
 *
 * Two different questions, so two different reports. The lock stores the hash
 * of the script **as run**, which is what `--check` compares against, so it
 * answers "has anything changed since you vendored?" with no false alarms for
 * a consumer deliberately running a newer tool. Whether that tool matches the
 * ref is asked here instead, at vendor time, where the answer is actionable.
 */
async function toolEntry(ref) {
  const source = 'scripts/vendor-configs.mjs';
  const self = fileURLToPath(import.meta.url);
  const path = lockKey(relative(process.cwd(), self));

  // A script outside the working directory cannot be recorded for the same
  // reason a vendored file outside it cannot: the lock is read relative to the
  // directory it sits in. Recording it would reintroduce the absolute-path bug.
  if (escapesCwd(self)) return undefined;

  let local;
  try {
    local = await readFile(self, 'utf8');
  } catch {
    return undefined;
  }

  // `.catch(() => null)` here swallowed a real error and printed nothing: the
  // config-payload assertions rejected the script for "exporting nothing", so
  // the comparison never ran and its silence was indistinguishable from a
  // match. A check that cannot run has to say so — that is the whole failure
  // class this entry was added to close, reproduced inside the fix for it.
  let upstream = null;
  let reason = null;
  try {
    upstream = await fetchFile(ref, source, false);
  } catch (error) {
    reason = error?.message ?? String(error);
  }

  if (reason !== null) {
    process.stderr.write(
      `\nwarning: could not compare ${source} against ${ref}: ${reason}\n` +
        `The vendored configs are unaffected — they came from the ref. This only means\n` +
        `the script itself was not checked against upstream on this run.\n`,
    );
  } else if (sha256(upstream) !== sha256(local)) {
    process.stderr.write(
      `\nwarning: the script you ran is not ${source} at ${ref}.\n` +
        `It still vendored ${ref} correctly — the config files come from the ref, not from\n` +
        `this file — but a fix or check present upstream may be missing here. Refresh it:\n` +
        `  curl -fsSL https://raw.githubusercontent.com/${REPO}/${ref}/${source} -o ${path}\n`,
    );
  }

  return { source, path, sha256: sha256(local) };
}

/**
 * Staleness was only reported by --check, which runs later and on a different
 * day. The moment a ref is chosen is the moment the choice can still be changed
 * cheaply, and four repositories vendored a ref far behind latest without
 * anything saying so. Same contract as --check: a newer release is
 * information, never a failure.
 */
async function reportStaleness(ref) {
  const latest = await latestRef();
  if (isNewerRef(latest, ref)) {
    process.stdout.write(
      `\nNotice: you vendored ${ref}; the newest release is ${latest}${await gapPhrase(ref)}.\n` +
        `This is not a failure — pinning to an older ref is a valid choice.\n` +
        `If it was not deliberate, resolve the tag rather than typing one:\n` +
        `  gh api repos/${REPO}/releases/latest --jq .tag_name\n`,
    );
  }
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
