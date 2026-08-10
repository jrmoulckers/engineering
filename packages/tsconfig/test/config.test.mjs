import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));

async function readJson(name) {
  return JSON.parse(await readFile(join(pkgDir, name), 'utf8'));
}

const VARIANTS = ['vite-app.json', 'vite-node.json', 'vite-react.json', 'next.json'];

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
    test(`${variant} chains back to the base`, async () => {
      // Variants may extend another variant rather than the base directly, so
      // walk the chain instead of asserting a single hop.
      const seen = [];
      let current = variant;
      while (current && current !== './base.json') {
        assert.ok(!seen.includes(current), `circular extends chain: ${seen.join(' -> ')}`);
        seen.push(current);
        const config = await readJson(current);
        current = config.extends;
      }
      assert.equal(current, './base.json', `${variant} never reaches base.json`);
    });
  }

  test('vite-app targets the browser', async () => {
    const o = (await readJson('vite-app.json')).compilerOptions;
    assert.ok(o.lib.includes('DOM'));
    assert.ok(o.types.includes('vite/client'));
  });

  test('vite-app deliberately omits sourceMap', async () => {
    // `@tsconfig/svelte` sets `sourceMap: true`, explaining it is needed "to
    // have warnings/errors of the Svelte compiler at the correct position".
    // That rationale predates Svelte 5. Measured on svelte-check 4.7.5 with
    // svelte 5, positions are identical with and without it — for TS
    // diagnostics inside `<script>` (including a script block offset below
    // markup and styles) and for Svelte compiler warnings (a11y, unused CSS)
    // alike.
    //
    // It could not have worked anyway: `base.json` sets `noEmit`, so tsc
    // writes no output and therefore no source maps. Carrying the flag would
    // imply a behaviour it does not provide, so a consumer migrating off
    // `@tsconfig/svelte` should drop it rather than port it.
    const base = (await readJson('base.json')).compilerOptions;
    const o = (await readJson('vite-app.json')).compilerOptions;
    assert.equal(base.noEmit, true);
    assert.equal(o.sourceMap, undefined);
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

  test('vite-react adds the automatic JSX runtime on top of vite-app', async () => {
    // vite-app alone cannot compile a React app at all: it sets no `jsx`.
    const app = await readJson('vite-app.json');
    assert.equal(app.compilerOptions.jsx, undefined);

    const react = await readJson('vite-react.json');
    assert.equal(react.extends, './vite-app.json');
    assert.equal(react.compilerOptions.jsx, 'react-jsx');
    assert.equal(react.compilerOptions.esModuleInterop, true);
  });
});

describe('package manifest', () => {
  test('ships every variant it declares', async () => {
    const pkg = await readJson('package.json');
    const onDisk = (await readdir(pkgDir)).filter(
      (f) => f.endsWith('.json') && f !== 'package.json',
    );
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

  // The presets were compiled clean against 5.9, 6.0.3 and 7.0.2 before this
  // range was widened. A consumer on a supported TypeScript must not be turned
  // away by ERESOLVE from a range that simply went stale.
  test('accepts every TypeScript major the presets were verified against', async () => {
    const { peerDependencies } = await readJson('package.json');
    for (const major of ['^5.5.0', '^6.0.0', '^7.0.0']) {
      assert.ok(
        peerDependencies.typescript.includes(major),
        `typescript peer range omits ${major}`,
      );
    }
  });
});
