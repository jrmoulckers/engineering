import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import prettier from 'prettier';

import config from '../index.js';
import svelteConfig from '../svelte.js';

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
    assert.equal(md.options.proseWrap, 'always');
    assert.equal(md.options.printWidth, 96);
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
