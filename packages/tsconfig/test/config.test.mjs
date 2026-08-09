import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));

async function readJson(name) {
  return JSON.parse(await readFile(join(pkgDir, name), 'utf8'));
}

const VARIANTS = ['vite-app.json', 'vite-node.json', 'next.json'];

describe('base tsconfig', () => {
  test('enables the checks that strict alone does not cover', async () => {
    const base = await readJson('base.json');
    const o = base.compilerOptions;
    assert.equal(o.strict, true);
    assert.equal(o.noUncheckedIndexedAccess, true);
    assert.equal(o.noImplicitOverride, true);
    assert.equal(o.noFallthroughCasesInSwitch, true);
    assert.equal(o.noUnusedLocals, true);
    assert.equal(o.noUnusedParameters, true);
    assert.equal(o.verbatimModuleSyntax, true);
    assert.equal(o.isolatedModules, true);
  });

  test('type-checks without emitting', async () => {
    const base = await readJson('base.json');
    assert.equal(base.compilerOptions.noEmit, true);
  });

  test('leaves exactOptionalPropertyTypes off pending per-repo adoption', async () => {
    const base = await readJson('base.json');
    assert.equal(base.compilerOptions.exactOptionalPropertyTypes, false);
  });
});

describe('variants', () => {
  for (const variant of VARIANTS) {
    test(`${variant} extends the base`, async () => {
      const config = await readJson(variant);
      assert.equal(config.extends, './base.json');
    });
  }

  test('vite-app targets the browser', async () => {
    const o = (await readJson('vite-app.json')).compilerOptions;
    assert.ok(o.lib.includes('DOM'));
    assert.ok(o.types.includes('vite/client'));
  });

  test('vite-node targets node without DOM', async () => {
    const o = (await readJson('vite-node.json')).compilerOptions;
    assert.ok(!o.lib.includes('DOM'));
    assert.ok(o.types.includes('node'));
  });

  test('next preserves jsx and registers the next plugin', async () => {
    const o = (await readJson('next.json')).compilerOptions;
    assert.equal(o.jsx, 'preserve');
    assert.ok(o.plugins.some((p) => p.name === 'next'));
  });
});

describe('package manifest', () => {
  test('ships every variant it declares', async () => {
    const pkg = await readJson('package.json');
    const onDisk = (await readdir(pkgDir)).filter((f) => f.endsWith('.json') && f !== 'package.json');
    for (const file of onDisk) {
      assert.ok(pkg.files.includes(file), `${file} exists but is not in package.json files`);
    }
    for (const file of pkg.files.filter((f) => f.endsWith('.json'))) {
      assert.ok(onDisk.includes(file), `package.json lists ${file} but it is missing`);
    }
  });

  test('publishes to GitHub Packages under the owner scope', async () => {
    const pkg = await readJson('package.json');
    assert.ok(pkg.name.startsWith('@jrmoulckers/'));
    assert.equal(pkg.publishConfig.registry, 'https://npm.pkg.github.com');
  });
});
