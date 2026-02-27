import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // The security-scanner's dist/ may not be built yet (uses tsc with
      // noEmit inherited from root tsconfig). Point Vite at the source
      // so module resolution succeeds during tests.
      '@isl-lang/security-scanner': resolve(__dirname, '../security-scanner/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
