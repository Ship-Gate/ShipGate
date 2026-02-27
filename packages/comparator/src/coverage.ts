/**
 * Coverage Comparison
 * 
 * Compare test coverage across multiple implementations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Test case result */
export interface TestCaseResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  category: TestCategory;
}

/** Categories of tests */
export type TestCategory = 
  | 'postcondition'
  | 'precondition'
  | 'invariant'
  | 'scenario'
  | 'edge_case'
  | 'error_handling'
  | 'temporal';

/** Coverage metrics for a single implementation */
export interface CoverageMetrics {
  /** Total tests run */
  total: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests skipped */
  skipped: number;
  /** Pass rate percentage */
  passRate: number;
  /** Coverage by category */
  byCategory: Map<TestCategory, CategoryCoverage>;
  /** List of failing tests */
  failures: TestCaseResult[];
  /** Total test duration */
  totalDuration: number;
}

/** Coverage for a specific category */
export interface CategoryCoverage {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

/** Result of coverage comparison */
export interface CoverageResult {
  /** Coverage by implementation */
  byImplementation: Map<string, CoverageMetrics>;
  /** Tests that passed for all implementations */
  universalPasses: string[];
  /** Tests that failed for all implementations */
  universalFailures: string[];
  /** Tests with mixed results */
  divergentTests: DivergentTest[];
  /** Overall comparison */
  comparison: CoverageComparison;
}

/** A test with different results across implementations */
export interface DivergentTest {
  testName: string;
  category: TestCategory;
  results: Map<string, boolean>;
  passCount: number;
  failCount: number;
}

/** Overall coverage comparison */
export interface CoverageComparison {
  /** Implementation with highest pass rate */
  bestCoverage: { name: string; passRate: number };
  /** Implementation with lowest pass rate */
  worstCoverage: { name: string; passRate: number };
  /** Average pass rate across all */
  averagePassRate: number;
  /** Categories with most divergence */
  mostDivergentCategories: TestCategory[];
  /** Number of tests that all implementations agree on */
  consensusTests: number;
  /** Total unique tests across all implementations */
  totalUniqueTests: number;
}

/** Options for coverage comparison */
export interface CoverageOptions {
  /** Include skipped tests in calculations */
  includeSkipped?: boolean;
  /** Minimum tests required per category */
  minTestsPerCategory?: number;
  /** Categories to focus on */
  focusCategories?: TestCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate coverage metrics from test results
 */
export function calculateCoverage(
  testResults: TestCaseResult[],
  options: CoverageOptions = {}
): CoverageMetrics {
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed && !t.error?.includes('skipped')).length;
  const skipped = testResults.length - passed - failed;
  const total = options.includeSkipped ? testResults.length : passed + failed;

  // Calculate by category
  const byCategory = new Map<TestCategory, CategoryCoverage>();
  const categories: TestCategory[] = [
    'postcondition', 'precondition', 'invariant', 
    'scenario', 'edge_case', 'error_handling', 'temporal'
  ];

  for (const category of categories) {
    const categoryTests = testResults.filter(t => t.category === category);
    const categoryPassed = categoryTests.filter(t => t.passed).length;
    const categoryFailed = categoryTests.filter(t => !t.passed).length;
    
    byCategory.set(category, {
      total: categoryTests.length,
      passed: categoryPassed,
      failed: categoryFailed,
      passRate: categoryTests.length > 0 ? (categoryPassed / categoryTests.length) * 100 : 100,
    });
  }

  const failures = testResults.filter(t => !t.passed);
  const totalDuration = testResults.reduce((sum, t) => sum + t.duration, 0);

  return {
    total,
    passed,
    failed,
    skipped,
    passRate: total > 0 ? (passed / total) * 100 : 100,
    byCategory,
    failures,
    totalDuration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare coverage across multiple implementations
 */
export function compareCoverage(
  allResults: Map<string, TestCaseResult[]>,
  options: CoverageOptions = {}
): CoverageResult {
  const byImplementation = new Map<string, CoverageMetrics>();
  const implNames = Array.from(allResults.keys());

  // Calculate metrics for each implementation
  for (const [name, results] of allResults) {
    byImplementation.set(name, calculateCoverage(results, options));
  }

  // Find all unique test names
  const allTestNames = new Set<string>();
  for (const results of allResults.values()) {
    for (const result of results) {
      allTestNames.add(result.name);
    }
  }

  // Analyze each test across implementations
  const universalPasses: string[] = [];
  const universalFailures: string[] = [];
  const divergentTests: DivergentTest[] = [];

  for (const testName of allTestNames) {
    const results = new Map<string, boolean>();
    let category: TestCategory = 'scenario';
    let passCount = 0;
    let failCount = 0;

    for (const [implName, implResults] of allResults) {
      const testResult = implResults.find(t => t.name === testName);
      if (testResult) {
        results.set(implName, testResult.passed);
        category = testResult.category;
        if (testResult.passed) passCount++;
        else failCount++;
      }
    }

    if (passCount === implNames.length) {
      universalPasses.push(testName);
    } else if (failCount === implNames.length) {
      universalFailures.push(testName);
    } else if (results.size > 1) {
      divergentTests.push({
        testName,
        category,
        results,
        passCount,
        failCount,
      });
    }
  }

  // Find most divergent categories
  const categoryDivergence = new Map<TestCategory, number>();
  for (const test of divergentTests) {
    const current = categoryDivergence.get(test.category) ?? 0;
    categoryDivergence.set(test.category, current + 1);
  }
  
  const mostDivergentCategories = Array.from(categoryDivergence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Calculate comparison stats
  const passRates = Array.from(byImplementation.values()).map(m => m.passRate);
  const bestIdx = passRates.indexOf(Math.max(...passRates));
  const worstIdx = passRates.indexOf(Math.min(...passRates));

  const comparison: CoverageComparison = {
    bestCoverage: {
      name: implNames[bestIdx],
      passRate: passRates[bestIdx],
    },
    worstCoverage: {
      name: implNames[worstIdx],
      passRate: passRates[worstIdx],
    },
    averagePassRate: passRates.reduce((a, b) => a + b, 0) / passRates.length,
    mostDivergentCategories,
    consensusTests: universalPasses.length + universalFailures.length,
    totalUniqueTests: allTestNames.size,
  };

  return {
    byImplementation,
    universalPasses,
    universalFailures,
    divergentTests,
    comparison,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap Analysis
// ─────────────────────────────────────────────────────────────────────────────

/** Coverage gap analysis */
export interface CoverageGap {
  category: TestCategory;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  affectedImplementations: string[];
}

/**
 * Analyze coverage gaps
 */
export function analyzeCoverageGaps(
  coverageResult: CoverageResult,
  options: CoverageOptions = {}
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const minTests = options.minTestsPerCategory ?? 3;

  // Check each implementation for category gaps
  for (const [implName, metrics] of coverageResult.byImplementation) {
    for (const [category, coverage] of metrics.byCategory) {
      // Gap: Category has no tests
      if (coverage.total === 0) {
        gaps.push({
          category,
          description: `No ${category} tests`,
          severity: category === 'postcondition' || category === 'invariant' ? 'critical' : 'warning',
          affectedImplementations: [implName],
        });
      }
      // Gap: Category has too few tests
      else if (coverage.total < minTests) {
        gaps.push({
          category,
          description: `Insufficient ${category} tests (${coverage.total}/${minTests})`,
          severity: 'info',
          affectedImplementations: [implName],
        });
      }
      // Gap: Category has low pass rate
      else if (coverage.passRate < 50) {
        gaps.push({
          category,
          description: `Low ${category} pass rate (${coverage.passRate.toFixed(1)}%)`,
          severity: coverage.passRate < 25 ? 'critical' : 'warning',
          affectedImplementations: [implName],
        });
      }
    }
  }

  // Merge similar gaps across implementations
  const mergedGaps = new Map<string, CoverageGap>();
  for (const gap of gaps) {
    const key = `${gap.category}:${gap.description}`;
    const existing = mergedGaps.get(key);
    if (existing) {
      existing.affectedImplementations.push(...gap.affectedImplementations);
    } else {
      mergedGaps.set(key, { ...gap });
    }
  }

  return Array.from(mergedGaps.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format coverage metrics for display
 */
export function formatCoverage(metrics: CoverageMetrics): string {
  const lines: string[] = [
    `Pass Rate: ${metrics.passRate.toFixed(1)}% (${metrics.passed}/${metrics.total})`,
    ``,
    `By Category:`,
  ];

  for (const [category, coverage] of metrics.byCategory) {
    if (coverage.total > 0) {
      const bar = createProgressBar(coverage.passRate, 20);
      lines.push(`  ${category.padEnd(15)} ${bar} ${coverage.passed}/${coverage.total}`);
    }
  }

  if (metrics.failures.length > 0) {
    lines.push(``);
    lines.push(`Failures (${metrics.failures.length}):`);
    for (const failure of metrics.failures.slice(0, 5)) {
      lines.push(`  ✗ ${failure.name}`);
      if (failure.error) {
        lines.push(`    ${failure.error.slice(0, 60)}`);
      }
    }
    if (metrics.failures.length > 5) {
      lines.push(`  ... and ${metrics.failures.length - 5} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a text progress bar
 */
function createProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Format coverage comparison table
 */
export function formatCoverageTable(result: CoverageResult): string {
  const lines: string[] = [];
  const implNames = Array.from(result.byImplementation.keys());

  // Header
  lines.push('Implementation'.padEnd(20) + 'Pass%'.padStart(8) + 
    'Passed'.padStart(8) + 'Failed'.padStart(8) + 'Total'.padStart(8));
  lines.push('-'.repeat(52));

  // Rows
  for (const name of implNames) {
    const metrics = result.byImplementation.get(name)!;
    const isBest = name === result.comparison.bestCoverage.name;
    
    const row = [
      (isBest ? '★ ' : '  ') + name.slice(0, 16).padEnd(18),
      `${metrics.passRate.toFixed(1)}%`.padStart(8),
      metrics.passed.toString().padStart(8),
      metrics.failed.toString().padStart(8),
      metrics.total.toString().padStart(8),
    ].join('');
    
    lines.push(row);
  }

  // Divergent tests
  if (result.divergentTests.length > 0) {
    lines.push('');
    lines.push(`Divergent Tests (${result.divergentTests.length}):`);
    for (const test of result.divergentTests.slice(0, 5)) {
      const passing = Array.from(test.results.entries())
        .filter(([, passed]) => passed)
        .map(([name]) => name)
        .join(', ');
      lines.push(`  ${test.testName}: passes for [${passing}]`);
    }
    if (result.divergentTests.length > 5) {
      lines.push(`  ... and ${result.divergentTests.length - 5} more`);
    }
  }

  return lines.join('\n');
}
