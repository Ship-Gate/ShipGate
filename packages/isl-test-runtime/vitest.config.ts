import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@isl-lang/trace-format': path.resolve(__dirname, '../isl-trace-format/src/index.ts'),
      '@isl-lang/trace-viewer': path.resolve(__dirname, '../trace-viewer/src/index.ts'),
    },
  },
});
