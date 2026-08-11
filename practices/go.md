# Go services and tools

Implements `ENG-ARCH-001`, `ENG-ARCH-002`, `ENG-ARCH-004`, `ENG-API-001`, `ENG-TEST-001`,
`ENG-TEST-004`, `ENG-TEST-007`, `ENG-TEST-010`, and `ENG-BUILD-001`. This guide adds no rules.

Go repositories consume Engineering practice through this guide and
[`configs/golangci.yml`](../configs/golangci.yml). There is no npm path; the `@jrmoulckers/*`
packages do not apply.

## Consuming the lint configuration

**golangci-lint has no config inheritance.** There is no `extends`, no include, and no
remote-config mechanism — an `extends:` key is rejected by its JSON schema outright. So the file
has to arrive on disk somehow, and the only question is whether it arrives as a committed copy
or a pinned fetch.

Fetch it. A committed copy drifts from the shared config, and the drift is invisible precisely
because nothing fails.

```bash
# <latest-tag> is a placeholder, not a version. Pin the newest release:
#   gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name
ENGINEERING_REF=<latest-tag>

curl -fsSL --retry 3 \
  "https://raw.githubusercontent.com/jrmoulckers/engineering/${ENGINEERING_REF}/configs/golangci.yml" \
  -o .golangci.yml
```

The ref is a placeholder that fails visibly rather than a version that lags quietly. A literal
version copied out of a document is stale one release later — and worse, it can be _wrong_:
`v0.2.3` of this file told consumers to copy it, which a later release reversed.
Pinning stays a deliberate edit in your history; never resolve the newest tag at fetch
time, or a tag pushed here changes your lint rules with no commit on your side.

Run that before the lint job, gitignore the result, and write a generated header naming the
source and ref so nobody edits it by hand.

**Add a non-fatal staleness notice.** There is no lockfile on this path, so a stale pin has no
signal at all — and staleness here is not merely cosmetic. A consumer pinned at `v0.2.3` rewrote
ten call sites to satisfy `errcheck`'s `check-blank`, which `v0.10.0` had already turned off as
contradicting this very document. The work was caused by the pin, not by the code. They had
compared their tag against the _next_ one and found no difference, which is the trap: adjacent
tags are usually identical, so only a comparison against the newest release is informative.

The file carries a `config-revision:` marker in its header, bumped whenever a rule's verdict
changes. Comparing that against the newest release answers "has anything I care about moved?"
without diffing the file — and a fetched copy with no marker at all is older than the marker,
which is itself the answer.

```bash
latest=$(gh api repos/jrmoulckers/engineering/releases/latest --jq .tag_name)
[ "$latest" = "$ENGINEERING_REF" ] || echo "::notice::pinned $ENGINEERING_REF; newest is $latest"
```

`::notice::`, never a non-zero exit. A tag pushed here must not redden an unrelated PR, or pinning
stops being a decision and becomes a default someone bumps to get green.

Three details are load-bearing:

**Pin the ref.** An unpinned fetch means a commit here can redden your build with no change on
your side — the same failure mode `GH-ACT-003` pins action SHAs to avoid.

**Fail loudly.** Without `-f`, `curl` writes the error body to the output file and exits zero,
so the linter runs against HTML and passes. Check the file is non-empty too: a truncated
transfer yields a valid empty config, and an empty config lints nothing while reporting success.

**Write it to the repository root.** This is required, not cosmetic. golangci-lint's default
`run.relative-path-mode: cfg` resolves reported paths relative to the config file's directory,
so a config outside the repository produces diagnostics with paths like
`../../elsewhere/file.go`. Root placement also lets editor integrations discover the config with
no configuration of their own — though see below for why your own invocations should still name it
explicitly.

Since `jrmoulckers/engineering` is public, the fetch needs no token.

**Always pass `--config` explicitly. A missing config does not fail — it lints less.** This is the
sharpest edge in the whole pattern, because the fetched file is deliberately untracked: a
contributor who clones and runs `golangci-lint run` before running the fetch has no
`.golangci.yml` at all. golangci-lint does not error on that. It treats the absence as
`ConfigFileNotFoundError`, swallows it, and proceeds with its **built-in defaults** — roughly
`errcheck`, `govet`, `ineffassign`, `staticcheck` and `unused`, with none of this config's
settings. Everything the shared config adds on top, including `errorlint`, `nilerr`, `revive`,
`misspell` and `unconvert`, is silently absent.

The result is the worst available outcome: a plausible, clean, **locally green** run against a
smaller rule set, then a red CI, with nothing on screen connecting the two. It is the same class as
the truncated-config case above — a step reporting success while checking less than you think.

Naming the file converts that into a hard failure, because an explicitly supplied path is read
directly rather than searched for, so its absence surfaces as an error instead of a fallback:

```bash
golangci-lint run --config .golangci.yml ./...
```

Use that form everywhere the linter is invoked — CI, scripts, and the command you put in your
README. Documentation alone is the weakest of the three, because the contributor who most needs the
warning is the one who has not read the file yet.

### The blessed `make lint` target

A consumer asked for this rather than inventing one, on the grounds that six repositories would then
diverge from each other — which is the problem the shared config exists to prevent. That was the
right instinct, and the gap was mine: this document recommended wiring the fetch and the run into a
single target without ever giving the form. Copy this one.

```make
ENGINEERING_REF ?= <latest-tag>
GOLANGCI_CONFIG := .golangci.yml
# The ref is in the stamp's *filename*, not its contents. See the note below.
GOLANGCI_STAMP  := .golangci.$(ENGINEERING_REF).ref

$(GOLANGCI_CONFIG): $(GOLANGCI_STAMP)
	curl -fsSL --retry 3 \
	  "https://raw.githubusercontent.com/jrmoulckers/engineering/$(ENGINEERING_REF)/configs/golangci.yml" \
	  -o $@

$(GOLANGCI_STAMP):
	rm -f $(GOLANGCI_CONFIG) .golangci.*.ref
	touch $@

.PHONY: lint
lint: $(GOLANGCI_CONFIG)
	golangci-lint run --config $(GOLANGCI_CONFIG) ./...
```

Gitignore `.golangci.yml` and `.golangci.*.ref`.

Four properties, each earning its line:

- **The config is a prerequisite of `lint`, not a step inside it.** A contributor cannot run the
  linter without it existing, which is the whole point — the failure being closed is a _silent
  pass_, and a step they can skip does not close it.
- **`--config` is still passed explicitly**, as the backstop for anyone who runs `golangci-lint`
  directly instead of through the target.
- **The ref is encoded in the stamp filename.** This is the part to copy exactly.
- **`ENGINEERING_REF ?=` allows CI to override** without editing the file, while keeping the pin in
  your history as a deliberate commit.

> **The obvious version of this target is broken, and it fails in the stale direction.** Writing the
> ref into the stamp's _contents_ — `echo $(ENGINEERING_REF) > .golangci.ref` — reads correctly and
> does not work: **make compares timestamps, not contents.** Once the stamp exists, it is up to date
> no matter what the ref says, so bumping `ENGINEERING_REF` refetches nothing and you lint against
> the old config while your Makefile claims the new pin.
>
> Verified with `make -n` across three states — clean tree, unchanged ref, bumped ref. The
> contents-based form emits no fetch on the bump; the filename-based form above emits all three
> steps. Putting the ref in the filename makes a new ref a _missing prerequisite_, which is the
> condition make actually acts on. The `rm -f .golangci.*.ref` glob then clears the previous
> stamp so the directory does not accumulate one file per ref ever used.

**Frame the fetch as a prerequisite of linting, not as a CI step.** A consumer reported that reading
it as CI-only is exactly what produces the silent pass, and they are right: a contributor who
believes the fetch belongs to CI has no reason to run it locally, gets a clean run against
golangci-lint's defaults, and ships. Concretely, in the rebase that prompted this, two of the five
issues found were `nilerr` and `unused`. **`unused` is on by default; `nilerr` is not.** A
contributor without the config would have shipped the `nilerr` believing they had linted.

## Static signals (`ENG-TEST-004`)

Each signal reports independently and blocks the merge:

```bash
test -z "$(gofmt -l .)"                        # format
go vet ./...                                   # vet
golangci-lint run --config .golangci.yml ./... # lint  — configs/golangci.yml
go test ./...                                  # behavior
go build ./...                                 # build
```

`gofmt` and `go vet` are the floor, not the ceiling. `golangci-lint` adds the error-handling and
shadowing checks that `vet` alone does not cover.

**`unused` catches incomplete deletions, which is the most valuable thing this config does.** The
argument for a shared linter usually gets made on style, and style is the least convincing part of
it. The stronger case is removal: when a repository cut an audit-console feature, deleting the
endpoints orphaned five symbols — an adapter-name table, three handler helpers, and a test helper —
that lost their only callers. Nothing in a `gofmt` + `go vet` bar reports that, the build stays
green, and the tests still pass because the code is simply never reached. `unused` named all five.

That is exactly the failure mode of a "cut the feature" commit, and it is worth leading with when
someone asks what the config buys beyond package comments. Verify each report has no remaining
reference before deleting, rather than trusting the linter alone.

**Re-run the linter after every rebase; do not infer cleanliness from a clean merge.** Lint fixes
can evaporate silently. In the same repository, an `errcheck` fix disappeared during a rebase
because the handler containing it had been deleted upstream — the correct outcome, reached without
any conflict to review. A textually clean rebase says nothing about whether the tree still passes.

The corollary is worth knowing before you plan an adoption: **this cost is paid per rebase, not
once.** A repository that reported 37 and then 23 issues in earlier rounds found only 6 after a
later rebase, and 5 of those 6 were the deletion case above. The number falls quickly once the tree
is clean, so a large first count is not a forecast of the second.

## Package boundaries (`ENG-ARCH-001`)

- `internal/` for everything not deliberately published. A package outside `internal/` is a
  public contract whether or not that was intended.
- `cmd/<tool>/` holds `main` and argument parsing only; the logic it calls is importable and
  testable without a process.
- Dependencies stay acyclic. Go enforces this at compile time — treat an import cycle as a
  boundary that was drawn in the wrong place, not an obstacle to route around with an interface.

## Contracts (`ENG-ARCH-002`, `ENG-API-001`)

Published schemas are versioned directories (`schemas/v1/`) and evolve additively until a
declared breaking boundary. Adding an optional field is additive; making a field required,
removing one, or narrowing a type is breaking, and breaking changes get a new version directory.

Contract tests validate fixtures against the committed schema — both accepted and rejected
payloads (`ENG-TEST-007`).

## Errors are values (`ENG-INT-001`)

Wrap with context at the boundary that has it, and let the caller decide:

```go
if err := store.Write(ctx, rec); err != nil {
    return fmt.Errorf("write record %s: %w", rec.ID, err)
}
```

`%w` preserves the chain for `errors.Is` and `errors.As`. Reserve `panic` for genuinely
unrecoverable programmer error, never for expected failure.

### Discarding an error is a decision, not an omission

Never discard an error with `_` unless the reason is stated in a comment beside it. The comment
states what the program does instead — a discard whose comment only says "ignore error" has
recorded nothing a reviewer can evaluate:

```go
// Best-effort: an unreadable library contributes no manifests to the fingerprint,
// which is treated the same as a library with none.
_ = os.Chmod(tmp, 0o600)
```

This is enforced by review rather than by `errcheck`. Its `check-blank` option is deliberately off
in [`configs/golangci.yml`](../configs/golangci.yml), because it only reports a blank assignment
whose right-hand side is a **call** — rewriting `_ = f()` as `err := f(); _ = err` silences it
while discarding exactly as much. A check that a rename satisfies cannot be the thing holding this
rule up. `check-type-assertions` stays on: a failed assertion panics, and no comment makes that
recoverable.

**If you cannot write the comment, that is the finding.** The requirement is a forcing function, and
its most useful output is sometimes that the discard should not exist. A consumer hit this on a
pre-existing `_ = filepath.WalkDir(...)`: attempting to justify it surfaced that the intended
behaviour was "a missing or unreadable artwork directory means zero artwork" — a real decision that
had never been stated anywhere. They expressed it in code instead, returning `fs.SkipDir` on the
error path and checking the walk's result. The intent became asserted rather than assumed.

Note what that example is not. They were pinned to an old revision where `check-blank` was still on,
so the rule they were satisfying had already been withdrawn — yet the outcome was still an
improvement. That is evidence for the comment requirement, not for the lint option: the constraint
that produced the better code was _having to state the reason_, which review imposes on every
discard, including the two-line spelling `check-blank` cannot see.

### Sanitizing wrapped errors without defeating `errorlint`

`errorlint` flags `fmt.Errorf("%w: %v", ErrSentinel, err)`, and the flag is usually right — the
cause becomes unreachable to `errors.Is` and `errors.As`. But that unreachability is occasionally
the **point**: when the inner error carries something that must not escape, such as a filesystem
path or a query fragment, wrapping the sentinel while flattening the cause is a real sanitization
technique, not a mistake.

Both readings are indistinguishable at the call site, so decide it explicitly:

- **If the cause is not sensitive**, use `%w: %w` (Go 1.20+) and let both be matchable. This is the
  common case, and the flag is doing its job.
- **If the cause is sensitive**, do not flatten it inline — that hides the intent from every
  reader and from the linter equally. Sanitize at the boundary that knows the value is sensitive,
  and wrap the sanitized error normally, so the chain stays intact and nothing is smuggled:

  ```go
  // The path is the sensitive part; drop it here rather than at every caller.
  return fmt.Errorf("%w: %w", ErrMediaUnsafe, sanitizePath(err))
  ```

Before converting an existing `%w: %v` to `%w: %w`, confirm the change is inert: the message text
is unchanged, no caller matches on the newly-reachable error, and no client-facing response
interpolates it. Within one package that is readable; where the error crosses a package boundary
it is not, and the sanitize-at-the-boundary form above is the one that survives review.

## Tests (`ENG-TEST-001`, `ENG-TEST-007`)

- Table-driven tests with a named case per row; the name is what a failure reports.
- `t.Parallel()` where the case has no shared state — it also surfaces accidental sharing.
- Golden files for serialized output, refreshed behind an explicit `-update` flag so a
  regression cannot be normalized away by a rerun.
- `testing/fstest` and `t.TempDir()` instead of touching the real filesystem.

## Reproducible builds (`ENG-ARCH-004`, `ENG-BUILD-001`)

- `go.mod` pins the toolchain; CI reads it via `go-version-file` rather than restating a version
  that can drift.
- Commit `go.sum` and build with `-mod=readonly` so a build cannot silently acquire a
  dependency.
- Inject version metadata with `-ldflags`, never by editing a tracked source file during the
  build.

## Committed artifacts carry no environment residue (`ENG-SEC-001`)

Generated reports and fixtures must not embed absolute user paths, home directories, or account
identifiers. Normalize the path before writing, and keep a check in CI that fails when residue
reappears — the executable form of `ENG-TEST-010`.
