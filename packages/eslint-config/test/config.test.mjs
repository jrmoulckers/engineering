import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import { readFile } from 'node:fs/promises';

import { base } from '../base.js';
import { svelteConfig } from '../svelte.js';
import { sharedIgnores, toolingFiles } from '../ignores.js';

/**
 * Flatten a preset and lint a source string through it, so the assertions
 * exercise the real ESLint resolution path rather than the config object shape.
 */
function lint(configs, code, filename) {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, configs, { filename });
}

describe('base preset', () => {
  test('returns a non-empty flat config array', () => {
    const configs = base();
    assert.ok(Array.isArray(configs));
    assert.ok(configs.length > 0);
  });

  test('reports unused variables as errors', () => {
    const messages = lint(base(), 'const unused = 1;\nexport const used = 2;\n', 'a.ts');
    const found = messages.find((m) => m.ruleId === '@typescript-eslint/no-unused-vars');
    assert.ok(found, 'expected no-unused-vars to report');
    assert.equal(found.severity, 2);
  });

  test('allows an underscore-prefixed binding as the explicit opt out', () => {
    const messages = lint(base(), 'const _unused = 1;\nexport const used = 2;\n', 'a.ts');
    assert.equal(
      messages.filter((m) => m.ruleId === '@typescript-eslint/no-unused-vars').length,
      0,
    );
  });

  test('reports loose equality as an error', () => {
    const messages = lint(base(), 'export const x = 1 == "1";\n', 'a.ts');
    const found = messages.find((m) => m.ruleId === 'eqeqeq');
    assert.ok(found);
    assert.equal(found.severity, 2);
  });

  test('permits null-comparison via loose equality', () => {
    const messages = lint(base(), 'export const f = (v) => v == null;\n', 'a.ts');
    assert.equal(messages.filter((m) => m.ruleId === 'eqeqeq').length, 0);
  });

  test('warns on console.log but not console.error', () => {
    const warned = lint(base(), 'console.log("x");\n', 'a.ts');
    const found = warned.find((m) => m.ruleId === 'no-console');
    assert.ok(found);
    assert.equal(found.severity, 1, 'no-console should warn, not error');

    const allowed = lint(base(), 'console.error("x");\n', 'a.ts');
    assert.equal(allowed.filter((m) => m.ruleId === 'no-console').length, 0);
  });

  test('exempts tooling files from no-console', () => {
    const messages = lint(base(), 'console.log("x");\n', 'thing.config.ts');
    assert.equal(messages.filter((m) => m.ruleId === 'no-console').length, 0);
  });

  test('applies rule overrides last', () => {
    const configs = base({ rules: { eqeqeq: 'off' } });
    const messages = lint(configs, 'export const x = 1 == "1";\n', 'a.ts');
    assert.equal(messages.filter((m) => m.ruleId === 'eqeqeq').length, 0);
  });

  test('appends caller ignores to the shared set', () => {
    const configs = base({ ignores: ['custom/**'] });
    const entry = configs.find((c) => Array.isArray(c.ignores));
    assert.ok(entry.ignores.includes('custom/**'));
    for (const shared of sharedIgnores) {
      assert.ok(entry.ignores.includes(shared), `lost shared ignore ${shared}`);
    }
  });

  test('exposes browser and node globals independently', () => {
    const browser = base({ env: 'browser' }).find((c) => c.languageOptions?.globals);
    assert.ok('window' in browser.languageOptions.globals);
    assert.ok(!('process' in browser.languageOptions.globals));

    const node = base({ env: 'node' }).find((c) => c.languageOptions?.globals);
    assert.ok('process' in node.languageOptions.globals);
  });
});

describe('svelte preset', () => {
  test('builds without throwing on the installed plugin version', () => {
    assert.doesNotThrow(() => svelteConfig());
  });

  test('routes svelte files to the typescript parser', () => {
    const configs = svelteConfig();
    const entry = configs.find(
      (c) =>
        Array.isArray(c.files) &&
        c.files.includes('**/*.svelte') &&
        c.languageOptions?.parserOptions?.parser,
    );
    assert.ok(entry, 'expected a svelte-scoped parser override');
  });

  test('still carries the base rules', () => {
    const messages = lint(svelteConfig(), 'export const x = 1 == "1";\n', 'a.ts');
    assert.ok(messages.some((m) => m.ruleId === 'eqeqeq'));
  });

  test('reports a readable error when no flat config is available', async () => {
    // Guards the v2 `flat/<name>` versus v3 `<name>` divergence: a wrong lookup
    // must not surface as a bare "not iterable" at config-load time.
    const svelte = (await import('eslint-plugin-svelte')).default;
    const original = svelte.configs;
    svelte.configs = { legacyOnly: {} };
    try {
      assert.throws(() => svelteConfig(), /exposes no flat config/);
    } finally {
      svelte.configs = original;
    }
  });
});

describe('shared ignores', () => {
  test('covers build output, dependencies, and vendored artifacts', () => {
    for (const expected of ['**/dist/**', '**/node_modules/**', '**/vendor/**', '**/coverage/**']) {
      assert.ok(sharedIgnores.includes(expected), `missing ${expected}`);
    }
  });

  test('tooling files include tests, config, and scripts', () => {
    assert.ok(toolingFiles.some((g) => g.includes('.test.')));
    assert.ok(toolingFiles.some((g) => g.includes('.config.')));
    assert.ok(toolingFiles.some((g) => g.includes('scripts/')));
  });
});

describe('typescript peer range', () => {
  // Deliberately narrower than @jrmoulckers/tsconfig, which accepts TypeScript
  // 5, 6 and 7. This package depends on typescript-eslint, whose own peer range
  // is `>=4.8.4 <6.1.0` as of 8.67.0 -- so it cannot honestly claim 7 yet. The
  // two packages must NOT be made to agree; declaring the real ceiling is what
  // turns a confusing runtime failure into an install-time ERESOLVE.
  test('declares the ceiling typescript-eslint actually supports', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const range = pkg.peerDependencies.typescript;
    assert.equal(range, '>=5.5.0 <6.1.0');
    assert.equal(pkg.peerDependenciesMeta.typescript.optional, true);
  });
});
