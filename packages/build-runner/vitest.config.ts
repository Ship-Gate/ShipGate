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
      include: ['src/**/*.ts'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@isl-lang/parser': path.resolve(__dirname, '../parser/src/index.ts'),
      '@isl-lang/typechecker': path.resolve(__dirname, '../typechecker/src/index.ts'),
      '@isl-lang/isl-compiler': path.resolve(__dirname, '../isl-compiler/src/index.ts'),
      '@isl-lang/codegen-tests': path.resolve(__dirname, '../codegen-tests/src/index.ts'),
      '@isl-lang/verifier-runtime': path.resolve(__dirname, '../verifier-runtime/src/index.ts'),
    },
  },
});
