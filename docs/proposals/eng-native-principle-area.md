# Proposal: `ENG-NATIVE-*` principle area

<!-- check-citations: allow-unknown ENG-NATIVE-001 ENG-NATIVE-002 ENG-NATIVE-003 ENG-NATIVE-004 -->

- Status: Proposed — not Ratified, not in force, and deliberately outside `principles/`.
- Requested by: the `finance` repository during centralized-practice adoption.
- Decision record:
  [`docs/architecture/0001-native-platform-principle-area.md`](../architecture/0001-native-platform-principle-area.md)

This file is a **proposal only**. Nothing here binds any repository. The four principles below are
written in the exact catalog format so that ratification is a file move plus a manifest update
rather than a rewrite, but they carry `Status: Draft` and live outside the sealed `principles/`
tree. Only the repository owner may ratify them.

## The gap, as measured

The catalog holds 66 Ratified principles across 11 areas. Five are platform areas: `API`, `WEB`,
`DATA`, `INT`, `LOCAL`. **None of them covers a native application surface.** `WEB` is explicitly
browser-framed in all four of its principles — "browser code", "optional browser capabilities",
per-route delivery budgets, and "assets beneath a running session".

Grepping the entire principles corpus for
`mobile|Android|iOS|desktop|Kotlin|Swift|multiplatform|native|app store` returns **three lines, all
in one principle**:

```
principles/assurance/performance.md:69  ## Platform-native profiling
principles/assurance/performance.md:73  - Statement: Profile suspected bottlenecks with the
                                          platform-native tool ...
principles/assurance/performance.md:11  - Handoff: ... Studio supplies UI-specific measurement ...
```

That is the shape of the problem rather than a coincidence. `ENG-PERF-007` **obliges** engineers to
profile with the platform-native tool, but there is no platform area in which a native surface has
any other obligation at all. The catalog demands native evidence from a platform it does not
otherwise acknowledge.

The reporting repository ships four platforms, three of them native, so **one of its four surfaces
is addressed by a platform area**.

## Why not extend `WEB`

Rejected. `WEB`'s four principles are not incidentally browser-flavored; their mechanisms are
browser mechanisms. `ENG-WEB-001` reasons about what is delivered to and accepted by a browser, and
`ENG-WEB-004` about replacing assets beneath a running session. Widening them either dilutes those
statements into vagueness or silently changes the meaning of principles that seven repositories
already cite. Both outcomes are worse than a new area.

## Why these four

Each proposed principle covers a mechanism that **has no analogue** in the existing catalog. Where
an existing principle is close, the boundary is stated explicitly so the areas do not overlap.

| Proposed         | Mechanism                                                    | Nearest existing             | Why it does not cover this                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-NATIVE-001` | Release through a third-party gate                           | `ENG-BUILD-*`                | Build and release assume the publisher controls the release. A store review queue is an external actor that can reject, delay, or refuse a rollback.                                                                                               |
| `ENG-NATIVE-002` | OS-initiated process death and background limits             | `ENG-WEB-004`                | Session-safe frontend state assumes a session ends when the user ends it. An operating system can terminate a native process mid-write without warning.                                                                                            |
| `ENG-NATIVE-003` | Platform-mediated permissions and on-device secret storage   | `ENG-WEB-002`, `ENG-SEC-001` | Capability-safe enhancement concerns absence at call time; native permissions can be **revoked mid-session**. `ENG-SEC-001` keeps secrets out of source and clients but says nothing about the platform keystore a native client must use instead. |
| `ENG-NATIVE-004` | Declared support floor across OS versions and device classes | `ENG-PERF-007`               | Gives the native profiling obligation a surface to attach to: profiling "the platform" is undefined until the supported platforms are named.                                                                                                       |

## Proposed catalog content

Proposed path on ratification: `principles/platforms/native-app.md`, prefix `NATIVE`.

---

# Native applications

## Store-gated release

- ID: ENG-NATIVE-001
- Status: Draft
- Statement: Treat an external distribution gate as an unremovable release dependency and keep a supported version floor that can be raised without a client update.
- Rationale: A third party can delay or reject a release, and a shipped client cannot be recalled from a device that never updates.
- Evidence: Release plans record review latency and rejection handling; a server-enforced minimum supported version is exercised by a test that refuses an expired client; rollback procedures state what cannot be rolled back.
- Owner and ratification: Engineering owns this Draft's distribution-gate and version-floor mechanism; only the repository owner may change it to Ratified.
- Handoff: Product decides supported-version policy and end-of-life timing; Studio owns the update and forced-upgrade experience, and `jrmoulckers/.github` owns release automation and signing material.
- Legacy inputs: none

## Interruption-safe application lifecycle

- ID: ENG-NATIVE-002
- Status: Draft
- Statement: Treat operating-system suspension, background limits, and process termination as expected events that never lose acknowledged work.
- Rationale: A native process can be suspended or killed without notice, so durability cannot depend on the application continuing to run.
- Evidence: Tests terminate the process mid-operation and restart it; acknowledged work survives or is retried exactly once; background tasks tolerate deferral and cancellation without corrupting durable state.
- Owner and ratification: Engineering owns this Draft's lifecycle and durability mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines which operations must be acknowledged as durable; Studio owns restore and in-progress presentation, and `jrmoulckers/.github` owns automation for the device matrix these tests require.
- Legacy inputs: none

## Platform-mediated capability and secret custody

- ID: ENG-NATIVE-003
- Status: Draft
- Statement: Resolve permissions and secret storage through the platform's own mechanisms and preserve a safe baseline when a permission is denied or revoked after it was granted.
- Rationale: A native client holds durable credentials on a device it does not control, and a granted permission can be withdrawn between one launch and the next.
- Evidence: Secrets and tokens are held in the platform keystore rather than application files or backups; tests revoke each permission after grant; core paths still complete or degrade without data loss or repeated prompting.
- Owner and ratification: Engineering owns this Draft's permission-lifecycle and key-custody mechanism; only the repository owner may change it to Ratified.
- Handoff: Product defines which outcomes survive a denied permission; Studio owns permission rationale and denial states, and `jrmoulckers/.github` owns credential automation for signing and distribution.
- Legacy inputs: none

## Declared platform support floor

- ID: ENG-NATIVE-004
- Status: Draft
- Statement: Declare the supported operating-system versions and device classes and measure against the weakest supported configuration rather than the development machine.
- Rationale: Native performance and capability vary by an order of magnitude across supported devices, so an unnamed floor is measured by accident.
- Evidence: Supported versions and a baseline device class are recorded; `ENG-PERF-007` profiles name the device and operating-system version; regressions are triaged against the baseline configuration, not the fastest available one.
- Owner and ratification: Engineering owns this Draft's support-floor and baseline-measurement mechanism; only the repository owner may change it to Ratified.
- Handoff: Product sets the supported-device and operating-system policy; Studio owns expression on constrained displays and inputs, and `jrmoulckers/.github` owns runner and device-matrix automation.
- Legacy inputs: none

---

## What ratification would require

Adding a principle file is **not** a single-file change. The catalog is sealed by path and by
content hash, so a partial change fails validation loudly rather than landing half-applied. In
`.github/scripts/validate-principles.ps1`:

1. `$expectedPrefixes` — add `"platforms/native-app.md" = "NATIVE"`. Without this the file fails as
   an `unrecognized principle path`.
2. `$expectedCounts` — add `"platforms/native-app.md" = 4`.
3. `$expectedSemanticHashes` — add the SHA-256 of the file's semantic content, which is every line
   **except** those matching `^- Status:`, joined with `\n` and given a trailing newline.
4. Flip each `Status: Draft` to `Status: Ratified`. Catalog validation rejects `Draft`.
5. `docs/ratification/` — a new decision record. The existing record is itself hash-pinned
   (`$expectedDecisionHash`), so its catalog line and total cannot be edited in place without
   updating that constant too.
6. `principles/index.json` is generated by `scripts/build-principles-index.mjs`; regenerate it
   rather than hand-editing.

The total moves from **66 to 70**, and the area count from **11 to 12**.

Coverage is a separate obligation: `scripts/check-coverage.mjs` ratchets against
`practices/uncovered.json`, and four new IDs with no implementing guide would raise the gap count
from 7 to 11. A `practices/native-apps.md` should land with, or shortly after, ratification — the
`ENG-PERF-007` native-profiling write-up already offered by the reporting repository is a natural
first section.

## Verification performed on this draft

The four principles were checked against the real validator, run against a scratch root where
`Draft` is legal and with a temporary prefix entry so the path resolved. All eight required fields,
the ID namespace and format, the imperative-verb rule, the owner-and-ratification wording, and the
handoff-authority rules pass. The command and result are recorded in the decision record.

This proves the draft is **well-formed**, not that it is **correct**. Whether these are the right
four obligations is the owner's judgment, not the validator's.
