# Frontend layering

Implements `ENG-ARCH-001` and `ENG-WEB-004`. This guide adds no rules.

## One directed seam (`ENG-ARCH-001`)

```
components  →  stores  →  storage / API
```

The arrows are one-way, and there is no path that skips a layer.

| Layer | May do | Must never do |
| --- | --- | --- |
| Components | Read store state, dispatch store actions, render | Call `fetch`, touch `localStorage`/IndexedDB, construct a mutation |
| Stores | Own persistence, transport, mutation construction, caching | Import a component or reach into the DOM |
| Storage / API | Serialize, persist, transport | Know which view triggered the call |

A component that calls `fetch` directly makes the transport an accidental part
of the view contract: it can no longer be tested without a network, and the
retry, offline, and error behavior fragments across every call site. Keeping
the seam narrow and directional is the whole point of `ENG-ARCH-001`.

## Why this makes the test pyramid possible

The layering is what lets the domain layer stay framework-free
(see [testing](testing.md)). Logic reachable only through a mounted component
can only be tested through a component harness. Move the decision into the store
or a pure module, and the same behavior becomes a fast domain test.

## Enforce it, do not just document it

The boundary is checkable. Prefer a lint rule or an import-graph assertion over
a paragraph in a README:

```js
// eslint.config.js
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';

export default svelteConfig({
  extend: [
    {
      files: ['src/components/**', 'src/routes/**'],
      rules: {
        'no-restricted-globals': ['error', { name: 'fetch', message: 'Call the store; components never transport.' }],
        'no-restricted-imports': [
          'error',
          { patterns: [{ group: ['**/storage/*'], message: 'Components read stores, not storage.' }] },
        ],
      },
    },
  ],
});
```

## Enumerate every state (`ENG-WEB-004`)

A view contract names its states explicitly rather than inferring them from
nullable data:

```ts
export type ViewState<T> =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; data: T }
  | { kind: 'failed'; error: string };
```

`data === null` conflates "not loaded yet", "loaded and empty", and "failed" —
three states that need three different treatments. Studio owns what each one
looks like and how it is worded; Engineering owns only that each is
distinguishable and reachable.

## Activate updates at a safe boundary (`ENG-WEB-004`)

A running session stays on one asset version. Commit durable state **before**
activating a new version, and never swap assets beneath a live session — mixed
versions produce failures that cannot be reproduced from either version's source.
