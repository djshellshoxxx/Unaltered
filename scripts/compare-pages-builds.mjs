#!/usr/bin/env node
// Read-only release evidence: compare two independently built Pages directories.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const [left, right] = process.argv.slice(2);
if (!left || !right || process.argv.length !== 4) {
  process.stderr.write('usage: node scripts/compare-pages-builds.mjs <first-web-dir> <second-web-dir>\n');
  process.exit(1);
}
function manifest(root) {
  // Strip trailing separators/dot segments before lstat; otherwise a path such
  // as "artifact-link/" follows the final symlink on POSIX systems.
  root = resolve(root);
  if (!lstatSync(root).isDirectory()) throw new Error('expected a Pages artifact directory');
  const files = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const info = lstatSync(path);
      if (info.isDirectory()) visit(path);
      else if (info.isFile()) files.push([relative(root, path).split(sep).join('/'), createHash('sha256').update(readFileSync(path)).digest('hex')]);
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
  for (const [path, sha] of a) process.stdout.write(sha + '  ' + path + '\n');
  process.stderr.write('Pages builds are byte-identical.\n');
} catch (error) {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
}
