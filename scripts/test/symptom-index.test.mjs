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
