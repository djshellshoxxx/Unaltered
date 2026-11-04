// Test double for scripts/r1-acceptance.mjs, copied into a scratch layout by tests/r1/r1-acceptance.test.mjs to test
// scripts/r1-acceptance.sh alone. It writes a synthetic "download" where the real runner does (join(outDir, name))
// and prints a PASS report shaped like the real one. Nothing here is a real receipt.
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

// The output directory comes from the command line. The test runs this stub with TMPDIR set to its scratch directory,
// and r1-acceptance.sh creates every work directory under TMPDIR, so anything else is refused before a file is made.
// TMPDIR is accepted as given and as its real path, since a temp root reached through a symlink (macOS /var ->
// /private/var) can be reported either way.
const temp = resolve(tmpdir());
const bases = [temp, realpathSync(temp)].map((b) => b + sep);
const outDir = resolve(process.argv[4] ?? '');
if (!bases.some((b) => outDir.startsWith(b))) throw new Error('browser-step stub: refusing an output directory outside TMPDIR');
mkdirSync(outDir, { recursive: true });
const upgradedReceiptPath = join(outDir, 'incomplete.txt.ots');
writeFileSync(upgradedReceiptPath, 'synthetic upgraded receipt\n');
process.stdout.write(`${JSON.stringify({ classification: 'PASS', verify: { state: 'VERIFIED', block: '428648', upgradedReceiptPath } }, null, 2)}\n`);
