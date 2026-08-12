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

describe('base strictTypeChecked (ENG-TEST-008)', () => {
  const STRICT_RULES = [
    '@typescript-eslint/no-unsafe-assignment',
    '@typescript-eslint/no-unsafe-member-access',
    '@typescript-eslint/no-floating-promises',
  ];

  /** Resolve a rule and the project-service setting for one file path. */
  function resolveFor(config, filePath) {
    const matches = (glob) => {
      const pattern = String(glob)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '(?:.*/)?')
        .replace(/\*/g, '[^/]*');
      return new RegExp(`^${pattern}$`).test(filePath);
    };
    const rules = {};
    let projectService;
    for (const entry of config) {
      if (entry.files && !entry.files.some(matches)) continue;
      Object.assign(rules, entry.rules ?? {});
      const ps = entry.languageOptions?.parserOptions?.projectService;
      if (ps !== undefined) projectService = ps;
    }
    return { rules, projectService };
  }

  const enabled = (r) => r !== undefined && r !== 'off' && r?.[0] !== 'off';

  test('off by default, so the preset needs no TypeScript project', () => {
    const { rules, projectService } = resolveFor(base(), 'src/a.ts');
    assert.notEqual(projectService, true);
    for (const rule of STRICT_RULES)
      assert.ok(!enabled(rules[rule]), `${rule} leaked into default`);
  });

  test('enables the type-checked families on TypeScript when opted in', () => {
    const { rules, projectService } = resolveFor(base({ strictTypeChecked: true }), 'src/a.ts');
    assert.equal(projectService, true);
    for (const rule of STRICT_RULES)
      assert.ok(enabled(rules[rule]), `${rule} missing under strict`);
  });

  test('never leaves a type-aware rule on a file with no project service', () => {
    // The failure mode is a hard abort of the whole run, not one failing rule.
    // Plain .js sources are the exposed case: they are not TypeScript and not
    // tooling, so only an explicit disable keeps them safe.
    const config = base({ strictTypeChecked: true });
    for (const p of [
      'src/a.js',
      'src/a.jsx',
      'src/a.mjs',
      'src/a.cjs',
      'vite.config.mjs',
      'scripts/build.mjs',
      'src/a.test.ts',
    ]) {
      const { rules, projectService } = resolveFor(config, p);
      for (const rule of STRICT_RULES) {
        if (enabled(rules[rule])) {
          assert.equal(projectService, true, `${p} enables ${rule} with no project service`);
        }
      }
    }
  });

  test('strictTypeChecked implies type information without also passing typeAware', () => {
    const { projectService } = resolveFor(base({ strictTypeChecked: true }), 'src/a.ts');
    assert.equal(projectService, true);
  });

  test('untypedFiles disables the type-aware rules for globs base cannot know about', () => {
    const config = base({ strictTypeChecked: true, untypedFiles: ['**/*.svelte'] });
    const { rules, projectService } = resolveFor(config, 'src/App.svelte');
    assert.notEqual(projectService, true);
    for (const rule of STRICT_RULES)
      assert.ok(!enabled(rules[rule]), `${rule} left on for an untyped file`);
  });

  test('untypedFiles outranks extend, which is where a preset would otherwise put it', () => {
    // The reason `untypedFiles` exists rather than presets handling this
    // themselves: `extend` is spliced in above the trailing disable blocks, so
    // an entry passed there cannot turn a type-aware rule back off.
    const config = base({
      strictTypeChecked: true,
      untypedFiles: ['**/*.svelte'],
      extend: [
        { files: ['**/*.svelte'], rules: { '@typescript-eslint/no-floating-promises': 'error' } },
      ],
    });
    const { rules } = resolveFor(config, 'src/App.svelte');
    assert.ok(!enabled(rules['@typescript-eslint/no-floating-promises']));
  });

  test('no preset leaves a type-aware rule on a file type it opts out of projectService', () => {
    // Generalises the plain-.js case. A preset that excludes a file type from
    // the TypeScript project must also disable the rules that need one; doing
    // only the first aborts the entire run on the first such file.
    const cases = [
      [
        svelteConfig({ strictTypeChecked: true }),
        ['src/App.svelte', 'src/s.svelte.ts', 'src/s.svelte.js'],
      ],
      [base({ strictTypeChecked: true }), ['src/a.js', 'src/a.mjs']],
    ];
    for (const [config, paths] of cases) {
      for (const p of paths) {
        const { rules, projectService } = resolveFor(config, p);
        for (const rule of STRICT_RULES) {
          if (enabled(rules[rule]))
            assert.equal(projectService, true, `${p} enables ${rule} with no project service`);
        }
      }
    }
  });
});

describe('published package contents', () => {
  /**
   * Every file an export condition points at, whether the entry is a bare
   * string or a conditions object. Missing the `types` condition here is how a
   * declaration file silently stops being published.
   */
  function entrypointTargets(exports) {
    const targets = [];
    for (const entry of Object.values(exports)) {
      const values = typeof entry === 'string' ? [entry] : Object.values(entry);
      for (const value of values) targets.push(String(value).replace('./', ''));
    }
    return targets;
  }

  // A module reachable from an entrypoint but absent from `files` is missing
  // only in the tarball, so every local gate passes and the failure appears at
  // the consumer as an unresolvable import. Walk the real import graph rather
  // than listing expected names, so a future module is covered automatically.
  test('every module reachable from an entrypoint is published', async () => {
    const dir = new URL('../', import.meta.url);
    const pkg = JSON.parse(await readFile(new URL('package.json', dir), 'utf8'));
    const published = new Set(pkg.files);

    const entrypoints = [...new Set(entrypointTargets(pkg.exports))];
    const seen = new Set();
    const queue = [...entrypoints];

    while (queue.length > 0) {
      const name = queue.pop();
      if (seen.has(name)) continue;
      seen.add(name);

      assert.ok(
        published.has(name),
        `${name} is reachable from an entrypoint but missing from package.json "files"`,
      );

      const source = await readFile(new URL(name, dir), 'utf8');
      for (const match of source.matchAll(/from\s+'\.\/([^']+)'/g)) {
        // A .d.ts importing './types.js' resolves to types.d.ts, not types.js:
        // TypeScript keeps the runtime specifier and swaps the extension. Queue
        // the file that actually has to be published.
        queue.push(name.endsWith('.d.ts') ? match[1].replace(/\.js$/, '.d.ts') : match[1]);
      }
    }
  });

  test('every entrypoint is listed in files', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const published = new Set(pkg.files);
    for (const target of entrypointTargets(pkg.exports)) {
      assert.ok(published.has(target), `${target} is exported but not published`);
    }
  });
});

describe('shipped type declarations', () => {
  const ENTRYPOINTS = ['base', 'svelte', 'react', 'next'];

  test('every entrypoint has a declaration file beside it', async () => {
    for (const name of ENTRYPOINTS) {
      const source = await readFile(new URL(`../${name}.d.ts`, import.meta.url), 'utf8');
      assert.ok(source.includes('export declare function'), `${name}.d.ts declares no function`);
    }
  });

  test('exports map every entrypoint to its declaration', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      assert.equal(typeof entry, 'object', `${subpath} must use export conditions to carry types`);
      assert.ok(entry.types, `${subpath} has no "types" condition`);
      assert.ok(entry.types.endsWith('.d.ts'), `${subpath} types condition is not a .d.ts`);
      // `types` must precede `default`: resolution takes the first match, so a
      // `default` listed first shadows the declarations entirely.
      assert.equal(Object.keys(entry)[0], 'types', `${subpath} lists "default" before "types"`);
    }
  });

  test('extend stays loosely typed', async () => {
    // Consumers pass entries built from their own plugins, carrying their own
    // copy of @types/eslint. Config objects from two different copies are not
    // mutually assignable, so narrowing this is what makes a *correct* config
    // fail to compile. Verified end to end: a foreign-shaped entry assigns.
    const source = await readFile(new URL('../types.d.ts', import.meta.url), 'utf8');
    assert.match(source, /extend\?:\s*unknown\[\]/);
  });

  test('declarations do not depend on @types/eslint', async () => {
    // Referencing it would reintroduce the version-skew problem these
    // declarations exist to avoid, and pull a second copy into the consumer.
    // Matched against import/reference syntax rather than the bare name, since
    // the files discuss @types/eslint in prose precisely to explain the choice.
    for (const name of [...ENTRYPOINTS, 'types']) {
      const source = await readFile(new URL(`../${name}.d.ts`, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /from\s+'eslint'/, `${name}.d.ts imports from eslint`);
      assert.doesNotMatch(
        source,
        /reference\s+types=|from\s+'@types\/eslint'/,
        `${name}.d.ts references @types/eslint`,
      );
    }
  });
});
