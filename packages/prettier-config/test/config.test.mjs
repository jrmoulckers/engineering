import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import prettier from 'prettier';

import config from '../index.js';
import svelteConfig from '../svelte.js';

describe('type declarations', () => {
  // A consumer enabling `checkJs` on a tsconfig that covers `prettier.config.js`
  // gets `TS7016: Could not find a declaration file` if any subpath resolves to
  // bare JavaScript. That failure names this package while the feature being
  // adopted lives in `eslint-config`, so it reads as an unrelated regression.
  test('every export subpath resolves to a declaration', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      assert.equal(
        typeof entry,
        'object',
        `${subpath} is a bare string, so it ships no types condition`,
      );
      assert.ok(entry.types, `${subpath} has no "types" condition`);
      assert.ok(
        pkg.files.includes(entry.types.replace('./', '')),
        `${entry.types} is not in "files", so it would not be published`,
      );
      await readFile(new URL(`../${entry.types.replace('./', '')}`, import.meta.url), 'utf8');
    }
  });
});

describe('prettier config', () => {
  test('pins line endings to lf', () => {
    // `auto` admits CRLF into tracked files on Windows; this value is the
    // deliberate correction, so it is asserted rather than assumed.
    assert.equal(config.endOfLine, 'lf');
  });

  test('states semi explicitly so a major-version default cannot change it', () => {
    assert.equal(config.semi, true);
  });

  test('formats with the declared quote and comma style', async () => {
    const out = await prettier.format('const x = {a:1,b:2}\n', { ...config, parser: 'babel' });
    assert.equal(out, 'const x = { a: 1, b: 2 };\n');
  });

  test('uses single quotes', async () => {
    const out = await prettier.format('const s = "hi";\n', { ...config, parser: 'babel' });
    assert.match(out, /'hi'/);
  });

  test('adds trailing commas in multiline literals', async () => {
    // Must exceed printWidth (100) or Prettier keeps it on one line and the
    // trailing-comma setting is never exercised.
    const long =
      'const o = { alpha: 1, beta: 2, gamma: 3, delta: 4, epsilon: 5, zeta: 6, eta: 7, theta: 8, iota: 9, kappa: 10 };\n';
    assert.ok(long.length > 100, 'fixture must exceed printWidth');
    const out = await prettier.format(long, { ...config, parser: 'babel' });
    assert.match(out, /,\n\}/);
  });

  test('narrows print width for markdown prose', () => {
    const md = config.overrides.find((o) => o.files === '*.md');
    assert.ok(md);
    assert.equal(md.options.printWidth, 96);
  });

  test('preserves author line breaks in markdown', async () => {
    const md = config.overrides.find((o) => o.files === '*.md');
    assert.equal(md.options.proseWrap, 'preserve');

    // The reason for the value: semantic line breaks must survive formatting.
    // Under 'always' these four lines collapse into filled prose, which is
    // what made every prose edit rewrap its whole paragraph.
    const semantic = [
      'The sync layer reconciles local mutations against the remote authority.',
      'It uses a last-writer-wins strategy scoped per field rather than per record.',
      'This avoids the failure where an unrelated concurrent edit clobbers an untouched field.',
      '',
    ].join('\n');

    const out = await prettier.format(semantic, {
      ...config,
      ...md.options,
      parser: 'markdown',
    });
    assert.equal(out, semantic, 'formatting must not re-flow authored line breaks');
  });
});

describe('svelte variant', () => {
  test('inherits every base option', () => {
    for (const key of ['printWidth', 'tabWidth', 'semi', 'singleQuote', 'endOfLine']) {
      assert.equal(svelteConfig[key], config[key], `diverged on ${key}`);
    }
  });

  test('registers the svelte plugin', () => {
    assert.deepEqual(svelteConfig.plugins, ['prettier-plugin-svelte']);
  });

  test('routes svelte files to the svelte parser', () => {
    const override = svelteConfig.overrides.find((o) => o.files === '*.svelte');
    assert.ok(override);
    assert.equal(override.options.parser, 'svelte');
  });

  test('keeps the base markdown override', () => {
    assert.ok(svelteConfig.overrides.some((o) => o.files === '*.md'));
  });
});
