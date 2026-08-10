# Go services and tools

Implements `ENG-ARCH-001`–`ENG-ARCH-004`, `ENG-TEST-001`–`ENG-TEST-010`, and
`ENG-BUILD-001`–`ENG-BUILD-008`. This guide adds no rules.

Go repositories consume Engineering practice through this guide and
[`configs/golangci.yml`](../configs/golangci.yml). There is no npm path; the
`@jrmoulckers/*` packages do not apply.

## Consuming the lint configuration

**golangci-lint has no config inheritance.** There is no `extends`, no
include, and no remote-config mechanism — an `extends:` key is rejected by its
JSON schema outright. So the file has to arrive on disk somehow, and the only
question is whether it arrives as a committed copy or a pinned fetch.

Fetch it. A committed copy drifts from the shared config, and the drift is
invisible precisely because nothing fails.

```bash
curl -fsSL --retry 3 \
  https://raw.githubusercontent.com/jrmoulckers/engineering/v0.2.2/configs/golangci.yml \
  -o .golangci.yml
```

Run that before the lint job, gitignore the result, and write a generated
header naming the source and ref so nobody edits it by hand.

Three details are load-bearing:

**Pin the ref.** An unpinned fetch means a commit here can redden your build
with no change on your side — the same failure mode `GH-ACT-003` pins action
SHAs to avoid.

**Fail loudly.** Without `-f`, `curl` writes the error body to the output file
and exits zero, so the linter runs against HTML and passes. Check the file is
non-empty too: a truncated transfer yields a valid empty config, and an empty
config lints nothing while reporting success.

**Write it to the repository root.** This is required, not cosmetic.
golangci-lint's default `run.relative-path-mode: cfg` resolves reported paths
relative to the config file's directory, so a config outside the repository
produces diagnostics with paths like `../../elsewhere/file.go`. Root placement
also makes a bare `golangci-lint run` and editor integrations work with no
flags.

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

`gofmt` and `go vet` are the floor, not the ceiling. `golangci-lint` adds the
error-handling and shadowing checks that `vet` alone does not cover.

## Package boundaries (`ENG-ARCH-001`)

- `internal/` for everything not deliberately published. A package outside
  `internal/` is a public contract whether or not that was intended.
- `cmd/<tool>/` holds `main` and argument parsing only; the logic it calls is
  importable and testable without a process.
- Dependencies stay acyclic. Go enforces this at compile time — treat an import
  cycle as a boundary that was drawn in the wrong place, not an obstacle to
  route around with an interface.

## Contracts (`ENG-ARCH-002`, `ENG-API-001`)

Published schemas are versioned directories (`schemas/v1/`) and evolve
additively until a declared breaking boundary. Adding an optional field is
additive; making a field required, removing one, or narrowing a type is
breaking, and breaking changes get a new version directory.

Contract tests validate fixtures against the committed schema — both accepted
and rejected payloads (`ENG-TEST-007`).

## Errors are values (`ENG-INT-001`)

Wrap with context at the boundary that has it, and let the caller decide:

```go
if err := store.Write(ctx, rec); err != nil {
    return fmt.Errorf("write record %s: %w", rec.ID, err)
}
```

`%w` preserves the chain for `errors.Is` and `errors.As`. Never discard an error
with `_` unless the reason is stated in a comment beside it. Reserve `panic` for
genuinely unrecoverable programmer error, never for expected failure.

## Tests (`ENG-TEST-001`, `ENG-TEST-007`)

- Table-driven tests with a named case per row; the name is what a failure
  reports.
- `t.Parallel()` where the case has no shared state — it also surfaces
  accidental sharing.
- Golden files for serialized output, refreshed behind an explicit `-update`
  flag so a regression cannot be normalized away by a rerun.
- `testing/fstest` and `t.TempDir()` instead of touching the real filesystem.

## Reproducible builds (`ENG-ARCH-004`, `ENG-BUILD-001`)

- `go.mod` pins the toolchain; CI reads it via `go-version-file` rather than
  restating a version that can drift.
- Commit `go.sum` and build with `-mod=readonly` so a build cannot silently
  acquire a dependency.
- Inject version metadata with `-ldflags`, never by editing a tracked source
  file during the build.

## Committed artifacts carry no environment residue (`ENG-SEC-001`)

Generated reports and fixtures must not embed absolute user paths, home
directories, or account identifiers. Normalize the path before writing, and keep
a check in CI that fails when residue reappears — the executable form of
`ENG-TEST-010`.
