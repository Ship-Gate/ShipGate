/**
 * Coverage Analyzer
 * 
 * Tracks contract coverage during testing.
 */

import type { DomainSpec, BehaviorSpec } from './tester.js';

// ============================================================================
// Types
// ============================================================================

export interface CoverageReport {
  preconditions: number;
  postconditions: number;
  errorPaths: number;
  invariants: number;
  behaviors: number;
  overall: number;
  details: CoverageDetails;
}

export interface CoverageDetails {
  behaviors: Map<string, BehaviorCoverage>;
  invariants: Map<string, boolean>;
}

export interface BehaviorCoverage {
  preconditions: { total: number; covered: number; items: string[] };
  postconditions: { total: number; covered: number; items: string[] };
  errors: { total: number; covered: number; items: string[] };
  executed: boolean;
}

// ============================================================================
// Coverage Analyzer
// ============================================================================

export class CoverageAnalyzer {
  private spec: DomainSpec | null = null;
  private executions: Map<string, Set<string>> = new Map();
  private coverage: CoverageDetails = {
    behaviors: new Map(),
    invariants: new Map(),
  };

  /**
   * Register spec for coverage tracking
   */
  registerSpec(spec: DomainSpec): void {
    this.spec = spec;
    this.executions.clear();

    // Initialize coverage tracking
    for (const behavior of spec.behaviors) {
      this.coverage.behaviors.set(behavior.name, {
        preconditions: {
          total: behavior.preconditions.length,
          covered: 0,
          items: behavior.preconditions,
        },
        postconditions: {
          total: behavior.postconditions.length,
          covered: 0,
          items: behavior.postconditions.map(p => p.guard),
        },
        errors: {
          total: behavior.output?.errors.length || 0,
          covered: 0,
          items: behavior.output?.errors.map(e => e.name) || [],
        },
        executed: false,
      });
    }

    for (const invariant of spec.invariants) {
      this.coverage.invariants.set(invariant.name, false);
    }
  }

  /**
   * Record test execution
   */
  recordExecution(behavior: string, test: string): void {
    if (!this.executions.has(behavior)) {
      this.executions.set(behavior, new Set());
    }
    this.executions.get(behavior)!.add(test);

    const cov = this.coverage.behaviors.get(behavior);
    if (cov) {
      cov.executed = true;

      // Update coverage based on test type
      if (test.startsWith('precondition_')) {
        const predicate = test.replace('precondition_', '');
        if (cov.preconditions.items.some(p => this.sanitize(p) === predicate)) {
          cov.preconditions.covered++;
        }
      } else if (test.startsWith('postcondition_')) {
        const guard = test.replace('postcondition_', '');
        if (cov.postconditions.items.some(p => this.sanitize(p) === guard)) {
          cov.postconditions.covered++;
        }
      } else if (test.startsWith('error_')) {
        const errorName = test.replace('error_', '');
        if (cov.errors.items.includes(errorName)) {
          cov.errors.covered++;
        }
      }
    }
  }

  /**
   * Record invariant check
   */
  recordInvariantCheck(name: string): void {
    this.coverage.invariants.set(name, true);
  }

  /**
   * Get coverage report
   */
  getReport(): CoverageReport {
    let totalPreconditions = 0;
    let coveredPreconditions = 0;
    let totalPostconditions = 0;
    let coveredPostconditions = 0;
    let totalErrors = 0;
    let coveredErrors = 0;
    let executedBehaviors = 0;

    for (const cov of this.coverage.behaviors.values()) {
      totalPreconditions += cov.preconditions.total;
      coveredPreconditions += cov.preconditions.covered;
      totalPostconditions += cov.postconditions.total;
      coveredPostconditions += cov.postconditions.covered;
      totalErrors += cov.errors.total;
      coveredErrors += cov.errors.covered;
      if (cov.executed) executedBehaviors++;
    }

    let coveredInvariants = 0;
    for (const covered of this.coverage.invariants.values()) {
      if (covered) coveredInvariants++;
    }

    const preconditionsCoverage = totalPreconditions > 0
      ? (coveredPreconditions / totalPreconditions) * 100
      : 100;
    const postconditionsCoverage = totalPostconditions > 0
      ? (coveredPostconditions / totalPostconditions) * 100
      : 100;
    const errorCoverage = totalErrors > 0
      ? (coveredErrors / totalErrors) * 100
      : 100;
    const invariantsCoverage = this.coverage.invariants.size > 0
      ? (coveredInvariants / this.coverage.invariants.size) * 100
      : 100;
    const behaviorsCoverage = this.coverage.behaviors.size > 0
      ? (executedBehaviors / this.coverage.behaviors.size) * 100
      : 100;

    const overall = (
      preconditionsCoverage +
      postconditionsCoverage +
      errorCoverage +
      invariantsCoverage +
      behaviorsCoverage
    ) / 5;

    return {
      preconditions: preconditionsCoverage,
      postconditions: postconditionsCoverage,
      errorPaths: errorCoverage,
      invariants: invariantsCoverage,
      behaviors: behaviorsCoverage,
      overall,
      details: this.coverage,
    };
  }

  /**
   * Get detailed behavior coverage
   */
  getBehaviorCoverage(behavior: string): BehaviorCoverage | undefined {
    return this.coverage.behaviors.get(behavior);
  }

  /**
   * Check if coverage meets threshold
   */
  meetsThreshold(threshold: number): boolean {
    const report = this.getReport();
    return report.overall >= threshold;
  }

  /**
   * Get uncovered items
   */
  getUncoveredItems(): {
    preconditions: string[];
    postconditions: string[];
    errors: string[];
    invariants: string[];
    behaviors: string[];
  } {
    const uncovered = {
      preconditions: [] as string[],
      postconditions: [] as string[],
      errors: [] as string[],
      invariants: [] as string[],
      behaviors: [] as string[],
    };

    for (const [name, cov] of this.coverage.behaviors) {
      if (!cov.executed) {
        uncovered.behaviors.push(name);
      }
      // Would track individual uncovered items in real implementation
    }

    for (const [name, covered] of this.coverage.invariants) {
      if (!covered) {
        uncovered.invariants.push(name);
      }
    }

    return uncovered;
  }

  /**
   * Reset coverage data
   */
  reset(): void {
    this.executions.clear();
    if (this.spec) {
      this.registerSpec(this.spec);
    }
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }
}
