import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ESLint } from 'eslint';

import { base } from '../base.js';
import { reactConfig } from '../react.js';
import { nextConfig } from '../next.js';
import { svelteConfig } from '../svelte.js';

/**
 * Lint real files with a real ESLint, rather than inspecting the config object.
 *
 * Every other test in this package reads the resolved configuration. That
 * catches wiring mistakes and misses everything that only happens at load time,
 * which is where this package's worst defects have lived:
 *
 * - A type-aware rule on a file with no project service aborts the entire run.
 *   There are no results to inspect — ESLint prints "Oops! Something went
 *   wrong!" and exits. A config-shape assertion passes happily.
 * - A plugin that moves its flat config between majors resolves to `undefined`,
 *   and the failure names no plugin.
 * - A module reachable from an entrypoint but missing from `files` imports fine
 *   here and fails only for a consumer installing the tarball.
 *
 * Three shipped defects were found by a consumer installing the package and
 * running `eslint`, after every unit test passed. This is that run, in CI.
 *
 * Mutation-tested against the real defect history. Reintroducing the v15-only
 * resolver key fails three tests; dropping hooks from the Next path fails one;
 * removing `base`'s JavaScript `disableTypeChecked` block fails one.
 *
 * Unscoping `no-misused-promises` in `next.js` — the exact 0.5.0 crash — fails
 * nothing, and that is a result rather than a hole: `base` appends its
 * JavaScript block *after* `extend`, so it now disables the rule no matter what
 * a preset above it enables. The scoping in `next.js` is a second layer, and
 * this suite proves the first one holds on its own.
 */

let root;

/** Write a fixture tree and lint it with the given config. */
async function lint(name, config, files) {
  const dir = join(root, name);
  await mkdir(join(dir, 'src'), { recursive: true });

  // A project service needs a tsconfig, and it must include the fixture files.
  await writeFile(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'es2022', module: 'esnext', jsx: 'react-jsx', strict: true },
      include: ['src'],
    }),
  );

  for (const [path, source] of Object.entries(files)) {
    await writeFile(join(dir, path), source);
  }

  const eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: config,
    errorOnUnmatchedPattern: false,
  });

  // A load-time failure throws here. That is the case worth catching: it is
  // indistinguishable from "no problems found" if you only count results.
  const results = await eslint.lintFiles(['src']);
  return results.flatMap((r) => r.messages.map((m) => ({ file: r.filePath, ruleId: m.ruleId })));
}

const ruleIds = (found) => new Set(found.map((m) => m.ruleId));

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'eslint-config-smoke-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('base preset lints real files', () => {
  test('reports planted violations in TypeScript', async () => {
    const found = await lint('base-ts', base({ env: 'node' }), {
      'src/bad.ts': [
        'const unused = 1;',
        'export function check(a: string, b: string) {',
        '  console.log(a);',
        '  return a == b;',
        '}',
        '',
      ].join('\n'),
    });

    const ids = ruleIds(found);
    assert.ok(ids.has('@typescript-eslint/no-unused-vars'), `missing unused-vars: ${[...ids]}`);
    assert.ok(ids.has('eqeqeq'), `missing eqeqeq: ${[...ids]}`);
    assert.ok(ids.has('no-console'), `missing no-console: ${[...ids]}`);
  });

  test('a plain .js file lints without aborting the run', async () => {
    // The regression that shipped twice. A type-aware rule leaking onto a file
    // with no project service does not produce a lint error — it kills the run,
    // so `lintFiles` rejects and this test fails on the throw, not an assertion.
    const found = await lint('base-js', base({ env: 'node' }), {
      'src/plain.js': 'export const value = 1;\n',
    });

    assert.deepEqual(found, [], 'a clean plain .js file should report nothing');
  });

  test('type-aware rules fire when strictTypeChecked is on', async () => {
    const found = await lint('base-strict', base({ env: 'node', strictTypeChecked: true }), {
      'src/unsafe.ts': [
        'export function run(input: any) {',
        '  return input.whatever();',
        '}',
        '',
      ].join('\n'),
      // Present to prove the strict sets do not reach JavaScript, which is the
      // same crash as above by a different route.
      'src/tool.js': 'export const ok = 1;\n',
    });

    const ids = ruleIds(found);
    assert.ok(
      [...ids].some((id) => id?.startsWith('@typescript-eslint/no-unsafe-')),
      `expected an unsafe-family report, got: ${[...ids]}`,
    );
    assert.ok(
      !found.some((m) => m.file.endsWith('tool.js')),
      'type-aware rules must not reach plain JavaScript',
    );
  });
});

describe('svelte preset lints real files', () => {
  test('ambient and namespaced types are not reported as undefined', async () => {
    // `typescript-eslint`'s `eslint-recommended` layer is scoped to `**/*.ts`,
    // so it never reached `.svelte`. `no-undef` therefore stayed on for
    // components, where it cannot see ambient or namespaced types: SvelteKit's
    // own `App.*` namespace and `NodeJS.Timeout` were reported as undefined in
    // `<script lang="ts">` while identical code in a `.ts` file was clean.
    //
    // Found by a consumer diffing resolved rule sets across file classes. It
    // was latent rather than live — their components happened to reference no
    // ambient type — so nothing in the suite or their CI would have surfaced it.
    const found = await lint('svelte-ambient', svelteConfig({ env: 'browser' }), {
      'src/Ambient.svelte': [
        '<script lang="ts">',
        '  const timer: NodeJS.Timeout = setTimeout(() => {}, 1);',
        '  export let user: App.User;',
        '</script>',
        '',
        '<div>{timer}{user}</div>',
        '',
      ].join('\n'),
    });

    assert.deepEqual(
      found.filter((m) => m.ruleId === 'no-undef'),
      [],
      'no-undef must not fire on ambient or namespaced types in a component',
    );
  });

  test('the Svelte plugin keeps its own rules and its no-self-assign opt out', async () => {
    // The fix appends `eslint-recommended` after the plugin's configs, so it
    // could plausibly clobber them. `no-self-assign` is the one that matters:
    // the plugin turns it off deliberately because `x = x` is Svelte's
    // invalidation idiom, and re-enabling it would break every component that
    // uses it.
    const found = await lint('svelte-plugin', svelteConfig({ env: 'browser' }), {
      'src/Debug.svelte': [
        '<script lang="ts">',
        '  let n = 1;',
        '</script>',
        '',
        '{@debug n}',
        '',
      ].join('\n'),
    });

    const ids = ruleIds(found);
    assert.ok(ids.has('svelte/no-at-debug-tags'), `plugin rules must still fire: ${[...ids]}`);
    assert.ok(!ids.has('no-self-assign'), 'the plugin no-self-assign opt out must survive');
  });

  test('a component still reports the violations the base preset carries', async () => {
    // The counterweight to the test above: turning `no-undef` off for `.svelte`
    // must not turn the preset off for `.svelte`.
    const found = await lint('svelte-violations', svelteConfig({ env: 'browser' }), {
      'src/Bad.svelte': [
        '<script lang="ts">',
        '  const unused = 1;',
        '  export let a: string;',
        '  export let b: string;',
        '  const same = a == b;',
        '</script>',
        '',
        '<div>{same}</div>',
        '',
      ].join('\n'),
    });

    const ids = ruleIds(found);
    assert.ok(ids.has('eqeqeq'), `missing eqeqeq: ${[...ids]}`);
    assert.ok(ids.has('@typescript-eslint/no-unused-vars'), `missing unused-vars: ${[...ids]}`);
  });
});

describe('react preset lints real files', () => {
  test('hooks rules fire on a conditional hook', async () => {
    const found = await lint('react', reactConfig(), {
      'src/Comp.tsx': [
        "import { useState } from 'react';",
        'export function Comp({ on }: { on: boolean }) {',
        '  if (on) {',
        '    const [v] = useState(0);',
        '    return <p>{v}</p>;',
        '  }',
        '  return null;',
        '}',
        '',
      ].join('\n'),
    });

    assert.ok(
      ruleIds(found).has('react-hooks/rules-of-hooks'),
      `expected rules-of-hooks, got: ${[...ruleIds(found)]}`,
    );
  });

  test('never hands eslint-plugin-react the version it cannot detect', () => {
    // eslint-plugin-react@7.37.5 declares `eslint: … || ^9.7` and its version
    // detection calls `context.getFilename()`, removed in ESLint 10. Passing
    // `'detect'` makes every rule in the plugin fail to load with
    // `contextOrFilename.getFilename is not a function`. The preset resolves
    // the version itself and passes a concrete string, so the detection path
    // is never entered.
    //
    // This is asserted on the config rather than by linting because the fault
    // only appears on ESLint 10, and the repository's own devDependency pins
    // one major — under ESLint 9 a regression here lints perfectly. The
    // eslint-majors CI matrix covers the load-time half; this covers the half
    // that is invisible on the pinned version.
    const versions = reactConfig()
      .map((entry) => entry.settings?.react?.version)
      .filter((v) => v !== undefined);

    assert.ok(
      !versions.includes('detect'),
      "settings.react.version must never be 'detect' — it breaks every rule on ESLint 10",
    );
    for (const v of versions) {
      assert.match(v, /^\d+\./, `expected a concrete React version, got ${JSON.stringify(v)}`);
    }
  });
});

describe('next preset lints real files', () => {
  test('resolves core-web-vitals against the installed plugin major', async () => {
    // The v15-to-v16 move emptied `flatConfig`, so the old key resolved to
    // undefined and the failure named no plugin. Asserting a real @next/next
    // report proves the resolver picked a usable config from whichever major
    // is installed, rather than proving it against a hard-coded key name.
    const found = await lint('next', nextConfig(), {
      'src/Page.tsx': [
        'export default function Page() {',
        '  return <img src="/a.png" />;',
        '}',
        '',
      ].join('\n'),
    });

    assert.ok(
      [...ruleIds(found)].some((id) => id?.startsWith('@next/next/')),
      `expected a @next/next report, got: ${[...ruleIds(found)]}`,
    );
  });

  test('ships hooks linting, as eslint-config-next does', async () => {
    const found = await lint('next-hooks', nextConfig(), {
      'src/Bad.tsx': [
        "import { useEffect } from 'react';",
        'export function Bad({ on }: { on: boolean }) {',
        '  if (on) {',
        '    useEffect(() => {}, []);',
        '  }',
        '  return null;',
        '}',
        '',
      ].join('\n'),
    });

    assert.ok(
      ruleIds(found).has('react-hooks/rules-of-hooks'),
      `Next consumers must not lose hooks linting: ${[...ruleIds(found)]}`,
    );
  });

  test('a Next repository with plain .js tooling still lints', async () => {
    const found = await lint('next-js', nextConfig(), {
      'src/page.tsx': 'export default function Page() {\n  return <p>ok</p>;\n}\n',
      'src/plain.js': 'export const config = { reactStrictMode: true };\n',
    });

    assert.ok(
      !found.some((m) => m.file.endsWith('plain.js')),
      'type-aware rules must not reach plain JavaScript',
    );
  });
});
