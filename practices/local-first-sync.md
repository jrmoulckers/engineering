# Local-first sync

Implements `ENG-LOCAL-001`–`ENG-LOCAL-004` and `ENG-DATA-001`–`ENG-DATA-003`. This guide adds no
rules.

## The device is the system of record (`ENG-LOCAL-001`)

Write to the durable local store, confirm the write, _then_ reflect success. A UI that reports
success before the durable write completes is reporting a state the system may not reach.

Sync is replication. It is never the authority.

## Record shape (`ENG-LOCAL-003`, `ENG-DATA-001`)

Every synchronized record carries the same four fields. This is the shape the product
repositories converged on independently:

```ts
interface SyncedRecord {
  id: string; // stable, client-generated, never reassigned
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms — the merge discriminator
  deleted?: boolean; // tombstone; the row is retained
}
```

## Merge model: per-entity last-writer-wins with tombstones (`ENG-LOCAL-003`)

```
merge(local, remote) = union by `id`, and for each `id` keep the higher `updatedAt`
```

Deletes are **tombstones**, not row removal. A dropped row is indistinguishable from a row the
peer has not seen yet, so the delete silently resurrects on the next sync. Retaining a `deleted`
marker is what lets peers converge.

Cascading deletes tombstone the whole subtree — the parent, its entries, its links, and its
derived stats — so a restore on another device learns the full deletion rather than reviving
orphans.

This is deliberately **not** event sourcing and **not** a CRDT. Both are valid; both cost more
than per-entity LWW buys for records a single user edits on a few devices. `ENG-LOCAL-003`
requires only that the model be _declared and tested_ — so if a repository chooses differently,
it documents and tests that choice.

## Declaring the model is not enough — test it (`ENG-LOCAL-003`)

Fixtures must cover, for each synchronized type:

| Case                              | Asserts                                           |
| --------------------------------- | ------------------------------------------------- |
| Concurrent create of distinct ids | Union keeps both                                  |
| Concurrent update of one id       | Higher `updatedAt` wins, deterministically        |
| Delete vs. concurrent update      | Documented precedence holds                       |
| Replay of the same payload        | Idempotent — no duplicates, no lost fields        |
| Equal `updatedAt`                 | Tie-break is deterministic, not insertion-ordered |

The equal-timestamp case is the one most often skipped and the one that produces
device-dependent divergence.

## One narrow provider seam (`ENG-LOCAL-002`)

All product-data sync sits behind a single contract:

```ts
export interface SyncProvider {
  pull(since: number): Promise<SyncedRecord[]>;
  push(records: SyncedRecord[]): Promise<void>;
  status(): Promise<'ready' | 'unauthenticated' | 'unavailable'>;
}
```

Contract tests cover upload, download, retry, and unavailable. Core reads and writes pass with
the provider entirely **absent** — that test is what proves sync is optional rather than merely
claimed to be.

> Repository and fleet synchronization belong to `jrmoulckers/.github`. This guide covers
> product data only.

## Portable versus device-local (`ENG-LOCAL-001`)

Keep the two distinct in types and in storage. Everything portable is exportable, in full,
offline, without an account. Device-local state — window size, last tab, ephemeral caches —
stays out of the export and out of sync.
