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

  /** Last matching entry wins in flat config, so resolve like ESLint does. */
  function resolveRule(config, ruleName, matches) {
    let resolved;
    for (const entry of config) {
      if (entry.files && !matches(entry.files)) continue;
      const value = entry.rules?.[ruleName];
      if (value !== undefined) resolved = value;
    }
    return resolved;
  }

  const isTs = (files) => files.includes('**/*.tsx');
  const isTooling = (files) => files.includes('**/*.config.mjs');

  test('a type-aware rule is never enabled without a project service backing it', () => {
    // The failure this guards is total: a type-aware rule on a file with no
    // type information aborts the whole run, not just that rule. An explicit
    // 'off' is the safe state, so only enabled entries must carry a service.
    for (const entry of nextConfig()) {
      const rule = entry.rules?.[TYPE_AWARE_RULE];
      if (rule === undefined || rule === 'off') continue;
      assert.equal(
        entry.languageOptions?.parserOptions?.projectService,
        true,
        `${TYPE_AWARE_RULE} is enabled in an entry that supplies no project service`,
      );
      assert.ok(entry.files?.length, `${TYPE_AWARE_RULE} is enabled without a files scope`);
    }
  });

  test('tooling files end up with the type-aware rule off', () => {
    // Config files and scripts routinely sit outside tsconfig.json.
    assert.notEqual(resolveRule(nextConfig(), TYPE_AWARE_RULE, isTooling), 'error');
    assert.equal(
      resolveRule(nextConfig(), TYPE_AWARE_RULE, isTooling),
      'off',
      'tooling files must disable the rule explicitly, not merely fail to enable it',
    );
  });

  test('TypeScript files keep the rule enabled', () => {
    const resolved = resolveRule(nextConfig(), TYPE_AWARE_RULE, isTs);
    assert.ok(Array.isArray(resolved) && resolved[0] === 'error');
  });

  test('typeAware: false drops the rule rather than leaving it to crash', () => {
    for (const entry of nextConfig({ typeAware: false })) {
      assert.equal(entry.rules?.[TYPE_AWARE_RULE], undefined);
      assert.notEqual(entry.languageOptions?.parserOptions?.projectService, true);
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
