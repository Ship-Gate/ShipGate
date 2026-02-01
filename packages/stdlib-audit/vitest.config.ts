import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['implementations/typescript/**/*.ts'],
      exclude: [
        'implementations/typescript/**/*.d.ts',
        'implementations/typescript/**/index.ts',
      ],
    },
    testTimeout: 10000,
  },
});
