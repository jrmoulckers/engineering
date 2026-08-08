# Local-first systems

- ID: ENG-LOCAL-001
- Status: Draft
- Statement: Make local durable ownership primary and keep sync, conflict resolution, and external services explicit optional layers.
- Rationale: Local-first behavior is a trust contract: users must retain useful operation and ownership when networks, accounts, or providers are unavailable.
- Evidence: Offline tests complete core writes and exports; durable-write failures are surfaced; portable and device-local data are separated; sync providers satisfy one narrow contract; conflict fixtures verify the declared merge model; optional services have tested degraded behavior.
- Owner and ratification: Engineering owns this Draft's local persistence, sync seam, conflict, and degradation mechanisms; the repository owner alone may ratify it.
- Handoff: Product defines which capabilities and data must remain available, Studio owns conflict/error/offline UX, and `jrmoulckers/.github` owns repository or fleet synchronization rather than product data sync.
- Legacy inputs: `studio-legacy:local-first:1`, `studio-legacy:local-first:2`, `studio-legacy:local-first:3`, `studio-legacy:local-first:4`, `studio-legacy:security:7.1`

## Rule

- Treat the device's durable store as the system of record for local-first data; persist before reflecting success and surface write failures.
- Separate portable data from device-local state in the type and storage model, and support complete user-controlled export of portable data.
- Put optional sync behind one narrow provider contract; local operation must not require an account or reachable service unless Product explicitly requires it.
- Declare and test the conflict model, including ordering, tombstones, concurrency checks, and merge invariants.
- Degrade unavailable optional services to an explicit local behavior without discarding writes or presenting false success.
- Fail production preflight when security-critical configuration is absent or malformed; optional-service degradation must not weaken a trust boundary.
