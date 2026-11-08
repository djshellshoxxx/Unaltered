// Run the actual draft-release verification command against synthetic downloaded platform artifacts.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const step = /- name: Verify artefacts against SHA256SUMS\n([\s\S]*?)(?=\n {6}- |$)/.exec(workflow)?.[1];
const run = /^ {8}run: (.*)(?:\n|$)/m.exec(step ?? '')?.[1];
const script = run === '|'
  ? step!.split('\n').slice(1).map((line) => line.slice(10)).join('\n')
  : run;

function verify(change?: { platform: string; missing?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'unaltered-platform-integrity-'));
  try {
    const bytes = 'Synthetic release archive.\n';
    const digest = createHash('sha256').update(bytes).digest('hex');
    for (const platform of ['linux', 'windows', 'macos']) {
      mkdirSync(join(dir, platform));
      writeFileSync(join(dir, platform, 'archive.zip'), bytes);
      writeFileSync(join(dir, platform, 'SHA256SUMS'), `${digest}  archive.zip\n`);
    }
    if (change?.missing) unlinkSync(join(dir, change.platform, 'archive.zip'));
    else if (change) writeFileSync(join(dir, change.platform, 'archive.zip'), 'Changed after checksums were generated.\n');
    expect(script, 'release artifact verification command exists').toBeDefined();
    return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script!], { cwd: dir, encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe.skipIf(Boolean(spawnSync('bash', ['--version']).error) || Boolean(spawnSync('sha256sum', ['--version']).error))('downloaded platform artifact integrity', () => {
  it('accepts intact files from all three platforms', () => {
    const result = verify();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it.each(['linux', 'windows', 'macos'])('rejects changed %s artifact bytes even when all manifests agree', (platform) => {
    expect(verify({ platform }).status).not.toBe(0);
  });

  it.each(['windows', 'macos'])('rejects a missing %s artifact even when all manifests agree', (platform) => {
    expect(verify({ platform, missing: true }).status).not.toBe(0);
  });
});
