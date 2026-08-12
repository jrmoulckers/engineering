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

// A rule count is meaningless without its baseline, and this defect has three:
// the legacy `next/core-web-vitals` (17 react / 6 a11y active), the broken
// preset (0 / 0), and the fixed layer (18 / 31). All three numbers are true.
//
// I got this wrong in exactly the way the docs warn about: a consumer measured
// broken -> fixed as 0 -> 18 / 0 -> 31, and I "corrected" the drop-relative-to-
// legacy figures of 17 and 6 to match, shipping a wrong fact to fix a right one.
// The scan that caught it looked for the old numbers and found them in a table
// that explained why they were right.
//
// So this asserts the fixed layer's own counts -- the only baseline this file
// can measure -- and leaves prose about the other two to name its baseline.
test('the restored layer is ahead of the legacy config, not merely level', () => {
  const react = activeRules(reactConfig(), 'react/');
  const a11y = activeRules(reactConfig(), 'jsx-a11y/');

  // Legacy `next/core-web-vitals` enforces 17 and 6. The fix must exceed both,
  // which is the claim in `docs/adopting.md` that adopters plan around: expect
  // *new* a11y findings, not parity.
  assert.ok(react.size > 17, `expected more than the legacy 17 react/*, got ${react.size}`);
  assert.ok(a11y.size > 6, `expected more than the legacy 6 jsx-a11y/*, got ${a11y.size}`);
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
