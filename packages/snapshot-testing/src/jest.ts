/**
 * Jest Integration
 * 
 * Custom matchers and setup for Jest.
 */

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

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchISLSnapshot(options?: IslSnapshotOptions): R;
      toMatchGeneratedSnapshot(filenameOrOptions?: string | GeneratedSnapshotOptions): R;
      toMatchJsonSnapshot(options?: JsonSnapshotOptions): R;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Context Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current test context from Jest
 */
function getTestContext(): SnapshotContext {
  // Access Jest's internal test state
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setup ISL snapshot matchers for Jest
 */
export function setupSnapshotMatchers(): void {
  if (typeof expect !== 'undefined' && typeof (expect as any).extend === 'function') {
    (expect as any).extend({
      toMatchISLSnapshot,
      toMatchGeneratedSnapshot,
      toMatchJsonSnapshot,
    });
  }
}

/**
 * Create Jest setup/teardown hooks
 */
export function createJestSetup() {
  return {
    setupFilesAfterEnv: () => {
      setupSnapshotMatchers();
      
      beforeAll(() => {
        resetSnapshotStore();
        resetStats();
      });

      beforeEach(() => {
        const context = getTestContext();
        getSnapshotStore().resetCounter(context.testFile, context.testName);
      });

      afterAll(() => {
        finalize();
        
        const stats = getStats();
        if (stats.passed + stats.failed > 0) {
          console.log('\n' + formatStats(stats));
        }
        
        clearAccessedSnapshots();
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Setup
// ─────────────────────────────────────────────────────────────────────────────

// Auto-setup when imported
setupSnapshotMatchers();

export {
  matchIslSnapshot,
  matchGeneratedSnapshot,
  matchJsonSnapshot,
  finalize,
  getStats,
  formatStats,
};
