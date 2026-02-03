/**
 * Test Harness with Proof Bundle Capture
 * 
 * Provides utilities for capturing test execution results
 * and generating proof bundles that show "X passed, 0 failed"
 */

// ============================================================================
// Types
// ============================================================================

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface ProofBundle {
  startTime: string;
  endTime?: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped?: number;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface HarnessConfig {
  outputFile?: string;
  verbose?: boolean;
  failFast?: boolean;
}

// ============================================================================
// Proof Bundle Management
// ============================================================================

let currentBundle: ProofBundle | null = null;

/**
 * Initialize a new proof bundle
 */
export function createProofBundle(metadata?: Record<string, unknown>): ProofBundle {
  const bundle: ProofBundle = {
    startTime: new Date().toISOString(),
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0,
    metadata,
  };
  currentBundle = bundle;
  return bundle;
}

/**
 * Get the current proof bundle
 */
export function getProofBundle(): ProofBundle | null {
  return currentBundle;
}

/**
 * Add a test result to the current bundle
 */
export function recordTest(result: TestResult): void {
  if (!currentBundle) {
    throw new Error('No proof bundle initialized. Call createProofBundle() first.');
  }

  currentBundle.tests.push(result);

  switch (result.status) {
    case 'passed':
      currentBundle.passed++;
      break;
    case 'failed':
      currentBundle.failed++;
      break;
    case 'skipped':
      currentBundle.skipped = (currentBundle.skipped || 0) + 1;
      break;
  }
}

/**
 * Finalize and return the proof bundle
 */
export function finalizeProofBundle(): ProofBundle {
  if (!currentBundle) {
    throw new Error('No proof bundle initialized.');
  }

  currentBundle.endTime = new Date().toISOString();
  currentBundle.summary = `${currentBundle.passed} passed, ${currentBundle.failed} failed`;

  if (currentBundle.skipped && currentBundle.skipped > 0) {
    currentBundle.summary += `, ${currentBundle.skipped} skipped`;
  }

  const bundle = currentBundle;
  currentBundle = null;
  return bundle;
}

// ============================================================================
// Test Runner Utilities
// ============================================================================

type TestFn = () => Promise<void> | void;

interface TestCase {
  name: string;
  fn: TestFn;
  timeout?: number;
}

/**
 * Run a single test and record result
 */
export async function runTest(test: TestCase): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${test.timeout || 30000}ms`)), test.timeout || 30000);
    });

    const testPromise = Promise.resolve(test.fn());
    await Promise.race([testPromise, timeoutPromise]);

    const result: TestResult = {
      name: test.name,
      status: 'passed',
      duration: Date.now() - startTime,
    };

    if (currentBundle) {
      recordTest(result);
    }

    return result;
  } catch (error) {
    const result: TestResult = {
      name: test.name,
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };

    if (currentBundle) {
      recordTest(result);
    }

    return result;
  }
}

/**
 * Run multiple tests in sequence
 */
export async function runTests(
  tests: TestCase[],
  config: HarnessConfig = {}
): Promise<ProofBundle> {
  const bundle = createProofBundle({
    config,
    testCount: tests.length,
  });

  for (const test of tests) {
    const result = await runTest(test);

    if (config.verbose) {
      const icon = result.status === 'passed' ? '✓' : '✗';
      console.log(`${icon} ${result.name} (${result.duration}ms)`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    if (config.failFast && result.status === 'failed') {
      break;
    }
  }

  return finalizeProofBundle();
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a proof bundle shows all tests passing
 */
export function assertAllPassed(bundle: ProofBundle): void {
  if (bundle.failed > 0) {
    const failedTests = bundle.tests
      .filter(t => t.status === 'failed')
      .map(t => `  - ${t.name}: ${t.error}`)
      .join('\n');

    throw new Error(
      `Expected all tests to pass, but ${bundle.failed} failed:\n${failedTests}`
    );
  }
}

/**
 * Assert proof bundle summary format
 */
export function assertProofBundleFormat(bundle: ProofBundle): void {
  if (!bundle.summary) {
    throw new Error('Proof bundle missing summary');
  }

  const summaryPattern = /^\d+ passed, \d+ failed/;
  if (!summaryPattern.test(bundle.summary)) {
    throw new Error(`Invalid summary format: "${bundle.summary}". Expected "X passed, Y failed"`);
  }
}

// ============================================================================
// Output Formatters
// ============================================================================

/**
 * Format proof bundle as markdown
 */
export function formatProofBundleMarkdown(bundle: ProofBundle): string {
  const lines = [
    '# Test Proof Bundle',
    '',
    `**Summary:** ${bundle.summary}`,
    `**Start:** ${bundle.startTime}`,
    `**End:** ${bundle.endTime}`,
    '',
    '## Test Results',
    '',
  ];

  for (const test of bundle.tests) {
    const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
    lines.push(`- ${icon} **${test.name}** (${test.duration}ms)`);
    if (test.error) {
      lines.push(`  - Error: \`${test.error}\``);
    }
  }

  return lines.join('\n');
}

/**
 * Format proof bundle as JSON (for CI/CD integration)
 */
export function formatProofBundleJSON(bundle: ProofBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Format proof bundle as compact summary
 */
export function formatProofBundleSummary(bundle: ProofBundle): string {
  const duration = bundle.endTime
    ? new Date(bundle.endTime).getTime() - new Date(bundle.startTime).getTime()
    : 0;

  return [
    '========================================',
    'PROOF BUNDLE SUMMARY',
    '========================================',
    `Result: ${bundle.summary}`,
    `Duration: ${duration}ms`,
    `Tests: ${bundle.tests.length}`,
    '========================================',
  ].join('\n');
}
