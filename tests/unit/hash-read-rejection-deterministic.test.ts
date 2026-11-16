import { describe, expect, it } from 'vitest';
import { hashSource, isReadFailure } from '../../src/core/hash/stream';
import { UnalteredError } from '../../src/core/errors';

describe('deterministic file-read rejection', () => {
  it('classifies a rejected slice read as INPUT_UNREADABLE without exposing native errors', async () => {
    const source = {
      size: 64,
      slice: () => ({
        arrayBuffer: async (): Promise<ArrayBuffer> => {
          throw new DOMException('private filesystem path', 'NotReadableError');
        },
      }),
    };
    try {
      await hashSource(source);
      throw new Error('expected file read to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(UnalteredError);
      expect((error as UnalteredError).code).toBe('INPUT_UNREADABLE');
      expect((error as Error).message).not.toContain('private filesystem path');
      expect(isReadFailure(error)).toBe(true);
    }
  });
});
