import { test, expect } from 'vitest';
import { toHex, fromHex, groupHex } from '../../src/core/bytes';
test('hex round trip', () => { expect(toHex(fromHex('00ff10'))).toBe('00ff10'); expect(groupHex('a'.repeat(16))).toBe('aaaaaaaa aaaaaaaa'); });
