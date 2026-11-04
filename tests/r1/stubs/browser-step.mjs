// Test double for scripts/r1-acceptance.mjs, copied into a scratch layout by tests/r1/r1-acceptance.test.mjs to test
// scripts/r1-acceptance.sh alone. It writes a synthetic "download" where the real runner does (join(outDir, name))
// and prints a PASS report shaped like the real one. Nothing here is a real receipt.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[4];
mkdirSync(outDir, { recursive: true });
const upgradedReceiptPath = join(outDir, 'incomplete.txt.ots');
writeFileSync(upgradedReceiptPath, 'synthetic upgraded receipt\n');
process.stdout.write(`${JSON.stringify({ classification: 'PASS', verify: { state: 'VERIFIED', block: '428648', upgradedReceiptPath } }, null, 2)}\n`);
