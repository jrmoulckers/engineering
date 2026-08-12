#!/usr/bin/env node
// Prints what each package version actually is, so nobody has to recall it.
//
// This exists because of a measured, repeated failure: a package version was
// announced to consumers from the git tag that shipped it, seven times, and the
// two have diverged badly — tag `v0.115.0` ships `eslint-config@0.16.0`. A tag
// is a repository-wide counter; a package version is per package. They were
// never the same number and nothing enforces a relationship between them.
//
// `versions:check` answers a different question — it compares the registry
// against versions.json and needs `read:packages`, so it degrades to "registry
// unreachable" exactly when someone is trying to look a version up. This one
// reads the working tree and always works.
//
// Reported state is the source of truth for what a consumer can install:
//   - workspace = what packages/<name>/package.json says right now
//   - recorded  = what versions.json says is published (the floor consumers pin)
// A workspace version ahead of the recorded one is normal mid-release: it means
// a bump has merged but the tag has not been pushed, so it is NOT yet
// installable. Saying so is the whole point — that gap is what gets misreported.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(await readFile(join(root, 'versions.json'), 'utf8'));
const recorded = manifest.packages ?? {};

const entries = await readdir(join(root, 'packages'), { withFileTypes: true });
const rows = [];

for (const entry of entries.filter((e) => e.isDirectory())) {
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(root, 'packages', entry.name, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (pkg.private === true) continue;
  const entryRecorded = recorded[pkg.name];
  rows.push({
    name: pkg.name,
    workspace: pkg.version,
    published: entryRecorded?.version ?? '(not recorded)',
    range: entryRecorded?.range ?? '',
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));

const width = (key, head) => Math.max(head.length, ...rows.map((r) => String(r[key]).length));
const w = {
  name: width('name', 'package'),
  workspace: width('workspace', 'workspace'),
  published: width('published', 'published'),
};

console.log(
  `${'package'.padEnd(w.name)}  ${'workspace'.padEnd(w.workspace)}  ` +
    `${'published'.padEnd(w.published)}  consumers pin`,
);
console.log(
  `${'-'.repeat(w.name)}  ${'-'.repeat(w.workspace)}  ${'-'.repeat(w.published)}  -------------`,
);

for (const r of rows) {
  console.log(
    `${r.name.padEnd(w.name)}  ${String(r.workspace).padEnd(w.workspace)}  ` +
      `${String(r.published).padEnd(w.published)}  ${r.range}`,
  );
}

const pending = rows.filter((r) => r.published !== '(not recorded)' && r.workspace !== r.published);
if (pending.length > 0) {
  console.log(
    `\n${pending.length} package(s) bumped in the workspace but not yet recorded as published:\n` +
      pending.map((r) => `  ${r.name}  ${r.published} -> ${r.workspace}`).join('\n') +
      '\nQuote the PUBLISHED column to a consumer. The workspace version is not installable\n' +
      'until the tag is pushed and the publish workflow succeeds.',
  );
}

console.log(
  '\nGit tags are a repository counter, not a package version — do not quote them as one.\n' +
    'To confirm against the registry (needs read:packages): npm run versions:check',
);
