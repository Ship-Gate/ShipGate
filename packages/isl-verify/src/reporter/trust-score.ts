/**
 * Trust Score Calculator
 * 
 * Calculates trust scores for implementations based on verification results.
 */

import type { TestResult, TestDetail } from '../runner/test-runner.js';

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
}

export interface CategoryScore {
  score: number;             // 0-100
  passed: number;
  failed: number;
  total: number;
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
    const postconditions = this.calculateCategoryScore(categories.postconditions);
    const invariants = this.calculateCategoryScore(categories.invariants);
    const scenarios = this.calculateCategoryScore(categories.scenarios);
    const temporal = this.calculateCategoryScore(categories.temporal);

    // Calculate weighted overall score
    const totalWeight = this.weights.postconditions + this.weights.invariants + 
                       this.weights.scenarios + this.weights.temporal;
    
    const overall = Math.round(
      (postconditions.score * this.weights.postconditions +
       invariants.score * this.weights.invariants +
       scenarios.score * this.weights.scenarios +
       temporal.score * this.weights.temporal) / totalWeight
    );

    // Calculate confidence based on test coverage
    const totalTests = testResult.passed + testResult.failed + testResult.skipped;
    const confidence = this.calculateConfidence(totalTests, testResult.skipped);

    // Determine recommendation
    const recommendation = this.determineRecommendation(overall, testResult.failed);

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
   * Calculate score for a category
   */
  private calculateCategoryScore(tests: TestDetail[]): CategoryScore {
    if (tests.length === 0) {
      return { score: 100, passed: 0, failed: 0, total: 0 };
    }

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const total = tests.length;

    const score = Math.round((passed / total) * 100);

    return { score, passed, failed, total };
  }

  /**
   * Calculate confidence based on test coverage
   */
  private calculateConfidence(totalTests: number, skippedTests: number): number {
    if (totalTests === 0) return 0;
    
    // Base confidence on number of tests and skip rate
    const skipRate = skippedTests / totalTests;
    const coverageFactor = Math.min(totalTests / 10, 1); // Max confidence at 10+ tests
    
    return Math.round((1 - skipRate) * coverageFactor * 100);
  }

  /**
   * Determine recommendation based on score and failures
   */
  private determineRecommendation(overall: number, failures: number): Recommendation {
    // Critical failures override score
    if (failures > 0 && overall < this.thresholds.shadow) {
      return 'critical_issues';
    }

    if (overall >= this.thresholds.production) {
      return 'production_ready';
    }
    
    if (overall >= this.thresholds.staging) {
      return 'staging_recommended';
    }
    
    if (overall >= this.thresholds.shadow) {
      return 'shadow_mode';
    }
    
    return 'not_ready';
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
    breakdown: {
      postconditions: {
        score: score.breakdown.postconditions.score,
        passed: score.breakdown.postconditions.passed,
        failed: score.breakdown.postconditions.failed,
      },
      invariants: {
        score: score.breakdown.invariants.score,
        passed: score.breakdown.invariants.passed,
        failed: score.breakdown.invariants.failed,
      },
      scenarios: {
        score: score.breakdown.scenarios.score,
        passed: score.breakdown.scenarios.passed,
        failed: score.breakdown.scenarios.failed,
      },
      temporal: {
        score: score.breakdown.temporal.score,
        passed: score.breakdown.temporal.passed,
        failed: score.breakdown.temporal.failed,
      },
    },
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
