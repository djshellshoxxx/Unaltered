// Test double for scripts/r1-acceptance.mjs, copied into a scratch layout by tests/r1/r1-acceptance.test.mjs to test
// scripts/r1-acceptance.sh alone. It writes a synthetic "download" where the real runner does (join(outDir, name))
// and prints a PASS report shaped like the real one. Nothing here is a real receipt.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

// r1-acceptance.sh passes "$work/incomplete.txt" "$work/incomplete.txt.ots" "$work/out", so the output directory must
// lie inside the work directory that holds the input file. Both come from the same "$work" string, so the check also
// holds where the work directory is not under TMPDIR (macOS mktemp) or is reached through a symlink (/var -> /private/var).
const work = dirname(resolve(process.argv[2] ?? ''));
const outDir = resolve(process.argv[4] ?? '');
if (!outDir.startsWith(work + sep)) throw new Error('browser-step stub: the output directory must be inside the work directory');
mkdirSync(outDir, { recursive: true });
const upgradedReceiptPath = join(outDir, 'incomplete.txt.ots');
writeFileSync(upgradedReceiptPath, 'synthetic upgraded receipt\n');
process.stdout.write(`${JSON.stringify({ classification: 'PASS', verify: { state: 'VERIFIED', block: '428648', upgradedReceiptPath } }, null, 2)}\n`);
