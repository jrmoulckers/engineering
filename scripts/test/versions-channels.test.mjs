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
// means >=0.2.0 <0.3.0 and silently refuses 0.12.0. Two repositories have
// adopted a caret-rewritten range and received an old package whose known bugs
// they then reported as current. The recorded value has to stay safe to paste.
describe('recorded ranges are safe to copy literally', () => {
  test('no range uses a caret or tilde', () => {
    for (const [name, entry] of Object.entries(manifest.packages)) {
      assert.doesNotMatch(
        entry.range,
        /[\^~]/,
        `${name} records range "${entry.range}" — caret/tilde on a 0.x version pins the ` +
          `minor, so this would exclude later fixes. Write an explicit >= / < pair.`,
      );
    }
  });

  test('each range admits its own recorded version', () => {
    // A range that excludes the version published beside it would send every
    // consumer to something older than what this file claims is current.
    for (const [name, entry] of Object.entries(manifest.packages)) {
      const lower = entry.range.match(/>=\s*([\d.]+)/)?.[1];
      assert.ok(lower, `${name}: range "${entry.range}" has no >= lower bound`);
      assert.equal(
        lower,
        entry.version,
        `${name}: range lower bound ${lower} does not match published version ${entry.version}`,
      );
    }
  });
});

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
});
