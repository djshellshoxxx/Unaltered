// Execute the shipped draft-creation shell with a local gh test double. A tag may move while the three platform
// builds run; --verify-tag only checks existence. Never associate those build artifacts with a different commit.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
const finalStep = workflow.slice(workflow.indexOf('      - name: Create draft pre-release'));
const script = finalStep.slice(finalStep.indexOf('        run: |\n') + '        run: |\n'.length)
  .split('\n').map((line) => line.slice(10)).join('\n');
const sha = '1'.repeat(40);

function draft(remoteSha: string, apiExit = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'unaltered-release-tag-'));
  const calls = join(dir, 'calls');
  try {
    mkdirSync(join(dir, 'linux'));
    writeFileSync(join(dir, 'linux', 'RELEASE-NOTES.md'), 'Synthetic release notes.\n');
    writeFileSync(calls, '');
    // Override gh in this shell, so the real workflow cannot create a release or contact GitHub in these tests.
    const stub = `gh() {
      printf '%s\\n' "$*" >> "$UNALTERED_CALL_LOG"
      if [ "$1" = api ]; then
        printf '%s\\n' "$UNALTERED_REMOTE_SHA"
        return "$UNALTERED_API_EXIT"
      fi
      if [ "$1" = release ] && [ "$2" = create ]; then return 0; fi
      return 2
    }\n`;
    const result = spawnSync('bash', ['-c', stub + script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env, RUNNER_TEMP: dir, GITHUB_REPOSITORY: 'synthetic/unaltered', GITHUB_SHA: sha,
        TAG_INPUT: 'v0.3.1', UNALTERED_CALL_LOG: calls, UNALTERED_REMOTE_SHA: remoteSha,
        UNALTERED_API_EXIT: String(apiExit),
      },
    });
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(Boolean(spawnSync('bash', ['--version']).error))('release tag identity at draft creation', () => {
  it('rechecks the fully qualified remote tag before creating an unpublished draft', () => {
    const result = draft(sha);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls[0]).toBe('api repos/synthetic/unaltered/commits/refs/tags/v0.3.1 --jq .sha');
    expect(result.calls).toHaveLength(2);
    expect(result.calls[1]).toContain('release create v0.3.1');
    expect(result.calls[1]).toContain('--verify-tag --draft --prerelease');
  });

  it.each([
    ['tag moved during builds', '2'.repeat(40), 0],
    ['tag missing', '', 1],
    ['API unavailable', sha, 1],
    ['empty API result', '', 0],
    ['malformed API result', `${sha} unexpected`, 0],
  ])('refuses draft creation when %s', (_label, remoteSha, apiExit) => {
    const result = draft(remoteSha, apiExit);
    expect(result.status).not.toBe(0);
    expect(result.calls.some((call) => call.startsWith('release create'))).toBe(false);
  });
});
