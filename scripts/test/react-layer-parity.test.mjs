import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextConfig } from '../../packages/eslint-config/next.js';
import { reactConfig } from '../../packages/eslint-config/react.js';

/**
 * `nextConfig()` must carry the same React and accessibility rules as
 * `reactConfig()`.
 *
 * It previously imported only `@next/eslint-plugin-next` and layered hooks by
 * hand, dropping every `react/*` and `jsx-a11y/*` rule relative to the
 * `eslint-config-next` consumers migrate off — which bundles
 * `eslint-plugin-react` and `eslint-plugin-jsx-a11y` as direct dependencies.
 *
 * That regression could not fail loudly. Removing `eslint-config-next` also
 * removes the only thing installing those plugins, so no unresolved-plugin
 * error was possible: the rules ceased to exist and lint stayed green while
 * `react/jsx-key` — a real correctness bug — passed.
 *
 * A test that only asserted "some react rules are present" would not have
 * caught the drift that produced it, so this compares the two presets to each
 * other. Both call `reactLayer()`; if a future change inlines the layer into
 * one of them, these assertions fail.
 */

/** @param {import('eslint').Linter.Config[]} configs @param {string} prefix */
function activeRules(configs, prefix) {
  const seen = new Map();
  for (const entry of configs) {
    for (const [name, value] of Object.entries(entry?.rules ?? {})) {
      if (name.startsWith(prefix)) seen.set(name, Array.isArray(value) ? value[0] : value);
    }
  }
  return new Set([...seen].filter(([, sev]) => sev !== 'off' && sev !== 0).map(([n]) => n));
}

for (const prefix of ['react/', 'jsx-a11y/', 'react-hooks/']) {
  test(`nextConfig() carries the same ${prefix}* rules as reactConfig()`, () => {
    const fromNext = activeRules(nextConfig({ typeAware: false }), prefix);
    const fromReact = activeRules(reactConfig(), prefix);

    assert.ok(fromReact.size > 0, `reactConfig() should enable ${prefix}* rules`);

    const missing = [...fromReact].filter((r) => !fromNext.has(r)).sort();
    assert.deepEqual(
      missing,
      [],
      `nextConfig() is missing ${missing.length} ${prefix}* rule(s) that reactConfig() enables: ` +
        `${missing.join(', ')}. A Next application is a React application; both presets must ` +
        `share reactLayer() so they cannot drift.`,
    );
  });
}

test('nextConfig() still carries the Next-specific rules', () => {
  const nextRules = activeRules(nextConfig({ typeAware: false }), '@next/next/');
  assert.ok(
    nextRules.size > 10,
    `expected the Core Web Vitals rule set, got ${nextRules.size} @next/next/* rules`,
  );
});

test('the shared React layer ships in the package tarball', async () => {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(
    await readFile(new URL('../../packages/eslint-config/package.json', import.meta.url), 'utf8'),
  );
  assert.ok(
    pkg.files.includes('react-layer.js'),
    'react-layer.js is imported by both presets but missing from "files", so the published ' +
      'tarball would omit it and every consumer would fail at config load.',
  );
});
