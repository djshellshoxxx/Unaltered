import { describe, expect, it } from 'vitest';
import { networkCapabilityText } from '../../src/core/net/capability';

describe('network capability copy', () => {
  it('never claims the service is reachable from navigator.onLine', () => {
    expect(networkCapabilityText(true)).toContain('not a server health check');
    expect(networkCapabilityText(true)).toContain('require');
  });
  it('explains which functions remain local when the browser reports offline', () => {
    expect(networkCapabilityText(false)).toContain('Hashing');
    expect(networkCapabilityText(false)).toContain('unavailable');
  });
});
