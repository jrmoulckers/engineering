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
//
// `--tag <ref>` exists because the warning above was not enough. Two consumers
// independently planned adoptions around the string `v0.16.0`, which is BOTH a
// real repo tag (shipping eslint-config@0.9.0) and a real package version
// (first shipped at repo tag v0.115.0, 99 tags away). Neither reading errors,
// so there is nothing to notice. Telling people "a tag is not a version" does
// not help them when they are holding a string that is legitimately both; they
// need to be able to resolve it. This does that, offline, from git alone.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

// Resolving a ref that does not exist must be loud. `git show <bad-ref>:<path>`
// fails the same way as a path that is genuinely absent at a good ref, and an
// empty result reads as "this package did not exist yet" — which is a wrong
// answer that looks like a finding. Verify the ref first, separately.
function atTag(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    console.error(
      `Unknown ref: ${ref}\n` +
        'Nothing was compared. Fetch tags first (git fetch --tags), or list them:\n' +
        '  git tag --list --sort=-v:refname | head',
    );
    process.exitCode = 1;
    return null;
  }

  let listing;
  try {
    listing = git(['ls-tree', '--name-only', `${ref}:packages`]);
  } catch {
    console.error(`No packages/ directory exists at ${ref}. Nothing to report.`);
    process.exitCode = 1;
    return null;
  }

  const found = [];
  for (const dir of listing.split('\n').filter(Boolean)) {
    let pkg;
    try {
      pkg = JSON.parse(git(['show', `${ref}:packages/${dir}/package.json`]));
    } catch {
      continue;
    }
    if (pkg.private === true) continue;
    found.push({ name: pkg.name, version: pkg.version });
  }
  return found;
}

const tagIndex = process.argv.indexOf('--tag');
if (tagIndex !== -1) {
  const ref = process.argv[tagIndex + 1];
  if (!ref) {
    console.error('--tag requires a ref, e.g. --tag v0.16.0');
    process.exitCode = 1;
  } else {
    const found = atTag(ref);
    if (found) {
      if (found.length === 0) {
        console.error(`No publishable packages found at ${ref}.`);
        process.exitCode = 1;
      } else {
        console.log(`Repo tag ${ref} ships:\n`);
        const nameWidth = Math.max(...found.map((f) => f.name.length));
        for (const f of found.sort((a, b) => a.name.localeCompare(b.name))) {
          console.log(`  ${f.name.padEnd(nameWidth)}  ${f.version}`);
        }

        // The string itself may be a plausible package version. Say so without
        // claiming which the reader meant — the point is that both readings
        // exist, not that one is wrong.
        const bare = ref.replace(/^v/, '');
        const alsoAVersion = /^\d+\.\d+\.\d+$/.test(bare);
        const shipsItself = found.some((f) => f.version === bare);
        if (alsoAVersion && !shipsItself) {
          console.log(
            `\n"${bare}" is also a well-formed package version, and this tag does not ship it.\n` +
              'These are different namespaces. If you meant the package, ask the registry:\n' +
              `  npm view @jrmoulckers/<name>@${bare} peerDependencies`,
          );
        }
        console.log(
          '\nRead peer ranges from the package version above, not from the tag. A peer that is\n' +
            'ABSENT at an old ref reads exactly like a peer that is not required.',
        );
      }
    }
  }
  process.exit(process.exitCode ?? 0);
}

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
    'Holding a tag and unsure what it ships?  npm run versions:print -- --tag v0.16.0\n' +
    'To confirm against the registry (needs read:packages): npm run versions:check',
);
