/**
 * Vitest configuration template for generated projects.
 * Resolves paths to src, tests, and generated types.
 */

import type { TestInfrastructureContext } from './types.js';

export function generateVitestConfig(ctx: TestInfrastructureContext): string {
  const { srcDir = 'src', testsDir = 'tests', outDir = '.' } = ctx;

  return `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['${testsDir}/**/*.test.ts', '${testsDir}/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '.next'],
    setupFiles: ['${testsDir}/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['${srcDir}/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 5000,
    pool: 'threads',
    passWithNoTests: false,
    reporters: ['verbose', 'json'],
    outputFile: {
      json: '${testsDir}/results.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './${srcDir}'),
      '@tests': path.resolve(__dirname, './${testsDir}'),
    },
  },
});
`;
}
