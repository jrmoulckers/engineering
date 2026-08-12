import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import next from '@next/eslint-plugin-next';

import { nextConfig } from '../next.js';
import { reactConfig } from '../react.js';

/**
 * A flat config declares `plugins` as an object; eslintrc declares it as an
 * array of strings. Feeding ESLint an eslintrc object, or `undefined`, fails at
 * config load with an error that names no plugin.
 */
function isFlatShaped(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  return !Array.isArray(entry.plugins);
}

describe('warn severities are documented', () => {
  // The README tells consumers how many rules `--max-warnings 0` promotes to
  // blocking. That number is only useful if it cannot drift, and it moves
  // whenever an upstream plugin changes a severity, with no edit here.
  //
  // Resolved through ESLint rather than by merging `rules` blocks: a flat merge
  // ignores `files` scoping, so the tooling block's `no-console: 'off'` lands on
  // every file and the count comes out one short for every preset.
  const documented = { base: 1, react: 2, svelte: 2, next: 18 };

  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const target = fileURLToPath(new URL('../src/component.tsx', import.meta.url));

  async function warnRules(name) {
    const mod = await import(`../${name}.js`);
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: mod.default(),
    });
    const resolved = await eslint.calculateConfigForFile(target);
    return Object.entries(resolved.rules ?? {})
      .filter(([, value]) => (Array.isArray(value) ? value[0] : value) === 1)
      .map(([rule]) => rule)
      .sort();
  }

  for (const [name, expected] of Object.entries(documented)) {
    test(`${name} exposes ${expected} warn-severity rule(s) on .tsx`, async () => {
      const warns = await warnRules(name);
      assert.equal(
        warns.length,
        expected,
        `README documents ${expected} for ${name}; resolved ${warns.length}: ${warns.join(', ')}`,
      );
    });
  }

  test('no-console is warn in every preset, so no consumer is exempt', async () => {
    for (const name of Object.keys(documented)) {
      assert.ok(
        (await warnRules(name)).includes('no-console'),
        `${name} does not resolve no-console to warn on a source file`,
      );
    }
  });
});

describe('next preset', () => {
  test('resolves against the installed plugin without throwing', () => {
    assert.doesNotThrow(() => nextConfig());
  });

  test('every entry is flat-shaped, never eslintrc or undefined', () => {
    for (const entry of nextConfig()) {
      assert.ok(entry, 'a config entry is null or undefined');
      assert.ok(isFlatShaped(entry), `entry ${entry.name ?? '(unnamed)'} is not flat-shaped`);
    }
  });

  test('carries the Core Web Vitals rules', () => {
    const rules = Object.assign({}, ...nextConfig().map((entry) => entry.rules ?? {}));
    // Present in the plugin's core-web-vitals set across both majors.
    assert.equal(rules['@next/next/no-img-element'], 'warn');
    assert.ok(Object.keys(rules).some((rule) => rule.startsWith('@next/next/')));
  });

  test('keeps the base rules underneath', () => {
    const rules = Object.assign({}, ...nextConfig().map((entry) => entry.rules ?? {}));
    assert.ok(rules['eqeqeq'], 'base rules were dropped');
    assert.equal(rules['@typescript-eslint/no-explicit-any'], 'warn');
  });

  test('ignores Next build output', () => {
    const ignores = nextConfig().flatMap((entry) => entry.ignores ?? []);
    assert.ok(ignores.includes('**/.next/**'));
  });

  test('appends caller ignores and extends rather than replacing', () => {
    const config = nextConfig({ ignores: ['generated/**'], rules: { 'no-console': 'off' } });
    assert.ok(config.flatMap((e) => e.ignores ?? []).includes('generated/**'));
    assert.ok(config.flatMap((e) => e.ignores ?? []).includes('**/.next/**'));

    const rules = Object.assign({}, ...config.map((e) => e.rules ?? {}));
    assert.equal(rules['no-console'], 'off');
  });

  test('the resolver survives a plugin that moves its flat config', () => {
    // v15 published at `flatConfig.coreWebVitals`; v16 empties `flatConfig` and
    // publishes at `configs['core-web-vitals']`. Whichever major is installed,
    // exactly one of those must have been usable for the preset to have built.
    const candidates = [next.flatConfig?.coreWebVitals, next.configs?.['core-web-vitals']];
    assert.ok(
      candidates.some(isFlatShaped),
      'no known key holds a flat config; the resolver needs a new candidate',
    );
  });

  test('peer range admits the installed plugin major', async () => {
    const { default: manifest } = await import('../package.json', { with: { type: 'json' } });
    const range = manifest.peerDependencies['@next/eslint-plugin-next'];
    // The preset resolves both majors, so the declared range must not forbid either.
    assert.match(range, /15/);
    assert.match(range, /16/);
  });

  test('framework plugins are optional peerDependencies', async () => {
    // These were briefly moved out of `peerDependencies` into a bespoke
    // `frameworkPlugins` field, on the belief that npm 7+ installs an optional
    // peer whenever it can resolve one. That belief is false, and this test
    // exists so it does not return.
    //
    // Measured by packing this package and installing the tarball into a bare
    // consumer: `eslint` (a *required* peer) is auto-installed, and all five
    // optional peers are not. Same result on npm 7, npm 11, pnpm 11, and pnpm
    // with `auto-install-peers=true`. Declaring them optional therefore costs
    // a consumer nothing at install time, while keeping the supported range
    // published where npm will check it and warn on a mismatch.
    const { default: manifest } = await import('../package.json', { with: { type: 'json' } });
    const peers = manifest.peerDependencies ?? {};
    const meta = manifest.peerDependenciesMeta ?? {};

    assert.ok(
      !('frameworkPlugins' in manifest),
      'frameworkPlugins is a bespoke field npm ignores; declare plugins as optional peers instead',
    );

    const frameworkPlugins = [
      '@next/eslint-plugin-next',
      'eslint-plugin-jsx-a11y',
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
      'eslint-plugin-svelte',
    ];
    for (const name of frameworkPlugins) {
      assert.ok(name in peers, `${name} must be declared so npm can version-check it`);
      assert.equal(
        meta[name]?.optional,
        true,
        `${name} must be optional — a Svelte repo must not be required to install React plugins`,
      );
    }

    // eslint is the only peer a consumer must always have. Marking it optional
    // would silence the one mismatch warning that matters universally.
    assert.equal(meta.eslint?.optional, undefined, 'eslint must remain a required peer');
  });
});

describe('next preset type-aware wiring (ENG-TEST-008)', () => {
  const TYPE_AWARE_RULE = '@typescript-eslint/no-misused-promises';

  /** Minimal glob matcher covering the shapes these presets use. */
  function matches(glob, filePath) {
    const pattern = String(glob)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*/g, '[^/]*');
    return new RegExp(`^${pattern}$`).test(filePath);
  }

  /**
   * Resolve as ESLint does: every matching entry applies, last one wins.
   * Behavioural rather than structural — what matters is what a given file
   * ends up with, not which entry supplied it.
   */
  function resolve(config, filePath) {
    let rule;
    let projectService;
    for (const entry of config) {
      if (entry.files && !entry.files.some((g) => matches(g, filePath))) continue;
      if (entry.rules?.[TYPE_AWARE_RULE] !== undefined) rule = entry.rules[TYPE_AWARE_RULE];
      const ps = entry.languageOptions?.parserOptions?.projectService;
      if (ps !== undefined) projectService = ps;
    }
    return { rule, projectService };
  }

  const enabled = (rule) => rule !== undefined && rule !== 'off';

  test('no file ever gets a type-aware rule without a project service', () => {
    // This is the invariant. Violating it aborts the entire ESLint run rather
    // than failing one rule, so it is checked per file shape, including the
    // plain .js case that is neither TypeScript nor a tooling file.
    const paths = [
      'src/a.ts',
      'src/a.tsx',
      'src/a.mts',
      'src/a.js',
      'src/a.jsx',
      'src/a.mjs',
      'vite.config.mjs',
      'eslint.config.js',
      'scripts/build.mjs',
      'src/a.test.ts',
    ];
    for (const p of paths) {
      const { rule, projectService } = resolve(nextConfig(), p);
      if (!enabled(rule)) continue;
      assert.equal(projectService, true, `${p} enables ${TYPE_AWARE_RULE} with no project service`);
    }
  });

  test('TypeScript sources keep the rule enabled', () => {
    const { rule, projectService } = resolve(nextConfig(), 'src/a.ts');
    assert.ok(Array.isArray(rule) && rule[0] === 'error');
    assert.equal(projectService, true);
  });

  test('tooling files disable the rule explicitly', () => {
    const { rule, projectService } = resolve(nextConfig(), 'vite.config.mjs');
    assert.equal(rule, 'off');
    assert.equal(projectService, false);
  });

  test('typeAware: false drops the rule rather than leaving it to crash', () => {
    for (const p of ['src/a.ts', 'src/a.js']) {
      const { rule, projectService } = resolve(nextConfig({ typeAware: false }), p);
      assert.ok(!enabled(rule));
      assert.notEqual(projectService, true);
    }
  });

  test('next-env.d.ts is ignored', () => {
    const ignores = nextConfig().flatMap((e) => (e.files ? [] : (e.ignores ?? [])));
    assert.ok(
      ignores.some((g) => String(g).includes('next-env.d.ts')),
      'Next regenerates next-env.d.ts on every build and it trips triple-slash-reference',
    );
  });
});

describe('next preset hooks parity (ENG-TEST-008)', () => {
  const CLASSIC = ['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'];

  /** Merge every rules entry, as ESLint does for a file all entries match. */
  function allRules(config) {
    const rules = {};
    for (const entry of config) Object.assign(rules, entry.rules ?? {});
    return rules;
  }

  const severity = (v) => (Array.isArray(v) ? v[0] : v);
  const isOff = (v) => severity(v) === 'off' || severity(v) === 0;

  test('ships the classic hook rules', () => {
    // Next.js is React, and eslint-config-next -- what consumers migrate off --
    // bundles hooks linting. Dropping it here is a silent loss of the two rules
    // most likely to catch a real bug.
    const rules = allRules(nextConfig());
    for (const rule of CLASSIC) {
      assert.ok(rule in rules, `${rule} missing from the Next preset`);
      assert.ok(!isOff(rules[rule]), `${rule} present but disabled`);
    }
  });

  test('leaves the React Compiler family off by default', () => {
    const rules = allRules(nextConfig());
    const compilerRules = Object.keys(rules).filter(
      (r) => r.startsWith('react-hooks/') && !CLASSIC.includes(r),
    );
    // v7 folded the Compiler rules into `recommended`. Enabling them wholesale
    // produces enough findings on an existing codebase that repositories
    // respond by disabling the plugin entirely.
    for (const rule of compilerRules) assert.ok(isOff(rules[rule]), `${rule} should default off`);
  });

  test('compiler: true opts into the full family', () => {
    const rules = allRules(nextConfig({ compiler: true }));
    const enabled = Object.entries(rules).filter(
      ([r, v]) => r.startsWith('react-hooks/') && !isOff(v),
    );
    assert.ok(enabled.length > CLASSIC.length, 'compiler: true enabled nothing extra');
  });

  test('matches the React preset, so the two cannot drift', () => {
    const nextHooks = Object.entries(allRules(nextConfig()))
      .filter(([r]) => r.startsWith('react-hooks/'))
      .map(([r, v]) => `${r}:${severity(v)}`)
      .sort();
    const reactHooksRules = Object.entries(allRules(reactConfig()))
      .filter(([r]) => r.startsWith('react-hooks/'))
      .map(([r, v]) => `${r}:${severity(v)}`)
      .sort();
    assert.deepEqual(nextHooks, reactHooksRules);
  });
});
