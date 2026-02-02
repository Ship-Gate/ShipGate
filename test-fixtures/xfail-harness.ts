/**
 * XFAIL Test Harness
 * 
 * Provides utilities for running fixture-based tests with expected failure support.
 * 
 * Usage:
 *   const harness = createXFailHarness('parser');
 *   
 *   harness.runFixtureTest('valid/minimal.isl', () => {
 *     const result = parse(loadFixture('valid/minimal.isl'));
 *     expect(result.success).toBe(true);
 *   });
 *   
 *   // At end of test suite
 *   harness.printSummary();
 */

import { describe, it, expect } from 'vitest';
import { 
  XFailConfig, 
  XFailEntry, 
  getXFailConfig, 
  shouldSkip, 
  isXFail 
} from './xfail.js';

export interface XFailSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  xfailPassed: number;   // Expected to fail and did fail (good)
  xfailFailed: number;   // Expected to fail but passed (needs removal from list)
}

export interface XFailHarness {
  /** The package this harness is for */
  readonly package: 'parser' | 'typechecker';
  /** The xfail configuration */
  readonly config: XFailConfig;
  /** Current summary of test results */
  readonly summary: XFailSummary;
  
  /**
   * Run a fixture test with xfail handling
   * 
   * If the fixture is in the skip list, the test is skipped.
   * If the fixture is in the xfail list:
   *   - If the test fails, it's counted as "expected failure" (pass)
   *   - If the test passes, it throws "XFAIL FIXED" error (fail)
   */
  runFixtureTest(fixture: string, testFn: () => void | Promise<void>): void;
  
  /**
   * Check if a fixture should be skipped
   */
  shouldSkip(fixture: string): XFailEntry | undefined;
  
  /**
   * Check if a fixture is expected to fail
   */
  isXFail(fixture: string): XFailEntry | undefined;
  
  /**
   * Print the xfail summary
   */
  printSummary(): void;
  
  /**
   * Assert the summary is valid (no xfail-fixed tests)
   * Call this at the end of the test suite
   */
  assertNoXFailFixed(): void;
}

/**
 * Create an xfail test harness for a package
 */
export function createXFailHarness(pkg: 'parser' | 'typechecker'): XFailHarness {
  const config = getXFailConfig(pkg);
  const summary: XFailSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    xfailPassed: 0,
    xfailFailed: 0,
  };
  
  return {
    package: pkg,
    config,
    summary,
    
    runFixtureTest(fixture: string, testFn: () => void | Promise<void>): void {
      const skipEntry = shouldSkip(config, fixture);
      const xfailEntry = isXFail(config, fixture);
      
      summary.total++;
      
      if (skipEntry) {
        summary.skipped++;
        it.skip(`[SKIP] ${fixture} - ${skipEntry.reason}`, () => {
          // Test is skipped
        });
        return;
      }
      
      if (xfailEntry) {
        it(`[XFAIL] ${fixture}`, async () => {
          let testPassed = false;
          let testError: Error | undefined;
          
          try {
            await testFn();
            testPassed = true;
          } catch (error) {
            testError = error instanceof Error ? error : new Error(String(error));
          }
          
          if (testPassed) {
            // Test passed but was expected to fail - this is a failure!
            summary.xfailFailed++;
            throw new Error(
              `XFAIL FIXED: "${fixture}" passed but was expected to fail.\n` +
              `Reason: ${xfailEntry.reason}\n` +
              `Action: Remove this fixture from the xfail list in test-fixtures/xfail.ts`
            );
          } else {
            // Test failed as expected - this is a pass
            summary.xfailPassed++;
            // Log for visibility but don't fail
            console.log(`  ✓ XFAIL (expected failure): ${fixture}`);
            console.log(`    Reason: ${xfailEntry.reason}`);
            if (testError) {
              console.log(`    Error: ${testError.message.split('\n')[0]}`);
            }
          }
        });
        return;
      }
      
      // Normal test
      it(fixture, async () => {
        try {
          await testFn();
          summary.passed++;
        } catch (error) {
          summary.failed++;
          throw error;
        }
      });
    },
    
    shouldSkip(fixture: string): XFailEntry | undefined {
      return shouldSkip(config, fixture);
    },
    
    isXFail(fixture: string): XFailEntry | undefined {
      return isXFail(config, fixture);
    },
    
    printSummary(): void {
      console.log('\n' + '='.repeat(60));
      console.log(`XFAIL Summary for ${pkg}`);
      console.log('='.repeat(60));
      console.log(`Total:          ${summary.total}`);
      console.log(`Passed:         ${summary.passed}`);
      console.log(`Failed:         ${summary.failed}`);
      console.log(`Skipped:        ${summary.skipped}`);
      console.log(`XFAIL Passed:   ${summary.xfailPassed} (expected failures that failed)`);
      console.log(`XFAIL Fixed:    ${summary.xfailFailed} (expected failures that passed - NEED CLEANUP)`);
      console.log('='.repeat(60) + '\n');
      
      if (summary.xfailFailed > 0) {
        console.log('⚠️  WARNING: Some XFAIL tests passed! Remove them from xfail.ts');
      }
    },
    
    assertNoXFailFixed(): void {
      if (summary.xfailFailed > 0) {
        throw new Error(
          `${summary.xfailFailed} XFAIL test(s) passed unexpectedly.\n` +
          `These fixtures need to be removed from the xfail list in test-fixtures/xfail.ts`
        );
      }
    },
  };
}

/**
 * Wrap a test suite with xfail handling
 * 
 * This is a convenience wrapper that creates a harness and provides
 * a clean API for running fixture tests.
 */
export function withXFail(
  pkg: 'parser' | 'typechecker',
  suiteName: string,
  suiteRunner: (harness: XFailHarness) => void
): void {
  describe(suiteName, () => {
    const harness = createXFailHarness(pkg);
    
    suiteRunner(harness);
    
    // Print summary after all tests in the suite
    describe('XFAIL Summary', () => {
      it('should print xfail summary', () => {
        harness.printSummary();
      });
      
      it('should have no xfail-fixed tests (CI enforcement)', () => {
        harness.assertNoXFailFixed();
      });
    });
  });
}

/**
 * Create fixture test runner with xfail support
 * 
 * This provides a simpler API for running a set of fixture tests.
 */
export function createFixtureRunner(
  pkg: 'parser' | 'typechecker',
  loadFixtureFn: (fixture: string) => string,
  runTestFn: (source: string, fixture: string) => void | Promise<void>
) {
  const harness = createXFailHarness(pkg);
  
  return {
    harness,
    
    /**
     * Run a single fixture test
     */
    run(fixture: string): void {
      harness.runFixtureTest(fixture, async () => {
        const source = loadFixtureFn(fixture);
        await runTestFn(source, fixture);
      });
    },
    
    /**
     * Run multiple fixture tests
     */
    runAll(fixtures: string[]): void {
      for (const fixture of fixtures) {
        this.run(fixture);
      }
    },
    
    /**
     * Finalize and check results
     */
    finalize(): void {
      harness.printSummary();
      harness.assertNoXFailFixed();
    },
  };
}

// Re-export types and utilities
export { XFailConfig, XFailEntry, shouldSkip, isXFail };
