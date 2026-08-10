import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "check-citations.mjs");
const index = path.join(here, "..", "..", "principles", "index.json");

function run(target, extra = []) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [script, target, "--index", index, ...extra],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function fixture(contents) {
  const dir = mkdtempSync(path.join(tmpdir(), "citations-"));
  writeFileSync(path.join(dir, "DOC.md"), contents, "utf8");
  return dir;
}

describe("check-citations", () => {
  test("accepts a real principle ID", () => {
    const dir = fixture("Secrets follow `ENG-SEC-001`.\n");
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0);
      assert.match(out, /all IDs exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fails on an ID that does not exist", () => {
    const dir = fixture("Invented citation `ENG-FAKE-999`.\n");
    try {
      const { code, out } = run(dir);
      assert.equal(code, 1);
      assert.match(out, /ENG-FAKE-999/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--review prints the real title beside a wrong-meaning citation", () => {
    // The defect this tool exists for: every miscitation seen during the
    // migration used a valid ID that meant something else, so the exit code
    // stays 0 and the title is the only signal. ENG-ARCH-003 is "Durable
    // decisions" (ADRs), not a rule about server tiers.
    const dir = fixture("libro has no server tier, per `ENG-ARCH-003`.\n");
    try {
      const { code, out } = run(dir, ["--review"]);
      assert.equal(code, 0);
      assert.match(out, /ENG-ARCH-003\s+Durable decisions/);
      assert.match(out, /no server tier/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reminds the author that existence is not correctness", () => {
    const dir = fixture("See `ENG-SEC-001`.\n");
    try {
      const { out } = run(dir);
      assert.match(out, /Existence is not correctness/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reports cleanly when a tree holds no citations", () => {
    const dir = fixture("No citations here.\n");
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0);
      assert.match(out, /No ENG-\* citations found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("every citation in this repository resolves", () => {
    const { code } = run(path.join(here, "..", "..", "docs"));
    assert.equal(code, 0);
  });

  test("exits 2 rather than 0 when the index cannot be read", () => {
    const dir = fixture("See `ENG-SEC-001`.\n");
    try {
      let code = 0;
      try {
        execFileSync(
          process.execPath,
          [script, dir, "--index", path.join(dir, "missing.json")],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
      } catch (err) {
        code = err.status;
      }
      assert.equal(code, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
