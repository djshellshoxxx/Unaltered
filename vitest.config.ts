import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.test.ts', 'tests/differential/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
