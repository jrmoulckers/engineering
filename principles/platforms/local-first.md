# Local-first systems

## Local durable ownership

- ID: ENG-LOCAL-001
- Status: Draft
- Statement: Treat the device's durable store as the system of record, persist before reflecting success, and keep portable data exportable.
- Rationale: Local-first behavior is a trust contract only when core work and user-owned data survive network and account loss.
- Evidence: Offline tests complete core writes and full portable-data export; durable-write failures are surfaced; portable and device-local data are distinct in types and storage.
- Owner and ratification: Engineering owns this Draft's local persistence and ownership mechanism; only the repository owner may change it to Ratified.
- Handoff: Reference Product for required local outcomes and Studio for write-failure and export UX; reference `jrmoulckers/.github` only for repository or fleet sync, not product-data sync.
- Legacy inputs: `studio-legacy:local-first:1`

## Optional sync seam

- ID: ENG-LOCAL-002
- Status: Draft
- Statement: Put product-data sync behind one narrow provider contract without making core local operation wait for an account, provider, or network.
- Rationale: Sync is an optional replication layer, not the authority for local-first data.
- Evidence: Core reads and writes pass with the provider absent; provider contract tests cover upload, download, retry, and unavailable states; local data remains authoritative.
- Owner and ratification: Engineering owns this Draft's product-data sync seam; only the repository owner may change it to Ratified.
- Handoff: Product decides whether sync is offered, Studio owns sync UX, and `jrmoulckers/.github` owns repository and fleet synchronization only.
- Legacy inputs: `studio-legacy:local-first:2`

## Declared conflict model

- ID: ENG-LOCAL-003
- Status: Draft
- Statement: Declare and test ordering, tombstone, concurrency, and merge rules for every synchronized data type.
- Rationale: Implicit conflict behavior loses data unpredictably and cannot be reasoned about during offline edits.
- Evidence: Conflict fixtures cover concurrent create, update, delete, replay, and clock-order cases; merge results satisfy documented invariants.
- Owner and ratification: Engineering owns this Draft's local-first conflict mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable domain outcomes and Studio owns conflict-resolution UX; Engineering defines only the data behavior.
- Legacy inputs: `studio-legacy:local-first:3`

## Zero-config safe degradation

- ID: ENG-LOCAL-004
- Status: Draft
- Statement: Start core local operation with zero external-service configuration and degrade unavailable optional services to explicit local behavior.
- Rationale: Optional dependencies must not block local ownership or turn an unavailable service into data loss or false success.
- Evidence: Zero-config tests complete core flows; unavailable-service tests preserve writes, avoid false success, and require no account or provider handshake.
- Owner and ratification: Engineering owns this Draft's local degradation and configuration mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines acceptable degraded outcomes, Studio owns offline and unavailable-service UX, and `jrmoulckers/.github` owns deployment automation.
- Legacy inputs: `studio-legacy:local-first:4`
