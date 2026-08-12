import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));

async function readJson(name) {
  return JSON.parse(await readFile(join(pkgDir, name), 'utf8'));
}

const VARIANTS = ['vite-app.json', 'vite-node.json', 'vite-react.json', 'next.json', 'node.json'];

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

  test('does not set allowImportingTsExtensions, which would break emitting consumers', async () => {
    // A consumer asked for this to be hoisted here, arguing it is inert unless
    // a repo writes `.ts` import specifiers. Measured on tsc 5.9.3, it is not:
    // a config that extends this base and sets `noEmit: false` fails outright.
    //
    //   TS5096: Option 'allowImportingTsExtensions' can only be used when
    //           either 'noEmit' or 'emitDeclarationOnly' is set.
    //
    // Every package that emits declarations overrides `noEmit`, so hoisting it
    // would turn a working build into a hard error for them. It lives in
    // `node.json` instead, which is opt-in.
    const base = await readJson('base.json');
    assert.equal(base.compilerOptions.allowImportingTsExtensions, undefined);
  });
});

describe('node variant', () => {
  test('permits .ts import specifiers', async () => {
    // Node executes TypeScript directly by stripping types, and its resolver
    // does not remap `./x.ts` to `./x.js`. Without this the specifier Node
    // requires is the one tsc rejects.
    const o = (await readJson('node.json')).compilerOptions;
    assert.equal(o.allowImportingTsExtensions, true);
  });

  test('inherits noEmit, which is what makes the flag legal', async () => {
    // The flag is only accepted alongside `noEmit` or `emitDeclarationOnly`.
    // This variant never sets its own `noEmit`, so it relies on the base — if
    // the base ever stopped setting it, this preset would fail to load.
    const base = await readJson('base.json');
    const node = await readJson('node.json');
    assert.equal(base.compilerOptions.noEmit, true);
    assert.equal(node.compilerOptions.noEmit, undefined);
  });

  test('avoids rewriteRelativeImportExtensions, which outruns the declared peer floor', async () => {
    // That option would let a consumer keep `.ts` specifiers *and* emit, but it
    // was added in TypeScript 5.7 and older releases reject an unknown option
    // outright rather than ignoring it. Measured on 5.6.3:
    //
    //   TS5023: Unknown compiler option 'rewriteRelativeImportExtensions'.
    //
    // The package accepts `^5.5.0`, so shipping it here would break 5.5 and 5.6
    // consumers. A consumer that needs both behaviours can set it locally along
    // with its own TypeScript floor.
    const pkg = await readJson('package.json');
    const o = (await readJson('node.json')).compilerOptions;
    assert.ok(pkg.peerDependencies.typescript.includes('^5.5.0'));
    assert.equal(o.rewriteRelativeImportExtensions, undefined);
  });

  test('targets node without DOM', async () => {
    const o = (await readJson('node.json')).compilerOptions;
    assert.ok(!o.lib.includes('DOM'));
    assert.ok(o.types.includes('node'));
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

    // `jsx` is the *only* thing it adds. It also carried `esModuleInterop: true`
    // until a consumer's option-by-option audit flagged the asymmetry: five other
    // variants omitted it. The option was inert here -- `base.json`'s
    // `moduleResolution: "bundler"` implies `allowSyntheticDefaultImports` and its
    // `noEmit` retires the emit half -- so nothing observable changed when it went.
    // See scripts/test/tsconfig-parity.test.mjs for the family-wide guard.
    assert.equal(react.compilerOptions.esModuleInterop, undefined);
    assert.deepEqual(Object.keys(react.compilerOptions), ['jsx']);
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
