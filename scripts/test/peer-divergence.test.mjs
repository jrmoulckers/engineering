import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The two packages declare deliberately different `typescript` peer ranges:
//
//   @jrmoulckers/tsconfig       ^5.5.0 || ^6.0.0 || ^7.0.0
//   @jrmoulckers/eslint-config  >=5.5.0 <6.1.0
//
// The narrower one is not an oversight and must not be widened to match. It is
// inherited from typescript-eslint, whose current major peers `>=4.8.4 <6.1.0`
// and which has no next major to move to. Widening eslint-config to claim TS 7
// would move a hard failure out of install time — where ERESOLVE names the
// conflicting package — and into type-aware lint rules at runtime, where it
// surfaces as inscrutable rule crashes. Strictly worse, and much later.
//
// A consumer flagged that this is exactly the shape of thing a later cleanup
// "helpfully" aligns, and that the reason should live with the declaration
// rather than only in prose. A comment cannot survive that cleanup, because the
// cleanup deletes the comment too. This test is the part that objects.
const read = (p) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8'));

const tsconfigPkg = read('packages/tsconfig/package.json');
const eslintPkg = read('packages/eslint-config/package.json');

describe('the typescript peer ranges diverge on purpose', () => {
  test('eslint-config keeps the typescript-eslint ceiling', () => {
    assert.equal(
      eslintPkg.peerDependencies.typescript,
      '>=5.5.0 <6.1.0',
      'eslint-config must not widen past typescript-eslint, which peers >=4.8.4 <6.1.0 ' +
        'and has no next major. Widening turns an install-time ERESOLVE into runtime ' +
        'rule crashes. If typescript-eslint ships a wider major, update it here and in ' +
        'the comment above — do not align it to tsconfig.',
    );
  });

  test('tsconfig stays wider, because it ships no analyzer', () => {
    assert.equal(
      tsconfigPkg.peerDependencies.typescript,
      '^5.5.0 || ^6.0.0 || ^7.0.0',
      'tsconfig is a set of compiler options with no dependency on the typescript-eslint ' +
        'AST, so it carries no reason to inherit that ceiling. Do not narrow it to match ' +
        'eslint-config.',
    );
  });

  test('the two ranges are actually different, and that is the invariant', () => {
    assert.notEqual(
      tsconfigPkg.peerDependencies.typescript,
      eslintPkg.peerDependencies.typescript,
      'These ranges being equal means one of them was aligned to the other. That is the ' +
        'specific regression this file exists to catch.',
    );
  });
});
