import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
    testTimeout: 10000,
    alias: {
      '@isl-lang/stdlib-core': new URL('../stdlib-core/src/index.ts', import.meta.url).pathname,
    },
  },
});
