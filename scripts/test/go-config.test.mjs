// Guards for configs/golangci.yml, which ships to Go consumers over HTTP with no
// package manager and no test between here and their CI.
//
// This repository has no Go toolchain, so `golangci-lint config verify` cannot run
// here — that check belongs in a consumer. What is verifiable here is the class of
// defect that a consumer cannot catch for us:
//
//   1. The published file stops satisfying the validation docs/adopting.md tells
//      every consumer to run before using it. Their fetch then hard-fails, and the
//      break is in our file rather than their pipeline.
//   2. A setting drifts back into contradicting practices/go.md. That happened:
//      `check-blank: true` banned the commented `_ = f()` that go.md explicitly
//      permits, and a consumer hit it before we did.
//
// Both are text-level assertions, so they are kept tolerant of formatting on
// purpose — matched against whitespace-normalized source, never against an exact
// line — because a guard that reads its own source text is the thing most likely
// to be silently broken by a formatter change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../../configs/golangci.yml', import.meta.url), 'utf8');
const goPractice = readFileSync(new URL('../../practices/go.md', import.meta.url), 'utf8');

// Whitespace-normalized view: collapses indentation and CRLF so an assertion
// survives reformatting, while still requiring the key and value to be adjacent.
const normalized = config.replace(/\r\n/g, '\n');
const setting = (key) => new RegExp(`^\\s*${key}:\\s*(\\S+)`, 'm').exec(normalized)?.[1];

test('published config satisfies the shape check adopting.md requires of consumers', () => {
  // docs/adopting.md instructs consumers to reject a payload lacking these two
  // top-level keys, to catch a 200 carrying the wrong body. If our own file ever
  // failed that check, every adopting repository would fail closed on fetch.
  assert.match(normalized, /^version:/m, 'missing top-level version:');
  assert.match(normalized, /^linters:/m, 'missing top-level linters:');
});

test('errcheck does not ban the commented blank discard that go.md permits', () => {
  // errcheck reports a blank assignment only when the right-hand side is a call
  // expression, so `_ = f()` is flagged while `err := f(); _ = err` is not.
  // Enabling it mandates a spelling rather than preventing a discard, and it
  // contradicts the carve-out in practices/go.md.
  assert.equal(setting('check-blank'), 'false');
});

test('errcheck still reports unchecked type assertions', () => {
  // Deliberately not symmetrical with check-blank: a failed assertion panics, so
  // no comment makes it recoverable. Guards against a future change that reads
  // the two as one knob and disables both.
  assert.equal(setting('check-type-assertions'), 'true');
});

test('go.md still carries the discard rule the config delegates to it', () => {
  // check-blank is off because review enforces the comment requirement instead.
  // If that sentence is ever deleted from the practice, nothing enforces it and
  // the config's rationale is stale — so the two are pinned to each other.
  const prose = goPractice.replace(/\s+/g, ' ');
  assert.match(prose, /Never discard an error with `_` unless the reason is stated in a comment/);
});
