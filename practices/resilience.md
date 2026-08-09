# Resilience

Implements `ENG-LOCAL-004`, `ENG-WEB-002`, and `ENG-INT-001`–`ENG-INT-005`. This
guide adds no rules.

## Degrade, do not throw (`ENG-LOCAL-004`, `ENG-INT-001`)

An optional dependency that fails must not take down the path that did not need
it. The technique that has worked across the product repositories is to make the
boundary **return the failure as a value** rather than let it propagate as an
exception.

```ts
export type ConnectorResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'failed'; error: string };

export async function runConnector<T>(
  id: string,
  run: () => Promise<T>,
): Promise<ConnectorResult<T>> {
  try {
    return { status: 'ok', data: await run() };
  } catch (error) {
    // Recorded against this connector alone. Siblings and the local data
    // path are unaffected.
    return { status: 'failed', error: describe(error) };
  }
}
```

Three properties make this structural rather than aspirational:

1. The registry — not each call site — owns the `try`. A caller cannot forget it.
2. The failure is typed, so the caller must handle it to type-check.
3. A test registers a throwing connector and asserts the siblings still resolve.

## Never put an optional service on the critical path (`ENG-LOCAL-004`)

Core flows complete with **zero external configuration**. No account, no
provider handshake, no network. A missing optional service produces explicit
local behavior — never a hang, and never a false success.

Assert it directly:

```ts
test('core flow completes with no network', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  await captureItem({ title: 'works' });
  expect(await readItems()).toHaveLength(1);
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

## Detect capabilities before use (`ENG-WEB-002`)

Browser APIs vary by browser, permission, and runtime resource — independently of
what the application intends. Feature-detect, then keep a safe baseline:

```ts
const canPersist =
  typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function';
```

Test each optional API **disabled**, and assert the core path still completes and
durable state is uncorrupted. An enhancement that fails must not block unrelated
work.

## Surface failure, never swallow it (`ENG-INT-002`, `ENG-LOCAL-001`)

Returning a failure as a value is not the same as ignoring it. A durable-write
failure must reach the user; a metadata-refresh failure sets a status flag the UI
can render. Reporting a success the system did not achieve is the one outcome
this practice exists to prevent.

Studio owns how these states are worded and presented. Engineering owns only
that a distinguishable state exists and is reachable.

## Bound every fallible call (`ENG-INT-003`, `ENG-WEB-003`)

Every network or IPC call carries a timeout and a progress signal. An operation
with neither is indistinguishable from a hang, and no amount of retry logic
fixes an unbounded wait. Retries use backoff and are capped; a retry loop
without a cap is an outage amplifier.
