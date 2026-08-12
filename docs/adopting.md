# Adopting Engineering practice

How a repository consumes this one. Three layers, adopt in order.

| Layer                                           | What you get                         | Transport                                       |
| ----------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| [Principles](../principles/README.md)           | 66 ratified `ENG-*` rules + evidence | Cite by ID; resolve via `principles/index.json` |
| [Practices](../practices/README.md)             | Technique for satisfying them        | Link by URL                                     |
| [Packages](#2-install-the-shared-configuration) | Executable enforcement               | GitHub Packages                                 |

## Start here: find your symptom

**This guide is long and six consumers have re-derived answers that were already in it.** That is a
failure of this document, not of the people reading it — so before reading linearly, search for your
symptom. Every phrase below is a literal string in this file; search for it rather than scrolling.

| What you are seeing                                          | Search for                                               |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| CI fails instantly, no logs, `startup_failure`               | `read the annotation, do not infer`                      |
| `strictTypeChecked` produced hundreds of findings            | `billing you for two unrelated`                          |
| `401` on install from Vercel/Netlify/Fly but CI is green     | `applies to GitHub Actions only`                         |
| A red check you already know about hides a new failure       | `has stopped being a check`                              |
| Wondering if an extra `permissions:` scope is harmful        | `Under-granting kills the run`                           |
| Every job fails with `steps=0`, any duration                 | `The permission ceiling and the billing hold`            |
| A version bump seems to change nothing                       | `Diffing the increment is not verifying the floor`       |
| `--print-config` shows rules for a framework you do not use  | `Grep the severity, not the name`                        |
| `npm update` will not take a new minor                       | `Do not use a caret at all`                              |
| Want to know if your pins are stale without a registry token | `Check your pins mechanically`                           |
| A base64-decoded file is corrupt on Windows                  | `WriteAllBytes`                                          |
| A Node script exits `0xC0000409` after a `fetch`             | `UV_HANDLE_CLOSING`                                      |
| `warn` rules are failing your build                          | `A warn severity is not advisory under`                  |
| `TS7016` on a config file after enabling `checkJs`           | `Precondition 1: the config file must be`                |
| Type declarations appear to do nothing                       | `Precondition 2:`                                        |
| A valid, documented option is rejected as unknown            | `silently overrides the package's shipped types`         |
| A citation link works but lands at the top of the file       | `cannot 404, so retitling a heading`                     |
| Unsure which version of a package is actually installable    | `a repository counter, not a package version`            |
| A "bogus option" check says a typed package has no types     | `does not work on every package`                         |
| Two measurements of one file's size disagree slightly        | `A character count is not a byte count`                  |
| Lint went green after swapping a meta-package for its plugin | `Dropping a meta-package for the plugin it wraps`        |
| `pnpm` refuses a just-published version                      | `minimumReleaseAgeExclude`                               |
| `TS5097` / `TS5096` on `.ts` import specifiers               | `allowImportingTsExtensions`                             |
| Lint is green but you suspect coverage shrank                | `set of files linted, in both directions`                |
| Your finding count **dropped** after a version bump          | `look in your test files before assuming`                |
| Unsure which before/after comparison to trust                | `Prefer measuring the artifact over reasoning`           |
| Go: a wall of `errcheck` findings that CI does not report    | `Compare the set of findings, not the set of rules`      |
| A rule you expected to fire never fires                      | `A clean `rules-of-hooks` run is not proof of absence`   |
| Package install returns `401`/`403`                          | `Visibility changes _authorization_, not authentication` |
| Told adoption is blocked on package access                   | `re-test before deferring further`                       |

**If your symptom is not here, say so when you report it.** A report that this guide lacks something
it already contains is still useful — it means the answer is unfindable, which is the same defect as
missing. Both get fixed here.

## 1. Cite principles by ID

Replace restated rules with a citation. Under
[.github ADR-0003](https://github.com/jrmoulckers/.github/blob/main/docs/architecture/0003-four-authority-topology.md),
no authority may copy another's normative text — a copy drifts and hides who owns the rule.

```diff
-## Sync rules
-
-Deletes are tombstones. Records are retained so clients converge, and merges
-take the newest `updatedAt` per record.
+## Sync rules
+
+Merge behaviour follows `ENG-LOCAL-003` (declared conflict model). See
+[local-first sync](https://github.com/jrmoulckers/engineering/blob/main/practices/local-first-sync.md).
+
+Docket-specific: the mutation log is server-authoritative (ADR-0003), so
+`updatedAt` ties break toward the server sequence.
```

Keep whatever is genuinely product-specific. Delete only what restates a rule this repository
already owns.

**A citation replaces prose. If there is no prose, do not add one.** A principle can apply to your
repository and still be the wrong thing to cite. One consumer found `ENG-WEB-003` (measured
foreground performance) genuinely satisfied — `bundle-budgets.json`, a budget script, Lighthouse in
CI — and deliberately did not cite it, because nothing in their docs restated the rule. It was
enforced by configuration, not narrated. With no duplicated text to remove, the citation would have
been decoration.

That is the right instinct and it is the test to apply: **citations exist to delete a copy, not to
demonstrate coverage.** Adding IDs to documents that never claimed the rule inflates apparent
adoption while removing nothing, and it makes the citations that _are_ load-bearing harder to find.
A repository that satisfies a principle in config and says nothing about it is already compliant.

**Resolve every ID against `index.json` before citing it — including IDs handed to you.** The same
consumer was sent a brief containing three incorrect ID-to-title pairings and hit none of them,
because they looked each one up rather than trusting the label. Two other repositories took the
labels at face value and cited the wrong principles. A wrong citation is worse than a missing one:
it reads as deliberate and survives review, because reviewers check that the ID exists far more
often than they check that it means what the sentence claims.

`principles/index.json` resolves any ID to its title, statement, status, and source path:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-003") | .statement'
```

## 2. Install the shared configuration

There are **two delivery channels**, and which one you use is decided per package, not per
repository. Most repositories will use both.

| Package                        | Channel            | Why                                                                    |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------- |
| `@jrmoulckers/tsconfig`        | **registry (npm)** | pure JSON, no runtime dependencies                                     |
| `@jrmoulckers/prettier-config` | **registry (npm)** | dependency-free ES modules                                             |
| `@jrmoulckers/eslint-config`   | **registry (npm)** | depends on four packages at runtime that a consumer must not re-choose |

> **Correction, and this repository's most costly error to date.** `tsconfig` and
> `prettier-config` were documented here — and recorded in `versions.json` — as **vendored at a
> ref: never published, no token required, adopt them while blocked**. That was false. All three
> packages are `private: false`, and `publish.yml` publishes every directory under `packages/`
> unconditionally without consulting `channel`, so all three have been on the registry the entire
> time and all three require a token.
>
> Three repositories were told they were unblocked on two packages that return `403
permission_denied: read_package`, and one of them proved it with a real CI run naming
> `@jrmoulckers/tsconfig/0.2.0`. **All three packages are gated on the same visibility grant.**
>
> The detail worth carrying: the contradicting evidence was in this repository's own CI output on
> every run. `versions:check` prints `versions.json matches the registry for 3 of 3 package(s)` —
> which is only possible if all three are on the registry — and that line was repeatedly quoted as
> confirmation the file was correct. A check can be passing, accurate, and read as proof of the
> opposite of what it says. `scripts/test/versions-channels.test.mjs` now asserts that a channel
> claiming `requiresRegistryAuth: false` is backed by a package with `private: true`, so the
> declaration cannot drift from what `publish.yml` actually does.

The split exists because **GitHub Packages authenticates every read, including reads of a public
package.** Putting the scope in the install path therefore requires every contributor — and, for a
self-hosted product, every self-hoster — to mint a token before `install` succeeds. That is a real
onboarding regression, and package visibility does not fix it: visibility changes authorization,
not authentication.

So the registry is used only where it earns its cost. `eslint-config` depends on `@eslint/js`,
`typescript-eslint`, `eslint-config-prettier` and `globals` at runtime. Vendoring its source would
hand those four version choices back to every repository, which is precisely the drift the shared
layer exists to remove. `tsconfig` and `prettier-config` have no such dependencies and can simply
be copied in.

If your repository has no ESLint dependency at all — a Go service, a docs site — you need no
registry access whatsoever.

#### Self-hosted products: the production install needs no token

The table above leaves one gap, and a self-hosted product is where it shows. `eslint-config` is a
`devDependency`, so it is absent from a production install tree — but a self-hoster who runs a bare
`npm ci` still resolves it and still gets a `401`. Document the production install explicitly:

```bash
npm ci --omit=dev
```

With `--omit=dev`, nothing scoped is requested, so **a person deploying your product never mints a
token.** Only contributors do, and only for lint. This is the same mechanism that makes a
production-scoped `npm audit` succeed while an install fails in the same run.

Combined with vendoring `tsconfig` and `prettier-config`, the result is that a clone builds and runs
with no credential anywhere: the two configs a build needs are committed files, and the one package
that requires the registry is never reached outside a contributor's machine.

### Vendoring — no token required

Fetch the script once, then run it with the tag you want to pin:

```bash
mkdir -p scripts

# <latest-tag> is a placeholder, not a version. Pin the newest release:
#   gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name
REF=<latest-tag>

curl -fsSL \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/scripts/vendor-configs.mjs" \
  -o scripts/vendor-configs.mjs

node scripts/vendor-configs.mjs "$REF"
```

Commit the fetched files, `engineering-configs.lock.json`, and the script. Refreshing is the same
command with a newer tag, which makes an upgrade a reviewable diff.

**Vendor at `v0.112.0` or newer.** That is the first tag where `prettier-config` ships its type
declarations, and the vendored set includes them. Earlier refs fail loudly with the floor named
rather than writing a partial set:

```
error: .../packages/prettier-config/index.d.ts returned HTTP 404
       Declarations ship from v0.112.0 onward. Ref 'v0.15.1' predates them; vendor a newer tag.
```

One consumer reached `v0.15.1`, then `v0.15.2`, then `v0.15.3` from illustrative snippets in this
guide and from version literals carried forward by hand — three sub-floor refs in a row. **Every
ref in this document is an example, not a recommendation.** Resolve the tag rather than copying
one, and check the floor as well as the shape:

```bash
REF=$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)
case "$REF" in v[0-9]*.[0-9]*.[0-9]*) ;; *) echo "not a semver tag: $REF" >&2; exit 1 ;; esac

# A shape check alone accepts v0.15.3, which predates the declarations.
MIN=v0.112.0
if [ "$(printf '%s\n%s\n' "$MIN" "$REF" | sort -V | head -1)" != "$MIN" ]; then
  echo "resolved $REF is below the $MIN vendoring floor" >&2; exit 1
fi
```

`sort -V`, not `sort`: a lexical sort puts `v0.99.0` above `v0.115.0`, so the naive form picks a
tag nearly a hundred releases old and still looks like it resolved something.

The declarations are not cosmetic for a vendoring consumer, and the precondition is the opposite of
the one most people assume. **The trigger is `allowJs: false`, not `checkJs`** — and `allowJs` is
false by default, which `@jrmoulckers/tsconfig` leaves alone. Measured both ways on a vendored tree:

| `allowJs` | Declarations | Result                                          |
| --------- | ------------ | ----------------------------------------------- |
| `false`   | present      | `tsc` exits 0                                   |
| `false`   | removed      | **TS7016**, config implicitly `any`             |
| `true`    | present      | exits 0                                         |
| `true`    | removed      | exits 0 — TypeScript reads the `.js` and infers |

So a repository that happens to enable `allowJs` cannot reproduce the failure, and one that does not
hits it on the first import. If you are chasing TS7016 on a vendored config, check `allowJs` before
anything else.

Vendoring normally trades away the one thing a registry gives you — a version signal — so this
deliberately keeps it. The lock file records the ref and the SHA-256 of every file, the fetched
files are written **byte-identical** to source with no generated header, and a re-run at a
different ref reports how many files actually changed:

```
Vendored 11 file(s) from jrmoulckers/engineering@v0.115.0 into config/engineering/
Ref moved v0.112.0 -> v0.115.0; 0 file(s) changed content.
```

That `0` is real output, not a placeholder: no vendored file has changed content since the
`v0.112.0` floor. It is the number worth having — it says a refresh across three releases was safe
without reading a diff, and it is the same question a Go consumer had to answer by hashing nine
files by hand.

A file the previous lock never recorded is reported as **newly tracked**, not as changed. Counting
it as changed would overstate the diff exactly when `--dest` or `--set` moved, which is when the
number is read most closely.

#### Vendoring copies files, not the package around them

The `prettier` set writes an extra `package.json` containing exactly `{ "type": "module" }`, so
that set emits **five** files rather than four. It is not padding, and it is the least obvious
failure in this document.

The published package declares `"type": "module"`. Vendoring copies the config files and leaves
that declaration behind, so in a consumer whose root `package.json` has **no `type` field** the
vendored files are nominally CommonJS — and `export default` is a syntax error. Node ≥22.7 hides
this by retrying a failed CommonJS parse as ESM, and says so:

```
[MODULE_TYPELESS_PACKAGE_JSON] Warning: … doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected.
```

**On a runtime without that fallback it is a hard `SyntaxError`, raised at the tool** — Prettier,
ESLint, whatever loaded the config — far from the vendoring step that caused it, and with a message
that says nothing about vendoring.

Three things make this worth stating rather than just fixing:

- **It is invisible to the hash check.** Every vendored file can be byte-identical to upstream and
  individually correct, the lock can verify clean, and the result still does not load. Hashes
  answer "are these the right bytes", never "is this a loadable package".
- **The marker is inside the lock.** A consumer who fixes this by hand — the natural response — puts
  a file next to the vendored tree that nothing hashes, nothing checks, and a repo-wide format or a
  stale-file cleanup can silently change or remove.
- **The declared type is verified against the ref at vendor time**, not trusted. A marker that
  confidently states the _wrong_ module type is worse than no marker, because it overrides the
  runtime's own detection: it converts a runtime that would have coped into one that cannot.

A JSON-only set like `tsconfig` gets no marker; JSON has no module semantics.

#### A key-by-key config comparison scores structural additions as zero

A consumer compared their `.prettierrc.json` against the shared config key by key, found all seven
scalars byte-equivalent, and recorded the adoption as a **verified zero-file no-op**. Adopting it
for real changed **5 files and 48 lines**.

The shared config carries an eighth thing no key comparison looks at: an `overrides` block setting
`printWidth: 96` for `*.md`. They had no markdown override at all, so markdown moved 100 → 96.

`overrides`, `ignores`, and file globs are all invisible to a comparison that walks top-level keys,
and this is the same blind spot as [the preset linting a different set of files than yours
did](#the-preset-lints-a-different-set-of-files-than-yours-did), one level up.
`prettier.resolveConfig()` per file type answers it directly, and so does a real run.

The general rule, which cost two consumers separately:

> **A simulated invocation is not evidence about the gate.** Measure through the command CI actually
> runs, after wiring — not through a reconstruction of what you believe it will do.

Their result is also a clean demonstration that `proseWrap: 'preserve'` does what it claims: of
those 48 lines, **all 48 were fenced code blocks. Not one line of prose moved, and no table moved.**
The width change is live for fences and tables and inert for prose.

**One wiring trap, which will hit every consumer that has one:** a `.prettierrc.json` **outranks**
the `prettier` field in `package.json`. Leave the old file in place and the repository looks adopted
while the previous config is silently still in force — and the gate stays green, because the old
config also passes. Delete it in the same change.

#### Vendor in the change that adopts, not before it

[engineering ADR-0001](architecture/0001-two-channel-config-delivery.md) says which packages are
vendored. It does not say _when_, and the obvious reading — fetch
both sets at once, since the token barrier is gone — is wrong.

A vendored config that nothing `extends` extends nothing: it fails no gate, is exercised by no CI,
and drifts against upstream invisibly. Worse, `--check` will happily report it clean forever, which
reads as coverage.

One consumer deliberately vendored `prettier` and **not** `tsconfig`, because their tsconfig
adoption is deferred on evidence (2,691 diagnostics) and removing the _access_ barrier does not
remove the _migration_ cost. That is the correct call. Vendor a set in the pull request that starts
using it.

#### The lock covers the script too

`--check` verifies the vendored configs **and the script that produced them**. The lock carries a
`tool` entry recording the script's own SHA-256:

```json
"tool": {
  "source": "scripts/vendor-configs.mjs",
  "path": "scripts/vendor-configs.mjs",
  "sha256": "…"
}
```

This closes an asymmetry that was silent in one direction. Reformat a vendored config and every
hash breaks loudly. Reformat **the script** and nothing broke at all: it forked from the upstream
copy it exists to reproduce, and the only thing that would have caught it is the byte comparison
the reformat had already corrupted. Prettier-ignoring the script works, but it is a convention a
consumer can forget, and the failure is invisible when they do — so the lock enforces it instead.

Two different questions, answered in two places:

- **`--check`** compares the script against the hash recorded **when you vendored**. It answers
  "has anything changed since?" and never fires for a consumer deliberately running a newer tool.
- **Vendor time** compares the script you ran against the script at the ref, and warns if they
  differ. Your configs are still correct — they come from the ref, not from the script — but a fix
  present upstream may be missing locally.

Locks written before this existed have no `tool` key and still pass; the next refresh adds it. A
`tool` key that is present but unusable **fails**, because absent and unusable are different states
and only one of them was a decision.

Raised by an adopter who noticed the script was the one fetched artifact its own lock did not cover.

#### Evaluating a new ref without committing to it

To see what a ref would change before adopting it, vendor it to a scratch directory:

```sh
node scripts/vendor-configs.mjs v0.115.0 --dest "$(mktemp -d)"
```

**A `--dest` outside the working directory writes no lock file at all.** It reports what changed and
stops there. That is deliberate, and it is a bug fix: the lock's keys are read relative to the
directory it sits in, so a lock describing a scratch tree describes nothing in your repository.
Earlier versions wrote it anyway, which replaced the real lock with absolute scratch paths and left
`--check` reporting

```
8 vendored file(s) match engineering-configs.lock.json at v0.15.4.
```

while examining **no repository file at all**. A hand-edited vendored file passed. The evaluation
command recommended here disarmed the guard that exists to catch exactly that, and it did so
silently — on the machine that ran the probe, every absolute path still resolved, so nothing looked
wrong until CI failed with `missing` on paths no runner has.

If you already committed such a lock, `--check` now **rejects it by the shape of its keys** rather
than passing or blaming a missing file:

```
error: engineering-configs.lock.json records 10 path(s) outside /repo
```

Re-run without `--dest` to fix it. Reported by an adopter who ran the probe exactly as documented.

Because the files are byte-identical, `git diff` after a refresh shows upstream's change and
nothing else, and local drift shows up as a diff against the recorded hash.

Three failure modes are fatal, and **nothing is written until every file passes all three** — a
partial write is worse than a failed one, because the tools would then run against a mix of refs
and report success:

1. a non-200 response, naming the ref so a bad tag is obvious;
2. an empty body;
3. a 200 carrying the wrong payload. This is the one that matters. An HTML error page or a
   redirect landing page arrives with status 200, and a config file that parses as nothing lints
   nothing while reporting success. JSON must parse _and_ carry `compilerOptions`; a module must
   actually export something.

Point it at a tag rather than a branch. A branch ref will resolve, but it re-points under you and
the lock file then records a name rather than a state.

#### Enforce the lock in CI, and warn about staleness without failing

`--check` verifies the vendored tree still matches the lock, then reports whether a newer release
exists. It takes no ref — the lock is the source of truth for what you pinned:

```yaml
- run: node scripts/vendor-configs.mjs --check
```

The two outcomes deliberately differ in severity:

- **Drift fails.** A vendored file that was edited by hand, or has gone missing, is a local
  integrity problem — the config no longer matches what the lock claims, so "verified at ref X"
  stops meaning anything. Without this, vendoring quietly reintroduces the drift the registry
  channel prevents, which is [engineering ADR-0001](architecture/0001-two-channel-config-delivery.md)'s main
  cost. This closes it.
- **Staleness only warns**, and exits 0:

  ```
  Notice: pinned at v0.114.0; newest release is v0.115.0, 1 release(s) newer.
  2 of 8 vendored file(s) would change.
  This is not a failure. Update deliberately when you choose to:
    node scripts/vendor-configs.mjs v0.115.0
  ```

  The **count** is there because four repositories read a two-line version comparison and stayed
  where they were. `v0.15.4` and `v0.115.0` read as neighbours — they differ by one character —
  and "this is not a failure" made a **116-release** gap sound like a decision someone had made.
  `116 release(s) newer` cannot be skimmed that way. If the count cannot be established it is
  omitted rather than guessed, and a full page reports `at least N` rather than a wrong total.

  **The notice is silent when a newer release would change nothing you vendor.** A tag here
  advances for docs, ADRs and CI edits that touch no vendored file. An adopter measured six
  consecutive releases across which **0 of their 8 files** changed, and were told they were stale at
  every one. A signal that always fires stops being read — and the habituated ignore then covers the
  release that mattered, so a notice that cries wolf is worse than none. `--check` therefore
  compares the **bytes at the newer ref**, not just the tag, and answers the question you actually
  have: _would my config change?_

  Two properties of that silence are worth knowing, because both are places this could have gone
  wrong:

  - **Silence means "compared, nothing differs" — never "the comparison failed."** If any file at
    the newer ref cannot be fetched, the notice speaks and says the result is unknown, explicitly
    disclaiming that it is evidence either way. A check whose failure mode is silence reads as
    success, which is the defect this repository has now found three separate times in its own
    verifying machinery.
  - **A file _added_ upstream is invisible to a file-by-file comparison.** Every file you already
    have matches, and you are silently missing the new one. The set of files is defined by the
    vendoring script, so the script is compared too: if it changed at the newer ref, the notice says
    so and tells you the file set may have changed — a case where `0 of N differ` is true and
    misleading.

  The vendor-time notice, by contrast, still fires on any newer tag. That difference is deliberate:
  `--check` runs on every CI build, so a nag across irrelevant releases is seen hundreds of times
  and learned as noise. Vendoring runs once, in a session where someone has just typed a ref by hand
  and can still cheaply correct it — which is exactly when a newer release is worth an interruption
  whatever its contents.

**A checker validates its input before it trusts it.** Two adopters arrived at the same rule from
opposite directions, and it is the single most useful thing to know about `--check`: assert the
lock parses, records files, and carries a usable ref **before** comparing any hashes. A checker
that cannot read its input and reports "no drift" holds a state indistinguishable from clean,
forever. `--check` therefore refuses an empty file list and a missing, empty, or non-string `ref`,
naming what it found — the ref because every remediation message interpolates it, so an unvalidated
one produces advice like `node scripts/vendor-configs.mjs` with nothing after it: a command that
cannot work, printed with confidence at the moment someone is already confused.

**Wire it into a command that already runs, or it will not run.** A check people have to remember
has the reliability of not having one:

```json
{
  "scripts": {
    "vendor:check": "node scripts/vendor-configs.mjs --check",
    "lint": "npm run vendor:check && eslint ."
  }
}
```

Chaining it ahead of lint short-circuits: under drift it exits 1 before ESLint runs, so the first
error you see is the real one rather than a hundred confusing rule failures from a half-reverted
config. If your CI calls a shared workflow with a `lint-command` input, put the chain there.

**Never make staleness fatal, and never resolve the newest tag at fetch time.** Both convert
pinning from a decision into a default. If a tag pushed here could redden your build, the change
arrives on whichever unrelated PR happens to be open, with nothing in your history explaining it —
and the pressure is to bump the ref to get green rather than to accept the change on its merits.
The property worth protecting is that when your lint result changes, `git log` says why. Make the
pin easy to update and loud when it is stale; never automatic.

A runner that is offline or rate-limited cannot tell you about staleness, so `--check` treats an
unavailable answer as "fine" and stays silent. Drift is still checked, because that needs no
network.

**The file count is the fastest way to spot a sub-floor ref.** `--check` reports how many files it
covers, and the current set is **10**. Eight means a ref older than `v0.112.0` got in and the two
prettier declarations are missing — a more legible signal than reading the tag, because `v0.15.3`
and `v0.115.0` look similar and sort in the wrong order.

#### `releases/latest` is the most recent release, not the greatest version

If you write your own staleness check, **compare versions — do not compare for difference.**

GitHub's `releases/latest` returns the most recent non-draft, non-prerelease release ordered by
the underlying tag's date. That is not the same as the highest version. A patch backported to an
older line and published after a newer minor is reported as `latest`, so:

```sh
[ "$latest" != "$pinned" ] && echo "update to $latest"   # prompts a DOWNGRADE
```

The output is confident, plausible, and wrong, and it fires for **every consumer simultaneously** —
the first backport release turns a correct check into fleet-wide bad advice. It cannot be caught by
observing a failure, because the misleading output is shaped exactly like the correct output.

Compare with `sort -V`, or parse and compare numerically:

```sh
[ "$(printf '%s\n%s\n' "$pinned" "$latest" | sort -V | tail -1)" != "$pinned" ]
```

Two further traps in the same area. **String comparison is not version comparison** — `v0.9.0`
sorts above `v0.15.4` lexically, which is wrong, and this repository's tags have run past `v0.99.0`
so the two-digit minor case is live rather than hypothetical. And **an ordering you cannot
establish is not a staleness signal**: if either ref fails to parse, say nothing rather than
guessing, for the same reason the check exits 0 when the lookup fails.

`scripts/vendor-configs.mjs` had this defect at both call sites, and shipped with it. An adopter
found it in their own notice first and reported the mechanism.

#### The verifier is the least-tested code you run

Every recipe here asks you to run a check, and the checks have now failed more often than the
things they check. A drift checker that cannot read its lock reports no drift. A staleness notice
whose extraction fails silently names no version and still prints confidently. An install verified
on a warm cache proves nothing about a cold one. A `--print-config` diff is sound and still wrong
against a stale tree.

These share one shape: **the failure of the check presents as a successful check.** So when you add
one, test that it can _fail_ — break the input on purpose and confirm the red — before trusting a
green. A check that has never been observed failing is an assertion about your intent, not about
your repository.

#### A warm npm cache makes a token requirement disappear

If you are checking whether a change removed the need for a token, **a plain `npm ci` cannot tell
you.** npm serves packages from its local cache without contacting the registry, so any machine
that authenticated once will install cleanly with every credential removed:

```
npm ci                          # added 599 packages, EXIT=0   <- proves nothing
npm ci --cache "$(mktemp -d)"   # E401 ... authentication token not provided
```

Both results are real. The first is a **false negative on the token requirement**, and it is
reproducible: an install satisfied entirely from cache makes no registry request, so there is
nothing for authentication to fail.

This matters more than an ordinary measurement error because of who it affects. The person
verifying is the person most likely to have a warm cache, and the people who get the failure — a
new contributor, and CI, which always starts cold — are the ones the change was supposed to help.
A cached probe hides precisely the onboarding regression it is run to detect.

Verify with a fresh cache directory rather than `npm cache clean`, which discards a cache you may
want. The same applies to `pnpm store` and yarn's cache.

#### Prettier-ignore the vendored tree, or drift detection starts lying

The vendored files are written byte-identical to upstream and pinned by SHA-256. A repo-wide
`prettier --write` rewrites them and breaks every recorded hash — and the damage is worse than
losing the check. `--check` then reports the files as drifted, and the natural reading of that is
**"someone hand-edited the vendored config"**, not "the formatter reformatted it." An
upstream-drift signal becomes a false local-edit signal, which is the one failure mode that costs
more than having no check at all.

```
config/engineering/
```

A repository escapes this only while the vendored Prettier config happens to agree with upstream's
own formatting on every vendored file. That is luck, not a property anyone maintains: one file
whose upstream formatting differs from the config shipped beside it is enough. Two repositories
reached the same `.prettierignore` entry independently, one of them by reasoning from the existing
`vendor/` precedent.

Vendoring now warns when the destination is not matched by any line in `.prettierignore`. The check
is a literal prefix match against non-comment lines rather than full gitignore semantics, so it
says exactly what it looked for, and it stays a warning: a repository with no `.prettierignore` at
all is not necessarily formatting anything.

**Exclude the tree from ESLint too, for a reason that generalises past formatting.** The `prettier`
set is `.js`, so a flat config with a `**/*.js` pattern lints it. Add:

```js
{
  ignores: ['config/engineering/**'];
}
```

The general property is the one worth carrying: **a hash-locked file has no legal response to a
gate finding.** Editing it breaks the lock; not editing it leaves the gate red. When a file cannot
be changed, reporting on it is not a finding, it is a dead end — so the only correct behaviour is
not to report. Apply this to every gate you add, not just these two.

**One thing you cannot test by corrupting the file.** An adopter tried to mutation-test their lock
check by injecting a comment into `tsconfig/next.json`, and it broke **Vitest's own config load**
before a single test ran. The suite went red for entirely the wrong reason and very nearly scored
as a passing mutation test. Vendored files that the toolchain itself consumes cannot be mutated
this way: change a **value** to something still valid rather than making the file unparseable, so
the failure comes from your assertion instead of from a dead runner.

#### Splitting a migration does not split its consequences

If you split an adoption into a vendored layer and a registry layer, the type fixes authored
against the _combined_ branch can depend on the layer you are not shipping yet.

One repository hit this precisely: its source fixes were written on a branch that had also adopted
the ESLint preset, whose `no-unused-vars` carries `argsIgnorePattern: '^_'`. Ported onto a branch
that kept the repository's own ESLint config, a `_`-prefixed binding errored — because an
`eslint-disable-next-line` had been deleted as redundant while the preset made it redundant, and
removing the preset made it load-bearing again.

The general shape: **a suppression deleted as redundant is only redundant under the config that
made it so.** When splitting, re-run the lower layer's gates against the lower layer's config
rather than assuming a fix that passed on the combined branch still applies.

#### Vendor everything in one run, or the lock stops covering what you moved

The lock records **one run**. It replaces rather than merges, so if you change `--dest` or `--set`,
the files from the previous run stay on disk and stop being tracked — and `--check` then reports
success while covering none of them. A config still referenced by a `tsconfig.json` `extends`, with
drift detection silently switched off, is the exact failure the lock exists to prevent.

Vendoring now names them rather than dropping them:

```
warning: 11 file(s) from the previous run are no longer tracked:
  config/engineering/tsconfig/base.json
  ...
Delete them, or re-run without --dest/--set so one run covers everything you vendor.
```

It is a warning, not a failure, because vendoring two sets to two directories is legitimate — but
if you do that, only the last run is covered, and you should treat the earlier tree as unmanaged.
The safe default is a single run with a single `--dest`.

### Registry — for `eslint-config` only

The rest of this section applies **only** if you install `@jrmoulckers/eslint-config`.

The package is published to **GitHub Packages**, which requires the `@jrmoulckers` scope to be
routed explicitly, and requires authentication on every read. This holds whatever the package's
visibility is: there is no anonymous access to the npm registry.

Visibility changes _authorization_, not authentication. A public package can be read by any
authenticated token, with no per-repository grant. A private one additionally requires each
consuming repository to be granted access. Either way you must send a token.

> **A package's visibility is not the repository's visibility.** `jrmoulckers/engineering` is a
> **public** repository, and all three packages are currently **private** — publishing from a
> public repository does not make the package public, and nothing about the repository page
> hints otherwise. Check the package, never the repo:
>
> ```console
> $ gh api users/jrmoulckers/packages/npm/eslint-config --jq .visibility
> private
> ```
>
> While that returns `private`, the grants below are required. This is the current state and the
> single blocker for adopting the presets.
>
> **An earlier version of this section recommended scraping the `/packages` page instead. It has
> been removed, and how it failed is worth more than the probe was.** The published form was:
>
> ```bash
> curl -s https://github.com/OWNER/REPO/packages | grep -c 'packages/container/package\|packages/npm/package'
> ```
>
> A consumer reported it returns `0` for repositories with unmistakably public packages, and
> therefore cannot produce a negative result. Re-measuring gave the opposite:
>
> | Repository             | measured here | measured by the consumer |
> | ---------------------- | ------------- | ------------------------ |
> | `home-assistant/core`  | **28**        | 0                        |
> | `renovatebot/renovate` | **1**         | 0                        |
> | `cli/cli`              | 0             | 0                        |
>
> Both runs were correct. The pattern is written in POSIX basic regular expressions, where `\|` is
> **alternation** — which is what `grep` uses by default. In PCRE, .NET, and PowerShell's
> `Select-String`, `\|` is an **escaped literal pipe**, so the expression becomes the single fixed
> string `packages/container/package|packages/npm/package`, which appears on no page anywhere:
>
> ```console
> $ pwsh -c "([regex]::Matches($body,'packages/container/package\|packages/npm/package')).Count"
> 0
> $ pwsh -c "([regex]::Matches($body,'packages/container/package|packages/npm/package')).Count"
> 28
> ```
>
> So the probe silently reports "no public packages" whenever it is run in a regex engine other
> than the author's — and it never errors, because the pattern is valid in both, meaning different
> things.
>
> **The reason it had to be deleted rather than repaired is that its correct negative answer is
> also `0`.** Every way of running it wrongly produces exactly the value it produces when the
> answer is genuinely "none public". This one probe has now returned a spurious `0` four distinct
> ways: an absence test with no control, a units error reading 960 lines as bytes, a needle that
> could not generalise, and now an escape that changes meaning between engines. That is not four
> careless readers; it is a probe whose failures are indistinguishable from its findings.
>
> Prefer a check that answers by **value**. `gh api … --jq .visibility` returns `private` or
> `public`, and a broken invocation returns an error instead of a plausible answer. When a probe
> must answer by absence, publish a control with a known non-zero result beside it — and state the
> shell it was measured in.
>
> **But `gh` reports on the identity actually in effect, which may not be the one you configured.**
> Running that probe here returned two different answers on the same machine, in the same
> directory, within a minute:
>
> ```console
> $ gh api users/jrmoulckers/packages/npm/eslint-config --jq .visibility
> gh: You need at least read:packages scope to get a package. (HTTP 403)
>
> $ GH_TOKEN='' gh api users/jrmoulckers/packages/npm/eslint-config --jq .visibility
> private
> ```
>
> An environment-supplied `GH_TOKEN` takes precedence over the keyring credential and is not
> mentioned in the error, which blames a missing scope without saying whose. `gh auth status` is
> the disambiguator, and it prints both:
>
> ```console
> $ gh auth status
> ✓ Logged in to github.com account jrmoulckers (GH_TOKEN)
>   - Active account: true
>   - Token scopes: 'gist', 'project', 'read:org', 'repo', 'user', 'workflow'
> ✓ Logged in to github.com account jrmoulckers (keyring)
>   - Active account: false
>   - Token scopes: 'admin:public_key', 'gist', 'read:org', 'read:packages', 'repo'
> ```
>
> Both are the same username, so nothing looks wrong. This applies to **every** `gh` probe in this
> document, not just the visibility one: run `gh auth status` first, or a reader reproduces a
> published check under a different identity and gets a different answer with no indication why.
> Note also that the 403 and a genuine "no such package" are easy to conflate — neither says
> `public`, and only one is about permissions.
>
> **Grep for the link shape, not for a package name.** _(Retained as history: the probe below has
> since been retired for the engine-dependence described above. The reasoning still applies to any
> absence-based check you write.)_ A consumer read this probe as untestable
> because it returned `0` for repositories with genuinely public packages too. Their controls were
> sound in intent and wrong in needle: the page never contains a bare package name near the link,
> so a name-based grep cannot match anywhere, and a probe that cannot match anywhere returns `0`
> for every input. Re-measured anonymously against the link shape:
>
> | Repository                | Package links | Reading           |
> | ------------------------- | ------------- | ----------------- |
> | `home-assistant/core`     | **28**        | public packages   |
> | `renovatebot/renovate`    | **1**         | public package    |
> | `actions/runner`          | **1**         | public package    |
> | `cli/cli`                 | 0             | genuinely none    |
> | `nodejs/node`             | 0             | genuinely none    |
> | `jrmoulckers/engineering` | 0             | private (correct) |
>
> The listed hrefs carry real names — `/orgs/home-assistant/packages/container/package/home-assistant`
> — so the probe does vary with the property under test.
>
> **The lesson is the positive control, not the needle.** Running a probe against known negatives
> only shows it returns `0`; it cannot distinguish "correctly reports absence" from "never reports
> anything." Confirm the probe can produce a **non-zero** result against something known to have
> the property before trusting a zero. That is the same operation as making a check go red once,
> applied to a diagnostic instead of a gate — and here it inverted the conclusion twice: first
> mine, then the correction to mine.

> **Assert a positive marker; do not trust a count of zero.** A consumer pointed out that this
> probe is an absence test whose failure mode is also absence — `0` comes back equally from a
> private package, a 404, a redirect, or a login wall. They fixed it by asserting GitHub's rendered
> empty state, which is self-validating because its presence proves the page loaded _and_ showed
> nothing:
>
> ```bash
> curl -s -o pkgs.html -w '%{http_code}\n' https://github.com/OWNER/REPO/packages
> grep -q 'Get started with GitHub Packages' pkgs.html && echo 'no packages visible'
> ```
>
> Verified here: `200`, marker present, zero package links. Verified in the other direction too —
> `home-assistant/core` does **not** contain that string, so the marker discriminates rather than
> appearing on every page.
>
> They also tried to find a positive control and could not: `nodejs/node`, `actions/toolkit` and
> `github/codeql-action` all return `0`, and they correctly declined to trust an absence test with
> no reachable positive control. Those three genuinely publish nothing linked. Working positive
> controls, anonymously: **`home-assistant/core` (28 package links)**, **`renovatebot/renovate`
> (1)**, **`actions/runner` (1)**. A third consumer independently found a fourth:
> **`super-linter/super-linter` (1)**, which they ran precisely because their own first reading was
> a false zero. Two consumers reaching for a positive control unprompted, after being burned, is
> the strongest argument for keeping one in the recipe.
>
> **The HTML tab is not merely the easiest probe — for the token that needs to ask, it is the only
> one.** `gh api "/user/packages?package_type=npm"` returns
> `403 You need at least read:packages scope to list packages`, so the API route is closed to
> exactly the credential that has the question. Anonymous HTML needs no credential at all, which is
> why it can answer when nothing else can.
>
> Use both. The marker proves the probe ran; the controls prove the probe can answer.
>
> **Two consumers measured the same page, got the same wrong number, and diagnosed two different
> causes from it.** This one is worth reading closely, because the measurement error produced a
> plausible number rather than an obvious one.
>
> Both ran the probe from PowerShell. `curl.exe` output binds as an **array of lines**, so `.Length`
> returns the line count, not the byte count:
>
> ```powershell
> $out = curl.exe -s https://github.com/OWNER/REPO/packages
> $out.GetType().Name        # Object[]
> $out.Length                # 960      <-- the line count
> ($out -join "`n").Length   # 195667   <-- the actual body
> ```
>
> The page was fully fetched, fully rendered, `200`, marker present. Nothing was wrong with it.
>
> One consumer read `960` and concluded **"empty page"**; they caught it by running a positive
> control. The other read `960` and concluded **"301 redirect stub"**, then proposed pinning
> `curl -L` and asserting a body size over ~50 KB. That fix targets a redirect that never happened —
> which is why it does not reproduce anywhere the probe is run with `curl -w '%{size_download}'`,
> where the number comes from curl rather than from PowerShell.
>
> **A wrong measurement does not announce itself as wrong; it produces a number, and the number
> then gets explained.** Two competent readings of one artifact yielded two confident and
> incompatible diagnoses, and one of them became a proposed change to this guide. Ask the tool that
> did the work for the figure — `-w '%{size_download}'`, `-o file` plus the file's length — rather
> than measuring whatever your shell handed back.
>
> This is also the concrete argument for the marker over any size threshold: `960` passes a
> "did it load" eyeball test and fails a `> 50000` assertion, while the marker is correct in both
> readings because it does not depend on the units.

> The marker answers all of these at once: a 301 stub does not contain it, a login wall does not
> contain it, and a real page with packages does not contain it either. **Assert what the page must
> say, not how big it is or how it got there.**

> **A control needs a needle that generalises, and this probe has now failed three different ways.**
> A consumer asked for the probe to be retracted outright, reporting that it returns `0` for
> `home-assistant/core`, `renovatebot/renovate` and `cli/cli` — all of which they believed publish
> public packages — and concluding it "reports private for everything and cannot produce a
> negative". Their instinct was right and the falsification was invalid: they ran the **subject's**
> needle against the **control** pages. `eslint-config` is a string that only ever appears on this
> repository's page, so grepping for it elsewhere tests nothing. Measured on their three:
>
> | Repository             | `grep -c eslint-config` | link shape | empty-state marker |
> | ---------------------- | ----------------------- | ---------- | ------------------ |
> | `home-assistant/core`  | 0                       | **28**     | absent             |
> | `renovatebot/renovate` | 0                       | **1**      | absent             |
> | `cli/cli`              | 0                       | **0**      | **present**        |
>
> The link shape discriminates cleanly, and the marker independently confirms that `cli/cli`'s zero
> is a true zero rather than a broken fetch — the two halves of the recipe answering different
> questions, as intended.
>
> Three consumers have now broken this one probe in three distinct ways: an **absence test with no
> positive control**, a **units error** reading `960` lines as bytes, and a **needle that does not
> generalise**. All three produced `0`, all three read as "private", and none of them was a
> measurement of visibility. When a probe's failure output is identical to its interesting output,
> expect to get it wrong more than once.

> **pnpm 11 refuses any dependency published in the last 24 hours, and the error invites you to
> disable the wrong thing.** A consumer adopting within a day of a publish hit
> `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` on all three packages. This is built in, not configured,
> and it is a supply-chain control worth keeping — a compromised release is most dangerous in its
> first hours. The error text suggests relaxing the policy that flagged them, which reads as an
> invitation to switch it off globally.
>
> Do what they did instead: exclude **by exact version**, so the exemption expires with the
> version rather than persisting.
>
> ```yaml
> # pnpm-workspace.yaml — narrow, self-expiring
> minimumReleaseAgeExclude:
>   - '@jrmoulckers/eslint-config@0.13.0'
> ```
>
> A later release re-enters quarantine rather than inheriting the exemption. Waiting a day is also
> a complete fix, and usually the cheaper one.
>
> **The exact-version form has an upgrade trap, reported by the consumer who proposed it.** On the
> _next_ bump, the install fails on the version you are **leaving**. Reproduced exactly — manifest
> moved to `0.13.0`, exclude updated to name `0.13.0`:
>
> ```console
> $ pnpm install
> [ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 1 lockfile entries failed verification:
>   @jrmoulckers/eslint-config@0.12.0 was published at 2026-08-11T22:23:55.000Z,
>   within the minimumReleaseAge cutoff (2026-08-11T06:03:34.305Z)
> ```
>
> The check runs against **lockfile entries**, and the outgoing pin is still one of them at the
> moment of resolution. So the error names a version that is no longer in your manifest, was
> working ten seconds ago, and is not the one you edited — which reads like the tool rejecting the
> change you did not make.
>
> List both across the transition, then drop the old entry once the lockfile is rewritten:
>
> ```yaml
> minimumReleaseAgeExclude:
>   - '@jrmoulckers/eslint-config@0.13.0'
>   - '@jrmoulckers/eslint-config@0.12.0' # remove after the lockfile is regenerated
> ```
>
> Verified: with both listed the install succeeds and the lockfile rewrites to `0.13.0` alone, after
> which the transitional line is dead and should go. Every repository that adopts the exclude will
> meet this on its next bump, and it is only visible while both versions are inside the window —
> so it appears exactly when releases are frequent, and not at all when you test it later.

> **`allowImportingTsExtensions` is deliberately not in the shared base, and hoisting it would
> break emitting consumers.** A consumer kept it locally and asked for it to be hoisted, reasonably
> — every preset here inherits `noEmit: true` from `base.json`, so it would be safe for all of them
> as shipped. It is not safe for a consumer who overrides that. Measured on TypeScript 5.9:
>
> ```
> tsconfig.json: error TS5096: Option 'allowImportingTsExtensions' can only be used
>                when either 'noEmit' or 'emitDeclarationOnly' is set.
> ```
>
> A hard error, not a warning. Hoisting would convert "works" into "does not compile" for any
> repository that sets `noEmit: false` to build with `tsc`, and it would arrive on a version bump,
> in a file they never edited. **A flag that is only valid under a setting a consumer may override
> does not belong in a base others extend.** Keep it local, next to the `noEmit` that licenses it.

> **GitHub Packages only supports classic personal access tokens.** Fine-grained PATs are
> rejected by the npm registry. A fine-grained token fails with a 401 that is indistinguishable
> from having no token at all, so this is worth getting right the first time.

> **One request separates a credential problem from an access problem — and from a package that
> was never published.** The REST endpoints return a uniform `404` whether the package is private,
> absent, or your token is wrong, which is why they cost people an hour. The npm registry
> discriminates. A consumer noticed the 401/403 split; adding the existence control makes it a
> three-way answer. Measured against `https://npm.pkg.github.com/@jrmoulckers%2f<name>`:
>
> | Credential                | Package                  | Status  | What it proves                            |
> | ------------------------- | ------------------------ | ------- | ----------------------------------------- |
> | none                      | real                     | **401** | credential never arrived                  |
> | garbage                   | real                     | **401** | credential arrived and failed             |
> | valid, no `read:packages` | real, private            | **403** | **your token's scopes** — fixable by you  |
> | valid, `read:packages`    | real, private, no grant  | **403** | **the grant** — fixable only by the owner |
> | valid, `read:packages`    | real, private, granted   | **200** | readable now                              |
> | valid                     | name that does not exist | **404** | not in GitHub Packages at all             |
>
> Read it as: **401 is about you, 403 is about permissions, 404 is about the package.** The `403`
> arm is positive evidence in two directions at once — it confirms your token is fine _and_ that
> the publish landed, neither of which the REST `404` can tell you.
>
> **A scope-deficient token makes a public package and a private one indistinguishable — and that
> is why the `403` gets over-read.** A consumer built the control that proves it: they probed
> `@github/copilot`, a **publicly listed** package, alongside a private one and got byte-identical
> behaviour — `401` anonymous, `403` with their token. They correctly concluded their `403` had
> never been evidence about visibility.
>
> Their stated conclusion goes one step too far, though, and the extra step matters. Re-run with a
> token that **has** `read:packages` and the two separate cleanly:
>
> | Package                      | anon  | scope-deficient token | **scoped token** |
> | ---------------------------- | ----- | --------------------- | ---------------- |
> | `@jrmoulckers/eslint-config` | `401` | `403`                 | **`200`**        |
> | `@github/copilot`            | `401` | `403`                 | **`403`**        |
>
> So the registry _can_ answer the visibility question; the scope check simply runs first and
> masks it. **A failing check that runs earlier than the one you care about will answer in its own
> terms, and its answer looks like an answer to your question.** The remedy is not a better probe,
> it is satisfying the earlier check and re-running — at which point `200` versus `403` is exactly
> the discriminator you wanted.

> **The two `403`s are different outcomes and the body text separates them.** A consumer caught
> this guide collapsing them into one row, which is a real defect: they mean opposite things and
> only one of them is the owner's problem. Measured:
>
> ```
> scope missing → {"error":"Permission permission_denied: The token provided
>                            does not match expected scopes."}
> grant missing → {"error":"Permission permission_denied: read_package"}
> ```
>
> Match on the text after `permission_denied:`. If it mentions **scopes**, re-issue your token —
> nothing is blocked on anyone else. If it is **`read_package`**, your credential is correct and
> the package needs a grant. Reporting the first as the second sends an unblockable ask to the
> owner and stalls; that happened here, in both directions, before either of us checked the body.

> **Your machine may already hold a token with the scope — shadowed by one that lacks it.** I
> reported for several releases that no available credential carried `read:packages`, and a
> consumer falsified it on their own machine. `gh` stores multiple credentials and an environment
> variable wins over the keyring, silently and without warning:
>
> ```
> ✓ Logged in to github.com account NAME (GH_TOKEN)   ← active
>   Token scopes: 'gist', 'project', 'read:org', 'repo', 'user', 'workflow'
> ✓ Logged in to github.com account NAME (keyring)    ← ignored
>   Token scopes: 'admin:public_key', 'gist', 'read:org', 'read:packages', 'repo'
> ```
>
> Reproduced here exactly. Every probe I ran used the first line, returned the **scope** `403`, and
> I read that as "no token anywhere has the scope" — when the machine held one the whole time.
> `gh auth status` prints both; read past the active account, and clear `GH_TOKEN` in the shell to
> use the keyring credential. This is the absence pattern again, with a twist: the capability was
> not absent, it was **shadowed**, and the shadowing agent reported a symptom that looked like
> absence.
>
> With such a token all three packages return **200** today, so anyone holding one can generate a
> real lockfile with verified integrity hashes locally. Only CI still needs the owner's action.

> **The owner's action is a choice, not a single option.** A consumer pointed out that this guide
> presented flipping to public as the only remedy. Either of these unblocks CI:
>
> - **Grant per package** — the package's _Manage Actions access_ → add the consuming repository.
>   The package stays private and each repository's own `GITHUB_TOKEN` can read it. This is the
>   narrower change and the one to prefer.
> - **Flip to public** — any authenticated token reads it, with no per-repository administration.
>
> A `403 permission_denied: read_package` from CI is consistent with **both**: it proves the grant
> is missing, not that public is the only fix.
>
> The authoritative visibility check belongs to the owner and needs no scraping:
>
> ```bash
> gh api "user/packages?package_type=npm" --jq '.[] | "\(.name) \(.visibility)"'
> ```
>
> Note the name in that output is `eslint-config`, unscoped. The per-package endpoint takes that
> bare name; passing `@jrmoulckers%2Feslint-config` returns a `404` that reads exactly like the
> package not existing.
>
> The `404` arm is the one worth keeping in mind, because it catches a different bug entirely: a
> valid token plus `404` means the package was never published under that name, so no amount of
> visibility work will help. Note that a public package from the wider ecosystem also returns
> `404` here — GitHub Packages does not proxy npmjs, it serves only what was published to it.
>
> This pairs with the finding above that unset, empty and wrong tokens are indistinguishable in
> the error _text_. They are — but they are all `401`, and the 401/403 boundary is the axis that
> actually separates "fix my credential" from "ask the owner for access."
>
> ```bash
> curl -o /dev/null -s -w '%{http_code}\n' \
>   -H "Authorization: Bearer $GH_TOKEN" \
>   https://npm.pkg.github.com/@jrmoulckers%2feslint-config
> ```

### `.npmrc` — commit this

```ini
@jrmoulckers:registry=https://npm.pkg.github.com
```

Route the scope, and nothing else. Do **not** commit an `_authToken` line, even one that
interpolates an environment variable: it makes every local command fail confusingly when the
variable is unset, and it puts a credential-shaped string in version control.

**"Scope, not wholesale" is not a style preference, and stating it as one is why people ignore
it.** Setting `registry=` without a scope prefix reroutes _every_ registry operation, including
advisory lookups — and GitHub Packages implements **no advisory endpoint at all**. So a wholesale
reroute does not redirect `npm audit` / `pnpm audit` to a different source; it **removes the
capability**, and your security gate starts erroring instead of auditing. Said that way it also
predicts the symptom on both package managers, rather than having to be memorized per tool. The
measured failure text for each is [below](#the-npmrc-scope-trap-measured).

**The trailing slash does not matter, and this document uses both forms.** A consumer noticed
their `.npmrc` said `https://npm.pkg.github.com` while an example here said
`https://npm.pkg.github.com/`, and — because a mis-routed scope silently never sends the
credential — tested it rather than assuming. With a dummy token against the slashless form, npm
returned `401 unauthenticated: User cannot be authenticated with the token provided`: the token
**was** transmitted and rejected on its merits, so the host normalizes and both forms bind to the
same `//npm.pkg.github.com/:_authToken` entry.

Recorded because the negative result is the useful part. Had the forms _not_ matched, the symptom
would have been an auth failure indistinguishable from "the CI change didn't take" — so this is
a plausible suspect permanently eliminated rather than a difference to correct.

**A committed `.npmrc` outranks the one CI writes for you.** `setup-node` writes its registry
configuration to a **user**-level file and points `NPM_CONFIG_USERCONFIG` at it. Your committed
`.npmrc` is **project**-level, and project beats user on every key it sets. npm says so out
loud:

```
; "user" config from ...\user.npmrc
; @jrmoulckers:registry = "https://npm.pkg.github.com/" ; overridden by project
//npm.pkg.github.com/:_authToken = (protected)

; "project" config from ...\.npmrc
@jrmoulckers:registry = "https://project-wins.example.com/"
```

So the line above must route `@jrmoulckers` to the **same host** the workflow authenticates
against. If it points anywhere else, the project file silently wins, and because the token is
bound to `npm.pkg.github.com` it is simply not sent to the other host — you get a 401 that looks
exactly like the workflow change never took effect. Trailing slashes are normalised, so that
difference is harmless. Keys your project file does not set — the token line included — pass
through untouched, so an `.npmrc` holding unrelated settings is fine.

**pnpm refuses to honour a committed credential regardless.** pnpm 11 ignores any credential in
a project-level `.npmrc` and says why:

> environment variables are not expanded in registry credentials that come from a project
> `.npmrc`, because that file is committed to the repository and could leak the secret to an
> attacker-controlled registry

It then fails the install with a 401. The warning scrolls past in a wall of install output, so
the visible symptom is an unexplained 401 while a token is demonstrably set — worth recognising.
This is deliberate hardening on pnpm's part and the same instinct as `ENG-SEC-001`, so the
guidance above is what to follow under either package manager.

> **The behaviour is pnpm 11+, and that makes it a delayed failure.** A repository pinned to pnpm
> 10 via `packageManager` does not reproduce it, so a committed interpolated `_authToken` appears
> to work indefinitely. It breaks at a routine `packageManager` bump, with nothing in that diff
> pointing at the `.npmrc`. Reported by a consumer on pnpm 10.6.1 who correctly predicted they
> would not reproduce it.
>
> Verified on both majors against a project-level `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`:
>
> | pnpm | Behaviour                                | Result                                           |
> | ---- | ---------------------------------------- | ------------------------------------------------ |
> | 10   | expands the variable and sends the token | `ERR_PNPM_FETCH_401` — a real registry rejection |
> | 11   | warns, ignores the line entirely         | `401` — the token was never sent                 |
>
> **Both fail with 401, for opposite reasons**, which is the part that costs debugging time. Under
> pnpm 10 a 401 means the token is wrong; under pnpm 11 it means your correct token was discarded
> before the request. Chasing token validity is the natural response and it is the wrong thread on
> pnpm 11. The `[WARN] Ignored project-level auth setting` line is the only thing distinguishing
> them, and it appears far above the error. Remove the line and the ambiguity goes with it.

### Local development

Put the token in your **user-level** `~/.npmrc`, where it is shared across every repository and
never committed:

```ini
//npm.pkg.github.com/:_authToken=ghp_...
```

Under pnpm, write it with `pnpm config set` rather than by hand, so it lands in the user-level
file pnpm actually reads:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" ghp_...
```

Use a classic PAT with only the `read:packages` scope.

**A missing token reports as a bad one.** With `NODE_AUTH_TOKEN` unset, npm sends an _empty_
credential rather than none, so the registry answers:

```
npm error 401 unauthenticated: User cannot be authenticated with the token provided.
```

That message describes a credential that was rejected, and the usual response is to reissue a
token that was never the problem. Fine-grained tokens fail with the same text, so no token, an
empty token and a wrong token are indistinguishable from the error alone. Check that the variable
is set and that the token is classic before reissuing anything.

### CI

Use the job's own `GITHUB_TOKEN`. No secret has to be created, shared, or rotated in any
consuming repository — but while the packages are private, that token also needs an access grant
per the note below.

The permission must be requested explicitly. Without it the token is minted without package
scope and the install fails with the same 401 as no token at all:

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      registry-url: https://npm.pkg.github.com
      scope: '@jrmoulckers'
  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **`packages: read` is the one change that can break a working pipeline.** A called workflow
> can never hold a permission its caller lacks. If your workflow **calls an install-bearing
> reusable** and has an explicit `permissions:` block that omits `packages: read`, the run fails
> at startup with **no readable log** — no failing step to open, no error text, just
> `startup_failure`. It reads like an outage rather than a missing scope, so check this first.
>
> **Both halves of that condition are required, and conditioning on the wrong one is expensive
> in a different direction.** A Go repository with an explicit `contents: read` block and no
> `packages: read` is green, because it calls no such reusable — nothing is ever asked for the
> permission, so the ceiling never binds. Read as "explicit block without `packages: read` is
> dangerous", the rule pushes repositories with no npm surface at all to grant a scope they have
> no use for. That is a **widening of `GITHUB_TOKEN` authority adopted for no reason**, which is
> the opposite of `ENG-SEC-004` (_"least privilege, scope, and credential lifetime needed for
> each operation"_). Condition on the call, not on the block.
>
> **And do not read this as a reason to omit `permissions:`.** Omitting it inherits the
> repository default. The consumer who first argued that point later checked the repository they
> were standing in and retracted the reasoning behind it:
>
> ```
> GET /repos/OWNER/REPO/actions/permissions/workflow
> {"default_workflow_permissions":"read", "can_approve_pull_request_reviews":false}
> ```
>
> Verified `read` on three repositories here. So the "permissive write-all default" argument does
> not hold. **The conclusion drawn from that — that a caller with no block inherits a superset and
> is therefore immune — is also wrong, and this guide shipped it. Retracted, with a measurement.**
>
> The reasoning was that GitHub labels the restricted default _"Read repository contents **and
> packages** permissions"_, so a no-block caller must already cover what the callees declare. That
> holds only while every callee declares nothing beyond `contents` and `packages`. A consumer
> pointed out that two of them do — `reusable-ci-lint` adds `pull-requests: read`, and
> `reusable-deploy-pages` adds `id-token: write`, which **no** default grants — and predicted that
> a no-block caller would fail identically. They could not test it; their pushes were blocked. So
> it was tested here, on a public repository with `default_workflow_permissions: read`:
>
> | Caller                                               | Callee declares              | Result                |
> | ---------------------------------------------------- | ---------------------------- | --------------------- |
> | **no `permissions:` block**                          | `contents` + `pull-requests` | **`startup_failure`** |
> | explicit block granting `contents` + `pull-requests` | same callee, same commit     | **success**           |
>
> One variable, one commit, same repository, same default. The run with no block produced the
> familiar shape: **`jobs: 0`, no logs, no annotations, nothing to read.**
>
> So the guidance inverts. **Writing the block down is not what bites you — it is what lets you fix
> it.** A repository on the restricted default calling `reusable-ci-lint` fails whether or not it
> has a block, and if it has been told "no block is immune" it has been pointed away from the only
> available remedy. The rule is the one already stated below: compute the block as the union of
> what every callee declares. There is no exemption for omitting it.
>
> Note where the prediction came from. The two workflows that break the carve-out are exactly the
> two whose declarations exceed `contents` + `packages` — which is the same predicate as the trap
> itself, not a coincidence. Check your own default before assuming anything:
>
> ```bash
> gh api repos/OWNER/REPO/actions/permissions/workflow --jq .default_workflow_permissions
> # "read"  => you have contents + packages only; anything more needs an explicit block
> # "write" => broader, but still nothing for id-token
> ```
>
> **The necessary condition is a job-level `uses:` calling a reusable workflow — not a step-level
> action.** A Go consumer confirmed they cannot have this trap at all: their only `uses:` entries
> are `actions/checkout`, `actions/setup-go` and `golangci/golangci-lint-action`, all step-level.
> Step-level actions declare no `permissions:` of their own; they run inside the calling job on
> that job's token, so there is no callee declaration for the ceiling to bind against. Say this
> plainly, because "applies even to Go repositories" otherwise sends every Go repository hunting
> for a problem most of them structurally cannot have. Grep for the shape:
>
> ```bash
> grep -rn --include='*.yml' -B5 'uses:.*jrmoulckers/\.github' .github/workflows/
> ```
>
> **The resolution of the `ENG-SEC-004` tension is to compute the block, not to skip it.** Least
> privilege says write an explicit narrow block; this trap says a narrow block is what kills you.
> The same consumer supplied the resolution and it is better than the advice it replaces: **write
> the explicit block as the union of what every callee declares.** That is still least privilege
> relative to the inherited default — just never less than the callees need. Skipping the block
> would trade a real security property for a workaround and would carve an exception out of
> `ENG-SEC-004`; computing it keeps the principle intact. Use the callee table below as the input.
>
> **The exposure is inverted, and that is the thing to take away.** A second consumer sets
> `permissions: {}` at _workflow_ level so that every job must declare its own — the strictest
> posture available, and the one this guide recommends. An empty block grants nothing, so it is
> the most efficient possible way to reach `startup_failure`: every scope any callee requests is
> already denied. Meanwhile a repository that declared nothing at all inherits a permissive
> default and sails through.
>
> So the population most exposed to this trap is **the population that followed the stricter
> advice**, and "you are fine if you have no block" is close to backwards for a fleet that has
> been told to write one. Least privilege and this failure mode are not in tension — the fix is
> per-job `packages: read` on the callers that need it, not a looser ceiling — but the ordering
> matters: tighten the block and add the scope in the same change, or the tightening is what
> takes the pipeline down.
>
> This was measured against a deliberately misconfigured caller, and there is genuinely nothing to
> read: **zero jobs created** (`/actions/runs/<id>/jobs` returns `total_count: 0`), **no check-run
> for the failing job**, and `gh run view --log` answers `failed to get run log: log not found`.
> The only surface text is the generic _"This run likely failed because of a workflow file
> issue."_ The ceiling is enforced before any job is instantiated, so no preflight step or `if:`
> guard can ever report it — anything you write lives inside a job that is never created. Diagnose
> it by reading the caller's `permissions:` block against the callee's, not by looking for output.
>
> **A logless failure has at least three distinct causes, and one of them is billing.** A consumer
> reported the whole fleet's CI down and diagnosed it by correlating outcome against repository
> **visibility** — every private repository failing, every public one passing. The correlation was
> real and the inference was right, but the probes they used all returned nothing: `--log-failed`
> said `log not found`, `output.title` and `output.summary` were `null`, and every job reported
> zero steps. They reached the answer by inference because the direct read appeared unavailable.
>
> **It is available.** The annotations endpoint carries plain English when nothing else does:
>
> ```bash
> run=$(gh api "repos/OWNER/REPO/actions/runs?per_page=1" --jq '.workflow_runs[0].id')
> job=$(gh api "repos/OWNER/REPO/actions/runs/$run/jobs" --jq '.jobs[0].id')
> gh api "repos/OWNER/REPO/check-runs/$job/annotations" --jq '.[].message'
> ```
>
> Measured across the fleet, that single command separates causes that are otherwise identical on
> sight:
>
> | Repository state | Annotation                                                                                     |
> | ---------------- | ---------------------------------------------------------------------------------------------- |
> | private, failing | `The job was not started because recent account payments have failed or your spending limit …` |
> | public, failing  | `Process completed with exit code 1.`                                                          |
>
> Reproduced identically on four private repositories. The billing failure is **not** the same as
> the `packages: read` ceiling above, and the prescribed fix for that one does nothing here — a
> consumer following it will add scopes, see no change, and start suspecting their pin. Both
> produce a fast, logless, step-less failure that reads like an outage.
>
> Two cautions on the correlation itself. It is **suggestive, not decisive**: during the same
> window a public repository failed for an ordinary reason (`exit code 1`), which is enough to
> break a naive visibility correlation for anyone who samples it. And the billable timing is
> consistent but indirect — `/timing` reporting `total_ms: 0` against nine jobs means nothing ran,
> not why. Prefer the annotation, which states the cause outright.
>
> Billing exhaustion hits private repositories only, because public-repository Actions minutes are
> not billed. That is why the visibility split appears at all, and why it will look like a
> configuration difference between two repositories whose configuration is identical.
>
> **The permission ceiling and the billing hold are mechanically distinguishable, and not by the
> figure you would reach for first.** A consumer proposed separating them on `total_ms`, expecting
> the permission failure to list jobs and report time. It does the opposite. Both arms measured
> here — the permission case from the controlled experiment above, the billing case from a
> consumer's failing run:
>
> | Cause                     | `/jobs` returns | `/timing` `.billable`                     |
> | ------------------------- | --------------- | ----------------------------------------- |
> | caller grant below callee | **`0` jobs**    | **`{}`** — empty, `run_duration_ms: null` |
> | billing / spending limit  | **every job**   | runner present, `total_ms: 0`             |
>
> Read `total_ms` (billable), **not `run_duration_ms`** (wall clock). A billing-stopped run reports
> `run_duration_ms` values of 4,000–39,000 ms across the fleet while every `total_ms` and every
> per-job `duration_ms` is exactly `0`. Reaching for the wrong one makes the billing case look like
> a run that executed. Measured on four repositories with job counts of 3, 6, 9 and 10 — the count
> itself is whatever the workflow declares, so compare against zero, not against a number.
>
> The cleaner discriminator is therefore **whether jobs exist at all**, not how long they ran. It
> also matches the mechanism: a caller asking for more than it holds is rejected before any job is
> created, whereas a billing hold creates every job and then refuses to allocate a runner — which
> is exactly why its per-job `duration_ms` is `0` rather than absent. Read it as: **no jobs means it
> was never admitted; jobs with zero time means it was admitted and never ran.**
>
> **The sharpest discriminator needs no API call at all: find a job with no shared surface.** A
> consumer pointed out that in their dead run, a plain `runs-on: ubuntu-latest` typecheck job also
> died at `steps=0` — a job that calls no reusable workflow, takes no `registry-url`, requests only
> `contents: read`, and installs nothing from this registry. Nothing about presets, permissions,
> package visibility, or your pin can reach such a job.
>
> So: **if a run kills a job that has no shared-workflow surface at all, the cause is account-level,
> not anything in this document.** That reasoning holds without reading annotations or timings, and
> it is worth applying before any of the tables above — it is also the check that stops a permission
> conclusion drawn during a billing outage from being believed. Keep one such job in your workflow
> if you can; it doubles as a control.>
> Prefer the annotation regardless. It states the cause outright, and neither counting exercise has
> to be interpreted.
>
> **Do not use elapsed time as any part of the signature.** The same repository, under the same
> billing hold, reported `2s` on one run and `10s` on the next — with `steps=0` and no log in both.
> The elapsed figure includes queue time, so it varies with platform load and says nothing about
> whether the job started. A consumer watching that second run nearly read `10s` as "it began
> executing." **`steps=0` is the observation; the duration is noise around it.**
>
> **Reported state is unreliable in the same way.** A third run under the same hold showed `lint` at
> `2s` while `test (ubuntu)` sat at **`pending` for over a minute** before failing. So one billing
> hold has now presented as `2s`, `10s`, and `pending`-then-fail — across jobs in a _single_ run.
> Neither elapsed time nor the in-flight state distinguishes "queued behind a busy runner" from
> "will never start," and a job that looks `pending` is the most convincing of the three, because
> waiting is what a healthy queued job also does. Read the annotation.
>
> **The two signatures have now been observed with the confound removed.** The table above pairs a
> permission failure and a billing failure measured on different repositories, which leaves open the
> objection that the difference tracks the repository rather than the cause. A public repository
> settles it: billing does not apply, because Actions minutes are free on public repositories, so
> any `startup_failure` there is necessarily not the billing hold. One such run reports **`0` jobs**
> and `"billable": {}` — the permission signature exactly, on a repository where the billing
> explanation is excluded by construction, and during the same outage window in which every private
> repository was showing the other signature. The discriminator separates causes, not repositories.
>
> That is also the control that a private repository cannot supply while the hold is in force, which
> is the point of the next paragraph.
>
> **A control run is only valid if it ran in the same platform state as the test, and this outage
> has already voided one.** The standard control for "did my change break CI" is to compare the
> changed branch against unmodified `main`. That is sound only when both runs happened on the same
> side of the billing boundary. Once an account-level hold is in force, `main` fails too, and the
> comparison stops discriminating — it returns "both red" no matter what the change did.
>
> This is not hypothetical. Measured on the fleet, the boundary is sharp:
>
> | run                    | result         |
> | ---------------------- | -------------- |
> | `2026-08-10T21:45:23Z` | **last green** |
> | `2026-08-11T00:15:55Z` | **first red**  |
>
> Every private-repository run after that point is red, across four repositories, all with the
> billing annotation. So **any CI-derived conclusion drawn from a private repo in that window rests
> on a control that could not fail** — a full day of evidence, not the few hours it feels like from
> inside the window.
>
> One repository in the fleet is worse off than confounded: it has **300 runs and zero successes**,
> and its oldest surviving run already postdates the boundary. It has never once observed its own
> CI pass. Nothing it concluded from a green-versus-red comparison can be load-bearing, because it
> has never had a green.
>
> That repository's control has now been read directly rather than inferred. Its oldest surviving
> unmodified-`main` run — the control arm of a permissions experiment — returns **9 jobs, 0 steps,
> and the billing annotation verbatim**. So the control did not merely fail; it failed for a reason
> the experiment could not see and could not have been fixed by any change to the branch under
> test. **A control that fails for an account-level reason returns "both red" and reads as
> confirmation.** The experiment's conclusion may still be true — the permission mechanism is real
> and was demonstrated separately — but this run is no longer evidence for it.
>
> The general form is worth more than the incident: **a control only controls for the variables it
> can vary.** Before a red-versus-red or green-versus-red comparison is load-bearing, confirm the
> control was capable of the other outcome. That is the same demand made of any probe elsewhere in
> this guide — run it against a state you believe is broken — applied to the control arm, which is
> the one place it is habitually skipped because the control is assumed rather than tested.
>
> **The visibility split is itself the cheapest fleet-wide probe.** Actions minutes are billed on
> private repositories and free on public ones, so an account-level hold partitions a mixed fleet
> exactly along `gh repo view --json visibility`. Measured here: four private repositories red with
> the annotation, four public ones running normally and merging, at the same minute, on the same
> workflows. If the split falls on visibility rather than on anything in the workflows, the cause is
> the account, and no amount of workflow auditing will move it.
>
> The practical rule: **before treating a red run as evidence about your change, confirm the account
> can produce a green run at all.** The cheapest check is a public repository under the same
> account, whose Actions minutes are not billed and which therefore stays green throughout. If the
> public repo is green and every private one is red, you are looking at billing, and no amount of
> workflow archaeology will move it.
>
> And when you report the finding, **give the boundary rather than a relative duration.** "It
> started in the last three hours" was off by an order of magnitude here, because the reporter
> reasonably dated the outage from when they noticed it. A timestamp is checkable by everyone else;
> "recently" silently re-anchors to each reader's clock.
>
> **A consumer proposed `runner_name` as the discriminator instead. It works, but not for the
> stated reason, and the value they named selects the wrong jobs.** Measured on both arms:
>
> | Cause                     | Failed jobs' `runner_name`    |
> | ------------------------- | ----------------------------- |
> | caller grant below callee | **not readable — no jobs**    |
> | billing / spending limit  | `""` — empty string, not null |
>
> Two corrections. First, in the permission case there is nothing to read: `/jobs` returns
> `total_count: 0`, so `runner_name` is not `null` and not `""` — the field does not exist, because
> the job does not. The discriminator is really **"is it readable at all"**, which is the
> jobs-exist test again wearing a different hat.
>
> Second, and the practical trap: in a billing-held run, **`null` and `""` both appear, and they
> track `conclusion`.** Measured on a 10-job run:
>
> ```console
> failure   ""     Server image builds
> failure   ""     lint / Lint and format
> skipped   null   lint / Semantic PR title
> skipped   null   perf
> ```
>
> `null` belongs to the **skipped** jobs — the ones that never had a chance to be assigned because a
> dependency failed. A check written as `runner_name == null` therefore matches the jobs that are
> not evidence of anything and misses every job that actually failed. Use `runner_name == ""` on
> jobs whose `conclusion` is `failure`, or read the annotation and skip the inference entirely.
>
> **A rerun is a genuine control, though.** Rerunning re-tests the same commit, so a failure that
> survives it cannot be transient scheduling. That is a good instinct and worth borrowing: when a
> symptom has several candidate causes, look for the cheap operation that eliminates one of them
> outright.

> **The blast radius is the whole workflow file, not the one misconfigured job.** A second,
> unrelated, perfectly valid job in the same file was added to that measurement and it did not run
> either. Permission resolution happens before any job is instantiated, so one caller job missing
> `packages: read` takes down every job that file would have produced — including the ones that
> never touch a package. If a file mixes a shared-workflow call with your own build or test jobs,
> you lose all of them at once, with the same absent log.
>
> Two consequences worth acting on. First, **a green history proves nothing about your next
> re-pin**: the failure is latent until the day you move the ref to a version whose callees request
> `packages: read`, and then it is total. At the time of writing, an org-wide scan found **13 caller
> jobs across 4 repositories** in exactly that state — currently green, pinned before the auth
> change, and one re-pin away from an opaque failure. Second, since no check can live inside the
> affected file, **any static check must be a separate workflow file**, which is unaffected and
> still runs.
>
> So treat "re-pin a shared workflow" as an instruction to re-read its `permissions:` blocks, not as
> a version bump.
>
> **Grant exactly what the callee declares. Do not reason from whether the job installs.** That
> heuristic is intuitive, mechanical-sounding, and wrong in both directions — it produced two
> incorrect answers here, one of each kind. Verified against the pinned callees:
>
> | Callee                     | Installs? | Declares `packages: read`? |
> | -------------------------- | --------- | -------------------------- |
> | `reusable-perf-budget.yml` | no        | **yes**                    |
> | `reusable-security-ci.yml` | no\*      | **no**                     |
> | `reusable-ci-lint.yml`     | yes       | yes                        |
>
> \*audits a manifest full of scoped packages, which is exactly why "it must need the scope" feels
> obvious and is false: advisory metadata resolves from the default registry.
>
> A consumer arrived at the right answer by reading each callee's own `permissions:` block at the
> pinned SHA and copying it, without knowing anything about how audit resolves endpoints. That is
> the rule: the callee has already declared its requirement, so read the declaration rather than
> re-deriving it from behaviour. A derivation can be reasoned wrong; a declaration cannot.

> **Reconcile counts against your own call list, and treat a maintainer's chat summary as the
> lossy channel it is.** Three times now this guide has been correct while a message summarising
> it was not, and every time a consumer caught it. One instance: a message listed six
> install-bearing reusables and then asserted "all five you call are covered." Those cannot both
> be true — the reader called five, but only **four** of theirs were on the list, the fifth being
> `reusable-security-ci`, which needs nothing. In a third, a message predicted that no Markdown
> would remain in a format diff, while the section above says the opposite and names the three
> categories that survive.
>
> The direction of the error is what makes it worth recording. A count that does not reconcile
> does not fail safe: the reader resolves the discrepancy by assuming the uncounted callee belongs
> in the set, and adds registry configuration to `reusable-security-ci` — the exact thing the next
> paragraph forbids. An off-by-one in a summary became an argument for the wrong action, and it
> arrived with more apparent authority than the table it contradicted.
>
> So: **when a message and this document disagree, the document wins**, and please say so rather
> than complying. Both consumers who caught this declined to act on the wrong claim and reported
> it instead. That is the behaviour that works — a fleet where the summary is trusted over the
> source propagates a maintainer's arithmetic slip to every repository at once, and none of them
> can detect it locally, because each one's configuration is individually plausible.

**The packages are labelled private, but that does not mean a consuming repository needs a grant —
and this guide told the fleet otherwise for several rounds.** Two consumers falsified it
independently by reading their own passing CI logs:

```
+ @jrmoulckers/eslint-config 0.11.0     # public consumer, GITHUB_TOKEN only
+ @jrmoulckers/eslint-config 0.12.0     # a second consumer, same
```

No secret, no PAT, no per-package grant — the job's own `GITHUB_TOKEN` with `packages: read` on the
caller. Six jobs in one run, across install, lint, E2E and Lighthouse.

**The mechanism is stated two paragraphs below and I failed to follow my own note to its
conclusion.** All three packages were published _linked_ to `jrmoulckers/engineering`, and a linked
package inherits the access permissions of its repository. `jrmoulckers/engineering` is **public**.
So the inherited permission is public-read, and any authenticated token can resolve the package
regardless of the `private` label on the packages tab.

Every observation is consistent with this and none of them required the grant:

| Probe                                  | Result  | Why                                            |
| -------------------------------------- | ------- | ---------------------------------------------- |
| Anonymous `GET` of the packument       | `401`   | Packages authenticates **every** read          |
| `GITHUB_TOKEN` from another repository | **200** | inherits the linked repository's public read   |
| Packages tab                           | private | the label describes the package, not the grant |

So the `401` that started this — a genuine finding — was an authentication failure being read as an
authorization failure. That distinction is drawn correctly elsewhere in this guide, and I still drew
the wrong conclusion from it, because I reasoned from the settings page instead of from a log.

**If you have deferred adoption on package access, re-test before deferring further.** The check is
one line in a passing job:

```bash
gh run view <run-id> --log | grep '@jrmoulckers/'
```

A grant is only required if the linked repository is private, or if the package is unlinked. Neither
is true today.

### The retraction above applies to GitHub Actions only, not to external build hosts

This is the boundary of the correction, and stating the retraction without it substitutes one
over-broad claim for another. **The inheritance is only reachable by a caller that has a credential
at all.** GitHub-hosted runners get one for free — every job is issued a `GITHUB_TOKEN`. Vercel,
Netlify, Cloudflare Pages, Fly, Render and any self-hosted pipeline are **not** issued one, so they
send an anonymous request, and Packages authenticates every read:

```
ERR_PNPM_FETCH_401  GET https://npm.pkg.github.com/download/@jrmoulckers/eslint-config/...
                    Unauthorized - 401
```

That is the same `401` from the probe table, arriving for the same reason — no credential, not no
permission. The precise statement is:

> Private packages are readable **wherever a GitHub credential exists**. On GitHub-hosted runners one
> always does. Off GitHub, one never does unless you install it.

So the two halves of a repository can disagree: CI green, deploys red, same commit, same lockfile.
A consumer hit exactly this — Actions installing all three packages happily while every Vercel build
died at install.

Remedy on the host, not in the repository. Add a classic PAT with `read:packages` as an environment
variable and point the package manager at it:

```ini
# .npmrc committed to the repo; the token comes from the host's env
@jrmoulckers:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

The cost is one credential per external host per repository, and it is a **classic** PAT — the
registry does not accept fine-grained tokens. That cost is the strongest argument for making the
packages public: it is the one change that removes the credential from every external host at once.

Audit before you assume this is someone else's problem, because a host can be connected to a
repository with **no configuration file committed** — checking for `vercel.json` will miss it. Read
the statuses and deployments instead:

```bash
sha=$(gh api "repos/OWNER/REPO/commits?per_page=1" --jq '.[0].sha')
gh api "repos/OWNER/REPO/commits/$sha/status" --jq '[.statuses[].context] | unique'
gh api "repos/OWNER/REPO/deployments?per_page=10" \
  --jq '.[] | "\(.environment)  \(.performed_via_github_app.name // "external")"'
```

A deployment reporting `GitHub Actions` as its app is credentialed and unaffected. A commit status
from a third-party context, or a deployment with no app, is the exposed case.

### A check that is already failing has stopped being a check

The consumer above found this bug **after** merging, and the reason generalises well beyond
registries. Their Vercel status was already red for an unrelated account-level build rate limit. When
the adoption PR went red on Vercel too, it read as the known noise — correctly, on the evidence
available, because both conditions surface as **one status with one colour**. No build had yet
reached `pnpm install`, so the `401` did not exist anywhere to be found.

The rule to take from it:

> Adopting anything underneath an already-red check means you have lost that check as a signal for
> the adoption. Clear the known failure first, or verify against a specific named build — do not
> read the aggregate status.

Establishing it took walking the deployment list and diffing `package.json` at each deployed SHA to
find that the last **successful** deploy predated the adoption. That is the reliable move when a
status is untrustworthy: find the last green run and ask what it actually contained. It is the same
principle this guide applies to configs — measure the artifact, not the summary of it.

> **Historical note, kept because the reasoning is still correct where it applies.** If a package
> _is_ genuinely unreachable, the options are a per-package grant — the package's _Manage Actions
> access_ → add the consuming repository — or a visibility flip. That is one grant per repository
> per package, so seven repositories across three packages would be twenty-one grants to create and
> maintain. That cost was real and is what motivated the recommendation; it simply was not being
> paid, because the inheritance made it unnecessary.

> **If "Manage Actions access" is not on the package settings page, this is why.** A linked package
> **inherits the access permissions of its repository by default**. While it inherits, the granular
> settings — including **Manage Actions access** — are not shown at all. You must first remove the
> inherited permissions, after which the package's own access list becomes editable. **Do not do
> this to "fix" access.** Removing the inheritance is what would break the working setup described
> above, and the button's absence is the signal that inheritance is active and doing its job.
>
> The npm registry does support this. It is one of the registries with granular, user-scoped
> permissions, alongside the Container, NuGet and RubyGems registries; only the Maven and Gradle
> registries are repository-scoped and genuinely cannot do it. A consumer who looks for the
> button, does not find it, and concludes npm lacks the capability has drawn a reasonable but
> wrong conclusion from a real observation.

Making the packages public collapses all of that to nothing, because any authenticated token may
then read them. Note that public does **not** mean anonymous — the registry still rejects an
unauthenticated read with a 401, so `packages: read` and the token remain required either way.
What changes is authorization, not authentication.

**This section applies to all three packages.** An earlier revision said it applied to
`@jrmoulckers/eslint-config` only, on the grounds that `tsconfig` and `prettier-config` were
vendored at a pinned ref and needed no registry, token, or grant. That was wrong — all three are
published and all three need the grant, so the count stands at twenty-one rather than seven. See
the correction under §1.

Prefer either of those over storing a PAT in a secret.

#### If your CI delegates to the reusable workflows in `jrmoulckers/.github`

The `setup-node` step above lives inside the reusable workflow, not in your caller, so you
cannot add `registry-url` yourself. Those workflows accept `registry-url` and `registry-scope`
inputs, and **authentication is zero-config** — `NODE_AUTH_TOKEN` falls back to the job's
`GITHUB_TOKEN`, so you pass no secret at all:

```yaml
permissions:
  contents: read
  packages: read

jobs:
  web:
    uses: jrmoulckers/.github/.github/workflows/reusable-ci-web.yml@905ca5f592e580299bb0c0192c5106a1d708ea03 # main
    with:
      package-manager: pnpm
      registry-url: https://npm.pkg.github.com
      registry-scope: '@jrmoulckers'
```

> **This SHA is an example, not an authority — resolve it yourself before pasting.** The pin
> printed here was `f1457271` for several releases, and by the time a consumer checked it was
> **230 commits behind** `main`. Four repositories had been told to move to it. Re-pinning to it
> would have been a rollback presented as a fix.
>
> One repository declined. They had already moved to a newer SHA, and instead of complying they
> ran the comparison:
>
> ```bash
> gh api repos/jrmoulckers/.github/compare/<recommended>...<mine> \
>   --jq '{status,ahead_by,behind_by}'
> # => {"status":"ahead","ahead_by":4,"behind_by":0}
> ```
>
> `ahead_by` non-zero with `behind_by: 0` means the recommendation is strictly older than what you
> have. That one call is the whole check, and it is worth running against **any** SHA anyone hands
> you, including the one above.
>
> **A pinned SHA is a claim with a currency property, exactly like a version range.** This guide
> has spent its length telling consumers that a stale ref makes a rigorous method produce a
> confident wrong answer — and then shipped a stale ref of its own, in the copyable snippet, which
> is the highest-traffic line in the document. Immutability is what makes a SHA safe to run and
> also what stops it aging visibly: a tag that moved would have been noticed, a SHA that stayed
> put looks correct forever.
>
> Resolve `main` at the moment you adopt, and record what you resolved:
>
> ```bash
> gh api repos/jrmoulckers/.github/commits/main --jq '.sha'
> ```

Pass a `secrets: NODE_AUTH_TOKEN:` block only for a registry the job's own token cannot reach.
If you staged a `secrets:` block on a `uses:` job for GitHub Packages, delete that block.

> **"Pass no secret at all" is about the caller's `secrets:` block, not about every
> `NODE_AUTH_TOKEN` line in your file.** A consumer flagged that the sentence reads as "delete
> every `NODE_AUTH_TOKEN`", and that following it literally would have broken four working steps.
> The fallback is a property of the **reusable workflow**: it defaults the secret to the job's
> `GITHUB_TOKEN` when the caller supplies none. An inline `actions/setup-node` step in your own
> job has no such wrapper, so it still needs `NODE_AUTH_TOKEN` set explicitly in its `env:`.
>
> | Where the line appears                   | Under zero-config |
> | ---------------------------------------- | ----------------- |
> | `secrets:` block on a `uses:` caller job | **delete it**     |
> | `env:` on your own inline install step   | **keep it**       |
>
> Most repositories have both shapes in one `ci.yml`, which is why the instruction is easy to
> over-apply. Deleting the caller block is inert if you were passing the same token the fallback
> would pick; deleting an inline `env:` is a 401 on the next run. When in doubt, check whether the
> line sits under a `uses:` job — a job that delegates has no install step of its own to
> authenticate.

**The discriminator is mechanical, not a judgment call.** A second consumer re-reported this
after the guidance above shipped, which suggests "check whether the line sits under a `uses:`
job" still reads as advice you have to apply carefully. It isn't: GitHub's schema permits a
`secrets:` block **only** on a reusable-workflow call, so the ambiguous shape cannot exist.

```console
$ actionlint
.github/workflows/bad.yml:6:5: "secrets" is only available for a reusable workflow call
  with "uses" but "uses" is not found in job "j" [syntax-check]
```

That turns the instruction into a grep with no false positives:

| Search                 | Matches                                          | Safe to act on          |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| `NODE_AUTH_TOKEN`      | caller `secrets:` blocks **and** your own `env:` | **no** — conflates both |
| `secrets:` under a job | only reusable-workflow calls                     | **yes**                 |

Grep for the block, never for the token name. The two constructs are indistinguishable by the
token name and perfectly distinguishable by the keyword that encloses it.

**And the fallback only covers workflows this backbone owns.** Zero-config authentication is a
property of the reusable workflow's own `setup-node` step. A job you define yourself gets
nothing automatically, no matter how the callee is configured — so an inline install step needs
its own `registry-url`, `scope`, and `env: NODE_AUTH_TOKEN:` even in a repository where every
delegated job authenticates without configuration.

**Deleting it is a simplification, not a repair — and that distinction is worth stating out loud.**
`NODE_AUTH_TOKEN` is still a declared optional `workflow_call` secret in every one of these
callees, so a caller that keeps passing it goes on working. The old shape carries dead config; it
does not break. One repository checked the callees' `on.workflow_call` blocks _before_ removing the
secret rather than after, which is the right order, and it turned an apparently urgent change into
a tidy-up.

This generalizes past workflows, and it is a duty on whoever publishes the guidance rather than on
you: **whenever a recommended shape changes, say whether the previous shape still works.** Silence
on that point reads as _breaking_, and the rational response to a suspected break is to re-pin
immediately — which is precisely the action most likely to expose an unrelated latent fault, such
as the permission-ceiling failure above. A shape change announced without a compatibility note can
therefore cause more breakage than the change itself ever would.

So when you receive one: establish whether it is required or cosmetic before you schedule it, and
verify against the callee's declared interface rather than against the announcement.

**An explicitly passed secret beats the fallback, and that destroys your diagnosis.** If the caller
passes `NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN }}`, the workflow authenticates as that PAT
and never exercises `github.token` at all. A `403 permission_denied: read_package` then tells you
about **the PAT's** authorization — a missing `read:packages` scope, or un-authorized SSO — which
is indistinguishable in the log from the package being unreachable. Deleting the line splits the two
cleanly:

| After removing the explicit secret | Means                                    |
| ---------------------------------- | ---------------------------------------- |
| install succeeds                   | the PAT was the problem                  |
| `403` on `github.token`            | the package's Manage Actions access list |
| `401`                              | `packages: read` missing from the caller |

**The empty-token trap does not apply to these workflows.** Elsewhere in this guide, an unset
`NODE_AUTH_TOKEN` sends an empty credential and 401s. At the pinned ref above the expression is
`${{ secrets.packages-read-token || github.token }}`, so an unset or empty secret **degrades to the
job token** rather than sending nothing. That is strictly better, but it means a stale secret name
fails as a _403 against the wrong identity_ instead of an obvious 401 — quieter, and easier to
misread as a package problem.

**The `packages: read` line above is not optional here, and this is where omitting it hurts
most.** Every one of these callees requests `packages: read` at job level, and a caller's
`permissions:` block _replaces_ the default rather than adding to it — so a caller that lists
only `contents: read` caps the callee below what it asks for and the run dies at startup with no
readable log. See the callout in the previous section.

**The grant tracks what the callee declares, not whether it installs anything.** This is the
part that catches people. `reusable-perf-budget` consumes a build artifact and runs no install,
so `packages: read` looks obviously irrelevant and gets left off — and the whole workflow dies
at startup in about a second. Match this table exactly, per callee you call:

| Callee                      | Permissions the caller must grant                                     |
| --------------------------- | --------------------------------------------------------------------- |
| `reusable-ci-lint`          | `contents: read`, `packages: read`, `pull-requests: read`             |
| `reusable-ci-web`           | `contents: read`, `packages: read`                                    |
| `reusable-deploy-pages`     | `contents: read`, `packages: read`, `pages: write`, `id-token: write` |
| `reusable-deploy-preview`   | `contents: read`, `packages: read`                                    |
| `reusable-perf-budget`      | `contents: read`, `packages: read` — **installs nothing**             |
| `reusable-smoke-test`       | `contents: read`, `packages: read`                                    |
| `reusable-security-ci`      | `contents: read`                                                      |
| `reusable-change-detection` | `contents: read`                                                      |

A caller with **no** `permissions:` block does **not** escape this. Omitting the block inherits the
repository default. Measured both ways on a repository with the restricted default: no block
`startup_failure`s against a callee needing `pull-requests: read`; an explicit block granting it
succeeds. **Writing the block down is what lets you fix this, not what causes it.**

**What the restricted default actually grants was worth measuring rather than reasoning about.** A
consumer stopped taking my word for it — and stopped taking GitHub's docs for it — and read the
group Actions already prints at job setup:

```text
##[group]GITHUB_TOKEN Permissions
Contents: read
Metadata: read
Packages: read
```

Reproduced here. That is the whole grant: `{contents, metadata, packages}: read`. This document
previously said "only `contents` and `packages`", which was asserted rather than measured and
missed `metadata`. The measurement gives a sharper rule than the table:

> Under a restricted default, a caller may omit `permissions:` **only if** the callee needs nothing
> outside `{contents, metadata, packages}: read`.

Applied to the current backbone, that is **8 of 10 reusable workflows covered by omission**, and
exactly two that are not:

| Callee                  | Needs beyond the default    |
| ----------------------- | --------------------------- |
| `reusable-ci-lint`      | `pull-requests: read`       |
| `reusable-deploy-pages` | `id-token`/`pages`: `write` |

Note which scope is _not_ at risk. `packages: read` — the scope this entire adoption is about — is
granted by default, so the failure mode people brace for is the one that cannot happen. And
`id-token: write` is a **write** scope, which a restricted default cannot supply under any
circumstance, so `reusable-deploy-pages` is unreachable without an explicit block.

**`permissions: {}` is not deny-all.** Measured in the same run: a job declaring an empty
permissions map still gets `Metadata: read`. Metadata cannot be dropped. Repositories that write
`{}` at the top level and describe it as deny-all are describing something the platform does not
implement — harmless in itself, but it means "we grant nothing globally" is not a safe premise to
reason from.

### A local `declare module` silently overrides the package's shipped types

If you hand-wrote an ambient declaration while a package shipped no types, **delete it the moment
the package ships its own**. It does not become redundant — it becomes an override, and it freezes
the API at whatever shape you wrote months ago. Nothing in the toolchain reports this.

This affects every repository that adopted before `eslint-config@0.8.0`, `tsconfig@0.4.0` or
`prettier-config@0.4.0`, because the advice at the time was to hand-declare the modules.

It fails by blaming the caller for a valid option:

```
nextConfig({ typeAware: true })
  → TS2353: 'typeAware' does not exist in type '{ ignores?: ...; env?: ... }'
```

`typeAware` exists, is documented, and is declared by the installed package. Read cold, the
reasonable conclusion is "the preset does not support this yet" — which is exactly wrong, and the
option is real. New options are invisible through an old shim, so the more the package gains, the
more of it disappears.

**The error text itself tells you which one you are looking at.** Reproduced both arms against the
real package:

| Arm                     | Error on a bogus option                                |
| ----------------------- | ------------------------------------------------------ |
| shipped types (healthy) | `does not exist in type 'ReactOptions'`                |
| local shim (shadowed)   | `does not exist in type '{ ignores?: ...; env?: ...}'` |

A **named** type means you are reading the package's declarations. An **anonymous type literal**
means you are reading a hand-written shim, because a published declaration exports a named
interface. That is the discriminator to look for, and it is present in the error you already have.

TypeScript is silent about the shadowing. Verified with `skipLibCheck: false`: no duplicate
declaration, no conflict, no warning — the ambient declaration simply wins. Find them by grep:

```bash
grep -rn "declare module '@jrmoulckers/" --include='*.d.ts' .
```

**When you remove one, verify in three directions, not one.** "The error went away" is also what an
option silently widening to `any` looks like:

| Check              | Expected                                               |
| ------------------ | ------------------------------------------------------ |
| `typecheck`        | clean                                                  |
| the new option     | now accepted                                           |
| a **bogus** option | **still rejected**, naming the package's own interface |

The third is load-bearing; the first two pass identically against a shim that resolved to `any`.

> **The bogus-option check does not work on every package, and `prettier-config` is one where it
> silently reports the wrong answer.** It was written against `eslint-config`, whose options are a
> named interface with a closed set of keys. Prettier's own `Config` — which
> `@jrmoulckers/prettier-config` deliberately re-exports rather than restating — carries an index
> signature:
>
> ```ts
> [_: string]: unknown;
> ```
>
> That is correct of Prettier, because plugins contribute arbitrary options. But it means **any**
> property name type-checks, so a bogus key is accepted by a fully, correctly typed package. Run
> the recipe above and you conclude the types are missing when they are live.
>
> **Where a type is open, probe a known key's type instead of an unknown key's existence:**
>
> ```js
> /** @type {number} */
> const n = config.semi; // → TS2322: 'boolean | undefined' is not assignable to 'number'
> ```
>
> An error naming `boolean | undefined` proves the declaration resolved and carries real types. A
> silent pass means it widened to `any`. Verified both arms against the published package.
>
> The general rule, which outlives this instance: **a negative check is only evidence if the thing
> it looks for is impossible when healthy.** "Rejects nonsense" assumes the type is closed. Where it
> is open by design, absence of an error is not absence of a type — the same vacuous-check shape as
> a fragment that cannot 404, and as a rule count that cannot see a dropped layer.

### Under-granting kills the run; over-granting does nothing at all

The failure is **not** symmetric, and this document's framing — "grant less than the callee declares
and the run dies" — leaves the other direction ambiguous. A consumer asked outright, having granted
`packages: read` to a job whose callee declares only `contents: read`, and reasoned that the caller's
grant is a ceiling which the callee's own block restricts further. That is correct. It is also
directly readable, so it should not be left as reasoning:

| Direction                                   | Effect                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| caller grants **less** than callee declares | `startup_failure`, **zero jobs**, no log, no annotation |
| caller grants **more** than callee declares | nothing — the extra scope never reaches the token       |

Measured on a green run, reading the `GITHUB_TOKEN Permissions` group of two jobs in the same
workflow, one over-granting and one exact:

```text
Security / Package audit          Performance / Performance budget
  caller grants: contents,          caller grants: contents, packages
                 packages           callee declares: contents, packages
  callee declares: contents
  ---                               ---
  Contents: read                    Contents: read
  Metadata: read                    Metadata: read
                                    Packages: read
```

The over-granted job's token carries **no `Packages`**. The caller asked for it, the callee did not
declare it, and the intersection is what the job runs with. So an unnecessary scope is inert rather
than merely harmless-in-principle — there is no token to leak it through.

**The practical consequence is a diagnostic limit, and it runs the opposite way to the one people
expect.** Because the group prints the _intersection_, a caller that over-grants and a caller that
matches exactly produce **byte-identical output**. You cannot audit your own `permissions:` blocks by
reading job logs; the log shows you what the callee declared, not what you wrote. Diff the two files
if you want to know. Note the direction of the risk this creates: the log will never tell you that a
scope you granted was pointless, so over-grants accumulate silently across re-pins as callees drop
scopes — untidy, never breaking, and invisible to every check.

Both halves matter when you read that table. The exact-match job **installs nothing** and still needs
`packages: read`, for the reason given above; the over-granting job **does** install and still
resolves the packages fine on `{contents, metadata}` alone, because its audit command does not reach
the scoped registry. Neither job's grant is predictable from what it does, which is why the callee
table is the input rather than intuition.

**And do not respond to this failure by deleting the `permissions:` block.** The framing above —
that the failure appears only once you write the block down — invites exactly that, and for the two
callees where it matters, deleting the block reproduces an **identical** `startup_failure`. The
correct diagnosis then looks disproven, which is the same hour spent a second time. A consumer
whose 31 workflows all declare blocks flagged this; the escape hatch is not available to them at
all, and creating it deliberately would be the wrong move.

```bash
gh api repos/OWNER/REPO/actions/permissions/workflow --jq .default_workflow_permissions
```

**The migration order that looks safest can be the one that is guaranteed to fail.** The same
consumer had chosen `deploy-pages.yml` to migrate first, on sound grounds: smallest workflow, not a
required check, contained blast radius. It is also the single worst case in the table — the only
callee needing a **write** scope, failing as an unreadable `startup_failure` that names neither
`id-token` nor `pages`. "Smallest and least critical" and "needs the most unusual scope" are
independent axes, and ordering a migration by the first tells you nothing about the second. Check
the declaration before picking the pilot.

**And `id-token: write` is the scope a careful caller removes on purpose.** Another consumer made
the same observation from the other side: a reviewer trimming permissions will scrutinise write
scopes first and read `id-token: write` on a docs-deploy job as obviously excessive. So
`reusable-deploy-pages` is not merely the row most likely to be missed — it is the row most likely
to be broken by someone **doing the right thing**, arriving as a `startup_failure` immediately
after a commit whose stated purpose was tightening permissions. That is the most confusing possible
pairing of cause and effect, and it is worth pre-empting in the review rather than diagnosing after.

Two details in that table are easy to lose. `reusable-deploy-pages` declares its permissions
across **two jobs** — `contents`/`packages` on one, `pages`/`id-token` on the other — so the union
is what the caller must supply, and reading only the first job under-counts. And both of its extra
entries are **`write`**, not `read`: granting `pages: read` fails exactly like omitting it.

`actionlint` does not model caller-callee permission ceilings and passes on both sides, so this is
not caught before it runs. The reason is structural rather than a gap to be filed: **the invariant
is not expressible in either file.** It holds between a repository you own and one you do not, at a
pinned SHA, so no single-file linter can see it. One consequence follows directly and is worth
expecting — **it can break with no local change.** A callee that adds a declared scope invalidates
every caller pinned to the new SHA, so the failure arrives attached to a re-pin and looks like the
re-pin caused it.

**A linter passing is silence, and silence is not a measurement.** `actionlint` clearing both files
is the same shape as two other checks this document has had to retract: a `grep -c` returning `0`,
and a coverage ratchet that counted only header IDs. In each case a check ran, said nothing, and
the nothing was read as evidence. The remedy here is unusually cheap, because the platform already
prints the answer — one throwaway workflow with no `permissions:` block, and the
`GITHUB_TOKEN Permissions` group states the grant outright. **Prefer the signal that names a value
over the check that declines to complain**, especially when the check has no way to see the thing
you are asking about.

The token is resolved as
`inputs.registry-url != '' && (secrets.NODE_AUTH_TOKEN || github.token) || ''`, so it is only
present on runs that opted into a registry. Callers passing no registry inputs get an unchanged
environment rather than a live token exposed to dependency `postinstall` scripts.

Pin to a reviewed SHA per `GH-ACT-003`. Workflows that install dependencies: `reusable-ci-lint`,
`reusable-ci-web`, `reusable-deploy-pages`, `reusable-deploy-preview`, `reusable-perf-budget`,
and `reusable-smoke-test`. Passing none of the new inputs leaves behaviour unchanged —
`setup-node` skips its auth setup entirely when `registry-url` is empty.

**Never accept a pin without checking its direction first.** A SHA handed to you in a message,
issue or review comment is meaningless on its own: what matters is how it relates to the ref
_you_ are already on. Check before you move, and refuse if the answer is `behind`:

```bash
gh api repos/<owner>/<repo>/compare/<your-current-sha>...<proposed-sha> \
  --jq '{status, ahead_by, behind_by}'
# status "ahead"  -> the proposal contains your ref; safe to adopt
# status "behind" -> the proposal is an ancestor; adopting it is a rollback
```

This is worth a hard rule because **a backwards re-pin is invisible**. Every other failure in this
guide announces itself — a 401, a 403, a `startup_failure`. Silently reverting to an older set of
shared workflows does not: CI stays green, because the older workflows were green too. You simply
lose whatever they fixed, and you find out later from the symptom rather than the cause.

The mechanism that produces these is worth naming, because it is systemic rather than careless.
**A single SHA broadcast to several repositories is guaranteed to be wrong for some of them**, since
each is at a different pin — the same message that advances one repository rolls another back. It
also happens when the sender quotes the SHA of the branch or PR they are working on rather than the
tip of the default branch. Four such instructions went out during this migration; the repository
that checked every one of them and refused caught all four, and the repositories that complied would
have had no signal at all.

So the obligation runs both ways. If you publish a pin, compare it against each recipient's current
ref before sending, and say what it contains rather than only quoting it. If you receive one, verify
`ahead` before you move — a correct-looking SHA from a credible source is exactly the case this
check exists for.

**Check the recipient even applies before you send.** One repository was told to re-pin shared
workflow refs three separate times while consuming none of them — 0 `uses:` references across all
31 of its workflows, a fact the sender had themselves confirmed earlier in the same thread. That is
not merely wasted effort: it teaches a recipient that messages from the shared repository need not
apply to them, which is precisely the habit that makes the next real advisory get skimmed. A
broadcast is cheap to send and expensive to receive, and the cost lands on whoever has to work out
that it was irrelevant.

**Before telling anyone to delete a line, confirm they have it.** Another repository was told to
drop a `sourceMap` setting it had never written: the flag was inherited from a third-party base
config, so `git grep` found nothing to remove. Their reply is the right instruction back —
_worth checking before you tell them to delete something they also don't have._ An instruction to
remove something is uniquely bad when misdirected, because the recipient cannot comply and cannot
tell whether they have misread you or you have misread them. Name the file and line you expect it
in, so a recipient who lacks it knows immediately that the message is not about them.

**The sharper version of that: confirm the line exists in _their tree_, not in your notes about
them.** It happened again, and worse. A repository was told to remove a note recording an ADR
naming convention as "pending" — a repo-wide grep found nothing. The note had never been in their
tree at all. It existed only in **their earlier report to me**, where they had flagged the
convention as unresolved in conversation and then, correctly, declined to write speculation into
the repository. I read my own record of the conversation as a record of their files.

That is a distinct failure from the `sourceMap` case and it is easier to commit, because the
sender genuinely did see the text — just not where they think. **The check is not "do I remember
this?" but "does `git grep` find it on their default branch?"** A recipient who diligently follows
such an instruction will search, find nothing, and be left unable to distinguish a phantom
instruction from their own oversight. Both of this migration's instances were caught only because
the recipient reported the absence instead of assuming they had misread.

### A sound measurement against a stale tree is still wrong

Comparing `--print-config` output before and after adopting a preset is the right method, and it
does not protect you if the branch you measured on has fallen behind.

One repository ran that diff carefully, on a branch **88 commits behind `main`**. In the meantime
`main` had added two ignore globs — `**/playwright-report/**` and `**/test-results/**` — to fix a
failure where Playwright's HTML report and trace snapshots took `pnpm lint` from **16 problems to
5439**. The diff was clean and the conclusion was wrong, because the baseline no longer existed.

The general form is worth more than the instance: **rigour in the measurement does not survive a
stale baseline.** A "verified clean" claim has a date on it, and the older it is, the more it is a
statement about a tree that no longer exists. Rebase onto current `main`, then re-measure — and
treat any adoption claim older than the branch it was made on as unverified rather than verified.

Both globs are now in `sharedIgnores`, so this specific case is closed for anyone adopting the
preset. The reason it is worth stating anyway is that the failure only appears **after a test
fails**: a repository that adopts while green sees nothing, and meets it on the run that already
had something else wrong with it.

### `behind main: 0` does not mean nothing was dropped

A long-running adoption branch is usually rebased several times, and a bad conflict resolution is
the failure mode that survives review. **Ancestry cannot detect it.** `git rev-list --count
HEAD..main` reporting `0` proves every commit on `main` is reachable — it says nothing about
whether a resolution reverted the _content_ of one of them. The revert is a change you introduced,
not a commit you are missing, so it is invisible to every "am I up to date" check.

One repository lost a cycle to exactly this: a fix that existed on `main` was silently undone
during a rebase resolution, on a branch that was fully current.

**Review your deletions against `main`, not your commit list.** A bad resolution shows up as a
deleted line you did not author:

```bash
git diff main...HEAD | grep '^-' | grep -v '^---'
```

Another repository ran this deliberately and accounted for all 133 deleted lines across 45 files,
finding the concentration — 39 deletions — in the single file that had conflicted in every rebase.
All were dead symbols it had intentionally removed. That is the useful outcome: not "no deletions"
but "every deletion is one I can name."

**Compilation is proof for one class of deletion and not the others.** If a deleted symbol still
had a caller on `main`, the build fails, so a green build rules that out. It says nothing about a
deleted config line, a dropped ignore entry, a reverted dependency bump, or a removed test — none
of which any gate will notice. Read those by eye.

**A measurement is evidence for the number, not for the cause.** The most expensive defect in thismigration was self-inflicted and began with a correct report. A consumer measured 37 packages /
6.2 MB of React and Next tooling arriving in a Svelte-only repository. We assigned it a cause —
that `peerDependenciesMeta.optional` does not prevent installation — and on that basis moved five
framework plugins into a bespoke `frameworkPlugins` field that npm ignores, published the mechanism
on this page, and added a regression test asserting the plugins must never be peers.

The premise was false. Optional peers are not auto-installed by npm 7, npm 11, pnpm 11, or pnpm
with `auto-install-peers=true`; installing the real package at the very version the report was
filed against yields zero framework plugins present. The change bought nothing and cost the version
contract for three releases, during which the published ranges were documentation rather than
constraints.

Two things generalise. First, **the cause was never re-derived** — the number was checked and the
explanation was not, and a plausible explanation for a real number is the easiest kind of error to
ship. When you report a size or count, include the dependency path (`npm ls <pkg>`, `pnpm why
<pkg>`); when you receive one, ask for it before designing against a mechanism.

That request is not a formality, and the same report recurred after the correction shipped —
same repository, same count, same attribution to optional peers. So it was measured a third time,
as the exact upgrade being performed rather than as an isolated install. A Svelte-only tree
(`eslint`, `eslint-plugin-svelte`, `typescript`), npm 11.16.0, real tarballs packed from the tags:

| Step          | `node_modules` dirs | lockfile lines |
| ------------- | ------------------- | -------------- |
| at `0.1.0`    | 102                 | 1884           |
| after `0.2.1` | 102                 | 1896           |
| **delta**     | **0**               | **+12**        |

Zero React, hooks, a11y or Next plugins present at either version, though `0.2.1` declares all four
as optional peers and `0.1.0` declares none of them. The reported 37 packages are real and the
dependency path producing them is somewhere in the consuming tree; nothing in this package can
account for it. **If a shared config appears to add packages, run `npm why <plugin>` before
reporting the config as the cause** — that single command distinguishes the two explanations, and
it is the step whose absence cost this migration its most expensive defect.

Second, and worse: **a wrong belief with a green check on it stops looking like a belief.** The
regression test encoded the false invariant, passed on every run, and would have blocked the
correct fix had it not been read closely. A test is an assertion about the world and inherits every
error in the reasoning that produced it. When a test exists only to defend a conclusion rather than
a behaviour, write the evidence for that conclusion into the test body, so the next reader can
re-check the claim instead of trusting the check.

**Route by scope. Never replace the default registry.** <a id="the-npmrc-scope-trap-measured"></a>Setting
`registry=https://npm.pkg.github.com/` wholesale, rather than scoping it, breaks `npm audit` /
`pnpm audit` — GitHub Packages implements no advisory endpoint. Under npm the failure reads:

```
npm warn audit 404 Not Found - POST https://npm.pkg.github.com/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

pnpm reports the same condition as `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`. Neither is an auth
problem and **no token will fix either** — the endpoint does not exist at that host. Always pass
`registry-scope` alongside `registry-url`, and keep the committed `.npmrc` to a single scoped
line.

`reusable-security-ci` needs **no** registry configuration. Audit never contacts the scoped
registry: `@npmcli/arborist` resolves the advisory endpoint as
`options.auditRegistry || options.registry`, which is the default registry.

That claim is easy to believe and easy to get wrong, so it was tested by trying to falsify it —
the scope was routed to a host that cannot resolve at all:

```ini
@jrmoulckers:registry=https://blackhole.invalid/
```

If audit contacted the scoped registry, this must fail with a DNS error. It did not: the
`minimist` advisory was reported normally, exit 1 for the vulnerability, with no network error.
A 401 requires reaching a host; an unroutable host cannot return one. Reproduced independently in
both npm and pnpm.

**A consumer confirmed the same result from the opposite direction — and retracted their own
earlier report to do it.** They had told this repository that `reusable-security-ci` would 401
and needed registry inputs. Rather than let that stand, they ran `pnpm audit --audit-level=high`
against a fully registry-resolved lockfile — every `@jrmoulckers/*` entry a
`npm.pkg.github.com` tarball URL with an integrity hash — with **no token present at all**. Exit
`0`, no 401.

The two experiments falsify the same claim from opposite ends. The blackhole test removes the
registry and shows audit never notices; theirs populates the scope completely and shows audit
still needs no credential. A single result in either direction is consistent with "the scope
happened not to matter here"; together they establish that audit's endpoint selection is
independent of scope configuration.

It is worth recording that the retracted claim was never tested when it was made — it was
inferred from the workflow reading `npm ci`-shaped. The correction cost one command.

> **Audit sends dependency names — including `@jrmoulckers/*` — to `registry.npmjs.org`.** The bulk
> advisory request contains the name and version of every dependency, whichever registry resolved
> it. Scoping a dependency to a private registry does **not** keep it out of that payload.
>
> Be precise about what this does _not_ mean, because the loose version invites a mitigation that
> does nothing. A consumer intercepted and gunzipped the actual
> `POST /-/npm/v1/security/advisories/bulk` body rather than reasoning about it: 745 public
> name/version pairs went out, an isolated probe sent `{"@jrmoulckers/eslint-config":["0.2.1"]}`,
> and **zero of their own five `private: true` workspace packages appeared**. npm excludes private
> workspace roots. So "your private package names leak" is false for internals, and renaming or
> re-scoping them buys nothing. The real exposure is your **dependency** names; the real mitigations
> are `--offline`, or accepting it.

The no-auth conclusion holds for a plain `npm audit` / `pnpm audit`, which only reads advisory
data. It does **not** hold for a command that resolves or installs — `npm audit fix`, or any
install-then-audit sequence — because those do contact the scoped registry and will 401 without
a token. If you override `reusable-security-ci`'s `audit-command` input with anything of that
shape, you are back to needing registry configuration.

**A suppressed advisory still prints.** A consumer reported that their audit outputs `2 high` and
exits `0`, because both advisories are suppressed by `ignoreGhsas` — and warned that a gate
grepping audit _output_ rather than trusting its exit code would fire on their repository
spuriously. Reproduced here, and the mechanism is sharper than a count mismatch: pnpm keeps the
advisory's full table row and leaves it in the severity summary, marking it only with a
parenthetical.

```console
$ pnpm audit --audit-level=high      # advisory NOT suppressed
Severity: 1 moderate | 1 critical

$ pnpm audit --audit-level=high      # same advisory, suppressed
Severity: 1 moderate (1 ignored) | 1 critical
```

The suppressed and unsuppressed runs differ by seven characters, and the severity word survives
both. Any gate matching `/high|critical/` on stdout cannot distinguish them. This is the same
failure as the earlier probes: a check whose signal was read out of text that was never a signal.
The exit code is the contract — audit already computed the answer, and re-deriving it from prose
discards the computation.

**And on pnpm 11 that suppression may already be inert.** `pnpm.auditConfig` in `package.json`
is no longer read:

```console
$ pnpm --version
11.10.0
$ pnpm audit --audit-level=high
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were
ignored: "pnpm.auditConfig". See https://pnpm.io/settings for the new home of each setting.
Severity: 1 moderate | 1 critical        # (1 ignored) is gone — suppression dropped
```

The setting moved to `pnpm-workspace.yaml`:

```yaml
auditConfig:
  ignoreGhsas:
    - GHSA-vh95-rmgr-6w4m
```

Note the failure direction. This one is _safe_ — suppressions dropping means previously hidden
advisories reappear and the gate goes red — but it goes red on a pnpm upgrade, in a repository
whose audit configuration nobody touched, for advisories somebody already triaged and accepted.
The warning is printed, but it is a `[WARN]` with an unchanged exit code, so nothing fails at the
moment the setting stops working. Any repository carrying an `ignoreGhsas` list in `package.json`
should move it before upgrading, not after.

This is the second pnpm 11 change in this guide to alter behaviour with no failing command at the
point of change; the release-age quarantine is the other. Treat a pnpm major as a settings
migration, not just a resolver upgrade.

`--omit=dev` makes the point moot regardless. All three presets are `devDependencies`, so an audit
scoped to production dependencies never queries them and passes even while `npm ci` fails in the
lint and build jobs. A repository auditing dev dependencies too is the case that needs the
registry wiring — confirmed in practice by a consumer whose `Package audit` job stayed green
through every run in which the install jobs failed.

#### Reading the failure: 401 and 403 are different problems

Both surface at install and are easy to conflate, but they point at opposite causes:

| Symptom                               | Meaning                             | Fix                                                     |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `401 unauthenticated`                 | No token, wrong host, or wrong type | Check `NODE_AUTH_TOKEN`, `registry-url`, token class    |
| `403 permission_denied: read_package` | Authenticated, not authorized       | Package visibility or an explicit grant — not the token |

The tell for a 403 is that **metadata resolves and only the tarball download fails**: the request
was authenticated successfully and rejected on authorization. No amount of token work fixes it.
Diagnostic contributed by a consumer who chased the wrong one first.

**The general shape, worth recognising before you debug any of them:** every credential failure on
this path reports as _a bad credential_ when the cause is almost always a **missing, misrouted, or
misclassified** one. An empty `NODE_AUTH_TOKEN` interpolates to nothing; a token bound to
`npm.pkg.github.com` is simply not sent to another host; a fine-grained token is rejected where a
classic one is required; an authorized-but-unprivileged token authenticates and then fails on the
tarball. Four different causes, one misleading symptom. Check _which_ credential reached _which_
host before changing the credential itself.

### Install

```bash
npm i -D @jrmoulckers/eslint-config @jrmoulckers/prettier-config @jrmoulckers/tsconfig
```

**Do not use a caret at all while these packages are `0.x`.** On a `0.x` package a caret only
permits _patch_ updates — `^0.1.0` resolves to `>=0.1.0 <0.2.0` and can never reach `0.2.x`. Early
adoption briefs named `^0.1.0`, and a manifest still carrying it silently installs a build in
which `@jrmoulckers/eslint-config/react` and `@jrmoulckers/tsconfig/vite-react.json` **do not
exist**.

The trap is that this repeats at every minor. `^0.3.0` locks you out of `0.4.0` exactly as
`^0.1.0` locks you out of `0.2.0`, so a consumer who follows a floor table using carets is stale
again one release later and has no signal. Pin with an explicit upper bound instead, which tracks
every minor until the first stable major:

| Package                        | Range             | Floor is set by                                                       |
| ------------------------------ | ----------------- | --------------------------------------------------------------------- |
| `@jrmoulckers/eslint-config`   | `>=0.16.0 <1.0.0` | Tooling globs cover every test/config/script suffix, and are exported |
| `@jrmoulckers/tsconfig`        | `>=0.4.0 <1.0.0`  | `vite-react.json`; TypeScript 6 and 7 support; opt-in `node.json`     |
| `@jrmoulckers/prettier-config` | `>=0.4.0 <1.0.0`  | Type declarations, so `checkJs` consumers can adopt at all            |

The floors say what each version _added_, so they only rise when something is genuinely required.
The ranges keep you current without editing the manifest. Confirm what is actually published
rather than trusting this table, which is a literal and therefore ages:

```bash
curl -s https://raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json
```

**The cost of ignoring this is now measured, and it presents as diligence.** One consumer kept the
caret form and bumped `0.4 → 0.6 → 0.7 → 0.8` in a single evening — four hand edits to
`package.json`, each one prompted by a message rather than by any tool, each verified with a full
five-gate run, and each leaving them stale again within hours. They then asked, reasonably, that
this trap be written down. It already was, three sections above the line they were editing.

That is the diagnostic worth keeping: **repeated manual version bumps are a symptom of the wrong
range form, not evidence of a well-maintained manifest.** If you find yourself editing a floor by
hand more than once, the fix is not a faster edit — it is `>=x.y.z <1.0.0`, after which `npm
update` crosses minors on its own and the floor table stops being something you have to be told.

**And the convergence is the publisher's fault, not the consumers'.** Five of seven repositories
independently arrived at `^0.8.0` while the floor was `0.15.0`. Five separate teams, each doing
careful verification, each landing on the same wrong pin is not five mistakes — it is one, upstream
of all of them. The cause is how releases were announced here: a note saying "type declarations
shipped in `0.8.0`" reliably produces `^0.8.0` in a manifest, because the version named in the
announcement is the version the reader pins, and a caret then freezes it there.

So an announcement must name **the floor**, not the version that introduced the change, and must
give the specifier rather than the number:

```diff
- Type declarations shipped in 0.8.0.
+ Type declarations shipped in 0.8.0. The floor is 0.15.0 — set
+ "@jrmoulckers/eslint-config": ">=0.16.0 <1.0.0".
```

If you are reading a release note from this repository that names a version without naming the
current floor, treat the version as trivia and check `versions.json` before editing anything.

### Check your pins mechanically, because every symptom of a stale one is silence

Everything in this section describes a defect with **no error message**. The install succeeds, the
range is satisfied, the behaviour is correct for the version you have, and `npm outdated` says
nothing actionable about a range that is met. Eleven repositories reached that state, and none of
them found it by noticing something.

So do not rely on noticing. `versions.json` lives in a **public** repository and is readable over
plain HTTPS with no registry token, which means a consumer can check their own pins even when they
cannot authenticate to the package registry at all — the case where the question is most likely to
be asked:

```bash
curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/scripts/check-pins.mjs \
  | node - ./package.json
```

It reads the `@jrmoulckers/*` ranges out of your `package.json`, compares each against the published
version recorded in `versions.json`, and exits non-zero if any range cannot reach it:

```
  STALE    @jrmoulckers/eslint-config    ^0.3.0  CANNOT reach 0.16.0
                                         use: >=0.16.0 <1.0.0
```

Two properties are deliberate, and both exist because this guide has repeatedly caught its own
tooling reporting clean for the wrong reason:

- **A range it cannot parse is reported `unknown` and exits non-zero**, never `ok`. A checker that
  treats "I failed to evaluate this" as "this is fine" reports success on exactly the inputs it did
  not examine.
- **An unreadable `versions.json` exits `2` with an error** rather than finding no problems. A
  network failure and a clean bill of health must not look alike.

Run it in CI if you want the guarantee rather than the reminder; a stale pin is otherwise invisible
until someone re-reports a defect that was fixed in a release their caret excludes.

#### Two Windows traps when running tooling from this repository

Both were found by consumers running the tooling above, and both produce a wrong result rather than
an error.

**Do not pipe binary through PowerShell to extract a file — PowerShell will re-encode it on the way
through.** A consumer decoding a base64 attachment with
`... | Set-Content` or `> file` got a corrupt file that failed to parse, because the pipeline
decodes bytes to text and re-encodes them on write. Write the bytes directly:

```powershell
[IO.File]::WriteAllBytes('out.mjs', [Convert]::FromBase64String($b64))
```

Measured on a 5,854-byte script: `WriteAllBytes` reproduces the source hash exactly, while the
piped form yields a different SHA-256 and a file **two bytes larger**.

**The corrupted file still passed `node --check`.** That is the part worth keeping: the damage is to
encoding and line endings, so whether it breaks depends on the content — one consumer's extraction
failed to parse outright, mine parsed clean and was still not the file I sent. A syntax check is not
an integrity check. If it matters that you received the bytes that were sent, **compare hashes**;
running the file successfully proves only that it runs.

This is the same class of fault as `(Get-Content -Raw).Length` returning a **character** count where
a byte count was meant — described under `A character count is not a byte count`. PowerShell's
pipeline is text, and every conversion at its edges is lossy for anything that is not ASCII.

**Do not call `process.exit()` after a `fetch()` in your own tooling.** On Windows, Node aborts with
a libuv assertion and returns `0xC0000409` (`-1073740791`) instead of the code you asked for, because
the connection pool is still open:

```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
```

Measured on Node 24.3.0: `process.exit(3)` aborts, while `process.exitCode = 3` exits cleanly with
`3` in 0.4s — so nothing is gained by forcing it. The failure is worse than a crash, because the
script prints its correct output first and only then aborts; a CI step reads a garbage exit code from
a run that looked like it worked. `scripts/check-pins.mjs` assigns `exitCode` for this reason.

**Verifying the behaviour does not verify the version, and this is the way the caret survives a
careful adoption.** One repository adopted `@jrmoulckers/prettier-config@^0.2.0` and checked it
properly — not package metadata but the _effective resolved config_: `proseWrap: preserve` and
`printWidth: 96` on Markdown, `parser: svelte` on a component, `format:check` green. Every
assertion was true. The pin was still a minor behind, because `^0.2.0` is `>=0.2.0 <0.3.0` and
`0.3.0` was published.

A stale version passes a behavioural test **because it behaves correctly**. What it lacks is not
wrong behaviour but absent capability, and no test you write against the features you already use
can see a feature you do not use yet. In this instance the excluded release was the one that
widened `prettier-plugin-svelte` from `^3.2.0` to `^3.2.0 || ^4.0.0` — and the repository was a
Svelte repository. The pin blocked precisely the change most relevant to it, and every check it
ran stayed green.

**Diffing the increment is not verifying the floor, and this is the strongest version of the trap
because the measurement is rigorous.** A consumer on `^0.6.0` moved to `^0.7.0` and did the
carefullest possible check: rather than trusting a claim that the release was irrelevant to their
preset, they printed the _effective resolved ruleset_ for a real source file on both versions and
compared them.

```
0.6.0 -> 295 rules
0.7.0 -> 295 rules
Compare-Object -> no difference
```

The measurement was correct and the method is the right one. The conclusion drawn from it — that
the bump was a formality — was not, because **a diff between two adjacent versions is evidence
about those two versions and nothing else.** The floor at the time was `0.14.0`. Seven minors sat
outside the comparison, and `^0.7.0` cannot reach any of them.

What was in that gap was not theoretical. Between `0.7.0` and `0.14.0`, `svelte.js` gains a block
applying `typescript-eslint`'s `eslintRecommended` rules to `**/*.svelte` — **23 rules: 19 core
rules switched off, 4 switched on** — and it applies to a bare `svelteConfig()` with no options.
For a Svelte consumer that is a larger change to their resolved ruleset than the release they
measured, and their check could not see it because it was never in the comparison.

**Diff against the floor, not against the next version.** If the floor is `0.14.0` and you are on
`0.6.0`, the only diff that answers "what does this bump change for me" is `0.6.0` against
`0.14.0`. An adjacent-version diff answers a question nobody asked, and answers it convincingly
enough to stop the investigation.

**A null result on one check says nothing about the other, and which half moves depends on your
stack.** Two consumers sat on `^0.8.0` against a `0.15.0` floor. Both ran the checks this guide
recommends, both got clean results, and **the same version gap changed a different half for each of
them.** Measured by resolving each preset through `ESLint.calculateConfigForFile` at package
`0.8.0` and `0.15.0` against one shared dependency tree:

| Check                             | Svelte consumer                  | React consumer                        |
| --------------------------------- | -------------------------------- | ------------------------------------- |
| linted file set / `sharedIgnores` | unchanged — 8 entries both sides | unchanged — 8 entries both sides      |
| resolved rules, `.ts` `.js`       | identical                        | identical                             |
| resolved rules, framework files   | **`.svelte` −18 / +4**           | `.tsx` `.jsx` `.mts` `.cts` identical |
| resolved rules, **test files**    | —                                | **`*.test.tsx` −2, `*.spec.tsx` −2**  |
| preset `files` globs              | —                                | **14 → 29**                           |

Neither consumer's measurement was wrong. The Svelte one would have caught its own change and
missed the React one; the reverse also holds. The two moved because `svelte.js` gained the
`eslintRecommended` block **and** `toolingFiles` grew from 9 entries to 24 — independent parts of
the package, which is why a clean file-set diff is not evidence about rules and a clean rule diff is
not evidence about coverage.

The `.svelte` figure matters if you have components: `no-undef` is among the 18 that switch off,
which is the point of the change — ambient and namespaced types such as `NodeJS.Timeout` and
SvelteKit's `App.*` are values the rule cannot see, so it reports them as undefined inside
`<script lang="ts">` while identical code in a `.ts` file is clean.

**The test-file row is the one most likely to surprise, because nothing about it is framework
specific.** The old tooling list carried `*.test.ts` and `*.test.js` but not `*.test.tsx`,
`*.spec.tsx`, `*.spec.js`, `*.config.cjs`, or anything under `tools/`. So whether a file counted as
tooling depended on which of two interchangeable suffixes its author had picked, and `no-console`
fired in `a.test.tsx` while staying silent in `a.test.ts` next to it. At `0.15.0` both are exempt.
If your finding count **drops** after this bump, look in your test files before assuming a rule was
lost.

### Prefer measuring the artifact over reasoning about the config

A consumer put the underlying point better than the paragraphs above do, and it reorders the whole
section:

> The fix isn't "also compare file sets," it's "measure the artifact instead of reasoning about the
> config."

That is right, and it explains why every failure catalogued in this guide sits on one side of a
line. In order of decreasing reliability:

| Method                                  | Sees rule changes | Sees file-set changes | Sees your inventory |
| --------------------------------------- | ----------------- | --------------------- | ------------------- |
| Run the preset over your repository     | yes               | yes                   | yes                 |
| Diff the resolved config per file class | yes               | only if you enumerate | no                  |
| Diff the preset's source                | no                | no                    | no                  |

A run cannot miss a file-set change, because a file that stops being linted stops producing
findings. A rule diff can, and a source diff misses both — the same consumer's from-source
reconstruction of their own findings under-counted by **19%**.

**A run has exactly one blind spot, and it is worth naming because it is invisible:** it measures
your inventory as it stands today. The same consumer found their old config selected
`.ts .tsx .mjs .js` while the preset also selects `.mts .cts .jsx .cjs`, and that the delta was
**zero** — because their repository contains none of those four. That zero is an accident of
current contents, not a property of the configs. The first `.jsx` or `.cjs` file anyone adds is
linted by the preset and was not by the old config, silently and with no bump to attribute it to.
So run the preset, and separately compare the two **selection surfaces** rather than the two file
lists.

The ignore side does not net out either, and a tracked-file count cannot see it: the preset ignores
`coverage`, `dev-dist`, `.svelte-kit` and `.impeccable`, none of which are usually tracked. If your
old config ignored something the shared list does not — `.gradle`, in that consumer's case — it
stays on your must-port list even though every file-based comparison scores it zero.

A corollary, since a resolved-ruleset diff is the best tool here and worth using correctly: a rule
present at severity `0` is not a rule that runs. `eslint-config-prettier` is part of the base
preset and switches off **178 rules across nine plugin namespaces** — 81 core, 39 `vue/*`, 19
`@typescript-eslint/*`, 16 `react/*`, 11 `flowtype/*`, and others — every one at severity `0`, for
plugins that are mostly not loaded. So `--print-config` on a Svelte file legitimately lists 16
`react/*` entries and 39 `vue/*` entries. None of them run. **Grep the severity, not the name**;
the positive check is whether the rules a release actually adds appear at a non-zero severity.

**A warn severity is not advisory under `--max-warnings 0`.** The severities in these presets are
chosen deliberately — `react-hooks/exhaustive-deps` is `warn` because it has real false positives,
`no-console` is `warn` because tests and scripts legitimately print. But the gate this guide
recommends, `eslint . --max-warnings 0`, promotes every one of them to build-failing. Verified:
identical source, exit `0` without the flag and exit `1` with it. The distinction between `warn`
and `error` collapses silently for anyone following the recommended gate, and `warn` reads as a
soft landing that does not exist.

Counts resolved through `ESLint.calculateConfigForFile` on a `.tsx`, which is the only correct way
to measure this — flat-merging the `rules` blocks ignores `files` scoping and reports every preset
one rule short:

| Preset           | `warn` rules | Notes                                   |
| ---------------- | ------------ | --------------------------------------- |
| `base()`         | 1            | `no-console` — so no consumer is exempt |
| `reactConfig()`  | 2            | adds `react-hooks/exhaustive-deps`      |
| `svelteConfig()` | 2            | adds `svelte/no-at-debug-tags`          |
| `nextConfig()`   | 18           | 14 `@next/next/*` plus four shared      |

If you run `--max-warnings 0`, decide per rule whether you want it blocking and downgrade the rest
at your call site rather than discovering it mid-migration. The count is pinned by a test in this
repository, so a release cannot change it silently.

**And the source diff misleads in the other direction too, which is the case that costs a bump
rather than hiding one.** A consumer verifying `0.6.0 → 0.7.0` found `react.js` had changed by
**−67 lines** and was about to report a behavioural change. The resolved config was identical:
342 rules on both sides, zero differing, compared key by key. The entire diff was an extraction of
three helpers into a new `hooks.js`, imported back.

So the two failure modes are symmetric and both are invisible from the source:

| What you compare  | What it misses                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- |
| adjacent versions | everything between your pin and the floor                                          |
| source files      | refactors that change no behaviour, and behaviour that changes with no source edit |

A refactor reads as a behavioural change; a dependency bump or a default flipping in a plugin
changes behaviour with no diff at all. **Compare resolved configuration between the version you
have and the floor, and treat the source diff as a hint about where to look, never as the result.**

That consumer drew the right practical conclusion from it: because the resolved config was
identical, an expensive prior measurement — 317 findings across their repository — **carried over
without re-running**. That is worth stating precisely, because "this release did not affect you"
and "this release resolves to an identical configuration for you" sound alike and only the second
one licenses skipping the re-validation.

> **A retracted claim has to be corrected where it was made, not only where it landed.** A consumer
> was told by this repository that "any authenticated token may now read the packages; no per-repo
> access grant is needed". That was wrong. They did not act on it, and when a later message
> attributed the belief to them, they declined the correction and named the actual source — this
> guide — rather than accepting a fix to a mistake they had not made.
>
> That is the right move, and the reason is not politeness. A correction applied to the wrong party
> leaves the claim intact at its origin, where it goes on being repeated to everyone else. **Wrong
> attribution converts a fixable error into a recurring one.** If a correction arrives for something
> you never claimed, say so and point at where it came from.

**Tracking releases diligently is not currency either, and this is the failure mode that survives
everything above.** One repository bumped three separate times, each time promptly, each time to
the number named in the most recent message it had received — and reported, with a freshly read
`package.json` quoted as proof, that there was "nothing to re-pin". All three were still short:

| Package           | Declared | Ceiling the caret imposes | Published |
| ----------------- | -------- | ------------------------- | --------- |
| `eslint-config`   | `^0.4.0` | `<0.5.0`                  | `0.13.0`  |
| `tsconfig`        | `^0.3.0` | `<0.4.0`                  | `0.4.0`   |
| `prettier-config` | `^0.2.0` | `<0.3.0`                  | `0.3.0`   |

Nothing here is careless. The re-read was real, the bumps were real, the reasoning was sound. The
defect is that **a version named in a message is a snapshot of the moment it was written**, and a
range derived from one inherits that timestamp permanently. Diligence about applying values you
are sent cannot correct for the values being older than the registry — it only makes you stale
more confidently, because each bump feels like a currency check and none of them was one.

This repository is also a Svelte repository, which lands it in the trap described immediately
above: `^0.2.0` on `prettier-config` excludes `0.3.0`, the single release that widened
`prettier-plugin-svelte` to `^4.0.0`.

**So make the registry the authority, never a message and never this document — but date the read.**
A consumer followed that instruction exactly, ran a registry query, and quoted the result as
"read from the registry just now". The list was ~30 hours old:

| Package           | Their registry read    | Actually published        |
| ----------------- | ---------------------- | ------------------------- |
| `eslint-config`   | `…0.2.1, 0.3.0, 0.4.0` | `…0.11.0, 0.12.0, 0.13.0` |
| `tsconfig`        | `0.1.0, 0.2.0, 0.3.0`  | `…0.3.0, 0.4.0`           |
| `prettier-config` | `0.1.0, 0.2.0`         | `…0.2.0, 0.3.0`           |

Each list is missing exactly its newest entries, and all three truncate at the **same instant** —
after `eslint-config@0.4.0` and before `0.5.0`, which is a 58-minute window. That is the signature
of a cached packument, not three coincidences. A stale read is indistinguishable from a fresh one:
it is well-formed, plausibly ordered, and ends in a real version.

The cost was not the version numbers. On the strength of that snapshot they re-reported a defect
as still open — a preset missing its React and a11y layers — and this document then recorded that
it "had been fixed four minors inside the range their read could not see."

**That sentence was wrong, and correcting it is the more useful lesson.** The version was asserted
from memory, never checked. Bisecting every published tarball shows where `next.js` actually gains
the layer:

| package version  | `next.js` imports                                        |
| ---------------- | -------------------------------------------------------- |
| `0.5.0`          | next plugin, `typescript-eslint`, `base`, `ignores`      |
| `0.8.0`          | next plugin, `base`, **`resolveHooks`** — still no React |
| `0.9.0`–`0.12.0` | no `reactLayer`                                          |
| **`0.13.0`**     | next plugin, `base`, **`reactLayer`**                    |

The gap survived **nine** releases and closed in `0.13.0`, published _after_ the report that was
dismissed on the grounds that it described fixed work. For the entire period they were reporting
it, they were right.

**A correct process critique does not dispose of the report.** Both facts were true and
independent: their registry read really was stale, and the defect really was open. Delivering them
together let the first stand in for a rebuttal of the second, so a valid, repeatedly-filed defect
report was recharacterised as a methodology failure by the reporter. That is worse than simply
missing the bug, because it transfers the error to the person who found it and gives them a reason
to stop filing.

Read the two independently. "Your evidence is stale" answers _how much confidence the evidence
carries_. It never answers _whether the thing is broken_ — that requires checking the thing.

And note which party was better positioned to catch it. The consumer could only observe the
version they had installed; the version claim was this repository's to verify, and verifying it is
one command. The report was re-filed five times.

```bash
npm view @jrmoulckers/eslint-config version --prefer-online
npm view @jrmoulckers/eslint-config time.modified --prefer-online   # when the registry last changed
```

**`--prefer-online` is the whole fix**, and it is worth making a habit rather than a remedy: the
one command everybody reaches for to escape staleness has a cache in front of it. Publishing
timestamps are the cross-check — if `time.modified` predates a release you were told about, you
are reading a copy, not the registry.

**If you go one level lower and fetch tarballs, do not construct the URL.** Verifying the table
above meant downloading each published version and reading `next.js` out of it. The obvious URL
shape is wrong for GitHub Packages, and it fails in the worst possible way:

```console
$ curl -s -L -H "Authorization: Bearer $TOKEN" \
    -o 0.13.0.tgz https://npm.pkg.github.com/@jrmoulckers/eslint-config/-/eslint-config-0.13.0.tgz
$ ls -l 0.13.0.tgz
-rw-r--r-- 1 user user 21 0.13.0.tgz          # 21 bytes
$ cat 0.13.0.tgz
{"error":"Not found"}
$ tar -xzf 0.13.0.tgz -C out                  # extracts nothing, exit 0 under a pipeline
```

`curl` without `-f` writes the error body to the output file and exits `0`. The first pass of that
check therefore reported `next.js MISSING` for **every** version — a result that reads exactly like
"the file was removed from the package," and which would have produced a second false claim on top
of the one being corrected.

GitHub Packages serves content-addressed tarballs, so the real URL is in the packument and cannot
be derived from the name and version:

```
https://npm.pkg.github.com/download/@jrmoulckers/eslint-config/0.13.0/43bd4252…
```

Read `.versions["<v>"].dist.tarball` rather than building the path, and pass `curl -f` so a 404
fails loudly. The general form: **an extraction step that finds nothing is not evidence of
absence until you have confirmed the archive was real.** Same shape as a `grep -c` of `0`.

```bash
npm ls @jrmoulckers/eslint-config @jrmoulckers/tsconfig @jrmoulckers/prettier-config
npm view @jrmoulckers/eslint-config version   # what actually exists right now
```

Reading `package.json` back to yourself confirms what you declared, which was never the question.

**A lockfile generated against the live registry is not evidence of currency.** Two repositories
reached for a real `npm ci` / `pnpm install` against GitHub Packages as the rigorous answer, and
both produced a lockfile with genuine registry URLs and genuine `sha512` integrity hashes — for a
stale version. The manifest range caps resolution before the registry is ever consulted about
what is newest, so the lock faithfully records the newest version _the range permits_. Measured on
one such lockfile:

| Declared | Resolved and hashed | Published |
| -------- | ------------------- | --------- |
| `^0.8.0` | `0.8.0`             | `0.13.0`  |
| `^0.3.0` | `0.3.0`             | `0.4.0`   |
| `^0.2.0` | `0.2.0`             | `0.3.0`   |

The integrity hash is the trap: it is real, it verifies, and it attests only that the bytes match
the version that was asked for. **A lockfile answers "did I get what I declared", never "did I
declare the right thing."** Check the range against `versions.json` first; a lock built on a stale
range is a stale lock with a verified checksum.

So the resolved version is its own assertion, and it is the one behavioural verification cannot
supply:

```bash
npm ls @jrmoulckers/prettier-config @jrmoulckers/eslint-config @jrmoulckers/tsconfig
# compare against versions.json — currency is a separate claim from correctness
```

This is the sixth repository to lose work to the `0.x` caret, and the first where a thorough
verification pass ran, succeeded, and confirmed nothing about currency. It belongs with the other
instances in which **a missing thing presents as a passing one**.

> **A differential test only sees the surface you exercise — and a config factory's new
> capabilities live behind options the old version silently ignores.** The same repository later
> returned with the most rigorous method anyone has applied here: `eslint --print-config` on real
> registry installs, compared across six file classes. It reported **zero rules added, zero
> removed, zero option differences**, and concluded the versions were equivalent.
>
> Reproduced exactly — and the result depends entirely on how the factory is called:
>
> | Invocation                    | Old rules | New rules | Added  | Changed |
> | ----------------------------- | --------- | --------- | ------ | ------- |
> | `base()`                      | 449       | 449       | **0**  | **0**   |
> | `base({ strictTypeChecked })` | 449       | **498**   | **49** | **1**   |
>
> Forty-nine rules appear, **43 of them error-level** — `await-thenable`, `no-misused-promises`,
> `no-base-to-string`, `no-for-in-array` — and `no-floating-promises` flips from `off` to `error`.
> None of it is visible at default options, because `strictTypeChecked` **did not exist** in the
> old version. JavaScript destructures an absent key to `undefined`, so the old config does not
> reject the unknown option; it returns a byte-identical result and reports no problem.
>
> That is the trap in general form: **comparing two versions at their default surface cannot
> detect capability added behind a new parameter, and the older version will not tell you the
> parameter is unknown.** A diff of `0` is evidence that the paths you exercised agree, not that
> the versions are equivalent. Strictly, `print-config` compares _resolved output for one
> invocation_, and a factory has as many resolved outputs as it has option combinations.
>
> **The same option pair has a second trap, and a consumer hit it while migrating _off_ a legacy
> config.** They measured 64 rules lost against their old setup and attributed 40 of them — the
> type-aware `@typescript-eslint` rules — to a "`projectService` gap." `projectService` was
> already enabled: `nextConfig()` defaults `typeAware` to `true`, so type information was being
> supplied the whole time. Turning it on would have changed nothing, because the missing rules
> were never gated on it.
>
> `typeAware` supplies the **information**; `strictTypeChecked` layers the **rules that consume
> it**. Two knobs where the first reads as though it should be sufficient, and the symptom — 40
> type-aware rules absent — names the information rather than the rule set. Passing
> `strictTypeChecked: true` restores them, and works on every preset, since each forwards unknown
> options to `base()`.
>
> **As of `0.16.0` there is a third knob, because the second one was billing you for two unrelated
> things.** The same consumer measured what `strictTypeChecked` actually costs on a 208-file app:
> **466 findings**, of which `consistent-type-definitions` — `interface` versus `type` — was 405,
> and stylistic rules in total were **444, or 95%**. The correctness rules the opt-in exists for
> contributed 22, and the headline ones contributed **zero**: the entire unsafe family,
> `no-floating-promises` and `await-thenable` were all clean.
>
> They then did the step that makes the zero worth anything. **A rule that is absent and a rule that
> is clean are indistinguishable in a finding count**, so they confirmed with `--print-config` that
> all seven resolve to severity `2` under that config. Enabled and genuinely quiet — which is the
> same control this guide asks for after a `grep -c` returns `0`.
>
> The conclusion is a design defect, not a preference: **the price of adopting type safety was set
> by a house-style rule that has nothing to do with type safety**, and no combination of the
> existing flags could separate them. `typeAware: true` alone supplies information but layers no
> rule sets, so it resolves to the baseline count — verified, not assumed. The three reachable
> states were: no type rules, or all 43 including the restyle.
>
> | Flag                   | Layers                                 |
> | ---------------------- | -------------------------------------- |
> | `typeChecked`          | `recommendedTypeChecked` — correctness |
> | `stylisticTypeChecked` | `stylisticTypeChecked` — house style   |
> | `strictTypeChecked`    | both, unchanged — **deprecated alias** |
>
> Take the 22-finding correctness win now and schedule the 444-finding restyle independently, or
> decline it. Upgrading changes nothing on its own: a test asserts the resolved config under
> `strictTypeChecked: true` is **byte-identical** to passing both new flags — measured at 0 differing
> rules across 111 active.
>
> One trap found while implementing it, worth stating because it is this guide's own recurring
> shape. `stylisticTypeChecked` does **not** contain the recommended rules, so selecting only the
> stylistic half drops the base layer entirely — a silent coverage loss that a rule _count_ reports
> as an **increase**, since the stylistic set is larger than what it displaces. The first
> implementation had exactly that bug. It is pinned now by a test asserting the recommended layer
> survives all four combinations.
>
> The direction repeats this repository's earlier case with a better instrument. Then, behavioural
> verification passed because a stale version behaves correctly. Now, a configuration diff read
> zero because a stale version _configures_ correctly. Both times what was missing was capability,
> and capability is invisible to any test written against the features you already use. Before
> concluding two versions agree, diff the **release notes** for new options, then re-run the
> comparison passing each one.
>
> **There is a third axis, and the same repository hit it next: the _endpoints_ go stale too.**
> They later reported `0.3.0 → 0.4.0` across the same six file classes — zero lost, zero gained,
> zero option differences — while the package was at `0.13.0`. The measurement was correct and
> answered a question nobody had. Re-run to current on a `.svelte` file, active rules only:
>
> | interval         | active on `.svelte` | added | removed |
> | ---------------- | ------------------- | ----- | ------- |
> | `0.3.0 → 0.4.0`  | 94 → 94             | 0     | 0       |
> | `0.4.0 → 0.13.0` | 94 → **80**         | **4** | **18**  |
>
> The 18 are core rules TypeScript already enforces — `no-undef`, `no-dupe-keys`,
> `constructor-super`, `no-const-assign` — switched off on `.svelte` by applying
> `typescript-eslint`'s `eslint-recommended` layer there, which previously reached only `.ts`. The
> 4 added are its replacements: `no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`.
> That is the intended correction, not a loss, but it is a **22-rule change to the exact file class
> the diff reported as identical.**
>
> So a differential test has three ways to read zero while missing everything: the **surface** you
> invoked, the **options** that did not exist yet, and the **interval** you chose. The first two are
> subtle. The third is just arithmetic — `npm view <pkg> version` before you pick the endpoints — and
> it is the one that has now cost the most effort here, because the rigour of the method makes the
> result feel conclusive. **Diff to `latest`, not to the next version after yours.**

> **`strictTypeChecked` and file types no `tsconfig` covers — fixed for the class in `0.14.0`.**
> Through `0.13.0`, `svelteConfig({ strictTypeChecked: true })` did not report findings; it
> **aborted the entire run** on the first `.svelte` file:
>
> ```text
> Error: Error while loading rule '@typescript-eslint/await-thenable': You have used a rule
> which requires type information, but don't have parserOptions set to generate type
> information for this file.
> Parser: svelte-eslint-parser
> ```
>
> Exit 2, no results for any file — so this reads as a broken preset rather than a lint failure.
>
> The mechanism is worth understanding, because it is the shape of the bug rather than one
> extension. `base()` applies the type-checked sets **unscoped**, then re-disables them in trailing
> blocks for `**/*.ts*`, `**/*.js*` and `toolingFiles`. `.svelte` matched none of them.
> `svelteConfig` _did_ opt `.svelte` out of the TypeScript project — but it set only
> `parserOptions.projectService: false`, not `disableTypeChecked.rules`. **Removing the project
> without removing the rules that need one is precisely the combination that aborts.**
>
> **This was live for the entire life of the option, and the `.js` half was never broken at all.**
> An earlier revision of this section said it was "the plain-`.js` crash fixed in `0.12.0`, one file
> extension over." Both halves of that are wrong. Bisecting all fifteen published versions for the
> two strings:
>
> | version          | `strictTypeChecked` | `.js` disable block |
> | ---------------- | ------------------- | ------------------- |
> | `0.1.0`–`0.5.0`  | absent              | absent              |
> | `0.6.0`–`0.14.0` | present             | present             |
>
> They arrived **in the same release**, so **no published version ever exposed the `.js` crash** —
> it was handled correctly the moment the option that can trigger it existed. `0.12.0` changed
> nothing here; `base.js` is byte-identical between `0.11.0` and `0.12.0`.
>
> `.svelte` is the half that was actually broken, and it was broken in **every version that had the
> option**: `0.6.0` through `0.13.0`, eight consecutive releases. Verified by installing `0.6.0`
> from the registry and reproducing the same abort.
>
> So this is not a fix that landed on one extension and missed another later. The `.svelte` path was
> **never** covered, and the reason is structural: the disable blocks were written by enumerating
> extensions, and an enumeration silently omits whatever it does not name. Any file type a
> `tsconfig` cannot include has the same property. `0.14.0` therefore adds `untypedFiles` to
> `base()`, which places caller globs in the **trailing** position, and `svelteConfig` passes its
> own three.
>
> **The correction is worth more than the fact, because of when it was made.** The wrong version
> number shipped in `v0.103.0` — the same release whose notes state that _a fixed-in version is a
> claim about the registry and has to be checked against it like any other_. Writing the rule down
> did not cause it to be applied to the sentence next to it. A number recalled from a prior
> conversation reads like a memory, not like a claim, so it never triggers the check that the rule
> demands. **Treat every version number you did not just read off the registry as unverified,
> including ones in your own recent work.** A consumer caught this one by asserting a different
> number in passing.
>
> **A preset could not have fixed this itself, and that is the design point.** Its entries arrive
> via `extend`, which `base()` splices in _above_ the trailing blocks specifically so a caller
> cannot re-enable a rule the preset switched off. Correct in general, but it also means the
> preset had no position from which to switch one off.
>
> **If you worked around this, remove the workaround.** Passing the disable block through `extend`
> did turn exit 2 into exit 1 — but only because _no_ trailing block matched `.svelte`, which made
> a caller entry last-matching. That is the opposite of the documented guarantee, and it never
> worked for `.js`. From `0.14.0` the guarantee holds for both, so the `extend` workaround stops
> working and a regression test pins that it must.
>
> What `strictTypeChecked` actually costs is worth measuring before you enable it. One Svelte
> repository found **71 findings across 18 files** — and 66% of them were two stylistic rules
> (`require-await` 27, `prefer-promise-reject-errors` 20), with `no-floating-promises` firing
> **zero** times and the whole `no-unsafe-*` family firing three. Real discipline, but a costed
> change rather than a free upgrade, and the headline rules may not be the ones you get.
>
> **Do not verify this fix without enabling the option that triggers it.** One repository confirmed
> the fix was active by linting a plain `.js` file through its own `svelteConfig()`:
>
> ```bash
> echo 'export const probe = 1;' | eslint --stdin --stdin-filename src/probe.js   # exit 0
> ```
>
> That probe cannot fail. Its config does not pass `strictTypeChecked`, so the type-checked sets are
> never applied, so there is nothing to abort — on **any** version. Installing `0.5.0`, which
> predates the whole mechanism, returns the same exit 0. The probe measures that type-aware linting
> is off, and reports it as evidence that a type-aware crash is fixed.
>
> This is the same defect as the deleted `/packages` probe in a different costume: **an all-clear
> whose failure mode also renders as an all-clear.** The check is cheap — run the probe against a
> version you believe is broken and confirm it goes red first. Here that is unusually awkward, and
> worth knowing before you try: because the option and its `.js` guard shipped together, **no
> published version produces a red for the `.js` case at all**, so the probe has no valid negative
> control anywhere in the release history. `.svelte` on `0.6.0`–`0.13.0` is the only real one.

> **A stale pin hides the fix for the bug you are about to report.** The sharpest instance so far:
> a Svelte repository held `prettier-config` at `^0.2.0` deliberately, and in the same message
> escalated — as an open upstream defect — that the package's `prettier-plugin-svelte` peer of
> `^3.2.0` was stale against the `4.1.1` it runs. Release `0.3.0`, the one release that caret
> excludes, is exactly the one that widened that peer to `^3.2.0 || ^4.0.0`.
>
> The bug report and its remedy were separated by the version range alone. That is worse than an
> ordinary stale pin, because it is **self-sealing**: the range does not merely withhold the fix,
> it makes the fix unobservable, since the release carrying it is never fetched and never read.
> Nothing in the repository can distinguish "not fixed yet" from "fixed in a version my range
> forbids", so the natural next step is to escalate — and the escalation is unfalsifiable from
> inside the pin.
>
> Three separate repositories have now reported a peer range as a live upstream defect when the
> widening had already shipped. Before filing one, resolve the current version and read the peer
> **there**: `curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/versions.json`,
> then check the peer at that release rather than at your pinned one.

**Use that, not `npm view`, and not `git show`.** This table went stale within one release of being
written — twice — and the verification command previously recommended here was `npm view`, which
requires registry access, the one thing the repositories most likely to be stale do not have. A
check that only works for readers who are already fine is not a check.

The `git show origin/main:versions.json` form recommended here before was better, but it has a
failure this one does not: **`origin/main` is a local cache.** Without a preceding `git fetch` it
returns whatever you last downloaded, silently and with no error. A consumer read this repository at
a tag sixteen releases behind and reported four facts as current — the published versions, a missing
`projectService`, absent hooks rules, and absent type declarations. All four were true at their ref.
All four were false on `main`. Nothing in their method could have revealed that, because a stale
read looks exactly like a fresh one.

`curl` against `raw.githubusercontent.com` cannot be stale: no clone, no fetch, no local ref, and no
authentication, since this repository is public. If you prefer `git`, run `git fetch origin` first
and treat the fetch as part of the command rather than as something you did earlier.

> **Reading the source is not more current than reading a manifest. Currency is a property of the
> ref, not of the method.** A consumer opened with _"confirmed against source, not transcribed"_ —
> exactly the right instinct — and read `packages/eslint-config/package.json` at tag `v0.4.0`. They
> found `eslint: ^9.0.0`, correctly derived that their `eslint@10` tree would `ERESOLVE`, and filed
> it as a second blocker independent of package visibility. Every step was sound and the conclusion
> was false: the current release peers `^9.0.0 || ^10.0.0`, and had for nine minors.
>
> They then went further, resolving the preset from that source and _executing_ it — the strongest
> form of verification anyone in this migration has used — and reported that the `react` subpath
> throws on ESLint 10 because `eslint-plugin-react` calls the removed `context.getFilename()`. That
> diagnosis is exactly right, and it is the same one that produced the fix already shipped: the
> preset sets a concrete `settings.react.version` instead of `'detect'`, which is what triggers the
> removed API. Reproduced on their exact versions — `eslint@10.6.0`, `eslint-plugin-react@7.37.5` —
> the current `reactConfig()` loads and `react/jsx-no-target-blank` fires.
>
> **Executing the code does not rescue you from reading it at the wrong ref**, and it is worth
> saying plainly because the effort is what makes it convincing. Running a thing feels categorically
> stronger than reading about it, so a result obtained by execution gets less scrutiny about
> _which_ thing was run. This is the same failure as the stale-pin case above with the direction
> reversed: there, current source and a stale install; here, a stale checkout executed faithfully.
> Both produce a true statement about the wrong artifact.
>
> Check the ref before checking the code. `git fetch origin && git describe --tags origin/main`, or
> `curl` the raw `versions.json`, costs one command and invalidates the entire investigation if it
> disagrees.

> **Your tooling goes stale the same way your packages do, and it is the channel nobody checks.** A
> consumer hand-verified all 18 of their linked citations against each principle's `source` field,
> reported `0 mismatched`, and offered to add that comparison to `check-citations.mjs` — describing
> it as "the thing your tool still doesn't cover." The checker has done exactly that since PR #54,
> on by default, with `--no-links` to turn it off. On a deliberately broken fixture it reports the
> wrong target, prints the expected path, and explains the very area-prefix trap they had
> independently rediscovered.
>
> Three things make this worth recording rather than laughing off:
>
> - **A correct manual result raises no alarm.** Their hand-check returned `0 mismatched` — the
>   same answer the tool gives. Nothing in a correct outcome signals that the labour was
>   unnecessary. Had they got a _wrong_ answer they would have investigated and found the flag.
> - **Tools get assumed where packages get probed.** This consumer had verified peer ranges by
>   executing resolved trees, and measured a formatter by running it twice under controlled
>   conditions. They did not run `--help` on the checker. A dependency invites a version question;
>   a script that ran once and worked does not.
> - **The countermeasure already existed and still did not land.** Every clean run prints
>   `checker v9; checks run: IDs, stated names, range members, link paths` — added precisely so a
>   silent check could not be mistaken for a missing one. A self-report can only correct you if you
>   run the current build. It cannot reach someone who never re-ran it, and it cannot reach someone
>   reasoning about the tool from memory.
>
> So treat the tooling as a pinned dependency with a version worth checking: re-fetch
> `check-citations.mjs` from `main` and read the `checks run:` line before concluding a category is
> uncovered — and before writing a checker that already exists.

Their general point survives the correction and is worth keeping: **a satisfiable range is not the
same as a working range.** The preset's `eslint-plugin-react: ^7.37.0` does permit versions that
need the `settings` workaround to run at all, so the config compensates for a plugin defect the
manifest cannot express. Only executing the resolved tree shows that — which is why the repository
runs its preset tests under an ESLint 9 **and** an ESLint 10 matrix rather than trusting the peer
range to describe reality.

A test asserts that every version range printed in this document matches `versions.json`, so the
table above cannot drift again without failing CI.

**And read `channel` while you are there.** All three packages are `"channel": "registry"`, so all
three require a token and all three are gated on the same visibility grant.

Three repositories independently reported being blocked on all three packages, and this paragraph
previously told them that only `eslint-config` was affected — that `tsconfig` and
`prettier-config` were `"channel": "vendored"`, never published, and adoptable while blocked.
**They were right and this document was wrong.** The correction and its cause are under §1.

The lesson survives the correction, and is now sharper. The original diagnosis was that prose goes
stale in a consumer's checkout while `versions.json` is read from `main`, so the meaning of
`channel` should live beside the value. That reasoning is still right, and it is why the legend
exists. But it was applied to a value that was itself false, which moved a wrong answer somewhere
more authoritative and harder to argue with. **Co-locating an explanation with a value does
nothing if nothing checks the value**, and three consumers contradicting it was the signal that
should have prompted the check.

So the legend now carries an enforcement rather than an assertion: a channel declaring
`"requiresRegistryAuth": false` must be backed by a package with `private: true`, and a channel no
package uses cannot remain in the file. Both are tested.

**If that command fails for you, read [`versions.json`](../versions.json) at the repository
root — not a git tag, and not `packages/<name>/package.json`.** A consumer without
`read:packages` gets `401`/`403` here, which is the same position as a repository whose access
grant has not landed yet. The tempting fallback is to read `packages/<name>/package.json` at a
tag, and it is wrong in a way that looks authoritative: it reports the source tree at that
moment, not what is published. That failure has now happened repeatedly, in both directions — a
consumer concluding a fix was missing when it had shipped several releases earlier, and
Engineering citing a repository tag as though it were an installable version. **Both are the same
mistake**, and the second one causes the first.

`versions.json` exists because that instinct — read the repository — is not going away, and
three separate repositories acted on it after this section already told them not to. So the
repository now answers correctly instead. It records the published version, the channel, the
range to pin, and the peer ranges, and `npm run versions:check` fails CI if any of it drifts from
the registry. It is therefore safe to read at a tag: every commit on `main` had it matching the
registry at that time. A newer version may exist, but nothing it states will be wrong.

#### Telling "not authorized yet" apart from "not published"

A `401` on its own answers nothing, and several repositories have read one as proof a package was
private. GitHub Packages **authenticates every read, including of public packages**, so an
anonymous request returns `401` whether the package is public, private, or absent. Visibility
changes _authorization_, not _authentication_.

Run it twice, and the pair is what settles it:

```bash
# 1. anonymous
curl -so /dev/null -w '%{http_code}\n' \
  https://npm.pkg.github.com/@jrmoulckers%2Ftsconfig

# 2. authenticated
curl -so /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://npm.pkg.github.com/@jrmoulckers%2Ftsconfig
```

| Anonymous | Authenticated | Meaning                                                        |
| --------- | ------------- | -------------------------------------------------------------- |
| `401`     | `200`         | Readable by you. Any install failure is elsewhere.             |
| `401`     | `403`         | Authenticated fine, **not authorized** — access grant is owed. |
| `401`     | `404`         | No such package or version.                                    |
| `401`     | `401`         | Your token is wrong or lacks `read:packages`.                  |

The `403` row is the one worth knowing, because it separates _your_ problem from _ours_: your
token works, and what is missing is a grant only the package owner can make. Reported by a
consumer who ran both probes rather than escalating on the `401` alone — which lets any
repository answer "has the access landed yet" without asking.

The `401`/`200`/`404`/`401` rows were confirmed from the owner side against this registry; the
`403` row is the consumer's evidence, since an owner cannot reproduce it.

That last distinction is the whole design. This table and the floor table are literals that age
silently; `versions.json` is a literal that **cannot** age silently, because a check compares it
to the registry rather than trusting it. Prefer it over any version number written in prose,
including numbers written here.

So: if you cannot query the registry, take versions from `versions.json`, and say in your report
that you could not verify against the registry yourself. That sentence is what lets the claim be
checked rather than propagated.

If you are reporting a defect in a preset, **state the version you resolved, not the range you
pinned.** Several reports have described behaviour fixed many releases earlier, because a `^0.1.0`
range held the install at `0.1.x` while the report was written against current documentation.

**`versions.json` cannot be found by the tags most likely to need it.** It is newer than much of
what consumers are pinned to, so a repository old enough to be reading `packages/*/package.json`
at a tag is usually too old to contain the file that would have told it not to. One repository
read `packages/eslint-config/package.json` at `v0.2.8` and reported `eslint: ^9.0.0` as too narrow.
That read was _correct for that tag_ — the package was `0.2.1` there — but the published version
was `0.10.0`, which had widened it to `^9.0.0 || ^10.0.0` along with the two other ranges the same
report asked for. So the check is not "does the repository say the range is narrow", it is **"am I
reading a tag old enough that this file predates the answer?"** If `versions.json` is absent from
the tree you are reading, that absence is itself the finding: resolve a newer ref before reporting
anything about versions.

**In any document that states a version twice, the summary is the copy that goes stale.** A
consumer found their own `AGENTS.md` saying the shared packages were "all pinned at `v0.1.0`"
thirty lines above adoption guidance that correctly said `^0.2.1` — the detail had been revised
three times and the summary line never re-read, because nobody re-reads the summary while editing
the section it summarizes. The failure is not cosmetic: `0.1.0` was not installable in that
repository at all, and the one-line summary is the first thing every reader hits. Either state the
version once and link to it, or point both places at `versions.json`. This is the same failure as
acting on a compressed summary instead of the artifact, committed at authoring time rather than at
reading time.

**Check the registry, not a git tag.** A repository tag and a package version are different
numbers and move independently: this repository was at `v0.2.5` while `@jrmoulckers/tsconfig` was
at `0.2.0`, and is at `v0.97.x` while that package is at `0.4.0`. Reading
`packages/tsconfig/package.json` at some tag tells you what the source tree contained then, not
what is published now — a consumer checked exactly that and concluded a peer range had never been
widened, four releases after it was. The registry is authoritative:

```bash
npm view @jrmoulckers/tsconfig version peerDependencies \
  --registry=https://npm.pkg.github.com
```

**And `git show main:path` may not be reading `main`.** Investigating the collision above, I ran
`git show main:packages/eslint-config/package.json` and got `0.10.0` — a version that was never
published and does not exist anywhere. The cause is worth knowing because it is invisible: in a
worktree checkout the primary `main` is checked out elsewhere, so the local `main` ref is never
updated by anything done here. `git fetch` advances `origin/main` and leaves `main` alone.

```console
$ git rev-list --count main..origin/main
87
```

Eighty-seven commits behind, and every `git show main:<path>` had been silently answering from
that. It does not error, and the answer is a real file from a real commit — it is simply the wrong
commit. **Read `origin/main`, not `main`, whenever the checkout is a worktree.** This is the same
failure shape as the stale registry cache: a well-formed answer to the question you did not ask.

**Never cite a repository tag as a version to install.** Release notes here are written against
repository tags, and adoption briefs have repeated them — but `v0.16.0` is not something you can
put in a `package.json`, and the three packages carry three different numbers that all differ from
it. A consumer told to "adopt `v0.2.5`" will reasonably write `^0.2.5` and get a resolution error
for all three. Resolve each package separately; that is what the command above is for.

**That failure used to be loud. It is now silent, and this is the sharper form of the trap.** The
paragraph above assumes a consumer given a tag writes it into a manifest and gets a resolution
error. That held while tags ran far ahead of package versions. It stopped holding once the package
numbers entered the same range, because **the two sequences now collide**: a tag number is very
often also a real package version, and installing it succeeds. Measured, same repository, same
moment:

| Repository tag | `eslint-config` package inside it |
| -------------- | --------------------------------- |
| `v0.4.0`       | `0.3.0`                           |
| `v0.13.0`      | `0.8.0`                           |
| `v0.97.0`      | `0.13.0`                          |

So the string `0.13.0` names two different artifacts 84 tags apart. A consumer told "published as
`v0.4.0`" who writes `^0.4.0` installs package `0.4.0` — which exists, resolves cleanly, passes
every gate, and is **not** the code in tag `v0.4.0`. There is no error to notice. Read the table in
the other direction too: inspecting `packages/eslint-config/package.json` at tag `v0.13.0` shows
`0.8.0`, so a consumer confirming "the fix is in 0.13.0" against that tag finds a version number
five minors below the one they were told about and reasonably concludes the claim was wrong.

**State floors as package versions, and never name a repository tag where a manifest value is
expected.** Release notes here are written against tags because that is what a release _is_; that
makes them the wrong thing to copy into `package.json`. If a number is going into a dependency
range, it must come from `npm view <pkg> version --prefer-online`, not from a release title, not
from this document, and not from a message.

### A green install does not prove your peer ranges are satisfied

Package managers disagree about what an unmet peer means, and the disagreement is silent:

| Manager                              | Unmet peer                |
| ------------------------------------ | ------------------------- |
| pnpm (default)                       | warning; install succeeds |
| pnpm with `strict-peer-dependencies` | error                     |
| npm 7+                               | `ERESOLVE`; install fails |

So a pnpm repository can run lint, format, and typecheck entirely green while three peer ranges are
unmet, and learn nothing. This is not hypothetical: a consumer verified a full green toolchain and
only found the unmet ranges by reading the manifests, having sailed past the wall an npm repository
would have hit on the first install.

The consequence worth acting on is that **a green run in one repository is not evidence for
another.** If you are on pnpm, check unmet peers explicitly rather than inferring them from a
passing build:

```bash
pnpm install --strict-peer-dependencies --lockfile-only
```

This is the same shape as two other traps in this guide — a clean `rules-of-hooks` run, and a
lab-only performance channel. In each, a tool reports nothing and the absence is read as
correctness when it only means the check was never made.

### A committed lockfile is what makes a wide range safe

A consumer widened `^0.8.0` to `>=0.8.0 <1.0.0` so that an eventual `0.9.0` would be reachable
without a hand edit nobody would be prompted to make. That is the right call **for them**, and the
reason is not the range — it is that they commit `package-lock.json` and CI runs `npm ci`. CI
resolves the locked version and nothing else, so a publish here cannot redden a PR that did not
touch the lockfile. The range governs what `npm update` may _reach_, not what CI _resolves_.

Invert either half and the same range becomes a liability. Without a committed lockfile — or with
an install command that re-resolves — a wide range on a **lint config** means a minor published
here adds rules to somebody else's unrelated PR, hours after it was opened, with no local change.
That is the precise failure this repository refuses to cause elsewhere: `--check` warns on
staleness rather than failing, so that a tag pushed here can never redden a consumer's build. A
range wide enough to auto-adopt rules gives that property away one layer down, where this
repository cannot protect it.

So the guidance is conditional, not universal:

| Your setup                                      | Recommended range                                    |
| ----------------------------------------------- | ---------------------------------------------------- |
| Lockfile committed, CI runs `npm ci`/`--frozen` | wide (`>=0.8.0 <1.0.0`) — upgrades stay deliberate   |
| No lockfile, or CI re-resolves                  | pin exactly, and bump in a change that runs the gate |

Note also that these are **floors, not the published set**. Version tables in this guide name the
minimum that carries a given fix; a consumer found a `0.2.1` that no table here had ever mentioned.
`versions.json` records published state — read it rather than inferring the set from a floor.

### The two packages support different TypeScript versions, on purpose

| Package                      | `typescript` peer                | Verified against                              |
| ---------------------------- | -------------------------------- | --------------------------------------------- |
| `@jrmoulckers/tsconfig`      | `^5.5.0 \|\| ^6.0.0 \|\| ^7.0.0` | 5.9, 6.0.3, 7.0.2 — all presets compile clean |
| `@jrmoulckers/eslint-config` | `>=5.5.0 <6.1.0` (optional)      | Ceiling set by `typescript-eslint@8.67.0`     |

**Do not "fix" this by making them agree.** `@jrmoulckers/eslint-config` depends on
`typescript-eslint`, whose own peer range is `>=4.8.4 <6.1.0`, so it cannot honestly claim
TypeScript 7 until that ships. The peer is declared — and marked optional, so JavaScript-only
consumers are unaffected — precisely so a TypeScript 7 repository gets an install-time `ERESOLVE`
naming the conflict, instead of a confusing failure inside the type-aware lint rules later.

If you are on TypeScript 7, adopt `@jrmoulckers/tsconfig` now and hold `@jrmoulckers/eslint-config`
until `typescript-eslint` widens. That split is expected, not a misconfiguration.

This bites hardest where a repository verified against the source tree — a `file:` or `link:`
dependency onto a local checkout resolves to whatever is checked out, which is current, while
the committed manifest still says `^0.1.0`. The gates pass locally and then install something
older in CI. If you verified that way, re-check the range you actually committed.

> **Sharper: the wrong range is not unverified, it is _unverifiable_ by that method.** A consumer
> who had verified exactly this way drew the distinction, and it is the more useful statement. A
> `file:` resolution **ignores the range entirely** — the specifier is never consulted, so it is
> never exercised, so no amount of care in the local run can surface a wrong one. The two
> disagreements cancel out visually: the source is current, the results are real, and the manifest
> that would have contradicted them was never read.
>
> This matters because "re-run your gates after bumping" implies the gates could have caught it.
> They could not. **The step that catches it is lockfile generation**, which resolves the range
> against the registry — and for a repository blocked on package access, that is precisely the step
> it cannot run. Treat a `file:`-verified adoption as carrying **one unvalidated field** into CI,
> and re-read the range by eye against `versions.json` before the pull request opens.
>
> **`npm pack` has the same hazard with a sharper edge.** A consumer verified by packing the local
> checkout, then correctly observed that the packed versions each satisfied their declared range —
> and concluded the green run therefore covered the manifest. It did, but only against **that
> checkout**, which was several minors behind `main`. A `file:` link at least always resolves to
> current source. `npm pack` freezes whatever the tree happened to be, so the check "does the
> packed version satisfy my range?" can pass while both sides are stale together. Self-consistency
> is not currency. Compare against `versions.json` on `main`, not against the tree you packed from.

**"Did you install a tarball, or link a checkout?" is the diagnostic question.** A second consumer
proposed it after using `npm pack` deliberately — not as a shortcut, but because a workspace link
resolves differently from a registry install and they wanted the failure modes a real install has.
That reasoning is right, and it separates two things the paragraph above ran together:

| Method                 | Resolves to        | Exercises your declared range? | Exercises packaging? |
| ---------------------- | ------------------ | ------------------------------ | -------------------- |
| `link:` / `file:`      | live working tree  | no                             | no — `files` ignored |
| `npm pack` + install   | the packed tarball | no                             | **yes**              |
| lockfile from registry | the published tar  | **yes**                        | yes                  |

So `npm pack` is materially better than a link: it honours `files`, `exports` and `main`, so a
missing entry point or an unpublished directory fails the way it would in CI. The hazard is
narrower than "packing is a trap" — it is that the packed tree can be stale, and that **neither**
local method consults your declared range.

> **Generate the lockfile with the same package-manager major CI runs, and check which that is.**
> A consumer regenerated a lockfile against the real registry on npm 11.16.0, verified it locally,
> and CI rejected it: the reusable workflows run Node 22 / npm 10.9.8, and npm 10 read the npm-11
> lockfile as out of sync — `Missing: picomatch@4.0.5 from lock file`. The manifest and the
> resolved versions were correct; only the lockfile's internal placement differed. Regenerating on
> npm 10.9.8 fixed it in 15 insertions / 72 deletions with no manifest change.
>
> **`lockfileVersion: 3` does not imply cross-major compatibility.** Both majors write v3, and the
> version field is unchanged by the incompatibility, so the file looks portable and is not.
>
> **It is also graph-dependent, so do not try to predict it.** Reproducing this on a minimal
> `svelte-check` tree did **not** fail: an npm-11 lockfile installed cleanly under
> `npm@10.9.8 ci`. Whether a given dependency graph trips it is not something you can reason about
> in advance, which is the argument for matching the major rather than for knowing when it
> matters. Pin the manager in `packageManager`, or read the Node version the reusable workflow
> actually uses, and generate to match.
>
> **This is not a source of dependency-count differences.** Measured directly, because it was a
> plausible explanation for a long-running bloat report: installing a package declaring three
> optional peers into an identical tree adds exactly one directory under **both** npm 10.9.8 and
> npm 11.16.0, and installs none of the optional peers under either. Optional-peer behaviour does
> not vary across these majors; lockfile placement does.

**The general rule, which is not npm-specific: verify against the resolved artifact, not a
convenient local stand-in.** This framing came from the one consumer with no npm surface at all,
and it is better than the packaging-flavoured version above because it survives a change of
channel. The failure has the same shape everywhere it appears:

| Channel           | The convenient stand-in                                       | What CI actually resolves               |
| ----------------- | ------------------------------------------------------------- | --------------------------------------- |
| npm packages      | a `link:`/`file:` checkout, or a stale pack                   | the tarball your declared range selects |
| fetched Go config | golangci-lint's built-in defaults, when the fetch has not run | the pinned `configs/golangci.yml`       |
| vendored files    | the copy in your tree                                         | the copy at the ref you recorded        |

The Go instance is worth stating because the mechanism is completely different and the symptom is
identical: golangci-lint does not error on a missing config, it silently falls back to its defaults.
A contributor who has not run the fetch loses `bodyclose`, `errorlint`, `nilerr`, `rowserrcheck`
and `misspell`. In the rebase that surfaced this, a `nilerr` violation would have shipped for
exactly that reason.

**An earlier revision of this paragraph said they also get a "clean local run", and named `revive`
and `unconvert` among the losses. Both were wrong**, and both were written from documentation
rather than from a run. Measured: `--no-config` produces **20 errcheck findings** where the shared
config produces **0**, because the defaults include `errcheck` without the config's
`std-error-handling` exclusions. `revive` and `unconvert` are not in the shared config at all.

That correction generalises past Go. **Compare the set of findings, not the set of rules.** A
rule-by-rule diff scores the unfetched Go case as "minus five linters, strictly looser" and misses
that it is simultaneously stricter in what it reports, because exclusions are configuration too.
The npm presets fail the same diff from the other side: identical rules, different set of files
linted. A findings diff is the only comparison neither mechanism can hide from, and it is cheaper
than reasoning about either.

Because the mechanisms differ, a fix for one does not fix the other — the shared discipline is the
question, not the remedy: **is the thing I just verified the thing that will be installed?** Ask it
before believing a green local run, on any channel, including ones added later.

**And "no npm surface" is not "no JavaScript".** That same consumer recorded the presets as
non-applicable, correctly, on the evidence they had — then asked a second question and found six
hand-authored browser ES modules served from Go via `//go:embed`:

| Probe                        | Count |
| ---------------------------- | ----- |
| `package.json`               | 0     |
| `eslint*` / `tsconfig*.json` | 0     |
| `.ts` / `.tsx`               | 0     |
| **`.js`**                    | **6** |

No bundler, no package manager, no build step — and, until they looked, linted by nothing at all.
`package.json: 0` and `.js: 0` are different questions, and only the first one gets asked, because
the absence of a manifest reads as the absence of a language.

**Measured before repeating their conclusion: `base()` handles this shape today.** With no
`tsconfig.json`, no TypeScript, and no bundler:

```console
$ npx eslint static/js/api.js
$ echo $?
0

$ npx eslint static/js/bad.js        # typo'd globals, unused binding
  4:9  error  'unusedVar' is assigned a value but never used   @typescript-eslint/no-unused-vars
  6:3  error  'documnet' is not defined                        no-undef
  7:3  error  'windwo' is not defined                          no-undef
```

Note both halves. The clean file passes with real `fetch`, `document` and `window`, so browser
globals are configured rather than `no-undef` being switched off — and a _typo'd_ global is caught,
which is the defect this file shape is most prone to and which no Go linter will ever see.

So for a repository like this the presets **do** apply; what is genuinely open is whether a Go
repository wants a Node toolchain, which is a cost decision and not an applicability one. Record it
that way. "N/A — no npm surface" closes the question; "applies, declined for toolchain cost" leaves
it visible.

This also revises the crash reported at `0.6.0`, where plain `.js` outside the config/script/test
escape hatch aborted a run. Hand-authored browser ESM with no project file anywhere is a **second
confirmed instance** of that shape, from an unrelated repository — enough to treat it as a category
the presets must handle rather than an edge case.

A **third** instance is the one that should set your expectations, because it is the least exotic:
a Next application carrying three ordinary `.js` files in its own `src/` — an env module, a logger,
a config table — alongside its TypeScript. Not tooling, not embedded assets, not a foreign
ecosystem. The consumer confirmed it per file:

| File                        | `no-misused-promises` | `projectService` |
| --------------------------- | --------------------- | ---------------- |
| `src/env.js`                | `0`                   | `false`          |
| `src/lib/log.js`            | `0`                   | `false`          |
| `src/config/media-hosts.js` | `0`                   | `false`          |
| `src/lib/utils.ts`          | `2`                   | `true`           |

**So the question to ask before adopting a type-aware option is not "do I have unusual files?" but
"do I have any `.js` under `src/`?"** In a repository mid-migration to TypeScript the answer is
almost always yes, and those files are the ones least likely to be remembered — they are the part
of the codebase nobody is currently working on. The last row is what makes the table evidence
rather than an absence: it shows the rule is genuinely on where a project exists, so the zeros
above are scoping and not a preset that quietly disabled itself.

> **The wider class: a missing thing presents as a wrong thing, or as a passing one.** The same
> consumer unified three failures in this migration that had been recorded separately, and the
> unification is correct — they are one lesson, not three:
>
> | Missing                               | How it presents                                                                                 |
> | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
> | no registry token                     | `401`, textually identical to a wrong or expired token                                          |
> | no fetched `.golangci.yml`            | a _different_ finding set — noisier on `errcheck`, silent on five linters                       |
> | a failed fetch writing to disk        | an error body saved as config, with exit status `0`                                             |
> | `packages: read` absent from a caller | `startup_failure` with **no job, no step and no log** — see below, this has more than one cause |
>
> In each case the absent thing is indistinguishable from a present-but-wrong thing, and in two of
> them it is indistinguishable from success. **So verify presence before assuming validity**: check
> the token is non-empty before concluding it is invalid, check the config exists before trusting
> a clean run, check the fetched body is the shape you expected before moving it into place. An
> error message describes what failed, not what was missing, and reasoning from the message alone
> reliably diagnoses the wrong one.
>
> The same consumer later added the fourth row and it is the most extreme member: the other three
> at least produce output to misread, while this one produces **nothing at all** and so presents as
> a fault in GitHub rather than in your file. It also shows the countermeasure has a limit — you
> cannot assert presence from inside a job that is never created, so this row is checked by reading
> the caller against the callee, or from a separate workflow file. Where the general rule fails,
> the fallback is to make the dependency **unreachable rather than merely absent**: the
> `blackhole.invalid` test elsewhere in this guide disproves a suspected registry dependency
> precisely because an unroutable host cannot return a plausible-looking `401`. Absence is
> ambiguous; unroutability is not.

**Byte-identical source across versions still does not license carrying a result forward.** This is
the part worth internalising, and it comes from that consumer being unusually precise about scope.
They noted their verification covered only the files their repository actually imports, diffed
those files between the version they had verified and the version they were bumping to, and found
them identical — a sound reason to carry the rule-level result forward. Reproduced here: across
`v0.1.0` and `v0.2.14`, `eslint-config/svelte.js`, `eslint-config/base.js`,
`prettier-config/svelte.js` and `tsconfig/vite-app.json` are all byte-identical.

And the bump still mattered, because the delta was not in any of those files:

```
v0.1.0   eslint-plugin-svelte: ^2.46.0
v0.2.1   eslint-plugin-svelte: ^2.46.0 || ^3.0.0
```

**`peerDependencies` live in the manifest, not in the modules you import.** A repository on
`eslint-plugin-svelte` v3 would install cleanly at one version and hit an unmet peer at the other,
with every consumed file identical between them. So the correct scope statement is narrower than
"the code I use didn't change": diff the `package.json` too, and say which of the two you checked.

Peer dependencies are not bundled — install the ones your stack needs:

| Stack   | Also install                                                           |
| ------- | ---------------------------------------------------------------------- |
| Any     | `eslint prettier typescript`                                           |
| Svelte  | `eslint-plugin-svelte prettier-plugin-svelte`                          |
| React   | `eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y` |
| Next.js | `@next/eslint-plugin-next eslint-plugin-react-hooks`                   |

**These are not installed for you, and that is deliberate — but the reason given here was wrong for
several releases, so read this if you adopted between `0.9.0` and `0.12.0`.**

Framework plugins are declared as **optional `peerDependencies`**. npm does not install an optional
peer, so a Svelte-only repository never receives the React or Next plugins — while the supported
range stays somewhere npm will check it and warn you on a mismatch:

| Plugin                      | Supported range        |
| --------------------------- | ---------------------- |
| `eslint-plugin-svelte`      | `^2.46.0 \|\| ^3.0.0`  |
| `eslint-plugin-react`       | `^7.37.0`              |
| `eslint-plugin-react-hooks` | `^5 \|\| ^6 \|\| ^7`   |
| `eslint-plugin-jsx-a11y`    | `^6.10.0`              |
| `@next/eslint-plugin-next`  | `^15.0.0 \|\| ^16.0.0` |

> **Correction, `0.12.0`.** From `0.9.0` these were moved out of `peerDependencies` into a bespoke
> `frameworkPlugins` field, and this page asserted that `peerDependenciesMeta.optional` "suppresses
> the error when a peer is missing, but npm 7+ still installs an optional peer whenever it can
> resolve one."
>
> **That is false, and the change it justified removed version checking for no benefit.** Measured by
> packing this package and installing the tarball into a bare consumer: `eslint` — a _required_ peer
> — is auto-installed, and all five optional peers are not. Same result on npm 7, npm 11, pnpm 11,
> and pnpm with `auto-install-peers=true`. A clean install of the Svelte-only tree came to 38.7 MB
> with zero React or Next plugins present, at the very version the original report was filed
> against.
>
> The consumer's measurement of 37 packages / 6.2 MB was real; the diagnosis was not, and nobody
> re-derived it before it became a design change, a documented mechanism, and a regression test that
> asserted the wrong invariant. If you are carrying a workaround for implicitly-arriving plugins,
> you can drop it — and if you copied the "optional peers are still installed" claim into your own
> notes, it is wrong there too.
>
> The lesson worth keeping: **a measurement is evidence for the number, not for the cause.**

Each preset is reached only through its own subpath export and imports its plugin directly, so a
missing one fails immediately at config load with the package named — you will not get a silent
half-configured lint run. With the plugins declared again, a version outside its range is now caught
at install time as an `npm warn peerOptional` rather than only at lint time.

If you adopted before `0.9.0` and relied on the plugins arriving implicitly, add the row for your
stack to your own `devDependencies` when you upgrade.

The Next row includes `eslint-plugin-react-hooks` because Next.js is React and the preset lints
hooks. Earlier revisions of this table omitted it, which is worth knowing if you adopted from a
copy: the preset then fails to load rather than silently skipping the rules.

**On ESLint 10, do not set `settings.react.version` to `'detect'`.** `eslint-plugin-react@7.37.5`
— the current release — declares `eslint: ... || ^9.7`, and its version detection calls
`context.getFilename()`, which ESLint 10 removed. Every rule in the plugin then fails to load
with `contextOrFilename.getFilename is not a function`, which reads like a broken plugin rather
than a removed API.

`reactConfig()` and `nextConfig()` are **not** affected **from `eslint-config@0.4.0`**: they resolve
the installed React version themselves at config-construction time and pass a concrete string, so
nothing enters the detection path. Verified against ESLint 10.8.1 with `eslint-plugin-react@7.37.5`
and React 19 — the preset lints normally, and the same config forced to `'detect'` throws the error
above.

> **Check the preset version before you go looking in your own config, because for three releases
> the `'detect'` line was ours.** This section previously said the line was "usually the only thing
> you need to delete" and that "keeping your own `settings.react` block is what reintroduces the
> failure." That is right from `0.4.0` and **wrong at or below `0.3.0`**, where `react.js` itself
> carried a bare `settings: { react: { version: 'detect' } }`:
>
> | `eslint-config` | `react.js` sets                                         |
> | --------------- | ------------------------------------------------------- |
> | `0.2.0`–`0.3.0` | `settings: { react: { version: 'detect' } }` — **ours** |
> | `0.4.0`+        | `detectReactVersion()`, a concrete version string       |
>
> A consumer on `0.3.0` who follows the old advice greps their own config, finds nothing, and is
> left with neither the cause nor the fix — while the actual remedy, **upgrade past `0.4.0`**, goes
> unstated. That was reported by a consumer who could not find the line they were told to delete.
>
> The failure is worth naming beyond this one line: **a remedy phrased as "look in your config"
> silently asserts the defect is not in the shipped artifact.** When it is, the search returns clean
> and the clean result reads as _"not my problem either"_ rather than _"wrong place to look."_ If a
> defect existed in released versions, the remedy has to name the version boundary, or it sends
> every consumer below that boundary on a search that cannot succeed.
>
> Note that grepping the preset source for `detect` does **not** answer this. From `0.4.0` the word
> still appears in `react.js` — in the function name `detectReactVersion` and in the comment
> explaining why `'detect'` is not used. Match the **setting**, not the string.

> **Isolating _which_ component throws is not the same as finding the cause, and the difference
> changed the recommendation.** A consumer on ESLint 10 hit this error, installed the three peers
> and ran them separately, and produced a clean result: `jsx-a11y` works, `react-hooks` works,
> `eslint-plugin-react` throws — "the sole fault". Every one of those observations is correct.
> The conclusion drawn from them was that the plugin is incompatible with ESLint 10 and should be
> **dropped or gated by ESLint major**.
>
> It is not incompatible. Reproduced on ESLint 10.8.1 with that exact plugin version: the preset's
> full smoke suite passes, and reintroducing `settings.react.version: 'detect'` fails it with the
> error above. The plugin works; **one setting** does not. Acting on the isolation result would
> have removed a working plugin — including `react-hooks`, which is the part that found that
> consumer two genuine stale-closure bugs — to avoid a line they could have deleted.
>
> Elimination answers "which one", and "which one" looks like a cause because it is specific and
> was arrived at by measurement. It is worth one more step: **change the suspect component's
> configuration before concluding the component is at fault.** The peer-range warning reinforced the
> wrong reading here, because a declared `^9.7` cap makes "incompatible with 10" the obvious story
> — but a peer range is an author's claim, not a test result.

> **A correction generated from a summary can invert the fact it is correcting.** After a consumer
> had already fixed a collision correctly — establishing order with `git log --diff-filter=A`,
> renumbering the newer record, leaving the older at its number — a follow-up instruction told them
> to do the opposite: renumber the _older_ record instead. They refused it, re-ran the command, and
> showed the two add-dates 49 minutes apart. They were right; the instruction was wrong.
>
> The mechanism is worth naming because it is not carelessness. The instruction was generated from
> a **list of the two filenames**, and two colliding ADR filenames are identical up to the title —
> they carry **no ordering information at all**. That is the exact reason the original guidance said
> not to trust filenames. A summary that drops the evidence keeps the shape of the claim and loses
> the thing that makes it checkable, so the restatement is fluent, specific, and reversed.
>
> Had it been followed it would have renumbered an already-published record a second time and
> re-broken references that had just been fixed — violating "published records are never
> renumbered" in the one case where that rule was cleanly satisfiable.
>
> The countermeasure is the same one this document reaches for elsewhere: **carry the evidence next
> to the claim, not the claim alone.** For ordering that is one command, and it belongs in the
> message rather than behind it:
>
> ```bash
> git log --diff-filter=A --format='%ad %H' -- docs/architecture/0003-*.md
> ```
>
> **And treat a correction that arrives without its evidence as unverified, whatever its source.**
> The consumer's decision to check before acting is what stopped this, and it is the generally
> correct response — including when the correction comes from the authority you are adopting.
>
> **The instruction was then sent a third time, after being corrected with evidence.** That moves
> it out of "a summary lost the evidence" and into a structural point: the wrong version lived in a
> tracking note, and the note had been marked resolved. A resolved item is never re-derived, so the
> error was recopied each round while the correction sat one message away in the thread. **Fix the
> record, not just the message** — a correction applied only to the reply will be overwritten by
> the next restatement from the same source.
>
> **And the successful fix erased the evidence that justified it.** After the collision was
> resolved by a squash merge that renamed one record, the command recommended above returns the
> _same_ timestamp for both files, because the renumbering commit is now the commit that added
> them:
>
> ```console
> $ gh api 'repos/O/R/commits?path=docs/architecture/0003-multi-creator-recipes.md&direction=asc' --jq '.[0].commit.author.date'
> 2026-08-11T22:37:17Z
> $ gh api 'repos/O/R/commits?path=docs/architecture/0004-account-erasure.md&direction=asc' --jq '.[0].commit.author.date'
> 2026-08-11T22:37:17Z   # identical — the rename is the add
> ```
>
> Anyone re-checking afterwards finds the ordering unknowable and may re-open a settled question.
> **Record the outcome where it cannot be flattened by a later commit** — the PR numbers that
> introduced each record survive any amount of squashing, and belong in the ADR body.

**`.npmrc` has no Prettier parser — but whether that breaks `format:check` depends on how your
script targets files, not on `.npmrc` being present.** The advice previously given here — add it to
`.prettierignore` — is a no-op for most repositories and insufficient for the rest. Measured on
Prettier 3.9.6:

| Invocation                                | Result                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `prettier --check .`                      | **passes** — `.npmrc` is silently skipped                          |
| `prettier --check "**/*.{ts,js,json,md}"` | **passes** — an extensionless file never matches an extension glob |
| `prettier --check .npmrc`                 | fails — `No parser could be inferred`                              |
| `prettier --check "**/*"`                 | fails on **every** unparseable file, `.npmrc` and binaries alike   |

Prettier skips files whose parser it cannot infer when the target is a **directory**, and errors
only when a file is named explicitly or matched by an explicit glob. So:

- If your script is `prettier --check .`, there is nothing to do. Adding `.npmrc` to
  `.prettierignore` is an inert entry guarding a failure the repository cannot have.
- **If your script is an extension glob** — `"**/*.{ts,tsx,js,json,css,md}"` — there is likewise
  nothing to do, and for a second, independent reason: an extensionless file cannot match a brace
  glob of extensions. A consumer measured both arms on their own gate (glob **exit 0**, explicit
  path **exit 2**) and deliberately declined to add the entry, on the grounds that an ignore rule
  for a file the gate cannot see is future confusion. That is the right call. Note this is not the
  directory case wearing different syntax: the directory passes because Prettier **skips**
  uninferrable files, the glob passes because the file is **never matched**. Two mechanisms, and
  only the first would change if Prettier ever learned an `ini` parser.
- If your script is `prettier --check "**/*"`, you were **already failing** on binary assets —
  PNGs, `.wasm` — before `.npmrc` existed. Adding one entry does not fix that. Use
  **`--ignore-unknown`**, or target the directory.

The question to ask is never "do I have an `.npmrc`" but **"what does my gate target"** — and the
answer is in your `package.json` script, not in the reusable workflow, whose default your
`format-check-command` may be overriding.

> **`--ignore-unknown` is the general fix; `.prettierignore` handles only the file that already
> bit you.** A second consumer made this point after reproducing the glob-vs-directory split
> independently, and it is right. Measured on 3.9.6 against a fixture holding `.npmrc`, a PNG, and
> one badly-formatted Markdown file:
>
> | Invocation                               | Result                                               |
> | ---------------------------------------- | ---------------------------------------------------- |
> | `prettier --check "**"`                  | `No parser could be inferred` on the PNG, **exit 2** |
> | `prettier --check "**" --ignore-unknown` | skips both, still flags the Markdown, **exit 1**     |
>
> The exit code is the part worth noticing. Without the flag the run exits **2** — a tooling error,
> not a formatting verdict — so the real Markdown finding is reported alongside a failure that has
> nothing to do with code style. With the flag you get exit **1** and a genuine result. An ignore
> entry per offending file converges on the same place one bite at a time, and only for files that
> already exist; `--ignore-unknown` covers every future extensionless config for free.

**A green run is not a refutation of this warning.** If you were told this would hit you and it did
not, check the shape of your format script before concluding the warning was wrong — the
directory form silently saved you, and it will keep saving you right up until someone switches it
to a glob. That is also the one defensible reason to add the `.prettierignore` entry anyway: as
insurance against the script form changing, recorded as such, rather than as a fix for a failure
you had. One consumer did exactly that, with a comment saying so. That is fine. What is not fine is
a later reader inferring from the entry that the repository once had the bug.

> **The suggested fix creates the next instance of the failure it fixes.** Verified: adding a
> `.prettierignore` containing `.npmrc` under a `**/*` glob removes the `.npmrc` error and
> immediately produces `No parser could be inferred for file ".prettierignore"`, because
> `.prettierignore` is itself extensionless and now matched by the glob. The error count does not
> even drop. A fix that reproduces its own bug is a strong signal the diagnosis sat at the wrong
> level, which it did: the fault is the glob, not any file it happens to name.

This correction came from a consumer who **could not reproduce** the problem, ran all three
invocations rather than reporting a null result, and declined to add the ignore entry on the
grounds that it would be an inert line guarding an impossible failure. That is the right call for
the right reason. A consumer who had simply applied the advice would have shipped the inert entry
and confirmed nothing.

**The same reasoning applies to sequencing, not just to whether a line belongs.** Another
consumer declined to pre-stage `registry-url` and `registry-scope` in CI ahead of the dependency
that would use them. The config would have been harmless and the run would have been green — and
that was the objection: a green run over a scope nothing resolves from **looks like validation of
the registry wiring while exercising none of it**. Staged with the dependency instead, the same
green tick carries evidence.

Generalised, because this migration has now produced the failure twice — once as gates passing
against a `link:`ed local checkout while the manifest claimed a published range:

> **Do not land configuration ahead of the thing that exercises it.** A passing check over inert
> config is indistinguishable from a passing check over working config, and the two get read the
> same way later. The cost of waiting is one PR; the cost of the false green is that nobody
> re-tests the wiring, because the tick is already there.

Pre-staging for fleet consistency is a legitimate reason to override this — just record in the PR
that the config is inert until the dependency lands, so the green run is not mistaken for proof.

### Exclude files that are sealed or generated

Three kinds of file must go in `.prettierignore` for reasons stronger than taste:

| Kind      | Why                                 | Symptom if you skip it                                         |
| --------- | ----------------------------------- | -------------------------------------------------------------- |
| Generated | The generator owns the formatting   | Formatter and generator fight; a permanent drift loop          |
| Sealed    | A checksum attests to exact content | Reformatting invalidates the attestation, not just the check   |
| Synced    | Another repository owns the content | False drift; the sync engine reports a conflict you never made |

**The three rows are one rule: something other than you owns the bytes.** A consumer generalised it
usefully after finding their own list already covered more than cross-repo syncs — `drizzle/` owned
by `drizzle-kit`, `CHANGELOG.md` owned by `release-please`, alongside the synced `.github/agents/`
and `AGENTS.md`. Neither generated file is "synced" and neither is "sealed", but both fail the same
way. **Any tool that owns its output belongs here**, whether the owner is another repository, a
code generator, a release bot, or a checksum. Ask who rewrites the file when you are not looking,
not which of the three labels fits.

This does not weaken the authorship rule above it — if you hand-edit the file, you own it, and it
must not be ignored no matter how tool-shaped its path looks.

This repository is its own example: `principles/` and `docs/ratification/` are pinned by
semantic content hashes, so reflowing them would break the evidence that the ratified text is
the text the owner approved. A formatter is not an owner. See this repository's
[`.prettierignore`](../.prettierignore).

**Synced files are the category most consumers miss**, because nothing about the file says it is
owned elsewhere. Anything distributed from `jrmoulckers/.github` qualifies — `.github/agents/`,
`.github/skills/`, `.github/prompts/`, `.github/instructions/`, and any managed region inside
`AGENTS.md`. Reformatting them changes content the sync engine tracks by hash, so the next sync
reports drift against a change you did not author. Vendored third-party sources are the same
shape. Exclude them **before** the first repo-wide `prettier --write`, not after:

```
.github/agents/
.github/skills/
.github/prompts/
.github/instructions/
vendor/
AGENTS.md
.github/copilot-instructions.md
.studio-sync.lock.json
```

**The single files at the bottom of that list are the sharper trap, and they were missing from it
until a consumer said so.** A synced _directory_ is obvious once you have had the thought about
syncing at all — the whole path is foreign. A synced _file_ sitting among authored ones looks
exactly like a file you own, and `AGENTS.md` is both the most likely of them to be hand-edited
and the one whose managed region is easiest to reformat by accident. Directory exclusions are
discoverable by inspection; file exclusions are not.

The mitigation that consumer applies is worth copying: **comment each entry with who owns it**,
so the next person to tidy the ignore file can see that removing a line has an owner on the other
end rather than looking like dead weight.

**Treat that list as an example of an invariant, not as the invariant.** A consumer verified their
coverage properly — running all 72 entries of their sync manifest through `prettier
--list-different` rather than eyeballing the four directory names — and found zero would be
reformatted. Then they found the coverage was partly accidental: one synced file, `agency.toml`,
was **not** ignored and was inert only because Prettier cannot infer a parser for it. Protected by
two mechanisms, one of them deliberate.

The invariant is: **every parseable path in the sync manifest must be covered by the ignore
list.** Those two lists are maintained separately — the manifest is generated, the ignore list is
enumerated by hand — so they drift in exactly one direction, silently, whenever a sync adds a
path. A fixed list of paths is correct until the next sync, and the failure is invisible until a
formatter run rewrites something nobody authored.

Check it the way they did, against the manifest rather than against memory:

```bash
jq -r '.files[].path' .studio-sync.lock.json |
  xargs npx prettier --list-different
```

Anything printed is a synced path your ignore list does not cover. A new extension the formatter
learns to parse can move a file from inert to exposed without anything in your repository
changing, which is the case a fixed list cannot anticipate.

**That check has a blind spot, and another consumer named it: it enumerates the manifest you have
today, and the manifest grows.** They added `.github/copilot-instructions.md` to their ignore list
for a file that **does not exist in their repository** — purely because sync may deliver it later.
That is not over-caution. When a canon sync lands, it arrives as someone else's unrelated pull
request going red on files they never touched, which is the worst possible moment to diagnose the
cause. One consumer had exactly that: a sync landed 55 files and turned `format:check` red on
branches that touched none of them.

So list the paths sync **may** deliver, not the paths present today. Listing a path that does not
exist costs nothing — Prettier ignores entries that match nothing — and removes the ambush. A
repository that copies the recipe by inspecting its own tree has snapshotted its current state and
will be bitten by the next sync that adds a file.

The two checks are complements, not alternatives: the manifest scan catches paths you have and
forgot; the full recipe catches paths you do not have yet.

**Those two consumers gave opposite advice, and the discriminator is authorship, not presence.**
One added a path they did not have; another declined to ignore a path they did have, because in
their repository `.github/copilot-instructions.md` is locally authored rather than synced.
Ignoring it would exempt a file they maintain from their own formatter. Both are right, and the
rule that gets both:

- **Never ignore a file you author**, however synced-looking its path. The recipe above is a
  default for repositories that receive all of it, not a list to apply unread.
- **List a path you do not have only if you would not author it either.** That is what makes a
  pre-emptive entry free rather than a future exemption for your own work.
- **Your sync lock is the authority for what is managed today**; the recipe is the authority for
  what may arrive tomorrow. Neither replaces reading which files you actually own.

**For a mixed file, fence the region instead of ignoring the file.** A consumer keeps `AGENTS.md`
formatter-managed and wraps only the synced block in `<!-- prettier-ignore-start -->` /
`<!-- prettier-ignore-end -->`. That protects the synced bytes while leaving their own prose — the
larger part of the file — under the formatter. A whole-file entry surrenders the majority to
protect the minority, and this is the better answer to the owned-file-containing-a-foreign-region
case raised above.

**Ask the formatter what it will do, rather than reasoning about glob precedence.**
`--list-different` answers whether a file would change; `--file-info` answers _why_, and separates
the two ways a file can be quiet:

```bash
jq -r '.files[].path' .studio-sync.lock.json |
  xargs -I{} sh -c 'printf "%s " {}; npx prettier --file-info {}'
```

| Output                                     | Meaning                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `"ignored": true`                          | deliberately covered by your ignore list        |
| `"ignored": false, "inferredParser": null` | **inert only because Prettier cannot parse it** |
| `"ignored": false, "inferredParser": "…"`  | exposed — it will be reformatted                |

The middle row is the one worth the sweep. A consumer found a synced `.toml` in exactly that
state: protected by accident, and one Prettier release away from being protected by nothing.
Re-run the sweep after any canon sync.

> **These exclusions are permanent, and `proseWrap: 'preserve'` does not retire them.**
> `prettier-config@0.2.0` stopped Prettier rewrapping prose, and it is natural to read that as
> making synced files safe to format again — the two changes arrive close together. They are
> unrelated. A consumer re-measured 55 synced files under `--prose-wrap preserve --print-width 96`
> and got **55**, unchanged. Reproduced here on a minimal file: Prettier inserts a blank line after
> the closing `---` of YAML frontmatter, and reformats tables and lists. No Prettier option
> suppresses any of that, because none of it is prose wrapping.
>
> `preserve` governs how prose is wrapped. It does not exempt a file from being formatted. Delete
> these entries and the next sync reports drift against content nobody authored.

### Confirm your check can fail before you trust that it passed

A consumer measured their synced paths with `prettier --no-config --list-different` and got **0**,
which reads as "these files are already clean." **`--no-config` disables the config file but still
honours `.prettierignore`.** All 55 files were skipped. The command measured nothing and reported
it as a pass.

Reproduced exactly — same tree, same paths, only the ignore handling varying:

| invocation                                     | files listed | exit  |
| ---------------------------------------------- | ------------ | ----- |
| `--list-different <paths>`                     | 0            | 0     |
| `--no-config --list-different <paths>`         | **0**        | **0** |
| `--ignore-path empty --list-different <paths>` | 1            | 1     |

To measure files you have deliberately ignored, bypass the ignore file explicitly:

```bash
: > /tmp/empty-ignore
prettier --ignore-path /tmp/empty-ignore --list-different .github/agents AGENTS.md
```

**Prettier reports the two empty cases differently, and the difference is worth knowing.** Point it
at a directory containing no supported files and it fails loudly — `[error] No supported files were
found in the directory`, exit **2**. Point it at files that are all _ignored_ and it prints
`All matched files use Prettier code style!` and exits **0**. That sentence is true over the empty
set and reads exactly like a passing measurement. The vacuity guard exists; it just does not cover
the ignore path, which is the case you are most likely to hit deliberately.

**This is a category, not an anecdote.** The same shape has now produced five separate wrong
conclusions in this migration, and the unifying description is a consumer's: **absence presenting
as something other than absence.**

| what you see                             | what is actually true                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `--no-config --list-different` reports 0 | ignore file still applied; zero files were checked                |
| npm registry `401`                       | token absent, empty or wrong — indistinguishable                  |
| npm `401`/`403` on a package             | says nothing about whether the package is private                 |
| `startup_failure` with no logs           | **at least two causes** — read the annotation, do not infer       |
| lint "passes" with no config present     | the linter fell back to built-in defaults silently                |
| a fetch step exits 0                     | an error body was written to the destination as config            |
| a preset diff shows no change            | the new option did not exist; the key destructured to `undefined` |
| `link:` resolution succeeds              | the working tree was tested, never the tarball                    |

Each row is a green result produced by something not being there. **Choose a probe whose result
varies with the property you are testing**, and assert the artifact exists and is well-formed
before trusting an exit code. Concretely: **make the check go red once** — delete a line, break a
file, revoke the token, point the fetch at a ref that does not exist — and confirm it notices. A
gate you have never seen fail is a gate you have not yet tested.

> **A config the repository ignores can still be the config CI enforces — I got this wrong.** A Go
> consumer gitignores `.golangci.yml` and fetches it from this repository at a pinned tag in the job
> immediately before linting, with the action running `config verify` on the fetched file every run.
> I read the gitignore as meaning nothing enforced it. The ignored path and the enforced file are
> **different copies**: ignoring it is precisely what stops a stale local fork being the thing that
> lints, which is the no-vendored-normative-text rule working as intended.
>
> Their fetch fails closed on three conditions — non-200, empty body, and a payload missing
> top-level `version:`/`linters:` — and writes the destination only after all three pass, so a
> truncated transfer cannot leave a valid-looking config that lints nothing. Verified against a
> nonexistent ref: exit 1, no file written, job stops. Anonymous `raw.githubusercontent.com` fetch
> of a public repository returns **200** regardless of any package's visibility — repository content
> and package content are separate visibility systems, so a Go consumer is not blocked by the npm
> access work.
>
> **The real gap is the complement of the obvious worry.** CI is airtight; the **developer's local
> run** is not, because golangci-lint does not error on a missing config — it falls back to built-in
> defaults, which enforce less without saying so. Ship a `make lint` target that performs the fetch
> as a prerequisite. That asymmetry — verified machine path, unverified human path — is worth
> checking wherever a config arrives at runtime.

> **A 404 on a citation link usually means the path was never right, not that something moved.** A
> consumer reported `principles/testing.md` returning 404 at an old tag and attributed it to a tree
> reorganisation. There was no reorganisation: `git log --all --diff-filter=A` shows that path was
> **never added in any commit on any branch**, and the tree under `principles/` is byte-identical
> between that tag and `main`. The correct path has always been `principles/assurance/testing.md`,
> and `index.json` has always said so in each principle's `source`.
>
> The invented path is plausible, which is the whole problem — an area-prefixed ID like
> `ENG-TEST-001` suggests a file named for the area, and the real layout nests it under a category
> directory. **Resolve the link from `source` in `index.json` rather than composing it from the ID**;
> `check-citations.mjs` does this by default and reports the expected path on mismatch.
>
> The general shape is one this migration keeps producing: a symptom that names a cause. A 404
> names a path, a stack trace names the frame that threw, and a `startup_failure` names nothing at
> all — in none of those cases is the named thing reliably the cause.

### A git tag is a repository counter, not a package version

> **This repository's maintainer got this wrong seven times, to seven different consumers.** Every
> instance had the same cause: announcing a package version by reading the git tag that shipped it.
> The two numbers were never related and have diverged badly — tag `v0.115.0` ships
> `eslint-config@0.16.0`. A tag counts commits to this repository; a package version counts releases
> of one package. Nothing enforces a relationship, and nothing ever will.
>
> The cost is not the wrong number, it is the round trip. A consumer told a stale floor either
> re-pins to something older than what they already have, or spends a message correcting it — and
> in at least two cases the advice would have been a **downgrade** from what the consumer had
> already merged.
>
> ```bash
> npm run versions:print   # workspace vs published vs the range consumers pin
> ```
>
> It reads the working tree, so it needs no registry credential — which matters, because
> `versions:check` degrades to "registry unreachable" without `read:packages`, precisely when
> someone is trying to look a version up. From outside this repository, `npm view <pkg> version`
> settles it in one call.
>
> The column to quote is **published**, not workspace. A workspace version ahead of the published
> one is normal mid-release: the bump has merged, the tag has not been pushed, and the version is
> **not installable yet**. `versions:print` names that gap explicitly, because it is exactly the
> state that produces a confidently wrong announcement.
>
> The generalisable form: **when two numbers are adjacent and look interchangeable, something has
> to state which one is authoritative** — otherwise the cheaper one to read wins, and it is usually
> the wrong one.
>
> **The same skew breaks verification, in the direction people actually get wrong.** A consumer
> asked to confirm a peer range "at `v0.4.0`" read exactly that ref — and got package `0.3.0`,
> because that is what the tag contains. So "check it at `v0.4.0`" and "check version `0.4.0`"
> resolve to **different code**, and the tag looks _newer_ than the package inside it, which is the
> opposite of what a reader assumes. They reported a stale peer range in good faith; the ref was
> right and the artifact was a version behind.
>
> A `git merge-base --is-ancestor` check does not catch this: the ref genuinely is an ancestor of
> `main` and still contains the wrong package version. What catches it is reading `version` out of
> **the same `package.json` you are reading the claim from**, which costs one line and makes the
> artifact self-identifying:
>
> ```bash
> git show "v0.4.0:packages/eslint-config/package.json" | jq -r '.version, .peerDependencies'
> ```
>
> So the rule is not only "a repo tag is never an actionable npm specifier" — it is **do not verify
> at a repo tag either**, unless you read the package version out of the same file.

### Dropping a meta-package for the plugin it wraps loses everything else it bundled

> `eslint-config-next` is a **meta-package**: it bundles `eslint-plugin-react`,
> `eslint-plugin-jsx-a11y` and `eslint-plugin-react-hooks` as direct dependencies. This preset
> consumes the bare `@next/eslint-plugin-next` instead, which carries only the `@next/next/*` rules.
> For one release that meant every Next consumer silently lost **every** `react/*` and `jsx-a11y/*`
> rule on adoption.
>
> **Name the baseline whenever you quote a count for this defect — three are in play and all three
> numbers are true.** Measured on the same probe file:
>
> | Measured from                 | `react/*` | `jsx-a11y/*` |
> | ----------------------------- | --------- | ------------ |
> | legacy `next/core-web-vitals` | 17 active | 6 active     |
> | the broken `nextConfig()`     | 0         | 0            |
> | the fixed layer (`0.13.0`+)   | 18 active | 31 active    |
>
> So the regression **dropped 17 and 6** relative to what consumers migrate off; a consumer
> measuring the broken preset against the fix correctly reports **0 → 18 and 0 → 31**; and the fix
> lands _ahead_ of the legacy config. A bare "18 and 31 were dropped" is wrong, because it implies
> the legacy config enforced that many. I made exactly that error correcting these numbers — took a
> consumer's true figure measured from one baseline and overwrote a true figure measured from
> another. **Two correct measurements of the same change disagree whenever their baselines differ,
> and neither one is a check on the other.**
>
> Three things made the original regression invisible, and they generalise to any meta-package swap:
>
> - **A rule-by-rule diff of the Next rules scores it as no change.** The `@next/next/*` set is
>   identical either side. You have to diff the rules you did _not_ think you were changing.
> - **No unresolved-plugin error is possible.** Removing `eslint-config-next` also removes the only
>   thing that installed those plugins, so nothing was left to fail. The rules ceased to exist and
>   lint stayed green — `react/jsx-key`, a real correctness bug, passed.
> - **The count moves in the direction of success.** Adoption reduces rule count for many good
>   reasons, so a smaller number after a migration does not read as a regression.
>
> A consumer measured the restoration on a real Next application: **95 → 141 active rules**, and
> **23 accessibility findings across 15 files** — keyboard-inaccessible controls, unlabelled form
> inputs, uncaptioned media. `react/*` reported **zero**, so the React half is coverage at no cost
> and the a11y half is where the defects were. For a repository holding itself to WCAG 2.2 AA, that
> is the whole argument.
>
> Fixed by a shared `react-layer.js` that both `reactConfig()` and `nextConfig()` call, plus a
> parity test asserting `nextConfig()` enables every `react/*`, `jsx-a11y/*` and `react-hooks/*`
> rule that `reactConfig()` does. The test compares the presets **to each other** rather than to a
> literal list, so it cannot pass by being updated alongside a regression — and it carries a
> non-emptiness guard, without which removing a plugin from the shared layer would satisfy it
> symmetrically.
>
> **If you are replacing a meta-package with one of its members, enumerate its dependencies first.**
> That list is the set of things you are silently dropping.

### A character count is not a byte count, and the difference only appears once you add an em dash

> Two file sizes I published as **verified** were wrong — `1636` and `1116` bytes for a config a
> consumer measured at `1642` and `1120`. The consumer checked whether a tag had been moved, which
> would have been serious, and found sizes stable at every tag: `1636` was never a size the file has
> ever had.
>
> The cause reproduces exactly. In PowerShell:
>
> ```powershell
> (Get-Content $f -Raw).Length   # 2046  -- CHARACTERS, after UTF-8 decoding
> (Get-Item $f).Length           # 2052  -- BYTES on disk
> ```
>
> The file contains **three em dashes** (`U+2014`), each one character but **three bytes** in UTF-8.
> Three characters × 2 extra bytes = the 6-byte gap. The older revision had two, giving 4. That is
> why the two errors differed and looked like they ruled out a systematic cause — the offset is not
> constant, it scales with how much non-ASCII the file contains.
>
> Every byte-accurate tool agrees with the larger number: `git cat-file -s`, `wc -c`,
> `curl -w '%{size_download}'`, `(Get-Item).Length`. Only the string length disagrees.
>
> **The reason this is worth a section rather than a correction: it is silent on ASCII-only files.**
> `.Length` on a decoded string is exactly right until the day someone writes a dash, a curly quote,
> an arrow, or an accented name — none of which look like they change a measurement. A check built on
> it passes its own tests, passes review, and starts lying later, at a commit that has nothing to do
> with measurement.
>
> Two consequences worth carrying:
>
> - **Never assert on file size.** Had the config's shape check been a size assertion it would now be
>   failing on a correct file. Assert on content — that `version:` and `linters:` are present — which
>   survives both formatting and prose edits.
> - **When two sizes disagree by a small amount, count the non-ASCII characters before assuming
>   drift.** A difference equal to twice the number of 3-byte characters is this bug, not a changed
>   file. The `git cat-file -s` figure is the one to trust.

### A citation's `#fragment` cannot 404, so retitling a heading breaks it silently

> A wrong path 404s and someone notices. **A wrong fragment does not.**
> `principles/assurance/security-and-privacy.md#secret-lifecycle` serves `200` whether or not that
> heading exists — the browser simply lands at the top of the file. So a citation degrades from
> _this specific rule_ to _this file, somewhere_, and there is no error anywhere to observe.
>
> This matters because the failure is caused by an edit **in this repository**, to a file the
> citing repo does not own. Retitling a principle heading breaks every citation of it across the
> fleet, at the moment of the retitle, with nothing reporting it. The consumer who raised it had
> verified all 11 of their own anchors by hand — the correct response, and not one that scales.
>
> `check-citations.mjs` now validates fragments as well as paths (`checks run: ... link anchors`).
> It resolves tag-pinned URLs back onto the local checkout, because consumers cite absolute URLs
> rather than relative paths — checking only relative links would have passed everything while
> inspecting nothing, which is the same silent-degradation shape the check exists to catch.
>
> Two things worth knowing about what it reports:
>
> - It validates against **your checkout**, not against the ref the URL pins. A citation pinned at
>   an old tag is checked against today's headings, so a failure tells you the anchor a re-pin
>   would land on. That is the question worth answering, since a stale pin gets read when it moves.
> - A near miss prints a `did you mean:` suggestion, because the common cause is a heading that was
>   reworded rather than removed, and the replacement is usually one edit away.
>
> The generalisable rule, which is not specific to citations: **when a reference can be wrong
> without producing an error, the check has to be run by the side that can break it.** A path is
> validated by the reader's toolchain for free. A fragment never is.

> **The sharpest case is a file you own that contains a region you don't — and whole-file
> exclusion is the expensive answer to it.** A consumer hit this when `main` grew a synced
> `studio:base` region inside `.github/copilot-instructions.md`, a file that is locally authored
> overall. Their category exclusions listed whole paths, so nothing covered it. They added the
> whole file to `.prettierignore`, which is correct and safe.
>
> It also stops formatting the majority of the file that they do own, permanently, to protect a
> few lines. Prettier supports region-level ignores in Markdown, which keeps both properties:
>
> ```markdown
> <!-- prettier-ignore-start -->
> <!-- studio:base:start -->
> ... managed content ...
> <!-- studio:base:end -->
> <!-- prettier-ignore-end -->
> ```
>
> Verified structurally rather than by eye — the managed region came back **byte-identical**
> (table unpadded, `*emphasis*` not converted to `_emphasis_`, runs of spaces intact) while local
> prose outside the markers was reformatted normally.
>
> **Put the `prettier-ignore` markers outside the sync delimiters, not inside.** A sync engine
> that rewrites the interior of its own region will overwrite anything placed within it, so
> markers on the inside survive exactly until the next sync and then vanish silently — leaving a
> file that formats correctly today and reformats a managed region the next time upstream
> changes. Outside the delimiters, they are part of the content you own.
>
> Whole-file exclusion remains the right call when the managed region has no stable delimiters to
> bracket, or when the file is mostly managed anyway. The point is to make it a decision rather
> than the only known option.

If you hold signed manifests, lockfiles with recorded integrity, golden or snapshot fixtures, or
vendored third-party sources, apply the same reasoning before your first format pass — the first
run is where the damage lands, and a reflowed snapshot fixture fails as a false test failure a
long way from its cause.

**But do not exclude a fixture merely for being one — read how it is compared first.** The hazard
is not that golden fixtures exist, it is that they are **compared as bytes**. A fixture that is
parsed before it is asserted on — `JSON.parse`, `json.decodeFromString`, then a comparison on the
resulting object — is immune to reformatting by construction, and excluding it buys nothing.

This matters because the exclusion is not free and not temporary: every path you add is a file
Prettier stops checking forever. Told only to "check for fixtures," a repository audits six golden
files, finds all six deserialise before comparing, and still adds six permanent holes to fix a
problem it did not have.

So the rule is: **find the fixtures, read their consumers, and exclude only the byte-compared
ones.** `toMatchSnapshot`, `toMatchFileSnapshot`, `.snap` files, and any assertion against a raw
`readFile` result are byte comparisons. A `parse`-then-`assertEquals` is not.

### A green test suite does not clear a formatter change

This is the failure mode most likely to cost you real correctness, and it is invisible.

Reformatting rewrites string literals — `singleQuote` applies to CSS as well as JS — and any
test or script that **parses its own source text** silently changes what it matches. Such a
check keeps passing while inspecting nothing.

Measured in one repository adopting this config, with roughly 28 self-scanning checks, four
degraded silently and none failed:

| Check                      | Before   | After                                    |
| -------------------------- | -------- | ---------------------------------------- |
| `i18n` rich-tag scanner    | 22 sites | **0 sites** — still exited 0             |
| creator-escalation test    | passing  | a `-1` anchor disabled a security filter |
| elevation / contrast tests | passing  | skipped every theme                      |

A suite that passes before and after tells you nothing here, because the degraded state is
indistinguishable from the healthy one. Verify by **diffing each scanner's output count** across
the reformat, not by re-running the suite:

```bash
# before the format pass
node scripts/scan.mjs --count > /tmp/before.txt
# after
node scripts/scan.mjs --count | diff /tmp/before.txt -
```

Then make the guards quote-agnostic and give each one an explicit assertion that its match count
is non-zero, so it fails loudly rather than inspecting an empty set. A check that cannot report
finding nothing is not a check. This is `ENG-TEST-008` applied to tooling: a scanner nobody has
proven can fail is not evidence.

Grep for the shape before you start — `readFileSync(__filename`, `readFileSync(import.meta`, and
any test reading files under `src/` and matching quoted substrings.

#### The same trap fires again on every rebase

A large format pass conflicts with every concurrent branch, so expect to rebase repeatedly — one
repository rebased five times. Resolving those conflicts by taking upstream's side is the obvious
move and it **silently reintroduces the defect**: the upstream hunk carries pre-format text, so a
source-shape guard goes back to matching against quotes and wrapping that no longer exist.

Two guards in that repository re-broke exactly this way after being fixed once, asserting against
the literal text of a config file and a Markdown doc. They failed loudly only because the earlier
non-zero anchors were already in place. Without those, they would have rejoined the silent set.

**Guards that slice between two literal markers degrade worse than guards that match a pattern.**
Another repository had four break at once, and the instructive part is that they failed in two
different ways. The one carrying an anti-vacuity assertion failed loudly and named the cause. The
one slicing between a start and end marker did not: when a marker stops matching, the slice yields
`""`, and the assertion that follows compares an empty string to an expected value. That reports a
**value mismatch** — as though the content were wrong — when the real fault is that the marker was
never found. The reader debugs the content and not the marker.

The symmetric case is worse and invisible: if the assertion is "the slice does not contain X", an
empty slice **passes**. So a marker-slicing guard silently becomes a no-op the moment a formatter
moves a quote. Assert that the slice is non-empty before asserting anything about what is in it.

**Land the reformat as its own pull request, merged the same day.** A repository-wide format pass
cannot survive an active `main`. One consumer rebased three times in a single sitting while `main`
moved three and then five commits, and a route-scoped refactor landing in parallel conflicted with
the reformat across **40 files**. Every conflict was formatting-versus-content and resolved
mechanically — take upstream, re-run Prettier — but the work is proportional to how long the branch
stays open, and a busier repository can thrash indefinitely.

Separating the two also makes both reviewable: a config change mixed into a 40-file reformat cannot
be read, and the reformat cannot be verified as content-neutral while a behavioural change is
hiding in it. Land the formatting alone, merge it immediately, then open the configuration change
on top.

Fix it at the read, not at the assertion — normalise quotes and collapse whitespace as the file is
loaded, so the guard is insensitive to formatting by construction rather than by being re-patched
after each rebase:

```js
const source = readFileSync(target, 'utf8').replace(/["']/g, "'").replace(/\s+/g, ' ');
const matches = source.match(pattern) ?? [];
assert.ok(matches.length > 0, 'guard matched nothing — it is no longer inspecting anything');
```

**The clearest evidence for the anchors is a single repository running both ways at once.** One
adoption produced both outcomes from the same root cause in the same rebase. Fifteen tests across
eight files broke on `singleQuote` and failed **loudly**, because the non-zero anchors had already
been added — one of them `creator-escalation.test.ts`, a security guard confining co-creator write
authority. In the same repository, `i18n-rich-tags.mjs` went from 22 matched call sites to **0 and
still exited 0**, because it had no anchor.

Same defect, same commit, opposite outcomes, and the only variable was whether the guard asserted
it had found anything. A security guard silently inspecting an empty set is indistinguishable from
a security guard passing — that is the whole cost of the missing line.

So the pre-adoption sweep is not optional and is worth stating as a step rather than a caution:
**grep for `readFileSync` in your tests and scripts before trusting a green suite.** A guard that
reads source and counts matches passes vacuously the moment its pattern stops matching, and a
formatting change is exactly what stops it.

Merge the format pass quickly or freeze the branch. Its cost grows with every day it stays open.

### The preset lints a different set of files than yours did

A rule-by-rule diff of the old config against this one cannot see this, and it is easy to
under-report as a result: the shared presets apply to paths many local configs never covered —
`scripts/**/*.mjs` most commonly. One repository's first run surfaced a genuine `no-regex-spaces`
violation in a script that had never been linted at all.

**This heading previously said "lints more files", and a consumer was right that the asymmetry
misleads.** They measured both sets — 84 files under each config, empty set difference — and
observed that the file the section predicts would be newly covered was already linted before. Their
point: a repository told "the preset lints more" goes looking for additions, finds none, concludes
it is fine, and skips the measurement. **The expensive failure is the opposite one — a file the old
config linted that the preset stops linting.** That is a silent coverage loss, and it is invisible
to a rule diff _and_ to a green lint run, because the finding that would have been reported is
simply never produced.

So compare the **set of files linted, in both directions**:

```bash
npx eslint --debug . 2>&1 | grep 'Linting ' | sed 's/.*Linting //' | sort > after.txt
# same against the old config, e.g. via --config, then:
comm -3 before.txt after.txt
```

`comm -3` prints both columns: left-only lines are coverage you lost, right-only lines are coverage
you gained. A count alone cannot distinguish "84 and 84" from "84 and 84 with twelve swapped", so
compare the sets and not their sizes. Discount any scratch config you wrote to disk to run the
comparison — that shows up as a spurious one-file delta and has already sent one consumer chasing
it.

it.

**Selection and configuration are two separate comparisons, and a repository can pass the first
while failing the second.** One consumer's config already selected `scripts/**/*.mjs` via a
top-level `**/*.mjs` pattern, so the file-set comparison above came out clean — and their tooling
block still configured those files wrongly, in two ways a rule diff scores as zero because both are
`languageOptions`:

- **An asymmetric glob.** The block listed `tools/**/*.js`, `tools/**/*.mjs`, and `scripts/**/*.js`
  — but not `scripts/**/*.mjs`. Invisible until the first such file existed, which is exactly when
  it appeared: adding `scripts/vendor-configs.mjs` produced **8 `no-undef` errors** that CI caught
  and their local run did not.
- **A hand-maintained globals list, which drifts from the runtime.** `fetch` has been a Node global
  since 18 and was absent, as were `URL`, `TextEncoder`, and `structuredClone`. Each one fails the
  same way, one at a time, on first use — years apart, each looking like an isolated mistake.

`toolingFiles` plus `globals.node` makes both of these **unrepresentable** rather than merely fixed.
That is the argument for adopting the preset that no rule-by-rule comparison can produce, because
the rules were never the difference.

The same consumer supplied the discipline that caught it, having skipped it themselves first:

> I ran `format:check` and not `npx eslint .`, reasoning that a Prettier-config change cannot affect
> ESLint. True of the config; false of the commit.

**Run the whole gate, not the part that seems relevant.** What is under review is the commit, not
the change you have in mind.

### Do not bulk-remove `svelte-ignore` comments

`svelte/no-unused-svelte-ignore` is one of the few new violations that looks purely mechanical and
is not. One repository had four `state_referenced_locally` ignores in a single file; the rule
flagged exactly **one** as unused. Removing the other three — the obvious next step once you
believe the category is noise — produced `svelte/valid-compile` errors, because they were
load-bearing.

Delete only what the rule actually names, one at a time, and re-run. The rule is precise; the
generalisation from its output is what goes wrong.

### A clean `rules-of-hooks` run is not proof of absence

`react-hooks/rules-of-hooks` detects a hook call it can see in a statement position. It does not
see one nested inside a returned object literal. A repository with seven `try`/`catch` hook
wrappers in a single file had **two** flagged, because the rule catches

```js
const { value } = useThing();
```

and misses

```js
return { value: useThing().value };
```

Both are conditional hook calls; only the first is reported. The two that did flag were genuine
bugs, so the rule earned its place — but treat a zero count as "no violations of the shape this
rule recognises", not as "no conditional hooks". If you are auditing a codebase for hook
correctness rather than just gating new code, read the wrappers by hand.

This generalises past this one rule. A lint gate reports the violations its rules are written to
find, and adopting a stricter preset changes which shapes are visible, not whether the underlying
defect exists. Reported by a consumer whose audit found the two the rule missed.

### Landing the first format pass

Markdown formatting uses `proseWrap: 'preserve'`, so adopting this config **does not reflow your
prose**. Paragraph line breaks are left exactly as authored.

**It does not follow that there is nothing to reformat.** `preserve` cancels the _rewrap_, not
the _reformat_ — and the difference is the whole first commit. Expect `prettier --check` on
Markdown to fail after adopting, and expect a real diff. A repository told "nothing to reformat"
that then sees `format:check` go red will reasonably suspect its wiring, when what it is looking
at is tables and code fences.

Measured on a repository that had staged the reflow under `always` and re-ran it under
`preserve`, against a clean tree to rule out residue from its own commit:

| Regime              | Lines changed |
| ------------------- | ------------- |
| `always`            | 1,126         |
| `preserve`          | **575**       |
| of which prose flow | **0**         |

The surviving 575 fell into three categories, none of them prose:

- **Table padding** (~354). The `.md` override narrows `printWidth` to 96, and Prettier still
  pads pipe tables into aligned columns.
- **Embedded code in fences** (~170). Prettier formats fenced code inside Markdown, so
  `singleQuote: true` rewrites quotes in a fenced YAML or JSON block. A docs-heavy repository
  that documents configuration in fences sees this most.
- **Emphasis normalisation** (48). `*works*` becomes `_works_`.

Reproduced here from scratch on a 16-line file: all three fire, and the line count is byte-identical
before and after. That last part is the check to run — if every file's line count is unchanged, no
authored break moved, and the diff really is confined to the categories above.

The practical consequence is the opposite of the rewrap's. The residual diff is mechanical,
low-risk, and worth landing in one commit; the rewrap was neither. **Same command, opposite
advice** — which is why the two need separating before anyone runs it.

> **Count files and count lines separately — `proseWrap` moves one and not the other.** A
> repository re-ran its whole tree twice, holding `.prettierignore` constant and changing only
> `proseWrap`:
>
> | Config                  | Files failing | Of which Markdown |
> | ----------------------- | ------------- | ----------------- |
> | `proseWrap: 'always'`   | 60            | 5                 |
> | `proseWrap: 'preserve'` | **60**        | **5**             |
>
> Identical. `proseWrap` changed the file count by **zero**, while changing the line count by 551.
> It cancels churn _within_ failing files; it does not stop any file failing. So a repository that
> measures adoption by "how many files does `--check` list" will see no movement at all, and may
> conclude its configuration never took effect. The measurement that shows the effect is lines,
> not files.
>
> **The same run isolated a confound worth copying.** That repository's file count had genuinely
> dropped, 104 → 60, and it would have been natural to credit `proseWrap`, since a drop was
> predicted. The entire drop came from its `.prettierignore` — a different change, shipped in the
> same pass. Holding one variable fixed and re-running is what separated them.
>
> This is the trap in predictions generally: **a confirming measurement does not identify the
> cause.** Two changes landed together, an effect was predicted, the effect appeared, and it
> belonged wholly to the other change. Every downstream repository would have inherited the wrong
> mechanism — and repositories with no `.prettierignore` would have seen no drop and reasonably
> suspected their own wiring. When you ship two changes at once and one of them has a predicted
> effect, vary them independently before reporting the effect as evidence.

> **A test that asserts on your own prose breaks under `always`, not under `preserve` — and the
> difference decides whether the fix is a config bump or a code change.** A consumer rebased,
> saw `printWidth: 96` split an asserted phrase in `DEPLOY.md` (`This automation-generated PR is
the sole` became `This\nautomation-generated…`), and attributed it to `printWidth` overriding
> `proseWrap`. Measured on a 170-character prose line at `printWidth: 96`:
>
> | `proseWrap` | Lines after | Prose reflowed? |
> | ----------- | ----------- | --------------- |
> | `always`    | 4           | **yes**         |
> | `preserve`  | 3           | **no**          |
>
> `printWidth` does not re-wrap prose under `preserve`; the two settings compose exactly as
> documented. What they hit was `proseWrap: 'always'`, which is `prettier-config@0.1.0` — so the
> reflow half of their finding is a **stale-version symptom that a floor bump removes**, not a
> permanent property of the preset.
>
> Their other two breakages are real and permanent: `singleQuote` rewrites quotes in `.cjs` and
> `.mjs` sources, so any `toContain('target: "filesystem"')` fails regardless of `proseWrap`.
>
> **Keep their fix even though the cause was misattributed.** They normalised at the read boundary
> and added non-empty **anchor assertions**, verifying non-vacuity explicitly against a negative
> control. That is worth doing on its own merits, because the failure it prevents is the one this
> guide keeps returning to: a formatter change silently turning a real assertion into a no-op that
> still passes. Note the direction — their assertions broke **loudly**, and only because the
> anchors existed. A repository asserting on its own source without them gets the reformat and a
> green suite.

> **"Does not reflow your prose" is true at the moment you switch, and progressively less true
> afterwards. Expect a mixed corpus, and do not "fix" it.** `preserve` does not merely permit
> semantic breaks; it stops enforcing `printWidth` on prose entirely. A repository arriving from
> `proseWrap: 'always'` therefore keeps its hard-wrapped files, but those files stop being
> maintained at that width the moment anyone edits them. Measured, inserting one word into a
> wrapped paragraph:
>
> | Config             | Resulting line                  |
> | ------------------ | ------------------------------- |
> | `always` (before)  | re-wrapped to 94 chars          |
> | `preserve` (after) | **191 chars, left as authored** |
>
> **And no gate reports it.** A 191-character prose line passes `prettier --check` under
> `preserve` with exit 0, because `preserve` treats any authored shape as correct. That is the
> intended trade — you cannot have semantic breaks and enforced wrapping at the same time — but it
> means the honest end state for an already-wrapped repository is a **mixed corpus**: old files
> hard-wrapped and slowly fraying, new prose semantic.
>
> The trap is what happens next. Someone notices the ragged over-width lines, sees that they
> genuinely exceed `printWidth`, and reflows the corpus to fix it — producing exactly the large
> mechanical markdown commit that choosing `preserve` was meant to avoid, and destroying any
> semantic breaks written since. **Ragged old files are the expected steady state. Leave them.**
> Reformat a file's prose only when you are already editing it for other reasons.
>
> Raised by the repository whose `.prettierrc.json` was the original source of
> `proseWrap: 'always'` — so this is the consequence of its own setting being reversed, reported
> against itself.

> **Citations are unbreakable by construction, and over-width lines containing one are correct.**
> A markdown link destination cannot be wrapped — there is no legal break point inside it — so a
> pinned citation is a single atomic token:
>
> ```md
> [`ENG-SEC-001`](https://github.com/jrmoulckers/engineering/blob/v0.2.3/principles/assurance/security-and-privacy.md#secret-lifecycle)
> ```
>
> Measured at `printWidth: 96`, `proseWrap: 'always'` handles that sentence by splitting it into
> three lines — and the citation line is still **134 characters**. So the reflow destroys the
> surrounding sentence structure _and_ fails to achieve the width it reflowed for. It is
> destructive and ineffective in the same operation, which is the strongest single argument
> against `'always'` in this repository's own documentation style.
>
> Two rules follow. **Over-width is expected and acceptable on any line containing a link
> destination or a table row**, and no gate should be configured to flag it. And **do not "fix" it
> by shortening the URL**: the pinned tag in a citation path is load-bearing, and trading it for a
> branch path or a bare anchor buys width by making the link mutable.
>
> Worth planning for rather than discovering: **the adoption programme is itself increasing the
> population of these lines.** Every repository that lands citations acquires lines that wrap
> badly by nature, and this is the second distinct piece of tooling to meet them at the line level
> — the first was a `--review` bare-URL defect with the same root cause.

### Write prose in semantic line breaks

Since the formatter no longer decides where lines end, the convention does. Break lines at
sentence or clause boundaries; one sentence per line is the simplest form.

```md
The sync layer reconciles local mutations against the remote authority.
It uses a last-writer-wins strategy scoped per field rather than per record.
```

This is not a style preference. It is measurably better on the things that matter for review,
and `preserve` exists to permit it. Every cell below is a real `git merge` result, with each
edit re-formatted under the regime named in its row:

| Shape                   | One-word edit   | Two edits, distant sentences | Two edits, adjacent lines | Bounded line length |
| ----------------------- | --------------- | ---------------------------- | ------------------------- | ------------------- |
| Hard-wrapped (`always`) | whole paragraph | **conflicts**                | **conflicts**             | yes                 |
| One long line           | 1 line          | **conflicts**                | **conflicts**             | no                  |
| Semantic breaks         | 1 line          | clean                        | **conflicts**             | yes                 |

Hard wrapping rewraps every following line in the paragraph, so a one-word change arrives as a
multi-line diff and the real edit has to be hunted for. A single unbroken line avoids that but
collides on any concurrent edit, since every change touches the same line. Semantic breaks avoid
both — and `proseWrap: 'always'` destroys them on write, which is why it is not the default.

> **A reflow that lands is permanent, and nothing downstream will ever flag it.** I told a
> consumer that if they had already landed a reflow, no action was needed. That was wrong, and
> the correction is worth stating as a property of the setting rather than as an apology:
>
> **`proseWrap: 'preserve'` does not undo an existing reflow.** It leaves authored breaks alone —
> including the wrong ones `always` just wrote. Measured, one file, `printWidth: 60`:
>
> | Stage             | Content                                              |
> | ----------------- | ---------------------------------------------------- |
> | authored          | one semantic line + a second short line              |
> | after `'always'`  | rewrapped **and the two lines joined into one flow** |
> | then `'preserve'` | **byte-identical to the `'always'` output**          |
>
> `preserve` is not a repair, and it is not the opposite of `always`. It is "do nothing", which
> when applied to damage means "keep the damage". So the fleet splits in two: repos that had not
> yet reflowed are protected by the default, and repos that already reflowed are permanently
> altered and will never be told. **"No action needed if you already landed one" is true for
> breakage and false for destruction** — a green `format:check` afterwards is not evidence the
> content survived, it is evidence that `preserve` is idempotent.
>
> If you landed a reflow under `0.1.x`, restore the affected files from the pre-adoption commit
> and re-run `format:check` under `>=0.2.0`. It should pass **untouched** — that is the proof the
> reflow was never required in the first place.

> **Do not audit a reflow with `git diff -w`.** It reports the whole file as changed. Rewrapping
> moves words _across_ lines rather than altering whitespace _within_ a line, so from git's point
> of view every line genuinely differs and `-w` has nothing to ignore. Measured on a pure rewrap
> where not one word changed:
>
> ```console
> $ git diff -w --stat
>  a.md | 5 +++--
>  1 file changed, 3 insertions(+), 2 deletions(-)
>
> $ git diff --word-diff=porcelain a.md | grep -c '^[+-][^+-]'
> 0
> ```
>
> `-w` says three lines were added; `--word-diff` says zero words changed. **Use
> `--word-diff`**, which is the tool that answers the question actually being asked — did any
> prose change, or did it only move. Auditing 25 reflowed files with `-w` produces 25 hits and
> invites the conclusion that content was rewritten when none was.

**Read the last column before using this table in an argument.** Adjacent edits conflict under
every regime, because git needs an unchanged context line between two changes and no wrapping
policy can supply one. Wrapping cannot fix that case and should not be claimed to.

**And be careful how you measure the middle column, because it inverts.** A consumer measured
this by editing _lines_ directly and concluded that conflict behaviour is governed by line
granularity alone — that `always` and semantic breaks are indistinguishable, so the axis should
not be cited in either direction. Measured that way the result is real and reproduces here. But
holding the _line_ edit constant switches off reflow, which is the single behaviour that defines
`always`. Hold the **prose** edit constant instead — one word added to the first sentence, one to
the last — and the two regimes separate cleanly: `always` rewrote all 3 lines of the paragraph
and **conflicted**, while semantic breaks touched 1 line and **merged clean**. Same edits, same
Prettier invocation, opposite answer.

That is the fourth-instance heuristic firing again, and this time on a _measurement of a
measurement_: the consumer correctly retracted a wrong conflict claim, then verified the
replacement with a test that held the deciding variable fixed. Both the original claim and its
correction were argued from a test that could not have shown the difference. If a setting's
whole function is to transform the artifact, an experiment that edits the artifact's
post-transform shape has quietly removed the setting from the experiment.

**The `~5 lines` figure is measured, and it is deliberately not larger.** The consumer who supplied
it had earlier argued that `'always'` makes a one-word change produce an unbounded multi-line diff,
then retracted their own claim after measuring it properly — inserting three words mid-paragraph and
diffing wrapped-baseline against wrapped-after-edit, rather than against the unwrapped original,
which was the confound in their first attempt. Reflow is bounded by **paragraph** length, not file
length: 5 changed lines versus 1 for `preserve`.

That is a ~5× ongoing review cost, not a catastrophic one, and the weaker number is the honest one.
It is worth stating plainly because the argument against `'always'` does not need the exaggeration
and is damaged by it — the one-time cost carries the case on its own, and a reader who checks the
inflated version and finds it false has reason to discount the rest.

> **The one-time reflow is not actually the expensive part.** A single mechanical commit is
> absorbed once and forgotten. The cost that matters is that `'always'` destroys semantic line
> breaks **silently and repeatedly**: every subsequent `format:write` re-flattens breaks the author
> just made, with no diagnostic and no failing check. The author reasonably concludes their editor
> did it. A one-time cost gets paid; a recurring invisible one teaches people to stop using the
> shape at all, which is the actual loss. This is why the value of catching it early is not
> measured in the files a reflow would have touched.

> **Independently reached, from the largest corpus of the seven.** A consumer measured `'always'`
> against 590 markdown files and rejected it, arriving at the same mechanism from the other end:
> the reflow makes a one-word edit a multi-line diff, so `'always'` "costs a mass reflow and buys a
> worse diff than doing nothing". They ranked `'never'` above `'always'` for review, which is
> correct as far as it goes — the row this table adds is that **semantic breaks beat both**, and
> `'preserve'` is what permits them. `'never'` gives one line per paragraph and therefore inherits
> the concurrent-edit collision in row two.
>
> Their sharpest point is about the shape of the answer rather than the value: **do not make it
> optional.** An inconsistent default is its own tax — every repository re-litigates it, and a
> shared config that declines to decide has moved the cost rather than removed it. `'preserve'` is
> also the only value that is safe to impose retroactively, because it is the one that changes
> nothing already written.

## 3. Wire it up

### ESLint — `eslint.config.js`

```js
// Svelte
import { svelteConfig } from '@jrmoulckers/eslint-config/svelte';
export default svelteConfig();

// React (Vite, or any non-Next React app)
import { reactConfig } from '@jrmoulckers/eslint-config/react';
export default reactConfig();

// Next.js
import { nextConfig } from '@jrmoulckers/eslint-config/next';
export default nextConfig();

// Plain TypeScript
import { base } from '@jrmoulckers/eslint-config';
export default base({ env: 'node' });
```

> **`nextConfig()` includes the React and accessibility rules — do not compose it with
> `reactConfig()`.** Through `eslint-config@0.12.0` it did not. It imported only
> `@next/eslint-plugin-next` plus hooks, so adopting it dropped 17 `react/*` and 6 `jsx-a11y/*`
> rules relative to the `eslint-config-next` you migrate off, which bundles `eslint-plugin-react`
> and `eslint-plugin-jsx-a11y` as direct dependencies. `react/jsx-key` and `jsx-a11y/alt-text`
> both stopped firing. Fixed in **0.13.0**; both presets now share one internal layer.
>
> **Those are counts of _enforcing_ rules, and the distinction is not pedantry.** Measured on the
> same probe file, `--print-config` on each config:
>
> |                 | legacy `next/core-web-vitals` | `nextConfig()` 0.13.0      |
> | --------------- | ----------------------------- | -------------------------- |
> | `react/*`       | 22 present / **17 active**    | 38 present / **18 active** |
> | `jsx-a11y/*`    | 6 present / **6 active**      | 34 present / **31 active** |
> | `react-hooks/*` | 2 present / **2 active**      | 17 present / **2 active**  |
>
> A key being present says nothing; `eslint-config-prettier` sets 17 `react/*` formatting rules to
> `off`, and the React Compiler family is present-but-`off` until you pass `compiler: true` — which
> is why the hooks row reads 17 present and 2 active rather than being a regression. **Count rules
> whose severity is not `off`.** A present-key count would have reported the original bug as 38
> versus 22 and looked like an improvement.
>
> Note the fix does not merely restore parity: `jsx-a11y` goes from 6 enforcing rules to **31**,
> because `eslint-config-next` ships a small hand-picked subset rather than the plugin's
> recommended set. If you adopt the preset expecting the old behaviour, expect new a11y findings.
>
> **The comment above the import argued for the fix and shipped without it.** It read "Next.js is
> React, and `eslint-config-next` bundles `eslint-plugin-react-hooks`. Omitting it here would
> silently drop rules with no signal at the call site" — correct reasoning, correct failure mode,
> applied to one of the three plugins that sentence describes. A rationale is not a test: it
> records what someone intended at the time, and nothing re-checks it when the code beneath it
> changes.
>
> **It also could not fail loudly, by construction.** Removing `eslint-config-next` removes the
> only thing that installed those two plugins, so no unresolved-plugin error was left to raise. A
> missing plugin is noisy; a missing plugin _and_ the rules that referenced it is silent. Lint
> stayed green and coverage shrank — that regression surfaces months later as a bug, not as a lint
> failure.
>
> **If you adopted a preset expecting parity with the config you replaced, count rules rather than
> reading the preset.** On the same file, before and after:
>
> ```bash
> npx eslint --print-config path/to/a/component.tsx > after.json
> node -e "const r=require('./after.json').rules, on=k=>{const v=r[k];const s=Array.isArray(v)?v[0]:v;return s!=='off'&&s!==0}; const c=p=>Object.keys(r).filter(k=>k.startsWith(p)&&on(k)).length; console.log('react',c('react/'),'a11y',c('jsx-a11y/'),'hooks',c('react-hooks/'))"
> ```
>
> A count that went **down** is the signal. Zero in a category you previously had is this bug.
>
> **"You were never affected" is scoped to regressions, and it is read as "nothing here concerns
> you."** That fix note told `reactConfig` users the hooks bug never reached them, which was true.
> A consumer nearly closed the release unread on that basis — then checked what they actually had
> and found their own config sets **no `react-hooks` rules and no `jsx-a11y` rules at all**, with
> neither plugin in any manifest. They had been linting React with zero hooks coverage and zero
> accessibility coverage since before the preset existed.
>
> So the preset was not preserving a guarantee for them. It was introducing one they had never
> had — and the two `rules-of-hooks` defects it surfaced had been invisible precisely because no
> rule in their CI could see them.
>
> **Separate regression scope from baseline capability when you write a fix note.** They are
> different audiences and the sentence that reassures the first dismisses the second, who has
> strictly more to gain. The consumers with the least existing protection are exactly the ones a
> "you were never affected" line tells to stop reading, because having never had the rule is
> indistinguishable, in that sentence, from having never lost it.

Every preset takes `{ ignores, env, rules, extend }`. Product-specific rules — ORM guards, i18n
literal checks, import boundaries — go in `extend`, so the shared preset stays generic:

```js
export default nextConfig({
  extend: [
    {
      rules: {
        'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['db'] }],
      },
    },
  ],
});
```

Type declarations ship with the package from `0.8.0`, so option names and types are checked even
in a plain `eslint.config.js` **if that file is inside a TypeScript project and that project checks
JavaScript**. Both conditions are load-bearing, both fail silently, and most repositories satisfy
neither by default. Do not hand-write ambient declarations — and **if you already did, delete
them**: an existing one does not become redundant when the package ships types, it silently
overrides them. See `A local declare module silently overrides the package's shipped types`.
`extend` is deliberately typed
`unknown[]`: config objects originating from a different copy of `@types/eslint` than yours are not
mutually assignable, so a narrower type would reject correct configs.

**Precondition 1: the config file must be in some project's file set.** `eslint.config.js` normally
sits at the repository root, above every project's `include`. A consumer checked each of their
projects with `tsc --listFilesOnly` and found the root config in **none** of them, so the
declarations could not have applied no matter what else was configured. Measured on a minimal
project with `include: ["src"]`, `allowJs` and `checkJs` both on: the program contains `src/a.ts`
and not `eslint.config.js`. Exit `0`, no diagnostic.

They were right not to wire it up during a migration. Pulling a root config into a TypeScript
project widens typecheck scope, which is a separate change with its own findings and belongs in its
own pull request.

**Precondition 2: `include` without `allowJs` is a silent no-op, not an error.** A second consumer
found their `tsconfig.node.json` had listed `svelte.config.js`, `eslint.config.js` and
`prettier.config.js` in `include` since adoption — and with `allowJs` off, `tsc` skips all three.
No error, no warning, exit `0`, and `--listFiles` shows none of them in the program. The `include`
entry made it look as though they were checked; they never had been.

The two failures are independent and produce identical output — nothing. So turning on the
declarations appears to do nothing, and the absence of any diagnostic reads as "the types do not
work" rather than "the file is not being compiled." Confirm the file is actually in the program
before concluding anything about it:

```bash
tsc -p tsconfig.node.json --listFilesOnly | grep eslint.config
```

That is this guide's standing rule about probes, in a new place: a green run proves nothing until
you have shown the check can see the file. Pair it with a negative control — pass a deliberately
invalid option and require a non-zero exit — because a config file that is skipped and a config
file that is correct produce identical output.

**Every subpath of every package must ship a `types` condition for this to work at all.** The same
consumer could not enable `checkJs`, because `@jrmoulckers/prettier-config` at `0.3.0` shipped no
declarations, so `prettier.config.js` failed with `TS7016` the moment the project began checking
JavaScript. Fixed in `prettier-config@0.4.0`. The failure is worth recognising because it **names
the wrong package**: the feature being adopted is in `eslint-config`, the error is raised against
`prettier-config`, and it appears only once an unrelated compiler option is switched on. A test in
each package now asserts that every `exports` subpath declares `types` and that the declaration is
listed in `files`, since a declaration that exists in the repository but is not published fails
identically for the consumer and passes every local check.

#### Diff the _resolved_ rule set per file class, not the config source

A consumer with no previous ESLint config had no before/after to compare, and said so rather than
manufacturing one. They applied `eslint --print-config` to a representative file of each class —
normal TypeScript, a scoped-exception file, a test, a config file, a normal component, an exception
component — and diffed the **active** rules (severity `off`/`0` filtered, options serialized so an
option-only change shows up). That is the strongest verification method any consumer has used here,
and it found a real preset defect that reading the source would not.

**`.svelte` and `.ts` resolved to materially different rule sets, in both directions.** The cause is
one line of scoping: `typescript-eslint`'s `eslint-recommended` layer declares
`files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']`, so it never reached `.svelte`. Because
that single layer both **disables** the core rules the compiler already enforces and **enables**
four others, its absence moved 18 rules on and 4 off at once:

- **18 active in `.svelte`, off in `.ts`** — the whole `eslint-recommended` disable set, including
  `no-undef`, `no-redeclare`, `no-const-assign` and `getter-return`.
- **5 active in `.ts`, off in `.svelte`** — `prefer-const`, `no-var`, `prefer-spread`,
  `prefer-rest-params`, `no-self-assign`.

**`no-undef` is the one that draws blood**, because it cannot see ambient or namespaced types.
Verified on a fixture: `NodeJS.Timeout` and SvelteKit's own `App.User` were both reported
`is not defined` inside `<script lang="ts">`, while byte-identical code in a `.ts` file reported
nothing. That is unfixable in the source — the identifiers are correct — so every SvelteKit
repository would hit it on the first component referencing `App.*`.

Fixed in `@jrmoulckers/eslint-config` **0.11.0** by applying the same layer to `**/*.svelte`. The
resolved sets now differ by exactly one rule, `no-self-assign`, which the Svelte plugin turns off
deliberately because `x = x` is the invalidation idiom. Three smoke tests lint real components to
hold it, and reverting the fix fails one of them.

> **The consumer's reading of the second list was wrong, and the correction matters.** They took the
> 5 rules off in `.svelte` as deliberate Svelte 5 accommodations — plausible, since `prefer-const`
> genuinely does conflict with `$state` reassignment. Only `no-self-assign` is actually the plugin's
> decision. The other four are off for the same reason the 18 are on: nothing scoped them to
> `.svelte` either. **One cause, two opposite-looking symptoms** — which is why a diff that shows
> both directions is worth more than one that shows only the alarming half. Had the fix been
> designed around the stated explanation, it would have addressed a rationale that did not exist.
>
> The trade the fix accepts, stated plainly: a `.svelte` file with a plain `<script>` gives up
> `no-undef` too. Svelte projects type-check components with `svelte-check`, so the
> compiler-already-checks-this rationale holds for the file type, and a false positive with no
> source-level fix is worse than a missed one another tool reports.

**A latent finding is still a finding.** `no-undef` was not firing on the reporting repository —
their components happened to reference no ambient type, and their lint was green. They reported it
anyway, as a sharp edge rather than a break. Nothing in the shared repository's own CI would have
caught it either. **Report what the diff shows, not what currently fails.**

**Use the same method on your own exceptions.** That consumer's other result was a negative one and
just as useful: their single scoped exception differed from the unscoped case by **exactly one
rule**, with zero rules added and zero options changed, so the narrow claim in its comment was true.
An exception block is the easiest place for scope to leak silently, and this measures it.

### Prettier — `prettier.config.js`

```js
export { default } from '@jrmoulckers/prettier-config/svelte'; // or '@jrmoulckers/prettier-config'
```

#### `.gitattributes` — required on Windows

The shared config sets `endOfLine: 'lf'`. Commit a `.gitattributes` alongside it:

```
* text=auto eol=lf

# Windows shells are the one place LF is not automatically safe.
*.bat text eol=crlf
*.cmd text eol=crlf
```

Without the first line, a Windows checkout under `core.autocrlf=true` gets CRLF in the working
tree while the index stays LF. `format:check` then **passes in CI and fails on every Windows
machine**, which reads as a broken developer setup rather than a missing file. Adding it may
reformat many files in the working tree while producing a zero-byte commit diff — that is the fix
working, not a mass rewrite.

The `*.bat` / `*.cmd` carve-out is precautionary, and it is worth being precise about why, because
the usual justification is stronger than the evidence. The claim is that `cmd.exe` misparses
LF-only batch files. Tested on Windows 11 (10.0.26100) across the shapes normally cited —
a `for` loop block, an `if`/`else` block, a forward `goto`, and `call :label` where the label is
the final line with no trailing newline — **all four ran correctly with LF endings**. So this is
not a bug you are likely to hit on a current machine.

Keep the carve-out anyway: it costs nothing, it matches the convention most `.gitattributes`
templates ship, and `cmd.exe` reads batch files by byte offset, so the tolerance is a property of
the current implementation rather than a guarantee. Just do not repeat the "it breaks parsing"
rationale as established fact — a repository that adopts a rule on a reason it never checked
cannot tell later whether the rule is still needed.

Everything else stays LF, including `.sh` and `.ps1`. Shell scripts genuinely do fail with CRLF —
that failure is real and reproducible, and `eol=lf` is what prevents it.

### TypeScript — `tsconfig.json`

```json
{ "extends": "@jrmoulckers/tsconfig/vite-app.json", "include": ["src"] }
```

| Variant           | For                                                  |
| ----------------- | ---------------------------------------------------- |
| `base.json`       | Any TypeScript                                       |
| `vite-app.json`   | Browser app — adds DOM libs and `vite/client`        |
| `vite-react.json` | React browser app — `vite-app` plus `jsx: react-jsx` |
| `vite-node.json`  | Build scripts and Node tooling                       |
| `next.json`       | Next.js — adds `jsx: preserve` and the Next plugin   |
| `node.json`       | TypeScript executed directly by Node                 |

**`node.json` is the one to reach for when Node runs your `.ts` files itself** — a server started
with `node --experimental-strip-types`, or Node 24 running TypeScript natively. Node's resolver
does not remap `./x.ts` to `./x.js`, so the specifier Node requires is the one tsc rejects by
default. This variant adds `allowImportingTsExtensions` so both agree.

It is a separate variant rather than part of `base.json` on purpose. The flag is **not** inert:
TypeScript accepts it only alongside `noEmit` or `emitDeclarationOnly`, so putting it in the base
turns a working build into a hard failure for every package that emits.

```
TS5096: Option 'allowImportingTsExtensions' can only be used when
        either 'noEmit' or 'emitDeclarationOnly' is set.
```

If you need `.ts` specifiers **and** emit, add `rewriteRelativeImportExtensions: true` locally —
it rewrites `./a.ts` to `./a.js` on the way out. It is not shipped in the variant because it
arrived in TypeScript 5.7, and 5.5 and 5.6 reject an unknown compiler option outright rather than
ignoring it (`TS5023`), which would break consumers still inside the declared peer range. Setting
it locally means you also own the TypeScript floor it implies.

`node.json` and `vite-node.json` both set `types: ["node"]`, so install `@types/node` alongside
them. Without it the first run fails with `TS2688: Cannot find type definition file for 'node'`,
which reads like a broken preset rather than a missing dev dependency.

**`node.json` bundles two unrelated concerns, so do not reach for it repo-wide.** It sets both
`types: ["node"]` and `allowImportingTsExtensions`, and a package that needs the second without the
first cannot use it. Both halves of the trap are real — measured on an empty project with one
`import './dep.ts'`:

| Extends                       | Result                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `base.json`                   | `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled` |
| `node.json`, no `@types/node` | `TS2688: Cannot find type definition file for 'node'`                                                     |

So in a monorepo where only the server package declares `@types/node`, extending `node.json` from
the shared root fails every other package. The wiring that works splits by what each package
actually is:

| Config                    | Extends         | Why                                   |
| ------------------------- | --------------- | ------------------------------------- |
| root `tsconfig.base.json` | `base.json`     | serves packages with no `@types/node` |
| server app                | `node.json`     | already declares `@types/node`        |
| web app                   | `vite-app.json` | replaces `@tsconfig/svelte`           |

If a package needs `.ts` specifiers but not Node types, set `allowImportingTsExtensions: true`
locally rather than extending `node.json` for it. It is one compiler option, and it is a statement
about how that package is executed — which is a repository layout decision, not a shared practice.

#### Replacing an existing root `tsconfig.base.json`

If your repository already has a root TypeScript config, two things decide the migration, and
they are documented in different sections — so read both before opening the PR.

1. **`tsconfig` is a registry package and does need a token** (§1). An earlier revision of this
   list said the opposite — that replacing a local base added no registry dependency and was never
   blocked on package access. That was wrong, and a consumer's CI proved it with `403
permission_denied: read_package` on `@jrmoulckers/tsconfig/0.2.0`. If you are waiting on the
   visibility grant, this migration waits with it.
2. **Pick the variant per package, not per repository.** A repository whose server runs `.ts`
   directly and whose web app emits needs `node.json` for the former and `base.json` for the
   latter. That is the normal shape, not a workaround.

**Do not add a flag to cancel a flag.** When a setting you dislike arrives by inheritance from the
config you are replacing, the fix is the replacement, not a neutralizing override. A consumer asked
whether to set `sourceMap: false` to counter a `true` inherited from a third-party base, and
answered it correctly themselves: the line disappears when `extends` moves to the preset, so adding
an override today means deleting it again later, and in the meantime the file states an opinion the
repository does not hold. Where the inherited setting is already inert — theirs was, because the
package sets `noEmit` on its own line — there is nothing to fix at all. **Confirm the flag is
actually doing something before you act on it**; provenance makes a setting look load-bearing
(a third-party base that sets it deliberately, with a rationale) when only measurement can say
whether it is.

> **The justification comment is more durable than the setting.** A second consumer had not merely
> inherited `sourceMap` — they had explicitly ported it into a new config with a comment restating
> the upstream rationale, written by copying that rationale rather than testing it. Their own
> assessment is the one to keep: an inherited default is invisible and gets re-derived whenever the
> base changes, but **a hand-written line with a justification reads as deliberate and already
> verified**, so the next reader preserves it out of respect for reasoning nobody ever checked.
> When you port a setting out of a base you are replacing, port the measurement too, or drop the
> comment and leave the setting bare.
>
> They also named the general class, and it is the most useful thing to come out of this:
> **wrong-but-inert statements survive precisely because nothing contradicts them.** There is no
> failing test to motivate removal and no symptom to trace, so the only pressure on them is someone
> deciding to check. Four instances so far, in four different artifact types — a config flag with
> a false rationale, a false claim that a principle area did not apply, a summary line naming a
> version many releases stale, and a measurement defending a setting by comparing it against
> itself rather than against what it prevents. The argument for removing any of them is not that
> they break something; it is that a false statement nothing refutes is a standing invitation to
> preserve it. Treat "this is harmless" as a reason to check it sooner, not later.
>
> **The review heuristic that falls out of all four: when a config value carries a rationale
> comment, the test is not "does it do what it says" but "what breaks if I remove it."** Every one
> of these failures is consistent with the artifact it describes — the flag really does set what
> the comment claims, the version string really is a version, the measurement really did run. The
> artifact never contradicts you, because it is not the thing in question. Only an experiment
> designed around what the setting _prevents_ can. Contributed by a consumer who applied it to
> their own ported comment first.

**Diff the old base against the preset before deleting it, option by option**, and treat any
option the preset lacks as a finding rather than an oversight. The presets are deliberately not
supersets. A concrete case: a repository fixing a Node 24 `ERR_MODULE_NOT_FOUND` had added
`allowImportingTsExtensions` to its own base; `base.json` does not set it, so a straight
replacement would have reintroduced the bug the option was added to fix. The answer was
`node.json` for that package — not hoisting the option into the base, which breaks every
emitting consumer with `TS5096` as shown above.

State the delta in the PR description. "Adopted the shared base" hides a regression; "adopted
the shared base; server moves to `node.json` to keep `.ts` specifiers working" does not.

**And keep each verification inside the tool it was run with.** A consumer who proved their ESLint
migration lost **zero rules** — a real, careful, rule-by-rule resolved-config diff — flagged that
the same number was at risk of being quoted as though it covered their toolchain. It does not. A
rule-level diff says nothing about `tsconfig`, and that repository's own `allowImportingTsExtensions`
gap is the counter-example: ESLint lossless, TypeScript config not. A clean typecheck under the new
flags is likewise a statement about the _code_, not about whether the config is a superset.

Three separate claims, three separate proofs: rules preserved, options preserved, code still
compiles. Report them separately or the strongest one silently vouches for the other two.

**On TypeScript 6, `baseUrl` stops the compiler before it checks anything — and the run looks
clean.** This is the single most dangerous interaction with these presets, because it produces a
success-shaped result rather than a failure. TS 6 promoted `baseUrl` from a deprecation warning to
a hard error, and a config error aborts the run before any file is loaded:

```
tsconfig.json(2,24): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in
TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

Measured on TypeScript 6.0.3 against a file containing two blatant errors — a `string` assigned to
`number`, and an unguarded index read. **Neither was reported.** Total output: one line, about the
config. A consumer keeping the ordinary path-alias shape (`baseUrl` plus `paths`) therefore sees
**one error and zero type diagnostics**, which reads as "essentially clean under the shared base"
when in fact nothing was type-checked at all.

**Do not take the compiler's own advice here.** `ignoreDeprecations: "6.0"` silences it on TS 6,
but on TypeScript 5.5 the same line fails with `error TS5103: Invalid value for
'--ignoreDeprecations'` — verified — which aborts the run in exactly the same way. Since these
presets support `^5.5 || ^6 || ^7`, putting it in a shared base would trade a false clean on one
half of the supported range for a false clean on the other. It is safe only in a consumer pinned
to TS 6, and even then it defers work rather than doing it.

**The fix is to drop `baseUrl` and make `paths` tsconfig-relative**, which is what TS 6 wants and
what removes the deprecation instead of hiding it:

```jsonc
// before — aborts the run on TS 6
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }

// after — checks files on 5.5, 6 and 7 alike
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

Both forms were verified to check files and report the two planted errors on 6.0.3.

> **Whenever a type-check comes back clean or near-clean after a config change, prove it ran.**
> Plant an obvious error — `const x: number = "s"` — and confirm it is reported. A count that
> collapses to zero or one is far more often a config abort than a healthy codebase, and every
> other signal here (exit code, output shape, brevity) looks the same in both cases. This is the
> same family as an empty token that 401s and a truncated lint config that lints nothing: the
> mechanism reports success-shaped output while doing no work.

**`types` replaces, it does not merge.** `vite-app.json` sets `types: ["vite/client"]`, and TypeScript
does not concatenate `types` across `extends` — a consumer inheriting it loses `node`,
`vitest/globals`, `@testing-library/jest-dom` and anything else it relied on. Restate the full list,
including `vite/client`:

```jsonc
{ "compilerOptions": { "types": ["vite/client", "node", "vitest/globals"] } }
```

Unlike the `baseUrl` case this one fails loudly — `TS2591: Cannot find name 'process'`, naming the
fix — so it costs a confusing few minutes rather than a wrong conclusion.

**`allowImportingTsExtensions` is deliberately absent from `base.json`, and cannot be added there.**
A consumer whose previous config set it asked for it in the base, correctly noting that the shared
base is therefore **not a superset** of what it replaces. It is not an oversight. The option is only
legal when `noEmit` or `emitDeclarationOnly` is set, so putting it in a base that every preset
inherits hard-breaks any consumer that emits. Measured on TypeScript 5.9.3, base with the flag and a
consumer setting `noEmit: false`:

```
tsconfig.json(1,26): error TS5096: Option 'allowImportingTsExtensions' can only be used
when either 'noEmit' or 'emitDeclarationOnly' is set.
```

This is the `ignoreDeprecations` shape again: a fix in the shared base that repairs one half of the
supported range by breaking the other. Set it in your own `tsconfig.json`, next to the `noEmit` that
makes it legal. It fails loudly and names the fix, so it is the cheap class of error.

The general point matters more than this flag. **The presets are a considered baseline, not a
superset of every config they replace**, and an adoption that reports "nothing lost" has usually
measured one tool. The consumer above was explicit that their own "0 lost" result covered ESLint
only and was being cited as the reference for six other repositories — say which tool your result
covers, because the next repository will read it as covering all of them.

`@tsconfig/svelte` sets it, explaining it is needed "to have warnings/errors of the Svelte
compiler at the correct position" — a rationale that predates Svelte 5. Measured on svelte-check
4.7.5 with svelte 5, diagnostic positions are identical with and without it, both for TS errors
inside `<script>` and for compiler warnings such as a11y and unused CSS. It could not have
worked regardless: `base.json` sets `noEmit`, so tsc writes no output and therefore no source
maps. Porting the flag would imply a behaviour it does not provide. Vite build sourcemaps are a
separate setting (`build.sourcemap` in `vite.config.ts`) and are unaffected.

**Independently reproduced on a second toolchain.** A consumer declined to take the result on
faith, correctly noting it came from a different repository on a different svelte-check patch. They
re-measured on svelte-check 4.7.4 / svelte 5.56.8 / TypeScript 6.0.3, with a probe designed to
expose mapping drift — a TS error in a `<script>` placed _below_ both markup and a `<style>` block:

| Diagnostic             | `sourceMap: true` | `sourceMap: false` |
| ---------------------- | ----------------- | ------------------ |
| TS error in `<script>` | `14:9`            | `14:9`             |
| a11y missing alt       | `2:1`             | `2:1`              |
| unused CSS selector    | `8:3`             | `8:3`              |

Byte-identical. Two toolchains, one mechanism explaining why it could not be otherwise. This is the
standard to hold shared-repository measurements to: **re-measure on your own versions rather than
adopting a number, especially when the conclusion is "delete this."**

### Scripts

```json
{
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "build": "vite build"
}
```

`ENG-TEST-004` requires these to report independently. Do not collapse them into one script.

## Go repositories

There is no npm path, so the shared lint configuration is fetched over HTTP at CI time. This
repository is public, so the fetch is anonymous — no token, no secret, no access grant.

Follow [practices/go.md](../practices/go.md) and fetch
[`configs/golangci.yml`](../configs/golangci.yml):

```bash
# Pin to a release tag. <latest-tag> is a placeholder, not a version — it will
# not resolve, which is the point: a literal version copied out of a document is
# stale one release later, and can be actively wrong. Resolve the newest:
#
#   gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name
#
# Without gh, sort by version — the tags API does not order by version, and
# sorting lexically puts v0.9.0 above v0.11.0:
#
#   git ls-remote --tags --refs https://github.com/jrmoulckers/engineering.git \
#     | sed 's:.*refs/tags/::' | grep '^v' | sort -V | tail -1
#
ENGINEERING_REF=<latest-tag>

tmp=$(mktemp)
curl -fsSL --retry 3 \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${ENGINEERING_REF}/configs/golangci.yml" \
  -o "$tmp"

# Validate before publishing to the destination.
[ -s "$tmp" ] || { echo "empty config fetched" >&2; exit 1; }
grep -q '^version:' "$tmp" || { echo "not a golangci config" >&2; exit 1; }
grep -q '^linters:' "$tmp" || { echo "not a golangci config" >&2; exit 1; }

mv "$tmp" .golangci.yml
```

The ref above is a placeholder that will visibly fail rather than a version that quietly lags.
That is deliberate. A literal version written into a document does not merely go stale — it can
go _wrong_: `v0.2.3` shipped a `configs/golangci.yml` comment telling consumers to **copy** the
file, which a later release reversed to "fetch at a pinned tag". A consumer who
copied the literal out of this guide would have adopted the behaviour the guide exists to
prevent. A placeholder cannot do that, because it does not run.

**Resolve the newest tag, but never resolve it at fetch time.** Pinning must stay an edit in your
repository's history. If CI resolved `latest` on every run, a tag pushed here would change your
lint rules with no commit on your side, surfacing on whichever unrelated PR happened to be open —
and `git log` would no longer explain why a green PR went red. Make the pin easy to update and
loud when it is stale; never make it automatic.

Six details carry the weight here:

**Write it to the repository root.** This is required, not cosmetic. golangci-lint's default
`run.relative-path-mode: cfg` resolves reported paths relative to the config file's directory,
so a config held outside the repository produces diagnostics with paths like
`../../elsewhere/file.go`. Root placement also lets editor integrations discover the config without
configuration of their own.

**Invoke it as `golangci-lint run --config .golangci.yml ./...`, never bare.** Because the fetched
config is deliberately untracked, a contributor who runs the linter before running the fetch has no
`.golangci.yml` — and golangci-lint does not treat that as an error. It swallows the
`ConfigFileNotFoundError` and falls back to its **built-in defaults**, a strictly smaller set
(roughly `errcheck`, `govet`, `ineffassign`, `staticcheck`, `unused`) with none of the shared
settings. The run looks clean locally and goes red in CI, with nothing explaining the gap. Naming
the path makes the file read directly rather than searched for, so its absence fails loudly. Better
still, wire the fetch and the run into one `make lint` target so the config cannot be missing;
`--config` is the backstop for anyone bypassing it.

**The blessed `make lint` form.** Treat the fetch as a **prerequisite of linting**, not as a CI
step that happens to run first — that framing is what keeps a fresh clone or a `git clean` from
producing a silently weaker run:

```make
ENGINEERING_REF ?= <latest-tag>

.golangci.yml:
	@scripts/fetch-golangci.sh

.PHONY: lint
lint: .golangci.yml
	golangci-lint run --config .golangci.yml ./...

.PHONY: lint-refresh
lint-refresh:
	@rm -f .golangci.yml && $(MAKE) .golangci.yml
```

Expressing the config as a **file target** rather than a phony step is the part that matters: Make
creates it when absent and skips the network when present, so `make lint` is correct on a fresh
clone and cheap afterwards. Keep it gitignored, and use `lint-refresh` to move refs — editing
`ENGINEERING_REF` alone will not re-fetch an existing file.

**The defaults exclude the linters most worth having.** A consumer measured this on a real rebase:
running against built-in defaults reported clean, while the pinned config found **five** issues the
merge was silent about — three `unused` (dead on `main`, invisible to `go vet`), one `errcheck`,
and one `nilerr`. `nilerr` is **not** in the default set, so a contributor who skipped the fetch
would have shipped a `nilerr` violation believing they had linted.

**Pin to a tag, never `main`.** An unpinned fetch means an unrelated commit here can turn a
consumer's build red with no change on their side, which is the same failure mode `GH-ACT-003`
pins action SHAs to avoid.

**`-f` is not optional — or capture the status instead.** Without `-f`, `curl` writes the error
body to the output file and exits zero, so lint then runs against a config that is HTML. That
passes, which is worse than failing. Capturing the status explicitly is strictly better where you
control the script, because `-f` gives a non-zero exit but not the code, so a missing tag and an
outage are indistinguishable — and a missing tag is the failure people actually hit:

```bash
code="$(curl -sSL -w '%{http_code}' -o "$tmp" "$url")"
[ "$code" = 200 ] || { echo "$url returned HTTP $code; check ref '$ENGINEERING_REF' exists" >&2; exit 1; }
```

**Check the shape, not just the size.** `-f` catches a non-200 and `-s` catches a truncated
transfer, but neither catches a **200 carrying the wrong body** — a redirect landing somewhere
unexpected, or a proxy's error page served with a success status. Asserting the payload has
top-level `version:` and `linters:` keys is what separates "we received bytes" from "we received
a golangci config".

**Stage, validate, then move.** Fetching straight to `.golangci.yml` means a failed or partial
run leaves a corrupt file exactly where the linter will read it, and the next run lints against
it. Writing to a temporary file and moving only after every check passes makes a failed fetch
leave the previous state untouched.

Do not vendor the file into the repository. golangci-lint has no config inheritance — no
`extends`, no include, no remote config (`extends:` is rejected outright as an unknown property)
— so the file must arrive on disk one way or another, and a committed copy silently drifts from
the shared config. The drift is invisible precisely because nothing fails.

Add the fetched path to `.gitignore`. That is what makes the previous paragraph structural rather
than advisory: a file that cannot be committed cannot fork.

**Budget for the first run.** On a Go repository with no prior lint configuration, expect roughly
**20 findings per 30 files**, overwhelmingly mechanical — unchecked errors, `%w`/`%v` misuse, and
`staticcheck` simplifications. Fix them in the adopting change rather than suppressing them; a
`//nolint` added during adoption is a permanent exemption bought to save an afternoon.

## Non-npm configuration generally

The same reasoning applies to any config this repository publishes that has no package-manager
channel — Go today, shell or Python later. Fetch by tag from `raw.githubusercontent.com`, fail
loudly on a non-200, validate the payload's shape rather than only its size, write to a temporary
file and move it into place only after every check passes, and add the destination to
`.gitignore` so the fetched copy cannot be committed.

**Every pinned fetch needs a staleness notice, whatever the artifact.** A pin is a decision and
should stay one — resolving the newest ref at fetch time means a commit here reddens your build
with no change on your side. But a pin also has no expiry and no lockfile, so nothing tells you it
has aged. This has now cost four repositories real work, in four different mechanisms and always in
the same direction: they reported defects that had already been fixed, and in two cases did work to
satisfy rules that had already been withdrawn.

- A Go consumer pinned at `v0.2.3` rewrote ten call sites to satisfy `errcheck`'s `check-blank`,
  which a later release had already turned off as contradicting `practices/go.md`.
- Two consumers ran a citation checker fetched at `v0.2.11` and reported two features as missing
  that had shipped in the twenty-plus releases since.
- Four consumers read `packages/*/package.json` **at a repository tag** and reported peer ranges as
  too narrow that had already been widened. A repository tag is not a package version; `versions.json`
  is the CI-verified authority.
- One consumer audited a stale `origin/main` and re-reported a deviation they had themselves fixed.

The notice belongs beside every fetch, and both guards in it are load-bearing:

```bash
latest=$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)

# `releases/latest` is the most recently published release, not the greatest
# version. A bare `!=` prompts a DOWNGRADE the first time a backport is
# published after a newer minor. Speak only when the tag sorts above the pin.
newer=$(printf '%s\n%s\n' "$ENGINEERING_REF" "$latest" | sort -V | tail -1)
if [ -n "$latest" ] && [ "$newer" != "$ENGINEERING_REF" ]; then
  # Compare bytes, not tags: most releases do not touch the file you fetched.
  new_sum=$(curl -fsSL "https://raw.githubusercontent.com/jrmoulckers/engineering/${latest}/configs/golangci.yml" | sha256sum | cut -d' ' -f1)
  [ "$new_sum" = "$(sha256sum .golangci.yml | cut -d' ' -f1)" ] ||
    echo "::notice::your rules are behind: pinned $ENGINEERING_REF, newest is $latest"
fi
```

`::notice::`, never a non-zero exit — a tag pushed here must not redden an unrelated PR, or pinning
stops being a decision and becomes a default someone bumps to get green.

**Compare the bytes you fetched, not the tag you pinned.** A tag-only notice fires on every release
forever, including the 26 consecutive tags that did not touch the Go config. A signal that always
fires stops being read — and then it is worse than no signal, because the habituated ignore also
covers the run where it mattered. It also silently charges a re-pin per release for no change in
enforcement. Hashing the candidate answers the question a consumer actually has: not _"are you 13
tags behind"_ but _"are your rules 13 tags behind."_ Against this repository's history it would have
stayed silent across all 26 no-op tags and still fired at `v0.2.17` and `v0.10.0`.

**A pin and a citation ref are different things.** The pin selects which bytes are enforced; a
citation records the text you read at a tag. Sweeping both on every re-pin produces a large diff
across every citing file for no change in behaviour, which is how re-pinning became expensive enough
to skip.

**Compare against the newest release, not the next tag.** Adjacent tags are usually identical, so a
diff against `N+1` almost always shows nothing and is read as "my pin is current". That is precisely
the comparison that let the `check-blank` rewrite happen.

**Self-identify what you can.** `check-citations.mjs` prints its version and the checks it ran;
`configs/golangci.yml` carries a `config-revision` marker bumped whenever a rule's verdict changes.
Both exist so a fetched artifact can answer "what am I?" without a diff. Note the limit, though: a
copy old enough to predate the marker cannot report that the marker is missing, so **absence is
itself the signal** — if the artifact you fetched says nothing about its own version, assume it is
old.

## Citing principles

Replace prose that restates a rule with a citation to its ID. Three things make a citation wrong
rather than merely untidy.

**Verify every ID against `principles/index.json`.** IDs are not guessable from the subject
matter, and a citation that points at the wrong principle is worse than the restated prose it
replaced, because it looks authoritative.

```bash
curl -fsSL https://raw.githubusercontent.com/jrmoulckers/engineering/main/principles/index.json \
  | jq -r '.principles[] | select(.id=="ENG-LOCAL-001") | .statement'
```

Run the checker over your repository before opening the PR. It needs no install and no auth — a
pinned `--index` URL is all it reads:

```bash
REF="$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)"

curl -fsSL -o /tmp/check-citations.mjs \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/scripts/check-citations.mjs"

node /tmp/check-citations.mjs . --review \
  --index "https://raw.githubusercontent.com/jrmoulckers/engineering/${REF}/principles/index.json"
```

**Re-resolve `REF` each time; do not sort tags yourself.** Resolve it from the releases API, as
above. A pinned ref you wrote down once is a snapshot, and this repository has shipped many
releases in a day. Lexical tag sorting is also wrong here — `v0.2.9` sorts _after_ `v0.2.11`, and
`v0.2.11` is a different and much older release than `v0.21.1`, which is one transposed character
away. A consumer pinned at `v0.2.11` spent two rounds reporting features as missing that had
shipped in the twenty releases since.

**If the run prints no version line at all, you are older than `v0.21.1`.** This is the one
staleness the version line cannot report, because a copy that predates it has nothing to print —
so the _absence_ is the signal. There is no version to compare, no list of checks, and no
indication that either is missing. Treat a silent summary as a stale copy and re-fetch before
concluding anything about your repository.

**That recipe is for a local pre-PR run, not for CI.** A consumer declined to wire it into their
workflow and was right to: `curl | node` from a tag, inside a job holding a token, is a
supply-chain seam, and a tag is mutable — it can be moved to point at different code after you
reviewed it. If you do want it in CI, pin `REF` to a **commit SHA** rather than a tag, so the
fetched bytes cannot change under you. Nothing here needs to run in CI to be useful; the check
exists to be run before you open the PR, when there is still a cheap moment to fix a citation.

**Confirm which checks actually ran — the script is fetched, not installed, so a stale copy is
invisible.** Every run now prints its own identity:

```
checker v7; checks run: IDs, stated names, link paths. Index: <url>
```

If that line is missing, or names fewer checks than you expected, you are running an old copy and
your clean result covers less than you think. A consumer reported link-path validation as a missing
feature after it had shipped several releases earlier, having fetched the script once and kept it —
their output could not tell them so, and neither could the exit code. Re-fetch at the latest tag
rather than reusing a downloaded copy, and treat `--no-links` as a claim you have to justify: it
announces itself as `(link paths SKIPPED via --no-links)` for exactly that reason.

This is the same failure family as the aborted type-check and the missing lint config: **a tool
reporting success while doing less than you assume.** The general defence is to make the tool state
what it did, rather than to remember what it should have done.

**Read the `--review` output; do not just check the exit code.** The exit code only catches an
ID that does not exist, and that is the rarer mistake. A real ID used for the wrong rule
exits 0. `--review` prints each principle's real title and its full statement, plus the
neighbouring lines, against every citation:

```
    171  ENG-PERF-009   Assurance precedence
         says: Reject performance changes that weaken correctness, accessibility,
               privacy, or security.
         keyboard control and correctly labelled transport controls.
      >  [`ENG-PERF-009`](…/assurance/performance.md)
         additionally forbids trading accessibility away for performance.
```

The neighbouring lines are the point. A wrapped markdown link leaves the citing line a bare URL,
so the claim being checked sits on the line above or below it. Judging that citation from the
URL line alone is not possible — and reading a summary of it instead of the file is how a
correct citation gets mistaken for a wrong one.

**The statement is printed because a three-word title pattern-matches too easily — but do not
treat it as automatically safer.** A statement can name a concern in passing, and a keyword match
then reads as confirmation. `ENG-PERF-009` "Assurance precedence" is the standing example: its
statement contains the literal word **accessibility**, so it will appear to confirm any citation
placed near an accessibility claim, whether or not it governs one.

So the question to ask is not "does this principle mention the topic" but **"does this principle
govern this claim?"** `ENG-PERF-009` governs _changes made for performance_. It correctly supports
"a performance change may not trade accessibility away" and does not support "this project
commits to WCAG 2.2 AA", which no ratified principle requires.

**The reviewer's false positive is a failure mode too, and it costs more than it looks.** All three
worked examples that previously appeared here were wrong. A repository was flagged for citing
`ENG-PERF-009` at an accessibility rule, `ENG-TEST-003` at test colocation, and `ENG-ARCH-003` at a
tier boundary. Reading the file settled it: every one was already scoped correctly in the prose —
"`ENG-PERF-009` **additionally** forbids trading accessibility away for performance", "**a libro
convention**; the obligation it serves is `ENG-TEST-003`", and an `ENG-ARCH-003` citation pointing
at the ADR that discharges it. The citations were exemplary. The flag was not.

Two things caused it, and both are worth avoiding:

- **Judging a citation from one line.** A wrapped markdown link leaves the citing line a bare URL,
  so the qualifying clause sits on the next line. The selection effect is perverse: a long URL is
  the single most likely thing to get a line of its own, so line-oriented review is least reliable
  exactly where citations are most carefully written. `--review` prints a context window for this
  reason — but the reviewer who reported this had been shown a summary, not the file.
- **Generalizing from an unverified flag.** The false conviction was then written into this guide
  as an observed pattern and broadcast to other repositories, one of which spent a full audit
  looking for a defect that never existed. A wrong finding propagates exactly like a right one.

**None of that is an argument for not challenging.** The repository that was wrongly convicted made
the point better than I can: the retraction is what surfaced the `--review` context hole, and the
grep they ran to answer the challenge found a real version inconsistency in their own `AGENTS.md`.
A wrong challenge that gets **checked against the artifact** is still productive; the cost lands
only when the challenge is checked against nothing and then relayed onward. So the rule is not
"flag less", it is **flag freely, verify before you generalize, and never broadcast an unverified
flag** — which is also the argument for keeping `--review` cheap enough that checking is the easy
path.

**A broadcast finding survives independent checking, because nobody re-checks the premise.** The
repository that spent an audit on the phantom defect did re-run the checker, read its own citations,
and correctly report itself clean — _against the three examples_, which it took as established fact
without opening the file they came from. Their own summary of it is the sharpest statement of this
whole failure mode: the same shortcut, one level down. No tool helps there. A finding you received
is an artifact you have not read, and the fact that it arrived from an authority is precisely what
makes it feel already-verified.

**An empty area cannot be disagreed with, so "declines nothing" means less than it sounds.** One
consumer evaluated all 66 principles individually and declined none — then pointed out that three of
its four platforms are native and no principle addresses them at all. Silence there is not
agreement; it is absence. When you report which principles you decline, say which areas had nothing
to decline, or a reader will count an unwritten rule as an accepted one.

**A cited range is verified at its endpoints only, and the checker never resolves the IDs between
the two you wrote.** `ENG-OBS-001`–`ENG-OBS-007` was scanned as two citations; the five in between
were never resolved, never compared against anything, and counted toward a clean result. That is
the worst possible shape for a blind spot: a range asserts something about **every** member while
showing the reader only the endpoints, so it is exactly where a wrong-meaning citation survives
longest — and `--review` looked exhaustive while omitting them. One consumer had two such ranges
concealing five IDs, resolved all five by hand, and found them correct only because an adjacent
gloss happened to list the titles in the right order.

The checker now expands ranges within an area and treats an interior member exactly like a literal
citation: it must exist, and `--review` prints it marked `via range` — _the range asserts this, but
the text never names it_. A range whose interior does not exist now fails. Ranges spanning two
different areas are left alone, since a dash between areas is prose rather than a range.

**Prefer an enumerated, glossed list over a range** where the members matter. A range is compact for
the author and lossy for the reader, who cannot tell whether you checked the interior or assumed it.

**The same shape appears outside citations, and there the answer is different.** A consumer read the
catalog span `ENG-PERF-001` through `ENG-PERF-009` as asserting nine implemented principles, and
reported that it concealed three with no implementing guide. The three are real —
`ENG-PERF-003`, `ENG-PERF-004`, `ENG-PERF-009` — but they are **not** concealed: they are enumerated
in [`practices/uncovered.json`](../practices/uncovered.json), `check-coverage` fails if that ledger
and reality disagree, and `practices/performance-budgets.md` names them in prose as ratified but not
yet implemented.

That contrast is the useful part, so state the rule by what separates the two cases rather than by
the syntax:

> A span is safe exactly when something machine-checked enumerates its exceptions. A citation range
> asserted meaning for interior members with nothing tracking them, so it had to be expanded. A
> catalog range asserts membership, and a separate ledger records which members are unimplemented —
> so the span stays, and the ledger is what you read.

If you inherit a span with no ledger behind it, expand it. If you are writing one, write the ledger
first — a span backed by nothing is a claim about members nobody verified, which is the failure both
instances share.

**A third instance sharpens the rule, because the machine-checked thing was itself the victim.** A
consumer's coverage ratchet read a header span `ENG-BUILD-001`–`ENG-BUILD-008` as covering both
endpoints while the body implemented one, and so counted four principles as covered that no one had
written a technique for. The ledger was correct; the _counter_ resolved the span naively. Their
corrected number came out **lower** than the wrong one, which is the signature of a real fix to a
counting error.

So "machine-checked" is not sufficient on its own — a checker that treats a span as two tokens
inherits exactly the defect the span creates. **Resolve ranges to their members before counting
anything, and never let a heading be the source of a coverage claim.** The same defect has now
appeared in a citation scanner, a practices header, and a coverage counter: three artifacts, three
independent discoveries, one shape — **an inclusive-looking span asserts coverage of members nobody
enumerated.** It recurs because the span is cheaper to write than the enumeration and reads as more
authoritative than either.

**Wrap so a citation never sits alone on a line.** Keep the qualifying clause on the same line as
the link. It is a one-line authoring convention that makes any line-oriented review of your file
sound, and it costs nothing.

Do not assume you were unaffected because a review of your file read correctly. One consumer
checked their two link-bearing citations specifically and found both had put the ID on the claim
line — then reported the right conclusion: they **got lucky rather than being immune**. Whether a
line-oriented reader sees your claim depends on where your wrap width happened to fall, which is
not a property you control or notice. Adopt the convention deliberately rather than inheriting it
by accident.

The statement-over-title case survives all of this, on better evidence: judging by title alone, one
consumer would have wrongly convicted `ENG-SEC-007` "Secure failure" for guarding a short API token
(the statement — "reject unsafe configuration before service" — clears it), while missing a real
`ENG-SEC-005` defect. Read the statement, then ask whether it governs.

**When an ID appears more than once, judge each use independently.** `--review` marks repeated
citations `[use k of n]` for this reason. A consumer found a wrong `ENG-SEC-005` citation in a file
that also cited `ENG-SEC-005` **correctly** ninety-eight lines earlier — right for the runtime
parsers guarding an unchecked request body, wrong for a server-side authorization invariant. Their
diagnosis of why it survived two reviews is worth repeating: a correct nearby use makes the ID read
as _known-good for this file_, so the second use is confirmed by association instead of re-derived.
That is a reviewer failure the exit code cannot reach, since both uses are of a real ID.

**Run `--by-id` as well as `--review`.** It groups every use of an ID together, most-cited first,
instead of walking files in order. Two consumers independently hit the same defect from opposite
directions: one cited an ID correctly and then wrongly ninety-eight lines later in the _same file_,
the other cited one ID four times across _four files_ with two different meanings. File-ordered
review misses both, for the same reason — the uses are never adjacent, so the divergence is never a
comparison. Grouped, the question becomes one you can answer at a glance: do all of these lines
claim the same rule?

**A cluster of miscitations usually has one cause, not several.** The four-file case was one ID
used for one wrong idea, not four independent misreadings — so it was one fix, and its author found
it by asking what the uses had in common. When `--by-id` shows a group that splits cleanly in two,
you have found a single mistake, not a run of bad luck.

**Before concluding a rule is uncovered, search by the mechanism rather than by the feeling.** That
same consumer concluded no principle covered "no environment residue — machine paths, drive letters,
home directories — in committed artifacts", having checked the security and privacy principles
because a stray home directory _feels_ like leakage. It is covered, just not there:
`ENG-ARCH-004` requires equivalent declared inputs to produce equivalent outputs, and `ENG-TEST-005`
requires generated or distributed interfaces to reproduce deterministically. An artifact carrying
the path of the machine that produced it fails both — two developers with identical inputs produce
different bytes. The residue is a **reproducibility** defect that presents as a privacy one.

This is the third instance of the same search failure: `ENG-DATA-*` is scoped by durability rather
than by data-ness, `ENG-INT-*` by external input rather than by having a service, and here the
governing principle is filed under construction rather than under secrets. **Searching the area that
matches the feeling finds the principle that matches the feeling** — which is exactly how a
plausible wrong ID gets chosen. Search the statements for the mechanism you are actually asserting.

**Fetch before you audit, and audit the ref you think you are auditing.** A consumer's first run
reported a deviation their repository had already fixed: their `origin/main` was stale, so the
checker faithfully reported a state that no longer existed. This is a second, independent staleness
from the one the tool's version line addresses — that one is a stale _checker_, this is a stale
_tree_ — and it fails in the more expensive direction, because re-reporting a fixed defect sends
someone to re-fix it. `git fetch` first, and say which ref your result covers.

The same
author convicted their own `ENG-SEC-001` citation by observing that you cannot _rotate_ a home
directory path, and that the rationale — "deleting a leaked value does not revoke copies" — says
nothing about one. A principle you are citing for one clause should still make sense in its other
clauses. Where it does not, you have matched a topic rather than a rule.

The same consumer proposed flagging multi-use IDs as a
smell. Measured before adopting: in this repository **100% of cited IDs appear more than once**
(495 citations across 66 principles), and in the smallest consumer audited, 4 of 5. A flag firing on
nearly every citation is a flag nobody reads. It would also have been wrong on their own best
example — they cite `ENG-ARCH-001` for both "one canonical record" and "components never touch
storage", which _sounds_ like one must be wrong, and both are correct because the statement carries
both halves ("each fact in one authoritative home" **and** "the smallest explicit boundary that keeps
dependencies acyclic"). So the marker states the fact and leaves the verdict to the reader.

That case is also the cleanest argument for printing statements rather than titles. Judging by title
alone, that consumer would have raised two false positives — `ENG-SEC-007` "Secure failure" looks
unrelated to rejecting a short API token until the statement says "reject unsafe configuration before
service" — while missing the one real defect.

**The checker reads the working tree, not git history.** It walks files on disk and never shells
out to git, so a miscitation already merged to `main` is invisible from a feature branch that does
not touch that file. A clean run means _the tree you are standing in_ is clean. To clear a
repository rather than a branch, run it against a checkout of `main` as well — the repository that
reported the cleanest result was clean partly because every one of its citations was still
unmerged, which is the case least likely to hide anything and therefore the case that proves the
least.

The example above is **correct**, and reads as correct: `ENG-PERF-009` is not an accessibility
rule, and the prose does not claim it is — it says the principle _additionally_ forbids trading
accessibility away for performance, which is exactly what it says. Compare a wrong one:

```
      3  ENG-PERF-009   Assurance precedence
      >  Accessibility follows ENG-PERF-009.
```

That asserts an equivalence the principle does not support. There is no ratified accessibility
principle, so the fix is to state the accessibility rule as your own and cite `ENG-PERF-009`
only for what it actually constrains.

### Write the name next to the ID, and it gets checked

`--review` is advisory: it prints the truth and trusts a human to read it. That is not enough,
because the reviewer most likely to skip it is the one who wrote the citation from memory. So
state the principle's name in parentheses and the checker verifies it for you:

```md
Adapters are required by [`ENG-INT-001` (Thin typed adapters)](../principles/platforms/integration-boundaries.md).
```

A wrong name now fails the build with a diff:

```
1 citation(s) state the wrong principle name:

  docs/architecture.md:12  ENG-SEC-001
      claimed:  Minimal directed boundaries
      actual:   Secret lifecycle
```

This converts the only error class that survived every other check into a mechanical one.
**Every miscitation in the seven-repo migration had the same shape** — a real ID, correctly
formatted, resolving to a different rule. Existence checks pass, link checks pass, and the
sentence still misleads.

The name is optional; omitting it is not a failure. Add it wherever a citation carries weight —
a principle named in an ADR, a `## Compliance` table, a rule you are asking another repo to
follow. Only parenthesised text beginning with a capital is read as a name claim, so ordinary
prose (`per ENG-SEC-008 — never a real record`) is untouched. That restraint is deliberate:
an early version also parsed em-dashed text and produced a false positive on that exact line,
and a checker that cries wolf is a checker somebody turns off.

**Cite nothing rather than the nearest-sounding ID.** If no principle states the obligation,
state it as your own rule. But check before concluding one is absent — read the **Statement**,
not the title. `ENG-INT-001` is titled _Thin typed adapters_, which does not sound like a rule
about framework-free domain logic; its Statement requires you to "isolate provider or framework
behavior behind thin single-purpose adapters", which is exactly that rule seen from the other
side. Titles are labels, not the obligation, and a search over titles alone will conclude a
principle does not exist when it does.

**Link paths are checked for you.** IDs and locations are independent, and the area prefix is not
derivable from the ID: of eleven prefixes, only `ARCH` lives under a directory named after it.
`ENG-INT-001` is under `principles/platforms/`, not `principles/architecture/`. A hand-written
path therefore produces a valid-looking citation with a dead link, and an ID-only check passes
because the ID is right.

`check-citations.mjs` validates link paths by default. It compares any markdown link whose text
names an `ENG-*` ID against that principle's `source` field in `index.json`:

```text
docs/architecture/connectors.md:14  ENG-INT-001 -> .../principles/architecture/integration.md
    expected a path ending in principles/platforms/integration-boundaries.md
```

Links pointing at a practice guide are left alone — naming an ID while linking to the technique is
correct as written. Pass `--no-links` to disable the check, though the only good reason is a
corpus you do not control.

Three separate repositories wrote a correct ID with a wrong path before this was enforced, one of
them in a document whose two links were both wrong while both IDs were right. Do not hand-write the
path; copy `source` from `index.json`.

**A fourth found one that 404s and reported it as link rot. It was not.** They had cited
`v0.2.0/principles/testing.md` and diagnosed it as stale — valid once, broken when the tree gained
its `assurance/`, `architecture/`, `operations/` and `platforms/` subdirectories. Checked against
the actual history: those subdirectories **already existed at `v0.2.0`**, and `principles/testing.md`
has never existed at any ref in this repository. The path was not stale, it was **never valid**.

Worth separating, because the two have different causes and different fixes:

|             | Rotted                              | Never valid                                     |
| ----------- | ----------------------------------- | ----------------------------------------------- |
| Cause       | the target moved after you cited it | the path was constructed by pattern, not copied |
| Implies     | pin the ref, add a redirect         | verify at authoring time                        |
| Detected by | re-checking old citations           | checking the citation when it is written        |

Diagnosing a never-valid path as rot sends you to fix history that was never broken, and leaves
the actual defect — a plausible-looking path assembled from the ID rather than copied from
`source` — in place to recur. It is the same defect the link check exists for, and pinning a tag
does not prevent it: `v0.2.0` is a perfectly good pin pointing at a file that was never there.

Their generalized warning stands and is the reason this matters: **a citation that 404s is worse
than no citation.** It carries the authority of a reference while being uncheckable, and the
reader who follows it cannot tell whether the principle is missing or the link is. Sweeping every
engineering link in a repository is cheap — theirs was fifteen — and worth doing once per repo.

**If no principle covers it, cite nothing.** A near-miss citation is the one failure mode this
whole scheme cannot survive: it transfers authorship of a rule to this repository, which never
agreed to it, and the next reader treats it as ratified. Restated prose is recoverable; a false
citation is not.

Two shapes that stay honest when nothing covers the subject:

- **Name it as yours.** "Colocate tests … a libro convention; the obligation it serves is
  `ENG-TEST-003` (Regression boundaries)." The convention is local, the cited principle is the
  real obligation beneath it, and neither is misattributed.
- **Record it as a decision.** A constraint with no principle behind it is an ADR, and
  `ENG-ARCH-003` is what requires you to write one before treating it as durable. Cite
  `ENG-ARCH-003` for the _recording_, not for the constraint.

**Cite `ENG-ARCH-003` once, on the index — not on each ADR.** This is the natural misreading of the
construction and it produces wrong citations at roughly eleven times the rate of getting it right
once. A consumer with eleven ADRs put the citation on the index and stated the direction outright:

> Recording these discharges `ENG-ARCH-003` … The principle covers the recording, not the content:
> every decision below is Docket's own, and no `ENG-*` rule mandates any particular one of them.

Attaching it to individual ADRs would assert that a ratified principle backs each decision's
**content** — the database choice, the auth model, the log design — when the principle governs only
that the decision was written down. That is the same meaning mismatch as citing a principle whose
statement does not govern your claim, arrived at from the opposite direction: not a wrong ID, but a
correct ID pointed at the wrong half of the sentence. **Ask what the principle obliges, then check
that the thing you attached it to is that thing.**

**Cite `ENG-ARCH-003` only if you actually keep ADRs.** It is the construction most likely to be
misused, precisely because it is available to any repository that writes anything down. A consumer
worked through all three shapes above looking for one that fit, and rejected this one on the
grounds that their repository has no `docs/architecture/` and no ADRs anywhere — so citing it would
assert a practice they do not follow. That is aspiration dressed as compliance, and it is worse
than silence, because the citation now reads as evidence that the obligation is discharged.

Their broader conclusion is the right default: **"no change" is a legitimate result.** Adding an ID
because a construction _permits_ one is the same failure as adding one because it sounds right.
The same repository also declined to manufacture a case for the other two shapes, and reported that
instead. If none of the three fit, cite nothing and say so.

**Two IDs side by side with nothing between them assert that your rule _is_ those principles.** That
is a stronger claim than citing either alone, and it is usually not the one you mean. One consumer
supported "the bridge never persists a user's library" with a bare pair of `ENG-SEC-008` and
`ENG-SEC-004`. Both IDs were correct and the checker was silent, because per-principle scoping makes
a bare pair _permissible_. But only the data-minimization half of `ENG-SEC-008` binds — its
lifecycle-evidence half has nothing to attach to, precisely because the bridge retains nothing — and
`ENG-SEC-004` binds something else entirely, the bridge's own credentials. Their fix names the rule
as a local convention, cites the obligation genuinely beneath it, says which half does not bind and
why, and marks the second ID as _additionally_ binding. **Permissible and accurate are not the same
test**, and stopping at the first is easy because nothing objects.

`--review` now prints `note: adjacent IDs, no connective` when two principle links share a line with
no scoping word between them. It is an annotation and never affects the exit code: a bare pair is
often correct, so this is a prompt to check, not a finding. It is also deliberately narrow — an
earlier version looked for IDs across a context window and fired on a third of this repository's own
citations, nearly all of them prose _discussing_ principles rather than citing them. A checker that
cries wolf is a checker somebody turns off.

**State a boundary by file kind, not by directory, and grep before you assert it.** Framework
isolation is the case where this bites. `ENG-INT-001` requires framework behaviour to sit behind
adapters, and the natural way to write that down — "nothing under `lib/` imports the framework" —
is **false for any repository that colocates components with the logic they serve**. A repository
that wrote exactly that sentence disproved it with one grep: two `.svelte` files under `lib/`
import `svelte`, while every `.ts` module under the same directory is framework-free.

The accurate claim was by file kind, and it is both true and checkable:

```bash
# every .ts module under lib/ is framework-free; .svelte files are the edge
rg -l "from 'svelte'" src/lib --glob '*.ts' | wc -l   # expect 0
```

A directory-shaped claim also fails silently the first time someone colocates a component, with
no test to catch it. Whatever boundary you state, write down the command that proves it and put
that command in CI — an invariant nothing checks is a comment.

**Do not cite a principle your repository does not follow.** Some principles are conditional on
an architecture, and the directory says which:

| Directory                  | Applies to                             |
| -------------------------- | -------------------------------------- |
| `principles/architecture/` | every repository                       |
| `principles/assurance/`    | every repository                       |
| `principles/operations/`   | every repository                       |
| `principles/platforms/`    | **only repositories on that platform** |

A `platforms/` principle is scoped to its platform the same way `browser-frontend.md` has
nothing to say about a Go CLI. So a repository on a different architecture is **out of scope,
not non-compliant**, and should not be measured against it.

`ENG-LOCAL-001` is the case that shows why this matters. It makes the device's durable store the
system of record — correct for a local-first product, and flatly wrong for one where the server
is canonical and clients are optimistic caches. A server-authoritative product does not fail
that principle; it is not addressed by it. Citing it there would encode a false claim about the
system, and so would recording it as a compliance gap.

Being out of scope is not a free pass on the neighbours, and this is the part most likely to be
got wrong.

**Scope is per principle, not per file.** A repository that falls outside one `platforms/`
principle usually still falls **inside** its siblings. docket is outside `ENG-LOCAL-001` because
its server is authoritative, yet `ENG-LOCAL-002`, `ENG-LOCAL-003` and `ENG-LOCAL-004` — the sync
seam, the conflict model, zero-config degradation — bind it in full. Concluding "we are not
local-first, so `local-first.md` does not apply to us" would drop three principles that do.

**Check whether the platform-independent half still binds.** The exportability requirement in
`ENG-LOCAL-001` holds no matter who is authoritative, so a server-canonical product still owes
it.

The whole rule, in one sentence, if you need something quotable for a review:

> A `platforms/` principle binds a repository when the repository is on that platform and the
> principle's specific subject applies to it; being outside one principle's subject does not
> release the sibling principles in the same file, nor the platform-independent parts of the
> principle itself.

Key on the **subject**, not the directory. `ENG-LOCAL-001` is about where the system of record
lives; `002`, `003` and `004` are about the sync seam. A repository can answer the first
question differently while owing all three of the others, which is exactly docket's position.

**Say it where the architecture is described**, not in a compliance appendix — and word it as
scope rather than as a departure, because a reader who finds it later will otherwise read it as
an admission. docket's phrasing is the model:

> This is **not a departure from `ENG-LOCAL-001`** — that principle governs products whose
> device store is the system of record, and Docket answers that question differently because the
> self-hosted server is the product. Out of scope is not non-compliant.

If a principle genuinely does not apply, say so plainly rather than citing it, and tell
Engineering. Only the repository owner may ratify a change to principle text, so a real scope
gap needs a decision record rather than an edit.

### The false exemption, and why it survives review

The dangerous direction is not citing a principle you do not follow — that gets caught. It is
**declaring a whole area inapplicable when it binds**, because nothing then contradicts it.

The mechanism is always the same: **an area name reads like an architectural precondition, so a
repository infers exemption from the name rather than from any principle's Statement.**

A pure-client repository declared all five `ENG-INT-*` principles vacuous — "we have no
integration boundary to govern" — on the strength of the words _integration boundaries_. Reading
the Statements, four of the five bind it: `ENG-INT-001` is scoped by **external input and
framework**, not by owning a service, and that repository parses EPUB containers, OPF metadata
and OPDS feeds. Only `ENG-INT-005`, about credential proxies, was genuinely out of scope.

**It survived because the repository already complied.** Every one of the four was satisfied by
existing code, so no review, lint or test could contradict the exemption. That is the property
that makes this class dangerous, and it inverts the usual risk:

> A false exemption costs nothing for code that exists and everything for code that does not.

The compliant components were never at risk. The exemption's real effect is on the next
component written under it — in that case, provider adapters under active development — which
inherits a documented licence to skip a principle nobody will re-check.

**So audit exemptions by Statement, one principle at a time.** Two questions, and an area-level
answer to either is a finding:

1. Does the principle's Statement name a subject this repository has? Not: does the area name
   sound like us.
2. If it binds, do we satisfy it **today**, by evidence? Compliance you cannot point at is
   indistinguishable from an exemption.

This is the same failure the `platforms/` rule above describes, one level up: there, scope keys
on the principle's subject rather than its file; here, on its Statement rather than its area
name. If a repository got one wrong it will usually have got the other wrong too, so check both
in the same pass.

### Record what you evaluated and excluded, not only what binds

Every adopter so far has cited the principles that bind and said nothing about the rest. That is
the natural thing to do and it loses the more valuable half of the work, because **silence reads
identically whether a principle was considered and excluded or never read at all** — and the
second is much more common.

The consequence is that no reviewer can distinguish them either. An area quietly absent from a
repository's citations is exactly what a false exemption looks like from the outside, so the one
case worth catching is invisible.

So state your exclusions. A line each is enough, and the reason is the part that matters:

```markdown
Evaluated and out of scope:

- ENG-LOCAL-002 (Optional sync seam) — no sync; re-evaluate if multi-device lands.
- ENG-DATA-001 (Owned durable integrity) — no durable store beyond the browser cache.
- ENG-INT-005 (Credential proxy isolation) — no server-side proxy by construction (ADR-0007).
```

Three properties make this worth the lines. It is **falsifiable** — a reader who knows the
repository can object to a specific claim rather than to an absence. It is **re-checkable** when
the repository changes, because "re-evaluate if X lands" names the trigger, and the false
exemption's whole danger is to code that does not exist yet. And it distinguishes _considered_
from _unread_ at the moment the distinction is cheap.

Two failure modes to avoid. Do not write exclusions by area — `ENG-INT-*` as a block is the
false exemption in its usual form, and one repository declared exactly that while four of the
five bound and were already satisfied. And do not claim an exclusion you have not checked: an
unverified exclusion is worse than silence, because it converts an open question into a settled
one.

### Watch the asymmetry: complying on paper is cheaper than disagreeing

An adopter that found a principle contradicted its architecture observed that citing the
principle anyway would have cost **one line and looked compliant to every reader**, while saying
so cost several rounds of argument. That asymmetry is real, it runs the wrong way, and it is the
reason to expect quiet citation rather than disagreement from repositories that never push back.

Two things follow, and they are directed at different people.

If you are adopting: **a citation you cannot defend is worse than a gap**, because a gap is
visible and a false citation is not. The section above exists to make disagreement structurally
cheap — an exclusion with a reason is a line of Markdown, not an argument.

If you own the practices: treat a repository that never disagrees as **unverified rather than
compliant**. Every substantive correction to this guide arrived from a repository whose
architecture contradicted something and which said so instead of citing around it — the
`ENG-LOCAL-001` scope rule, the false-exemption section above, the two-channel delivery split,
and the triage guidance for `noUncheckedIndexedAccess` all originated that way. A guide that only
hears agreement stops improving and cannot tell that it has.

## Recording decisions (ADRs)

`ENG-ARCH-003` requires a decision record before a consequential tradeoff is treated as durable.
The naming convention already exists — it is stated in
[`docs/architecture/README.md`](../docs/architecture/README.md) and repeated here because that
is not the file a consuming repository reads:

**Name records `NNNN-short-title.md`.** Four digits, zero-padded, kebab-case title, no prefix.
`0004-identity-and-mapping-strategy.md`, not `adr-0004-…` and not `4-…`.

The convention governs the **filename**, not the directory. Both of these conform:

| Layout                                  | Use when                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/architecture/NNNN-*.md`           | the directory holds decisions only                                             |
| `docs/architecture/decisions/NNNN-*.md` | the directory also holds architecture prose, and separating the two is clearer |

`jrmoulckers/.github` uses the first. Neither is required of you, and a repository already using
either is conformant and should not renumber or relocate anything.

Two rules that do matter, because both have been violated in practice:

- **Numbers are unique and never reused**, including across a rename or a supersession. A
  superseded record keeps its number and gains `Status: Superseded` plus a link to its
  replacement; the replacement takes a new number. Two records sharing a number make every
  cross-reference to it ambiguous, and cross-references are the entire point of numbering.
- **Do not renumber a published record.** Anything already merged may be cited from another
  repository, and this repository's own guidance tells consumers to cite ADRs by number. Fix a
  collision by giving the _newer_ record the next free number.

**Fixing a collision means re-resolving every reference, not substituting the number.** A consumer
found two records sharing `0003` and, before moving one, checked what the seven existing bare
`ADR 0003` mentions actually meant. They did not all mean the same document: three tests and a
design doc cited the canonical-URL and `308` behaviour of one record, while two source files cited
the erasure-hold precondition of the other. A blanket `0003 → 0004` would have mis-pointed four of
the seven.

The reason this is worth a rule of its own is that the wrong result is **stable**: both numbers
resolve to a real file, so nothing 404s, no check fails, and the citation reads authoritatively
forever. It is the ADR form of a wrong-but-real `ENG-*` ID — the failure is that the reference
resolves to the wrong _claim_, which existence checking cannot see. Resolve each reference against
the text it is claiming, mechanically where you can: here, the erasure record contained no
`canonical` and no `308` anywhere, which settled the split without a judgement call.

Two references are easy to miss because they do not look like citations. The first is a
`Superseded by ADR NNNN` heading — when the collision moves the _superseding_ record, that heading
is stale even though the rule above is about the superseded record keeping its number. The second
is a number embedded in test names or fixture data, which greps differently from prose.

### An ADR records a choice you made, not a fact you discovered

`ENG-ARCH-003` is about consequential **tradeoffs**, so the test for whether something belongs in
a decision record is whether you could have chosen otherwise.

A consuming repository was asked to record third-party behaviour it had just characterised —
that `npm audit` transmits dependency names to the default registry — and declined, on the
grounds that an ADR records _its_ decision, while this is inherent behaviour of a tool it neither
controls nor chose. Recording it locally would misattribute an external constraint as a local
decision. That reasoning is right, and it generalises:

| What you have                                                                     | Where it goes                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A tradeoff you chose, with alternatives you rejected                              | an ADR in your repository                                    |
| Behaviour of a tool or platform you don't control                                 | this guide, or a practice note — not an ADR                  |
| A choice **about** that behaviour (accept it, work around it, forbid the command) | an ADR — the decision is yours, the behaviour is its context |

The failure this prevents is subtle and cumulative. An ADR corpus whose entries are mostly
observed facts stops being a record of judgement, and its readers stop expecting the "why" that
makes a record worth keeping. Worse, the fact goes stale — the tool changes, and a document
framed as a decision now misstates the world while carrying the authority of a decision nobody
revisits.

**If the constraint affects every repository, it belongs here, once.** A repository noticing
shared behaviour should report it rather than document it locally, so it lands in one place
instead of seven divergent ones. Cite the shared guidance from your ADR when you make a decision
under it.

## Expected diff

Adoption should **remove** more than it adds:

- Delete the hand-authored `eslint.config.js` / `.eslintrc.cjs`, `.prettierrc*`, and duplicated
  `compilerOptions`.
- Delete prose that restates an `ENG-*` rule; leave a citation.
- Keep every product-specific rule, moved into `extend` or stated as such.

If adoption only adds files, the duplication was not actually removed.

### Expect a burst of type errors, and fix them at the source

`@jrmoulckers/tsconfig/base.json` turns on `noUncheckedIndexedAccess` and `noImplicitOverride`,
which most hand-rolled configs leave off. Adopting it in a codebase of any size can surface a
large batch of diagnostics at once — one repository saw **109**.

That number is alarming and the temptation is to turn the flag back off. Don't. In that
repository the errors resolved to **19 genuine production gaps**, with the remainder mechanical
test assertions and `override` modifiers. The real defects were all the same shape — a value
assumed present at an index that the type system could not prove:

- array elements read positionally without a guard,
- a property dereferenced off an element found by lookup,
- results zipped against `Promise.allSettled` by position,
- `getAllKeys()` zipped against `getAll()` on an assumed-equal length.

Those are latent crashes, not style. The flag did not create them; it revealed them.

A third shape is worth naming because it does **not** crash. A router matching
`/^\d{4}$/.test(segs[1])` against a possibly-absent segment does not throw — `.test()` coerces
`undefined` to the string `"undefined"`, which simply fails the match. The result is a silently
wrong route rather than an error, so it survives every test that does not specifically exercise the
short path. **Not every finding is a latent crash; some are permanently wrong answers**, and those
are the ones no amount of runtime testing was ever going to surface.

A second repository reproduced the pattern at larger scale: **152 errors, every one from
`noUncheckedIndexedAccess`** — 12 in production source, 140 in test files that index immediately
after their own `toHaveLength` assertion. That distribution is the useful part to plan around:

| Location   | Share | Fix                                                     |
| ---------- | ----- | ------------------------------------------------------- |
| Test files | ~92%  | Mechanical; a non-null assertion is acceptable **here** |
| Production | ~8%   | Narrow properly — guard, destructure, or default        |

Two repositories now agree that this is the single highest-friction setting in the base, and that
the friction is concentrated where the risk is lowest. A test that has just asserted
`toHaveLength(3)` genuinely knows index `0` exists, so `!` there is a statement of fact rather
than a suppression. The same `!` in production code is the bug being re-hidden. Budget for the
test churn separately so it does not disguise the small number of real fixes.

**The test carve-out is conditional on the assertion that justifies it, and nothing enforces
that.** `expect(r).toHaveLength(2)` followed by `r[0]!.name` is sound only because of the line
above it. Delete or weaken that line later — narrow the case, change the fixture, split the test —
and the `!` stays behind, now asserting something no longer established. The test still fails, but
as a `TypeError: Cannot read properties of undefined` at an arbitrary line instead of a named
assertion failure. So the cost of a stale `!` in tests is not a hidden production bug; it is a
worse diagnostic at the moment you most need a good one.

Two things follow. First, if you are adding these in bulk, **verify the tail rather than the
sample** — "every one of them follows a length assertion" is exactly the claim that is true of the
twenty you looked at and false of the hundred you did not. Second, prefer a helper where the
guard is not literally the previous line:

```ts
function assertDefined<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`expected ${what} to be defined`);
  return v;
}
```

It costs one line, survives edits to the surrounding test, and fails with a sentence instead of a
stack trace. Bulk-converting an existing, genuinely-guarded set of assertions to it is not worth
the churn — this is guidance for what you write next.

So treat the burst as a one-time debt payment. Fix at the call site — add the guard, narrow the
type, handle the absent case. Do **not** widen with `!` or `as` in production code, and do not
disable the flag in your `tsconfig.json`: both re-hide exactly the class of bug the flag exists
to find. If a diagnostic is genuinely wrong rather than inconvenient, that is worth reporting
here.

**A third repository hit 368 across 91 files and turned the flag off**, with a comment and a
tracking issue. That is the honest failure mode of the advice above, so it is worth stating what
to do instead of repeating "don't".

The scale is real: three data points are 109, 152 and 368, and the last is not a tail — it is
what a large codebase with pervasive indexing looks like. Turning the flag off repo-wide is still
the worst option, because it silently covers new code as well as old, and the tracking issue
outlives the memory of what it was for.

Stage it instead. `exclude` is the wrong lever, but a scoped override is not:

```jsonc
// tsconfig.json — flag stays on everywhere it currently passes
{
  "extends": "./config/engineering/tsconfig/vite-app.json",
  "include": ["src"],
}
```

```jsonc
// tsconfig.legacy.json — the not-yet-clean subset, shrinking over time
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noUncheckedIndexedAccess": false },
  "include": ["src/games/**"],
}
```

Typecheck both. The difference from disabling it globally is that the excluded set is **named and
finite**, new directories are covered by default, and progress is a shrinking `include` rather
than a closed issue. If even that is too much at once, keep the flag off but record the error
count in the tracking issue so the number is a ratchet rather than a memory.

### Triage the list; the bug-to-appeasement ratio is not predictable

That third repository then audited its suppression rather than defending it, and the result
changes the advice above more than the count did. Under `tsc` it had **263 diagnostics, 87 of
them in production code, and exactly one was a bug.**

Set against the earlier reports, the spread is the finding:

| Repository | Production diagnostics | Real bugs found |
| ---------- | ---------------------- | --------------- |
| First      | 109                    | 19              |
| Third      | 87                     | 1               |
| Fourth     | 838                    | 0 found so far  |

Same flag, same language, two orders of magnitude apart in yield. **So do not plan from either
number.** "A three-figure count is not noise" is true, and its corollary is equally true: most of
a given list may be compiler appeasement, and you cannot tell which case you are in without
reading it. Triage the list. Production first, in file-sized batches.

The fourth repository makes the point sharpest, and it is the reason a raw count must never be
reported on its own. It measured **2,691 diagnostics — roughly 25× the first repository's 109** —
and is almost certainly _less_ bug-dense: 69% were in tests, and a sample of every riskiest-code
diagnostic in production found no active crash. Left as a bare number, that repository looks
twenty-five times more alarming than the one with nineteen real bugs. Someone comparing the two
would reasonably conclude the flag is unusable and switch it off, which is the outcome this whole
section exists to prevent.

**A fifth repository measured zero, and it explains all four other numbers.** It applied the
shared base's genuinely-new flags — `moduleDetection: force`, `noUnusedLocals`,
`noUnusedParameters` — and typechecked four workspaces including `svelte-check
--fail-on-warnings`: **0 diagnostics**. Not a small repository, and not a lucky one. It already
set `noUncheckedIndexedAccess` in its own base, and had for longer than this migration.

That converts the whole range from a planning risk into a **one-command precheck**:

```bash
grep -rn 'noUncheckedIndexedAccess' --include='tsconfig*.json' .
```

A repository that already sets it measures approximately zero, because it has been paying this
debt continuously all along. A repository that does not measures somewhere in 109–2,691, and the
spread within that band is the shape question below, not a size question. Nothing else in the
shared base produces diagnostics at that scale.

So the honest planning advice is not a range at all — it is: **run the grep, and only then decide
whether you need a migration slot.** Four repositories reported counts before anyone asked the
question that predicts them.

**What separates the two is the shape of the read, not the number of them.** The same repository
supplied the discriminator after sampling its own worst cases: an index read is dangerous when it
is indexed by something other than the collection's own bounds check — a cross-collection zip,
a key from one map used to index another, an offset carried in from a caller. Those are the
`getAllKeys()`/`getAll()` shape, where two sequences are assumed to correspond and nothing enforces
it. What is almost always safe is `arr[i]` inside a loop bounded by that same array's `length`, a
regex group behind a successful-match guard, or `split()` of a key the code itself constructed.
Sort the list by that question before reading it, and a four-figure count usually collapses to a
handful of sites worth arguing about.

### The discriminator: what is the index derived from?

Counting diagnostics is the wrong axis. The useful question is where the index came from:

> **The dangerous shape is a read indexed by something other than the collection's own bounds
> check** — two collections zipped positionally, or collection `A` indexed by a value found in `B`.
> A read indexed against its own `length` guard is noise.

That single test explains every case reported so far. It is why nineteen of the first
repository's findings were real: they were cross-collection reads, `allSettled` results zipped by
position and `getAllKeys()` against `getAll()`. It is why the third repository's lone bug was real
— a palette indexed by a position found in a _different_ palette. And it is why the fourth
repository's 838 are mostly noise: `arr[i]` inside `for (i < arr.length)`, regex capture groups
behind a match guard, destructuring a `split('|')` of a key the same function built two lines
earlier. In-bounds by construction, unprovable to the compiler.

Apply the test first and the four idioms below become a consequence of it rather than a list to
memorize — each is a read indexed by its own bounds.

The reason the ratio moves is that a large share of diagnostics come from idioms where the
invariant is real and local but inexpressible to the checker:

| Idiom                     | Example                                        |
| ------------------------- | ---------------------------------------------- |
| Loop-guarded indexing     | `while (i < xs.length) { xs[i].v }`            |
| Paired-swap destructuring | `[a[i], a[j]] = [a[j], a[i]]`                  |
| Modulo indexing           | `words[h % words.length]` on a non-empty array |
| Fixed-size typed arrays   | `new Uint32Array(1)` then `buf[0]`             |

None is a latent crash. Clearing them is refactoring for provability, not bug-fixing — worth
doing, but it is not the same work as fixing the one real defect hiding among them, and it should
not be scheduled as though it were.

**This is where the "no `!` in production" rule needs its honest edge.** The rule exists because
`!` re-hides the bug class the flag finds. Against a provably-safe idiom there is no bug to
re-hide, so the rule is protecting nothing — but you cannot tell the two apart by looking at the
`!`, which is exactly why the rule is unconditional. Resolve it by making the invariant visible
instead of asserting past it: destructure the element once (`const row = xs[i]; if (!row) break;`),
hoist the pair out of the swap, or keep the scoped `tsconfig` override above for a directory that
is dense with one idiom. A runtime guard helper is right in tests and wrong in a hot loop; the
scoped override is the better lever there, because it is named, finite, and shrinking.

**Audit before you suppress, not after.** The third repository's single bug was found only
because it flipped the flag back on and read the output, and it was the same shape as the first
repository's worst finding — **two arrays indexed by a position derived from each other, correct
only while their lengths agree**. In the first it was `getAllKeys()` zipped against `getAll()`; in
the third, a palette indexed by a position found in a _different_ palette, which returns
`undefined` typed as `string` the moment someone adds one entry without its counterpart.

Two of three repositories carried that shape. The third searched for it specifically and found
none — it had no positional zip anywhere, because every read either consumed a whole array or
keyed a map by a field on the record. That negative is worth as much as the positives: the search
is cheap, bounded, and its answer is trustworthy either way. Grep for it directly rather than
waiting for the compiler to raise it — any `b[i]` where `i` came from `a.indexOf(...)`,
`a.findIndex(...)`, or a loop over `a` — and note that **keying by a field instead of a position
removes the shape entirely**, which is the durable fix rather than a guard at each site.
