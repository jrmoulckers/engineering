import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const guide = readFileSync(
  fileURLToPath(new URL('../../docs/adopting.md', import.meta.url)),
  'utf8',
);

const START = '## Start here: find your symptom';
const END = '## 1. Cite principles by ID';

function indexSection() {
  const from = guide.indexOf(START);
  const to = guide.indexOf(END);
  assert.ok(from !== -1, 'symptom index heading is missing from docs/adopting.md');
  assert.ok(to > from, 'symptom index must precede the numbered sections');
  return guide.slice(from, to);
}

// Each row's second column is a literal search string. Readers are told to search
// for it verbatim, so a term that no longer appears in the body is a dead entry —
// indistinguishable, to the reader, from the answer not existing at all.
function searchTerms() {
  return indexSection()
    .split('\n')
    .filter((line) => line.startsWith('|') && line.includes('`'))
    .flatMap((line) => {
      const cells = line.split('|').map((c) => c.trim());
      const term = cells[2] ?? '';
      const match = term.match(/^`(.+)`$/s);
      return match ? [match[1]] : [];
    });
}

describe('symptom index', () => {
  it('extracts a search term from every row', () => {
    const terms = searchTerms();
    assert.ok(terms.length >= 10, `expected the index to carry rows, got ${terms.length}`);
  });

  it('every search term appears in the body below the index', () => {
    const body = guide.slice(guide.indexOf(END));
    const dead = searchTerms().filter((term) => !body.includes(term));
    assert.deepEqual(
      dead,
      [],
      `these index terms resolve to nothing in the guide body: ${dead.join(' | ')}`,
    );
  });

  it('no search term is so short it matches incidentally', () => {
    const vague = searchTerms().filter((term) => term.length < 12);
    assert.deepEqual(vague, [], `these index terms are too short to locate a section: ${vague}`);
  });
});

// A reader who pins this document to the ref their vendored configs name gets frozen
// advice, and frozen advice is worse than absent advice because it still asserts what
// was later retracted. One consumer's copy at their pinned tag was 1,118 lines against
// 6,106, and the missing part was where a defect got found -- their copy still called
// that defect intentional. The instruction to read at `main` therefore has to survive
// in the first screen of the file, before any content a reader might act on.
describe('currency banner', () => {
  const banner = guide.slice(0, guide.indexOf('## Start here'));

  it('tells the reader which ref to read, before any guidance', () => {
    assert.match(
      banner,
      /read this document at `main`/i,
      'the guide must open by telling the reader not to read it at their pinned ref',
    );
  });

  it('points at the section that explains why', () => {
    assert.match(banner, /Pin the configs\. Do not pin the guidance\./);
    assert.ok(
      guide.includes('#### Pin the configs. Do not pin the guidance.'),
      'the banner links a section heading that does not exist',
    );
  });

  it('distinguishes the two artefacts rather than banning pinning outright', () => {
    // Pinning vendored configs is correct and this repository requires it. A banner
    // read as "do not pin" would push a consumer to unpin the one thing that should
    // be pinned, which is a worse outcome than the staleness it prevents.
    assert.match(banner, /configuration/i);
    assert.match(banner, /guidance/i);
  });
});
