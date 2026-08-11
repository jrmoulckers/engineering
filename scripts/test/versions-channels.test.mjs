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

  test('at least one channel needs no registry auth, and it is reachable while blocked', () => {
    // The point of recording this is that a repository waiting on package
    // access can still adopt everything in a tokenless channel. If that stops
    // being true the guidance sent to blocked consumers becomes wrong.
    const tokenless = Object.entries(manifest.channels).filter(
      ([, spec]) => spec.requiresRegistryAuth === false,
    );
    assert.ok(
      tokenless.length > 0,
      'no tokenless channel exists; blocked consumers can no longer make progress',
    );

    const names = new Set(tokenless.map(([channel]) => channel));
    const reachable = Object.entries(manifest.packages).filter(([, e]) => names.has(e.channel));
    assert.ok(
      reachable.length > 0,
      'a tokenless channel is defined but no package uses it, so the legend misleads',
    );
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
