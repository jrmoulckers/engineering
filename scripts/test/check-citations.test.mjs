// citations-check: ignore-file -- builds deliberately-invalid citation fixtures.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'check-citations.mjs');
const index = path.join(here, '..', '..', 'principles', 'index.json');

function run(target, extra = []) {
  try {
    const stdout = execFileSync(process.execPath, [script, target, '--index', index, ...extra], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function fixture(contents) {
  const dir = mkdtempSync(path.join(tmpdir(), 'citations-'));
  writeFileSync(path.join(dir, 'DOC.md'), contents, 'utf8');
  return dir;
}

describe('check-citations', () => {
  // A consumer's two wrong citations sat in `.ts` files. The scanner's
  // extension set excluded them, so the run printed `all IDs exist` and exited
  // 0 -- an affirmative green over the exact defect the tool exists to find.
  test('scans source files, not only prose', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'citations-src-'));
    try {
      writeFileSync(path.join(dir, 'query.ts'), '// Authoritative (`ENG-NOPE-404`).\n', 'utf8');
      const { code, out } = run(dir);
      assert.equal(code, 1, 'a wrong citation in a .ts file must fail the run');
      assert.match(out, /ENG-NOPE-404/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A file count is not a claim about a repository unless the reader can see
  // what "file" meant.
  test('prints the scanned extension set alongside the count', () => {
    const dir = fixture('Secrets follow `ENG-SEC-001`.\n');
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0);
      assert.match(out, /scanned extensions:.*\.ts\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('honours the ignore pragma but names every file it skipped', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'citations-skip-'));
    try {
      writeFileSync(
        path.join(dir, 'fixtures.mjs'),
        `// citations-check${':'} ignore-file\nconst bad = 'ENG-NOPE-404';\n`,
        'utf8',
      );
      const { code, out } = run(dir);
      assert.equal(code, 0, 'a pragma-marked fixture file must not fail the run');
      assert.match(out, /1 file\(s\) skipped/);
      assert.match(out, /fixtures\.mjs/, 'a silent skip is how the false green happened');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The pragma regex first matched its own definition, so the checker quietly
  // excluded itself from every scan.
  test('does not exclude itself via its own pragma definition', () => {
    const { code, out } = run(script);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /skipped/, 'the checker must scan its own source');
  });

  test('accepts a real principle ID', () => {
    const dir = fixture('Secrets follow `ENG-SEC-001`.\n');
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0);
      assert.match(out, /all IDs exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails on an ID that does not exist', () => {
    const dir = fixture('Invented citation `ENG-FAKE-999`.\n');
    try {
      const { code, out } = run(dir);
      assert.equal(code, 1);
      assert.match(out, /ENG-FAKE-999/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('link paths', () => {
    // Three consuming repositories independently wrote a correct ID with a
    // wrong path. The cause is that the area prefix does not follow the
    // directory layout: of eleven prefixes, only ARCH lives under a directory
    // named after it. A wrong path is worse than a wrong ID because it looks
    // authoritative and then 404s.

    test('rejects a real ID pointing at a path derived from its prefix', () => {
      const dir = fixture(
        '[ENG-INT-001](https://github.com/jrmoulckers/engineering/blob/v0.13.0/' +
          'principles/architecture/integration.md)\n',
      );
      try {
        const { code, out } = run(dir);
        assert.equal(code, 1);
        assert.match(out, /principles\/platforms\/integration-boundaries\.md/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    for (const [label, link] of [
      [
        'absolute pinned link',
        '[ENG-INT-001](https://github.com/jrmoulckers/engineering/blob/v0.13.0/' +
          'principles/platforms/integration-boundaries.md)',
      ],
      [
        'gloss and anchor',
        '[ENG-INT-001 (Thin typed adapters)](https://github.com/jrmoulckers/engineering/' +
          'blob/main/principles/platforms/integration-boundaries.md#thin-typed-adapters)',
      ],
      ['relative link', '[ENG-SEC-001](../principles/assurance/security-and-privacy.md)'],
      [
        'link title attribute',
        '[ENG-SEC-001](../principles/assurance/security-and-privacy.md "Secrets")',
      ],
      // Citing the technique, not the principle. Correct as written.
      [
        'link to a practice guide',
        '[ENG-INT-001](https://github.com/jrmoulckers/engineering/blob/main/practices/x.md)',
      ],
      ['bare ID with no link', 'Follows ENG-INT-001 closely.'],
    ]) {
      test(`accepts a ${label}`, () => {
        const dir = fixture(`${link}\n`);
        try {
          const { code, out } = run(dir);
          assert.equal(code, 0, out);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
    }

    test('--no-links disables the check', () => {
      const dir = fixture('[ENG-INT-001](../principles/architecture/integration.md)\n');
      try {
        assert.equal(run(dir).code, 1);
        assert.equal(run(dir, ['--no-links']).code, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test('--review prints the real title beside a wrong-meaning citation', () => {
    // The defect this tool exists for: every miscitation seen during the
    // migration used a valid ID that meant something else, so the exit code
    // stays 0 and the title is the only signal. ENG-ARCH-003 is "Durable
    // decisions" (ADRs), not a rule about server tiers.
    const dir = fixture('libro has no server tier, per `ENG-ARCH-003`.\n');
    try {
      const { code, out } = run(dir, ['--review']);
      assert.equal(code, 0);
      assert.match(out, /ENG-ARCH-003\s+Durable decisions/);
      assert.match(out, /no server tier/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--review shows neighbouring lines so a wrapped link is judgeable', () => {
    // A markdown link wrapped onto its own line leaves the citing line a bare
    // URL. Printing only that line hides the claim being checked and makes a
    // correct citation look unsupported -- which caused a real misjudgement.
    const dir = fixture(
      [
        '6. **Accessibility is a gate.** WCAG 2.2 AA.',
        '   [`ENG-PERF-009`](https://example.invalid/performance.md)',
        '   additionally forbids trading accessibility away for performance.',
        '',
      ].join('\n'),
    );
    try {
      const { out } = run(dir, ['--review']);
      assert.match(out, /Accessibility is a gate/);
      assert.match(out, /additionally forbids trading accessibility away/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reminds the author that existence is not correctness', () => {
    const dir = fixture('See `ENG-SEC-001`.\n');
    try {
      const { out } = run(dir);
      assert.match(out, /Existence is not correctness/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports cleanly when a tree holds no citations', () => {
    const dir = fixture('No citations here.\n');
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0);
      assert.match(out, /No ENG-\* citations found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every citation in this repository resolves', () => {
    const { code } = run(path.join(here, '..', '..', 'docs'));
    assert.equal(code, 0);
  });

  test('exits 2 rather than 0 when the index cannot be read', () => {
    const dir = fixture('See `ENG-SEC-001`.\n');
    try {
      let code = 0;
      try {
        execFileSync(process.execPath, [script, dir, '--index', path.join(dir, 'missing.json')], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        code = err.status;
      }
      assert.equal(code, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Every miscitation observed across the seven-repo migration used a real ID
  // standing for a different rule, which existence and link checks both pass.
  // Stating the name turns that semantic error into a mechanical one.
  describe('stated principle names', () => {
    test('accepts a name that matches the index', () => {
      const dir = fixture('See `ENG-INT-001` (Thin typed adapters) for adapters.\n');
      try {
        const { code, out } = run(dir);
        assert.equal(code, 0);
        assert.match(out, /stated name\(s\) match/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('fails on a real ID given another principle name', () => {
      const dir = fixture('Secrets are `ENG-SEC-001` (Minimal directed boundaries).\n');
      try {
        const { code, out } = run(dir);
        assert.equal(code, 1);
        assert.match(out, /claimed:\s+Minimal directed boundaries/);
        assert.match(out, /actual:\s+Secret lifecycle/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('ignores case, backticks and trailing punctuation', () => {
      const dir = fixture('Adapters: `ENG-INT-001` (**thin typed adapters**.)\n');
      try {
        assert.equal(run(dir).code, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // An earlier version read em-dashed prose as a name claim and failed on
    // this exact line in practices/data-contracts.md. A checker that cries
    // wolf is a checker somebody turns off, so only a parenthesised phrase
    // beginning with a capital counts as a claim.
    test('does not read prose after an ID as a name claim', () => {
      const dir = fixture('Synthetic subject, per ENG-SEC-008 — never a real record.\n');
      try {
        assert.equal(run(dir).code, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('leaves a lowercase parenthetical aside alone', () => {
      const dir = fixture('Erasure obligations `ENG-SEC-008` (see the table below).\n');
      try {
        assert.equal(run(dir).code, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('bare multi-citation annotation', () => {
  const SRC = 'https://github.com/jrmoulckers/engineering/blob/main/principles';
  const link = (id) => `[\`${id}\`](${SRC}/assurance/security-and-privacy.md)`;
  const pair = (glue) =>
    `The bridge never persists a library ${link('ENG-SEC-008')}${glue}` +
    `${link('ENG-SEC-004')}.\n`;

  test('annotates two principle links sharing a line with no connective', () => {
    const dir = fixture(pair(', '));
    try {
      assert.match(run(dir, ['--review']).out, /note: adjacent IDs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('stays silent once a connective scopes the second ID', () => {
    const dir = fixture(pair('; additionally '));
    try {
      assert.doesNotMatch(run(dir, ['--review']).out, /note: adjacent IDs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Bare IDs in prose are discussion, not citation. Counting them fired on a
  // third of this repository's own citations, which is why the check looks for
  // links rather than for the ID pattern.
  test('ignores bare IDs mentioned in prose', () => {
    const dir = fixture('Both ENG-SEC-008 and ENG-SEC-004 are listed in the table.\n');
    try {
      assert.doesNotMatch(run(dir, ['--review']).out, /note: adjacent IDs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('never changes the exit code', () => {
    const dir = fixture(pair(', '));
    try {
      assert.equal(run(dir, ['--review']).code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('citation ranges', () => {
  test('verifies the interior of a range, not just its endpoints', () => {
    const dir = fixture('Observability: `ENG-OBS-001`–`ENG-OBS-007` (structured signals).\n');
    try {
      const out = run(dir, ['--review']).out;
      for (const n of ['002', '003', '004', '005', '006']) {
        assert.match(out, new RegExp(`ENG-OBS-${n}`), `range member ${n} not verified`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails when a range names a principle that does not exist', () => {
    const dir = fixture('Coverage of `ENG-OBS-005`–`ENG-OBS-009` is complete.\n');
    try {
      const res = run(dir);
      assert.equal(res.code, 1);
      assert.match(res.out, /ENG-OBS-00[89]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('expands the abbreviated second endpoint', () => {
    const dir = fixture('See `ENG-OBS-001`–`005` for the signal rules.\n');
    try {
      assert.match(run(dir, ['--review']).out, /ENG-OBS-003/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A hyphen between two areas is prose, not a range. Expanding it would
  // invent citations the author never made.
  test('ignores a dash between different areas', () => {
    const dir = fixture('Compare `ENG-OBS-001`–`ENG-SEC-004` on failure handling.\n');
    try {
      const res = run(dir, ['--review']);
      assert.equal(res.code, 0);
      assert.doesNotMatch(res.out, /via range/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('marks range members as inferred rather than written', () => {
    const dir = fixture('Signals `ENG-OBS-001`–`ENG-OBS-003` apply.\n');
    try {
      assert.match(run(dir, ['--review']).out, /via range .*never names it/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// A fragment cannot 404: the file serves 200 and the reader silently lands at
// the top. Retitling a heading breaks every citation of it with no error
// anywhere, which is why these assert resolved behaviour rather than shape.
describe('citation link anchors (ENG-DOC-004)', () => {
  const SEC =
    'https://github.com/jrmoulckers/engineering/blob/v0.2.3/principles/assurance/security-and-privacy.md';

  test('accepts a fragment that names a real heading', () => {
    const dir = fixture(`See [\`ENG-SEC-001\`](${SEC}#secret-lifecycle).\n`);
    try {
      assert.equal(run(dir).code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails on a fragment that names no heading, and suggests the near miss', () => {
    const dir = fixture(`See [\`ENG-SEC-001\`](${SEC}#secret-lifecycles).\n`);
    try {
      const { code, out } = run(dir);
      assert.equal(code, 1);
      assert.match(out, /heading that does not exist/);
      assert.match(out, /did you mean: secret-lifecycle/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The check resolves tag-pinned URLs onto the local checkout. Consumers cite
  // absolute URLs, never relative paths, so without this the feature would pass
  // everything while inspecting nothing — the exact silent-degradation shape it
  // exists to catch.
  test('resolves a tag-pinned URL rather than skipping it as remote', () => {
    const dir = fixture(`See [\`ENG-SEC-001\`](${SEC}#not-a-heading).\n`);
    try {
      assert.equal(run(dir).code, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('leaves another repository alone', () => {
    const other =
      'https://github.com/other/repo/blob/main/principles/assurance/security-and-privacy.md';
    const dir = fixture(`See [\`ENG-SEC-001\`](${other}#not-a-heading).\n`);
    try {
      assert.equal(run(dir).code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a heading inside a fenced block is code, not an anchor', async () => {
    const { readHeadingSlugs } = await import('../check-citations.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'slugs-'));
    const file = path.join(dir, 'F.md');
    try {
      writeFileSync(
        file,
        ['# Real heading', '', '```sh', '# Not a heading, a shell comment', '```', ''].join('\n'),
        'utf8',
      );
      const slugs = await readHeadingSlugs(file);
      assert.ok(slugs.has('real-heading'));
      assert.equal(slugs.has('not-a-heading-a-shell-comment'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('slugs match GitHub for inline markdown and duplicate headings', async () => {
    const { readHeadingSlugs } = await import('../check-citations.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'slugs-'));
    const file = path.join(dir, 'F.md');
    try {
      writeFileSync(
        file,
        ['## The `typeAware` flag', '## Least authority', '## Least authority', ''].join('\n'),
        'utf8',
      );
      const slugs = await readHeadingSlugs(file);
      // Backticks are stripped, not slugified into the anchor.
      assert.ok(slugs.has('the-typeaware-flag'));
      // GitHub disambiguates a repeat with -1, so both must resolve.
      assert.ok(slugs.has('least-authority'));
      assert.ok(slugs.has('least-authority-1'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports the anchor check in --json checksRun', () => {
    const dir = fixture(`See [\`ENG-SEC-001\`](${SEC}#secret-lifecycle).\n`);
    try {
      const parsed = JSON.parse(run(dir, ['--json']).out);
      assert.ok(parsed.checksRun.includes('linkAnchors'));
      assert.deepEqual(parsed.badAnchors, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
