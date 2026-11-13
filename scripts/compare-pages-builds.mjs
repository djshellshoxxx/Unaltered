#!/usr/bin/env node
// Read-only release evidence: compare two independently built Pages directories.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [left, right] = process.argv.slice(2);
if (!left || !right || process.argv.length !== 4) {
  process.stderr.write('usage: node scripts/compare-pages-builds.mjs <first-web-dir> <second-web-dir>\\n');
  process.exit(1);
}
function manifest(root) {
  const files = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) visit(path);
      else if (info.isFile()) files.push([relative(root, path).replaceAll('\\\\', '/'), createHash('sha256').update(readFileSync(path)).digest('hex')]);
      else throw new Error('non-regular Pages artifact');
    }
  }
  visit(root);
  if (!files.length) throw new Error('empty Pages artifact');
  return files;
}
try {
  const a = manifest(left), b = manifest(right);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Pages builds differ');
  for (const [path, sha] of a) process.stdout.write(sha + '  ' + path + '\\n');
  process.stderr.write('Pages builds are byte-identical.\\n');
} catch (error) {
  process.stderr.write(String(error) + '\\n');
  process.exitCode = 1;
}
