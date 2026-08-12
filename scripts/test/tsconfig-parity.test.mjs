import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'packages', 'tsconfig');

/**
 * A compiler option set by some variants and omitted by others is a defect even
 * when every resolved value is correct, because the asymmetry is what a
 * consumer auditing the family reads as a bug.
 *
 * `vite-react.json` carried `esModuleInterop: true` while the other five
 * omitted it. Every resolved config behaved identically -- `base.json` sets
 * `moduleResolution: "bundler"`, which implies `allowSyntheticDefaultImports`,
 * and `noEmit: true`, which retires the emit half of the flag -- so no
 * behavioural test could have caught it. What it invited was a reader
 * concluding `base.json` had *forgotten* the option and hoisting it, the same
 * shape as the `allowImportingTsExtensions` hoist that produced TS5096.
 *
 * Asserting agreement rather than any particular value keeps this honest: a
 * variant may still override an option deliberately, but it must do so for a
 * reason recorded in KNOWN_DIVERGENCE below.
 */

const variants = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'package.json')
  .sort();

/** Options a leaf variant is expected to set alone, with the reason it diverges. */
const KNOWN_DIVERGENCE = new Map([
  ['allowImportingTsExtensions', 'node.json only; hoisting it to base produces TS5096'],
  ['useDefineForClassFields', 'bundler-specific class semantics'],
  ['checkJs', 'bundler-specific: Vite apps carry checked JS config files'],
  ['jsx', 'renderer-specific: only the React and Next variants emit JSX'],
  ['jsxImportSource', 'renderer-specific'],
  ['types', 'runtime-specific ambient types'],
  ['lib', 'runtime-specific standard library'],
  ['plugins', 'editor tooling, framework-specific'],
  ['allowJs', 'framework build output, framework-specific'],
  ['incremental', 'build-mode specific'],
  ['composite', 'build-mode specific'],
  ['noEmit', 'framework variants may emit where base does not'],
  ['module', 'runtime-specific module system'],
  ['moduleResolution', 'runtime-specific resolution'],
  ['target', 'runtime-specific language level'],
  ['outDir', 'emit-location specific'],
  ['rootDir', 'emit-location specific'],
  ['declaration', 'library variants emit declarations'],
  ['declarationMap', 'library variants emit declarations'],
  ['sourceMap', 'documented opt-in, measured on Svelte 5'],
  ['verbatimModuleSyntax', 'runtime-specific import elision'],
  ['isolatedModules', 'runtime-specific'],
  ['emitDeclarationOnly', 'library variants only'],
  ['tsBuildInfoFile', 'build-mode specific'],
]);

/** @returns {Record<string, {file: string, value: unknown}[]>} */
function optionSites() {
  /** @type {Record<string, {file: string, value: unknown}[]>} */
  const sites = {};
  for (const file of variants) {
    const parsed = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    for (const [option, value] of Object.entries(parsed.compilerOptions ?? {})) {
      (sites[option] ??= []).push({ file, value });
    }
  }
  return sites;
}

test('no compiler option is set by exactly one leaf variant without a recorded reason', () => {
  const sites = optionSites();
  const lone = Object.entries(sites)
    .filter(
      ([option, where]) =>
        where.length === 1 && where[0].file !== 'base.json' && !KNOWN_DIVERGENCE.has(option),
    )
    .map(([option, where]) => `${option} (only in ${where[0].file})`);

  assert.deepEqual(
    lone,
    [],
    `Options set by a single variant with no recorded reason:\n  ${lone.join('\n  ')}\n\n` +
      'Either hoist the option to base.json so the family agrees, drop it if the\n' +
      'resolved behaviour is already correct, or add it to KNOWN_DIVERGENCE with\n' +
      'the reason it legitimately differs.',
  );
});

test('esModuleInterop is set nowhere in the family', () => {
  const sites = optionSites();
  assert.equal(
    sites.esModuleInterop,
    undefined,
    'esModuleInterop must not be set. `moduleResolution: "bundler"` implies\n' +
      'allowSyntheticDefaultImports, and `noEmit: true` retires the emit half, so\n' +
      'it is inert on TypeScript 5.x. TypeScript 6 deprecates `false` (TS5107) and\n' +
      '7 removes it (TS5108), so the option is becoming unconditional. Setting it\n' +
      'to `true` is harmless but misleading; setting it to `false` breaks on 6+.',
  );
});

test('every variant inherits bundler resolution and noEmit from base', () => {
  const base = JSON.parse(readFileSync(join(DIR, 'base.json'), 'utf8')).compilerOptions;
  assert.equal(base.moduleResolution, 'bundler');
  assert.equal(base.noEmit, true);

  for (const file of variants.filter((f) => f !== 'base.json')) {
    const parsed = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    const options = parsed.compilerOptions ?? {};
    if ('moduleResolution' in options && options.moduleResolution !== 'bundler') {
      assert.fail(
        `${file} overrides moduleResolution to "${options.moduleResolution}". ` +
          'That reinstates the need for esModuleInterop, because ' +
          'allowSyntheticDefaultImports is no longer implied -- see TS1259.',
      );
    }
  }
});
