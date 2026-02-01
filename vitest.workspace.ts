/**
 * Vitest Workspace Configuration
 * 
 * Configures test settings across all packages in the monorepo.
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Parser package
  {
    test: {
      name: 'parser',
      root: './packages/parser',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
  // Typechecker package
  {
    test: {
      name: 'typechecker',
      root: './packages/typechecker',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
  // Evaluator package
  {
    test: {
      name: 'evaluator',
      root: './packages/evaluator',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },
    },
  },
  // CLI package
  {
    test: {
      name: 'cli',
      root: './packages/cli',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  },
  // REPL package
  {
    test: {
      name: 'repl',
      root: './packages/repl',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts', 'src/cli.ts'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  },
]);
