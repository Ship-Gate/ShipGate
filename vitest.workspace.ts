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
  // E2E and Phase 3 Integration Tests
  {
    test: {
      name: 'e2e',
      root: '.',
      globals: true,
      environment: 'node',
      include: ['tests/e2e/**/*.test.ts'],
      testTimeout: 180000,
    },
  },
  // Intent Translator package
  {
    test: {
      name: 'intent-translator',
      root: './packages/intent-translator',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 60000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  },
  // ISL Pipeline package
  {
    test: {
      name: 'isl-pipeline',
      root: './packages/isl-pipeline',
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
  // ISL Policy Packs package
  {
    test: {
      name: 'isl-policy-packs',
      root: './packages/isl-policy-packs',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  },
  // ISL Proof package
  {
    test: {
      name: 'isl-proof',
      root: './packages/isl-proof',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // Import Resolver package
  {
    test: {
      name: 'import-resolver',
      root: './packages/import-resolver',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // ISL Gate package (trust score engine)
  {
    test: {
      name: 'isl-gate',
      root: './packages/isl-gate',
      globals: false,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 10000,
    },
  },
  // Verifier Runtime package
  {
    test: {
      name: 'verifier-runtime',
      root: './packages/verifier-runtime',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // ISL Stdlib Registry package
  {
    test: {
      name: 'isl-stdlib',
      root: './packages/isl-stdlib',
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
  // ISL SMT package (external Z3/CVC5 solver adapter)
  {
    test: {
      name: 'isl-smt',
      root: './packages/isl-smt',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // ISL Test Runtime package (login test harness)
  {
    test: {
      name: 'isl-test-runtime',
      root: './packages/isl-test-runtime',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 60000,
      alias: {
        '@isl-lang/trace-format': './packages/isl-trace-format/src/index.ts',
        '@isl-lang/trace-viewer': './packages/trace-viewer/src/index.ts',
      },
    },
  },
  // Hallucination Scanner package (Rust resolver)
  {
    test: {
      name: 'hallucination-scanner',
      root: './packages/hallucination-scanner',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  },
  // MCP Server package (unified Shipgate API)
  {
    test: {
      name: 'mcp-server',
      root: './packages/mcp-server',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 60000,
    },
  },
  // Codegen Quality Harness (golden output + compile checks)
  {
    test: {
      name: 'codegen-harness',
      root: './packages/codegen-harness',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // gRPC/Proto Code Generator
  {
    test: {
      name: 'codegen-grpc',
      root: './packages/codegen-grpc',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
    },
  },
  // Shipgate E2E Intent Verification (investor proof fixtures)
  {
    test: {
      name: 'shipgate-e2e-intent',
      root: './packages/shipgate-e2e-intent',
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 60000,
    },
  },
]);
