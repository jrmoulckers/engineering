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

Three details are load-bearing:

**Pin the ref.** An unpinned fetch means a commit here can redden your build with no change on
your side — the same failure mode `GH-ACT-003` pins action SHAs to avoid.

**Fail loudly.** Without `-f`, `curl` writes the error body to the output file and exits zero,
so the linter runs against HTML and passes. Check the file is non-empty too: a truncated
transfer yields a valid empty config, and an empty config lints nothing while reporting success.

**Write it to the repository root.** This is required, not cosmetic. golangci-lint's default
`run.relative-path-mode: cfg` resolves reported paths relative to the config file's directory,
so a config outside the repository produces diagnostics with paths like
`../../elsewhere/file.go`. Root placement also makes a bare `golangci-lint run` and editor
integrations work with no flags.

Since `jrmoulckers/engineering` is public, the fetch needs no token.

## Static signals (`ENG-TEST-004`)

Each signal reports independently and blocks the merge:

```bash
test -z "$(gofmt -l .)"   # format
go vet ./...              # vet
golangci-lint run         # lint  — configs/golangci.yml
go test ./...             # behavior
go build ./...            # build
```

`gofmt` and `go vet` are the floor, not the ceiling. `golangci-lint` adds the error-handling and
shadowing checks that `vet` alone does not cover.

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
