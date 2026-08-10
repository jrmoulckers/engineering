import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';

import { reactConfig } from '../react.js';

const linter = new Linter({ configType: 'flat' });

const COMPONENT = `import { useState, useEffect } from 'react';
export function Widget({ id }: { id: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(id.length); }, []);
  if (n > 0) { const [x] = useState(1); return <p>{x}</p>; }
  return <img src="a.png" />;
}
`;

function lint(config, code = COMPONENT, filename = 'src/Widget.tsx') {
  return linter.verify(code, config, filename);
}

function ruleIds(messages) {
  return new Set(messages.map((m) => m.ruleId));
}

describe('react preset', () => {
  test('loads without throwing on the installed plugin versions', () => {
    assert.ok(Array.isArray(reactConfig()));
    assert.ok(reactConfig().length > 0);
  });

  test('every config entry is flat-shaped, not legacy eslintrc', () => {
    // A legacy entry declares `plugins` as an array of strings. ESLint rejects
    // the whole config at load time with an error that names no plugin, so
    // catching it here is much cheaper than catching it in a consumer.
    for (const entry of reactConfig()) {
      if (entry && Array.isArray(entry.plugins)) {
        // Only arrays reach here, so this is safe to stringify; the plugin
        // objects in a flat entry contain circular references.
        assert.fail(`found a legacy eslintrc entry with plugins: ${entry.plugins.join(', ')}`);
      }
    }
  });

  test('reports conditionally called hooks', () => {
    const ids = ruleIds(lint(reactConfig()));
    assert.ok(ids.has('react-hooks/rules-of-hooks'));
  });

  test('reports an incomplete dependency array', () => {
    const ids = ruleIds(lint(reactConfig()));
    assert.ok(ids.has('react-hooks/exhaustive-deps'));
  });

  test('reports accessibility defects', () => {
    const ids = ruleIds(lint(reactConfig()));
    assert.ok(ids.has('jsx-a11y/alt-text'));
  });

  test('still carries the base rules', () => {
    const messages = lint(
      reactConfig(),
      `const x = 1;\nif (x == '1') console.log(x);\n`,
      'src/a.ts',
    );
    const ids = ruleIds(messages);
    assert.ok(ids.has('eqeqeq'));
    assert.ok(ids.has('no-console'));
  });

  test('does not require React to be in scope', () => {
    const ids = ruleIds(lint(reactConfig()));
    assert.ok(!ids.has('react/react-in-jsx-scope'));
  });

  test('does not ask a TypeScript component for prop-types', () => {
    const ids = ruleIds(lint(reactConfig()));
    assert.ok(!ids.has('react/prop-types'));
  });
});

describe('react compiler rules', () => {
  test('are off by default', () => {
    const messages = lint(reactConfig());
    const compilerFindings = messages.filter(
      (m) =>
        m.ruleId?.startsWith('react-hooks/') &&
        !['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'].includes(m.ruleId),
    );
    assert.deepEqual(compilerFindings, [], 'compiler rules must be opt-in');
  });

  test('turn on with compiler: true', () => {
    const before = ruleIds(lint(reactConfig()));
    const after = ruleIds(lint(reactConfig({ compiler: true })));
    assert.ok(after.size > before.size, 'expected additional findings under compiler: true');
  });

  test('the opt-out set is derived, not hardcoded', () => {
    // Every rule the installed plugin ships must be either classic or disabled.
    // Hardcoding a list would silently let a future rule through.
    const entry = reactConfig().find((c) => c.rules?.['react-hooks/rules-of-hooks']);
    assert.ok(entry);
    for (const [name, level] of Object.entries(entry.rules)) {
      if (!name.startsWith('react-hooks/')) continue;
      const classic = ['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'].includes(name);
      if (!classic) assert.equal(level, 'off', `${name} should be off by default`);
    }
  });
});

describe('option passthrough', () => {
  test('applies rule overrides last', () => {
    const config = reactConfig({ rules: { eqeqeq: 'off' } });
    const ids = ruleIds(lint(config, `const x = 1;\nif (x == '1') { }\n`, 'src/a.ts'));
    assert.ok(!ids.has('eqeqeq'));
  });

  test('appends caller ignores', () => {
    const config = reactConfig({ ignores: ['generated'] });
    assert.ok(config[0].ignores.includes('generated'));
  });

  test('appends caller extend entries last', () => {
    const marker = { rules: { 'no-debugger': 'off' } };
    const config = reactConfig({ extend: [marker] });
    assert.equal(config.at(-1), marker);
  });
});
