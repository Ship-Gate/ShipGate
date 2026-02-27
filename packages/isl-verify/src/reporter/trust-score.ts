/**
 * Trust Score Calculator
 * 
 * Calculates trust scores for implementations based on verification results.
 */

import type { TestResult, TestDetail } from '../runner/test-runner';

export interface TrustScore {
  overall: number;           // 0-100
  confidence: number;        // 0-100, based on test coverage
  breakdown: {
    postconditions: CategoryScore;
    invariants: CategoryScore;
    scenarios: CategoryScore;
    temporal: CategoryScore;
  };
  recommendation: Recommendation;
  details: TrustDetail[];
  /** True when score was capped because results came from execution-proof fallback */
  fallbackCapped?: boolean;
}

export interface CategoryScore {
  score: number;             // 0-100, composite from coverage/execution/pass
  coverage_score: number;    // 0-100, % of required checks present
  execution_score: number;   // 0-100, % of checks that actually executed
  pass_score: number;        // 0-100, % passed among executed
  passed: number;
  failed: number;
  unknown: number;           // tracked separately from fail (skipped/unverified)
  total: number;
  gaps: string[];            // missing postconditions, no error cases, etc.
  confidence: number;        // 0-1, derived from inference + execution coverage
}

export type Recommendation = 
  | 'production_ready'
  | 'staging_recommended' 
  | 'shadow_mode'
  | 'not_ready'
  | 'critical_issues';

export interface TrustDetail {
  category: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  impact: 'critical' | 'high' | 'medium' | 'low';
  message?: string;
}

export interface TrustCalculatorOptions {
  weights?: {
    postconditions?: number;
    invariants?: number;
    scenarios?: number;
    temporal?: number;
  };
  thresholds?: {
    production?: number;
    staging?: number;
    shadow?: number;
  };
}

export class TrustCalculator {
  private weights: Required<NonNullable<TrustCalculatorOptions['weights']>>;
  private thresholds: Required<NonNullable<TrustCalculatorOptions['thresholds']>>;

  constructor(options: TrustCalculatorOptions = {}) {
    this.weights = {
      postconditions: options.weights?.postconditions ?? 40,
      invariants: options.weights?.invariants ?? 30,
      scenarios: options.weights?.scenarios ?? 20,
      temporal: options.weights?.temporal ?? 10,
    };

    this.thresholds = {
      production: options.thresholds?.production ?? 95,
      staging: options.thresholds?.staging ?? 85,
      shadow: options.thresholds?.shadow ?? 70,
    };
  }

  /**
   * Calculate trust score from test results
   */
  calculate(testResult: TestResult): TrustScore {
    // Use pre-categorized results if available, otherwise categorize
    const categories = testResult.categories 
      ? {
          postconditions: testResult.categories.postconditions,
          invariants: testResult.categories.invariants,
          scenarios: testResult.categories.scenarios,
          temporal: testResult.categories.temporal,
          // Merge chaos into scenarios for backwards compatibility
          ...(testResult.categories.chaos?.length 
            ? { scenarios: [...testResult.categories.scenarios, ...testResult.categories.chaos] }
            : {})
        }
      : this.categorizeTests(testResult.details);

    // Calculate category scores
    const postconditions = this.calculateCategoryScore(categories.postconditions, 'postconditions');
    const invariants = this.calculateCategoryScore(categories.invariants, 'invariants');
    const scenarios = this.calculateCategoryScore(categories.scenarios, 'scenarios');
    const temporal = this.calculateCategoryScore(categories.temporal, 'temporal');

    // Calculate weighted overall score
    const totalWeight = this.weights.postconditions + this.weights.invariants + 
                       this.weights.scenarios + this.weights.temporal;
    
    let overall = Math.round(
      (postconditions.score * this.weights.postconditions +
       invariants.score * this.weights.invariants +
       scenarios.score * this.weights.scenarios +
       temporal.score * this.weights.temporal) / totalWeight
    );

    // Calculate confidence based on test coverage
    // Synthetic tests contribute 0 execution credit
    const syntheticCount = testResult.details.filter(d => d.synthetic).length;
    const totalTests = testResult.passed + testResult.failed + testResult.skipped;
    const confidence = this.calculateConfidence(totalTests, testResult.skipped, syntheticCount);

    // ──────────────────────────────────────────────────────────────────────
    // VERIFICATION BLOCKED: If test execution itself failed, force NO_SHIP.
    // Trust score tanks. Output explains why.
    // ──────────────────────────────────────────────────────────────────────
    if (testResult.verificationFailed) {
      const reason = testResult.verificationFailureReason ?? 'Verification blocked: tests did not run';
      return {
        overall: 0,
        confidence: 0,
        breakdown: { postconditions, invariants, scenarios, temporal },
        recommendation: 'critical_issues',
        details: [{
          category: 'verification',
          name: 'execution_blocked',
          status: 'failed',
          impact: 'critical',
          message: reason,
        }],
      };
    }

    // Aggregate gaps and detect critical missing categories
    const allGaps = [
      ...postconditions.gaps.map(g => `postconditions: ${g}`),
      ...invariants.gaps.map(g => `invariants: ${g}`),
      ...scenarios.gaps.map(g => `scenarios: ${g}`),
      ...temporal.gaps.map(g => `temporal: ${g}`),
    ];
    const hasCriticalGaps = postconditions.total === 0 || invariants.total === 0;

    // Determine recommendation using honest verdict mapping
    let recommendation = this.determineRecommendation(overall, testResult.failed, confidence, allGaps, hasCriticalGaps);

    // ──────────────────────────────────────────────────────────────────────
    // CRITICAL INVARIANT: Execution-proof fallback evidence can NEVER
    // produce a SHIP-worthy verdict.  Cap score at 69 (below shadow
    // threshold) and clamp recommendation to at-best 'not_ready'.
    // Full unit tests are required for anything higher.
    // ──────────────────────────────────────────────────────────────────────
    const FALLBACK_SCORE_CAP = 69;
    const FALLBACK_BEST_RECOMMENDATION: Recommendation = 'not_ready';
    let cappedByFallback = false;

    if (testResult.fallbackEvidence) {
      cappedByFallback = true;
      if (overall > FALLBACK_SCORE_CAP) {
        overall = FALLBACK_SCORE_CAP;
      }
      const allowedRecs: Recommendation[] = ['not_ready', 'critical_issues'];
      if (!allowedRecs.includes(recommendation)) {
        recommendation = FALLBACK_BEST_RECOMMENDATION;
      }
    }

    // Build details
    const details = this.buildDetails(testResult.details);

    return {
      overall,
      confidence,
      breakdown: {
        postconditions,
        invariants,
        scenarios,
        temporal,
      },
      recommendation,
      details,
      ...(cappedByFallback ? { fallbackCapped: true } : {}),
    };
  }

  /**
   * Categorize test results by type
   */
  private categorizeTests(details: TestDetail[]): {
    postconditions: TestDetail[];
    invariants: TestDetail[];
    scenarios: TestDetail[];
    temporal: TestDetail[];
  } {
    const categories = {
      postconditions: [] as TestDetail[],
      invariants: [] as TestDetail[],
      scenarios: [] as TestDetail[],
      temporal: [] as TestDetail[],
    };

    for (const detail of details) {
      const name = detail.name.toLowerCase();
      
      if (name.includes('postcondition') || name.includes('ensures')) {
        categories.postconditions.push(detail);
      } else if (name.includes('invariant') || name.includes('maintains')) {
        categories.invariants.push(detail);
      } else if (name.includes('temporal') || name.includes('within') || name.includes('eventually')) {
        categories.temporal.push(detail);
      } else {
        categories.scenarios.push(detail);
      }
    }

    return categories;
  }

  /**
   * Honest category scoring model.
   *
   * Per category:
   *   coverage_score:  % of required checks present (0-100)
   *   execution_score: % of checks that actually executed (0-100)
   *   pass_score:      % passed among executed (0-100)
   *
   *   score = floor( 0.45*coverage + 0.35*execution + 0.20*pass )
   *
   * Why: Missing coverage and non-execution are punished harder than failures.
   * A failing test is useful information. A missing test is blindness.
   * "unknown" (skipped) is tracked separately from "fail".
   * Synthetic tests are NON_EVIDENCE and contribute 0 execution credit.
   */
  private calculateCategoryScore(tests: TestDetail[], categoryName?: string): CategoryScore {
    // Filter out synthetic tests — they are NON_EVIDENCE
    const realTests = tests.filter(t => !t.synthetic);

    if (realTests.length === 0) {
      return {
        score: 0, coverage_score: 0, execution_score: 0, pass_score: 0,
        passed: 0, failed: 0, unknown: 0, total: 0,
        gaps: [`no ${categoryName ?? 'checks'} defined`], confidence: 0,
      };
    }

    const passed = realTests.filter(t => t.status === 'passed').length;
    const failed = realTests.filter(t => t.status === 'failed').length;
    const skipped = realTests.filter(t => t.status === 'skipped').length;
    const total = realTests.length;
    const executed = passed + failed; // skipped did NOT execute

    // coverage_score: tests exist → full coverage credit for this category
    const coverage_score = 100;

    // execution_score: % of declared checks that actually ran
    const execution_score = total > 0 ? Math.round((executed / total) * 100) : 0;

    // pass_score: % passed among those that executed
    const pass_score = executed > 0 ? Math.round((passed / executed) * 100) : 0;

    // Composite: punish missing coverage & non-execution harder than failures
    const score = Math.floor(
      0.45 * coverage_score + 0.35 * execution_score + 0.20 * pass_score
    );

    // Detect gaps
    const gaps: string[] = [];
    if (skipped > 0) gaps.push(`${skipped} skipped (unverified intent)`);
    if (failed > 0) gaps.push(`${failed} failing checks`);
    if (executed === 0) gaps.push('no checks executed');

    // Confidence: execution rate × volume factor
    const executionRate = total > 0 ? executed / total : 0;
    const volumeFactor = Math.min(total / 5, 1); // max confidence at 5+ tests
    const confidence = Math.round(executionRate * volumeFactor * 100) / 100;

    return {
      score, coverage_score, execution_score, pass_score,
      passed, failed, unknown: skipped, total, gaps, confidence,
    };
  }

  /**
   * Calculate confidence based on test coverage.
   * 0 tests = 0 confidence. All skipped = 0 confidence.
   * Confidence requires actually-passed tests.
   * Synthetic tests do not count toward confidence.
   */
  private calculateConfidence(totalTests: number, skippedTests: number, syntheticCount = 0): number {
    const realTotal = totalTests - syntheticCount;
    if (realTotal <= 0) return 0;
    
    const actuallyRan = realTotal - skippedTests;
    if (actuallyRan <= 0) return 0; // All skipped = no verification occurred
    
    const runRate = actuallyRan / realTotal;
    const coverageFactor = Math.min(actuallyRan / 10, 1); // Max confidence at 10+ real tests
    
    return Math.round(runRate * coverageFactor * 100);
  }

  /**
   * Verdict mapping (brutally honest):
   *   score >= 85 AND no critical gaps → SHIP (production_ready)
   *   score 60–84 OR gaps but mitigated → WARN (staging_recommended / shadow_mode)
   *   < 60 OR execution failed OR missing required categories → NO_SHIP (not_ready / critical_issues)
   */
  private determineRecommendation(
    overall: number,
    failures: number,
    confidence: number,
    gaps: string[] = [],
    hasCriticalGaps = false,
  ): Recommendation {
    // Zero confidence means nothing was verified — cannot recommend anything
    if (confidence === 0) {
      return failures > 0 ? 'critical_issues' : 'not_ready';
    }

    // Missing required categories (postconditions or invariants) → NO_SHIP
    if (hasCriticalGaps) {
      return overall >= 60 ? 'shadow_mode' : 'not_ready';
    }

    // < 60 → NO_SHIP
    if (overall < 60) {
      return failures > 0 ? 'critical_issues' : 'not_ready';
    }

    // 60-84 or has gaps → WARN
    if (overall < 85 || gaps.length > 0) {
      return overall >= 70 ? 'staging_recommended' : 'shadow_mode';
    }

    // >= 85 and no critical gaps → SHIP
    return 'production_ready';
  }

  /**
   * Build detailed trust breakdown
   */
  private buildDetails(testDetails: TestDetail[]): TrustDetail[] {
    return testDetails.map(test => ({
      category: this.categorizeTest(test.name),
      name: test.name,
      status: test.status,
      impact: this.determineImpact(test.name),
      message: test.error,
    }));
  }

  /**
   * Categorize a single test by name
   */
  private categorizeTest(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('postcondition') || lower.includes('ensures')) return 'postconditions';
    if (lower.includes('invariant') || lower.includes('maintains')) return 'invariants';
    if (lower.includes('temporal') || lower.includes('within')) return 'temporal';
    return 'scenarios';
  }

  /**
   * Determine impact level of a test
   */
  private determineImpact(name: string): 'critical' | 'high' | 'medium' | 'low' {
    const lower = name.toLowerCase();
    
    // Critical: security, data integrity, money
    if (lower.includes('security') || lower.includes('auth') || 
        lower.includes('money') || lower.includes('payment')) {
      return 'critical';
    }
    
    // High: invariants, postconditions
    if (lower.includes('invariant') || lower.includes('postcondition')) {
      return 'high';
    }
    
    // Medium: preconditions, validation
    if (lower.includes('precondition') || lower.includes('valid')) {
      return 'medium';
    }
    
    // Low: temporal, edge cases
    return 'low';
  }
}

/**
 * Calculate trust score from test results
 */
export function calculateTrustScore(
  testResult: TestResult,
  options?: TrustCalculatorOptions
): TrustScore {
  const calculator = new TrustCalculator(options);
  return calculator.calculate(testResult);
}

/**
 * Format trust score as JSON report
 */
export function formatTrustReport(score: TrustScore): string {
  return JSON.stringify({
    trust_score: score.overall,
    confidence: score.confidence,
    recommendation: score.recommendation,
    ...(score.fallbackCapped ? { fallback_evidence: true, fallback_capped: true } : {}),
    breakdown: Object.fromEntries(
      Object.entries(score.breakdown).map(([key, cat]) => [key, {
        score: cat.score,
        coverage_score: cat.coverage_score,
        execution_score: cat.execution_score,
        pass_score: cat.pass_score,
        passed: cat.passed,
        failed: cat.failed,
        unknown: cat.unknown,
        total: cat.total,
        gaps: cat.gaps,
        confidence: cat.confidence,
      }])
    ),
    failures: score.details
      .filter(d => d.status === 'failed')
      .map(d => ({
        category: d.category,
        name: d.name,
        impact: d.impact,
        error: d.message,
      })),
  }, null, 2);
}
