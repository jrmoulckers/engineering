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
