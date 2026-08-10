import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import next from '@next/eslint-plugin-next';

import { nextConfig } from '../next.js';

/**
 * A flat config declares `plugins` as an object; eslintrc declares it as an
 * array of strings. Feeding ESLint an eslintrc object, or `undefined`, fails at
 * config load with an error that names no plugin.
 */
function isFlatShaped(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  return !Array.isArray(entry.plugins);
}

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
    // The preset resolves both majors, so the manifest must not forbid either.
    assert.match(range, /15/);
    assert.match(range, /16/);
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
