import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../versions.json', import.meta.url)), 'utf8'),
);

// Three separate repositories reported being blocked on all three packages when
// only one is installed from a registry. Each time, the correction existed in
// docs/adopting.md — and each time it did not reach them, because a consumer
// reads prose at the ref they pinned while versions.json is read from main.
//
// So the meaning of `channel` lives in versions.json next to the value it
// explains. These tests keep it there and keep it true.
describe('versions.json channels are self-describing', () => {
  test('every package channel is defined in the channels legend', () => {
    const defined = Object.keys(manifest.channels ?? {});
    assert.ok(defined.length > 0, 'versions.json must carry a channels legend');

    for (const [name, entry] of Object.entries(manifest.packages)) {
      assert.ok(
        defined.includes(entry.channel),
        `${name} declares channel "${entry.channel}", which the legend does not define — ` +
          `a consumer reading this file cannot resolve what it obligates them to do`,
      );
    }
  });

  test('each channel states whether it requires registry auth', () => {
    for (const [channel, spec] of Object.entries(manifest.channels)) {
      assert.equal(
        typeof spec.requiresRegistryAuth,
        'boolean',
        `channel "${channel}" must answer requiresRegistryAuth as a boolean — this is the ` +
          `single question consumers have got wrong, so it cannot be left to prose`,
      );
      assert.ok(
        typeof spec.summary === 'string' && spec.summary.length > 0,
        `channel "${channel}" needs a summary`,
      );
    }
  });

  test('a channel claiming no registry auth is backed by a package that cannot be published', () => {
    // This is the check that was missing, and its absence cost three
    // repositories real time. Two packages were recorded as "vendored" —
    // never published, no token needed — while publish.yml published every
    // directory under packages/ unconditionally and check-published-versions
    // verified all three against the registry on every run. The claim was
    // false, consumers were told they were unblocked on packages that
    // returned 403, and CI printed "matches the registry for 3 of 3" the
    // whole time.
    //
    // A channel is a claim about delivery, so it has to be checked against
    // the thing that decides delivery: whether npm can publish the package.
    for (const [name, entry] of Object.entries(manifest.packages)) {
      const spec = manifest.channels[entry.channel];
      if (spec?.requiresRegistryAuth !== false) continue;

      const dir = name.replace('@jrmoulckers/', '');
      const pkg = JSON.parse(
        readFileSync(
          fileURLToPath(new URL(`../../packages/${dir}/package.json`, import.meta.url)),
          'utf8',
        ),
      );

      assert.equal(
        pkg.private,
        true,
        `${name} is recorded as channel "${entry.channel}", which claims it needs no registry ` +
          `auth — but packages/${dir}/package.json has private: ${pkg.private}, so publish.yml ` +
          `publishes it and consumers installing it hit a 403. Either set private: true or ` +
          `record the channel as one that requires auth.`,
      );
    }
  });

  test('every channel in the legend is used by at least one package', () => {
    // A channel nobody uses is a promise the file cannot keep. The "vendored"
    // entry survived here after it had stopped being true of any package,
    // which is what let the false claim keep reaching consumers.
    const used = new Set(Object.values(manifest.packages).map((e) => e.channel));
    for (const channel of Object.keys(manifest.channels)) {
      assert.ok(
        used.has(channel),
        `channel "${channel}" is defined but no package uses it — remove it, or a consumer ` +
          `will plan around a delivery path that does not exist`,
      );
    }
  });
});

// Every package here is below 1.0, where npm's caret pins the MINOR: ^0.2.0
// means >=0.2.0 <0.3.0 and silently refuses 0.12.0.
//
// This suite used to FORBID the caret, for that reason: two repositories had
// adopted a caret-rewritten range and received an old package whose known bugs
// they then reported as current. It now requires the caret instead.
//
// The reversal is deliberate and docket supplied the argument. Stranding on an
// old minor and auto-adopting a new one are both silent, but they are not
// symmetric: stranding fails safe (you keep building against known code, and a
// fix stays upstream until you act), while auto-adoption fails unsafe (a
// working build breaks with no local cause). eslint-config@0.9.0 removed five
// peer dependencies and 0.16.0 restored them -- breaking changes in minors, on
// a 0.x package, which is exactly where convention puts them. A wide range
// admits those sight-unseen.
//
// The real cure for stranding was never a wider range, it was telling the
// consumer -- which check-pins now does WITHOUT failing their build. So the
// caret is safe to paste precisely because a notice, not a range, closes the
// gap it leaves.
describe('recorded ranges are safe to copy literally', () => {
  test('every range is a caret, so a 0.x minor cannot arrive unreviewed', () => {
    for (const [name, entry] of Object.entries(manifest.packages)) {
      assert.match(
        entry.range,
        /^\^\d+\.\d+\.\d+$/,
        `${name} records range "${entry.range}". On a 0.x package a minor may break; ` +
          `record ^${entry.version} so patches ride along and minors stay a decision. ` +
          `check-pins reports the stranding this creates, and exits 0 doing it.`,
      );
    }
  });

  test('each range admits its own recorded version', () => {
    // A range that excludes the version published beside it would send every
    // consumer to something older than what this file claims is current.
    for (const [name, entry] of Object.entries(manifest.packages)) {
      const lower = entry.range.match(/^\^([\d.]+)$/)?.[1];
      assert.ok(lower, `${name}: range "${entry.range}" is not a plain caret`);
      assert.equal(
        lower,
        entry.version,
        `${name}: range base ${lower} does not match published version ${entry.version}`,
      );
    }
  });

  test('the recorded caret does not admit the next minor', () => {
    // The invariant that replaced "no carets" needs teeth of its own, or this
    // suite would pass on a range that merely looks like a caret.
    for (const [name, entry] of Object.entries(manifest.packages)) {
      const [major, minor] = entry.version.split('.').map(Number);
      const nextMinor = major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
      assert.ok(
        !satisfiesCaret(nextMinor, entry.range),
        `${name}: range "${entry.range}" admits ${nextMinor}, which may carry a breaking change`,
      );
    }
  });
});

/** Minimal 0.x-aware caret test, so this suite needs no resolver dependency. */
function satisfiesCaret(version, range) {
  const m = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [, bMaj, bMin, bPat] = m.map(Number);
  const [vMaj, vMin, vPat] = version.split('.').map(Number);
  if (bMaj === 0) {
    return vMaj === 0 && vMin === bMin && vPat >= bPat;
  }
  return vMaj === bMaj && (vMin > bMin || (vMin === bMin && vPat >= bPat));
}

// docs/adopting.md printed a range literal that disagreed with versions.json
// twice, and each time the surrounding prose warned the reader that the table
// ages. A warning is not a check. This is the check.
describe('documented ranges match versions.json', () => {
  const doc = readFileSync(
    fileURLToPath(new URL('../../docs/adopting.md', import.meta.url)),
    'utf8',
  );

  test('every documented range for a package matches the recorded one', () => {
    for (const [name, entry] of Object.entries(manifest.packages)) {
      // A line naming the package may legitimately also carry a peer range
      // (TypeScript's, for instance). Only ranges that are not a recorded peer
      // range are claims about this package's own version.
      const peerRanges = new Set(Object.values(entry.peerDependencies ?? {}));

      const stale = doc
        .split('\n')
        .filter((line) => line.includes(name))
        .flatMap((line) => [...line.matchAll(/>=\s*\d+\.\d+\.\d+\s*<\s*\d+\.\d+\.\d+/g)])
        .map((m) => m[0].replace(/\s+/g, ' ').trim())
        .filter((found) => !peerRanges.has(found))
        .filter((found) => found !== entry.range);

      assert.deepEqual(
        stale,
        [],
        `docs/adopting.md prints ${JSON.stringify(stale)} for ${name}, but versions.json ` +
          `records "${entry.range}". A consumer copying the document gets an old floor.`,
      );
    }
  });

  test('the verification command cannot read a stale local ref', () => {
    // `git show origin/main:...` returns the last fetched copy with no error,
    // which is how a consumer reported four facts from a ref sixteen releases
    // behind. The recommended command has to be one that cannot be stale.
    const bare = /`git show origin\/main:versions\.json`/.test(doc);
    const fenced = /^git show origin\/main:versions\.json\s*$/m.test(doc);
    assert.ok(
      !fenced,
      'adopting.md recommends `git show origin/main:versions.json` in a command block — ' +
        'that reads a local cache and is silently stale without a prior fetch',
    );
    assert.ok(
      doc.includes('raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json'),
      'adopting.md must recommend a fetch-free read of versions.json',
    );
    void bare;
  });

  // eslint-config 0.9.0 through 0.11.0 declare the five framework plugins in a
  // bespoke `frameworkPlugins` key that no package manager reads, while react.js,
  // next.js and hooks.js still import them at module scope. Installing one of
  // those versions exits 0, skips ~90 packages, warns about nothing, and fails at
  // first lint with ERR_MODULE_NOT_FOUND. 0.12.0 restored the declarations.
  //
  // A consumer found this by asking npm what our own recommended range resolved
  // to. Nothing stopped us publishing it, and nothing stopped us recommending a
  // range that selected it, so the guard is mechanical rather than editorial.
  test('no recorded version falls in a known-broken window', () => {
    const BROKEN = {
      '@jrmoulckers/eslint-config': {
        from: '0.9.0',
        to: '0.12.0',
        why: 'framework plugins declared in a field no package manager reads; fails at first lint',
      },
    };

    const cmp = (a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i += 1) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
      }
      return 0;
    };

    for (const [name, window] of Object.entries(BROKEN)) {
      const entry = manifest.packages[name];
      assert.ok(entry, `${name} must be recorded in versions.json`);
      const broken = cmp(entry.version, window.from) >= 0 && cmp(entry.version, window.to) < 0;
      assert.ok(
        !broken,
        `versions.json records ${name}@${entry.version}, inside the known-broken window ` +
          `[${window.from}, ${window.to}): ${window.why}. Consumers paste this value verbatim.`,
      );

      // The recorded range must not admit the window either -- recording a good
      // version behind a range that reaches a broken one is the same defect with
      // an extra step, and it is how this shipped in the first place.
      const floor = /(\d+\.\d+\.\d+)/.exec(entry.range ?? '')?.[1];
      if (floor && entry.range.startsWith('>=')) {
        assert.ok(
          cmp(floor, window.to) >= 0,
          `${name} records range "${entry.range}", whose floor ${floor} admits the broken ` +
            `window [${window.from}, ${window.to}) -- a resolver may select one of those`,
        );
      }
    }
  });
});
