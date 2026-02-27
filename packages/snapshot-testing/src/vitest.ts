/**
 * Vitest Integration
 * 
 * Custom matchers and setup for Vitest.
 */

import { expect } from 'vitest';
import {
  matchIslSnapshot,
  matchGeneratedSnapshot,
  matchJsonSnapshot,
  finalize,
  getSnapshotStore,
  resetSnapshotStore,
  clearAccessedSnapshots,
  resetStats,
  getStats,
  formatStats,
  type SnapshotContext,
  type IslSnapshotOptions,
  type GeneratedSnapshotOptions,
  type JsonSnapshotOptions,
} from './index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

declare module 'vitest' {
  interface Assertion<T> {
    toMatchISLSnapshot(options?: IslSnapshotOptions): void;
    toMatchGeneratedSnapshot(filenameOrOptions?: string | GeneratedSnapshotOptions): void;
    toMatchJsonSnapshot(options?: JsonSnapshotOptions): void;
  }
  
  interface AsymmetricMatchersContaining {
    toMatchISLSnapshot(options?: IslSnapshotOptions): void;
    toMatchGeneratedSnapshot(filenameOrOptions?: string | GeneratedSnapshotOptions): void;
    toMatchJsonSnapshot(options?: JsonSnapshotOptions): void;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Context Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current test context from Vitest
 */
function getTestContext(): SnapshotContext {
  // Access Vitest's internal test state
  const state = (expect as any).getState?.();
  
  if (state?.testPath && state?.currentTestName) {
    return {
      testFile: state.testPath,
      testName: state.currentTestName,
    };
  }

  // Fallback: try to get from Error stack
  const stack = new Error().stack ?? '';
  const match = stack.match(/at\s+.*?\s+\((.+?\.test\.[tj]sx?):(\d+)/);
  
  return {
    testFile: match?.[1] ?? 'unknown.test.ts',
    testName: 'unknown test',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Matchers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ISL snapshot matcher
 */
function toMatchISLSnapshot(
  this: any,
  received: string,
  options: IslSnapshotOptions = {}
) {
  const context = getTestContext();
  const result = matchIslSnapshot(received, context, options);

  return {
    pass: result.pass,
    message: () => result.message,
    actual: received,
    expected: undefined,
  };
}

/**
 * Generated code snapshot matcher
 */
function toMatchGeneratedSnapshot(
  this: any,
  received: string,
  filenameOrOptions?: string | GeneratedSnapshotOptions
) {
  const context = getTestContext();
  
  let options: GeneratedSnapshotOptions;
  if (typeof filenameOrOptions === 'string') {
    options = { filename: filenameOrOptions };
  } else {
    options = filenameOrOptions ?? {};
  }
  
  const result = matchGeneratedSnapshot(received, context, options);

  return {
    pass: result.pass,
    message: () => result.message,
    actual: received,
    expected: undefined,
  };
}

/**
 * JSON snapshot matcher
 */
function toMatchJsonSnapshot(
  this: any,
  received: unknown,
  options: JsonSnapshotOptions = {}
) {
  const context = getTestContext();
  const result = matchJsonSnapshot(received, context, options);

  return {
    pass: result.pass,
    message: () => result.message,
    actual: received,
    expected: undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setup ISL snapshot matchers for Vitest
 */
export function setupSnapshotMatchers(): void {
  expect.extend({
    toMatchISLSnapshot,
    toMatchGeneratedSnapshot,
    toMatchJsonSnapshot,
  });
}

/**
 * Create Vitest setup/teardown hooks
 */
export function createSnapshotHooks() {
  return {
    beforeAll() {
      resetSnapshotStore();
      resetStats();
    },
    
    beforeEach() {
      // Reset counter for current test
      const context = getTestContext();
      getSnapshotStore().resetCounter(context.testFile, context.testName);
    },
    
    afterAll() {
      finalize();
      
      // Log stats
      const stats = getStats();
      if (stats.passed + stats.failed > 0) {
        console.log('\n' + formatStats(stats));
      }
      
      clearAccessedSnapshots();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Setup (for use with vitest.setup.ts)
// ─────────────────────────────────────────────────────────────────────────────

// Auto-setup when imported
setupSnapshotMatchers();

export {
  // Re-export for convenience
  matchIslSnapshot,
  matchGeneratedSnapshot,
  matchJsonSnapshot,
  finalize,
  getStats,
  formatStats,
};
