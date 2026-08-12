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

// The counts above are quoted in `react-layer.js` and in `docs/adopting.md` as
// the size of the regression. They were wrong once — recorded as "17 react/* and
// 6 jsx-a11y/*" from recall rather than measurement, when a consumer measuring a
// real application found 18 and 31. A prose number that nothing executes drifts
// silently, so this asserts a floor: the documented figures cannot exceed what
// the presets actually enable.
test('the documented rule counts are not larger than the real ones', () => {
  const react = activeRules(reactConfig(), 'react/');
  const a11y = activeRules(reactConfig(), 'jsx-a11y/');

  assert.ok(react.size >= 18, `docs claim 18 react/* rules; the preset enables ${react.size}`);
  assert.ok(a11y.size >= 31, `docs claim 31 jsx-a11y/* rules; the preset enables ${a11y.size}`);

  // The specific rules cited as evidence, by name. A count can hold while the
  // rule someone was told about disappears.
  for (const rule of [
    'react/jsx-key',
    'jsx-a11y/alt-text',
    'jsx-a11y/click-events-have-key-events',
    'jsx-a11y/label-has-associated-control',
    'jsx-a11y/interactive-supports-focus',
    'jsx-a11y/media-has-caption',
  ]) {
    const family = rule.startsWith('react/') ? react : a11y;
    assert.ok(family.has(rule), `${rule} is cited as evidence but is not enabled`);
  }
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
