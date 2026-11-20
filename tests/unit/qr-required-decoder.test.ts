import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { qrPython } from '../qualification/qr-cert';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(), execFileSync: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('UNALTERED_QR_PYTHON', '/test/qr-python');
  vi.stubEnv('UNALTERED_REQUIRE_QR_DECODER', '1');
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

it('uses the selected interpreter when both required tools are available', () => {
  expect(qrPython()).toBe('/test/qr-python');
  expect(spawnSync).toHaveBeenCalledWith('/test/qr-python', expect.arrayContaining(['-I', expect.any(String), 'probe']), expect.any(Object));
});

it.each([0, 1])('fails qualification when required tool %i is unavailable instead of skipping', (failedCall) => {
  vi.mocked(spawnSync).mockImplementation((..._args: unknown[]) => ({
    status: vi.mocked(spawnSync).mock.calls.length - 1 === failedCall ? 3 : 0, stdout: '', stderr: '',
  }) as ReturnType<typeof spawnSync>);
  expect(() => qrPython()).toThrow(/Independent QR decoder absent/);
});

it('fails qualification when a required interpreter cannot launch', () => {
  vi.mocked(spawnSync).mockReturnValue({ status: null, error: new Error('ENOENT'), stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
  expect(() => qrPython()).toThrow(/Independent QR decoder absent/);
});

it('keeps optional local qualification skippable when tools are absent', () => {
  vi.stubEnv('UNALTERED_REQUIRE_QR_DECODER', '');
  vi.mocked(spawnSync).mockReturnValue({ status: 3, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
  expect(qrPython()).toBeNull();
});
