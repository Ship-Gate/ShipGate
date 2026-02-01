// ============================================================================
// Metrics Collector - Collect metrics from verifiers
// ============================================================================

import type {
  VerifyMetricResult,
  ChaosMetricResult,
  TrustScoreMetric,
  Verdict,
  CoverageInfo,
} from './types';

/**
 * Verifier result that can be collected
 */
export interface VerifierResult {
  success: boolean;
  verdict: Verdict;
  score: number;
  behaviorName: string;
  inputUsed: {
    category: string;
    name: string;
  };
  execution: {
    duration: number;
  };
  coverage: {
    preconditions: { passed: number; total: number };
    postconditions: { passed: number; total: number };
    invariants: { passed: number; total: number };
    overall: number;
  };
  timing: {
    total: number;
    execution: number;
  };
}

/**
 * Chaos verifier result
 */
export interface ChaosVerifierResult {
  scenario: string;
  passed: boolean;
  duration: number;
}

/**
 * Collector callback
 */
export type CollectorCallback = (result: VerifyMetricResult) => void;

/**
 * Chaos collector callback
 */
export type ChaosCollectorCallback = (result: ChaosMetricResult) => void;

/**
 * Collector configuration
 */
export interface CollectorConfig {
  /** Domain name for collected metrics */
  domain: string;
  
  /** Callback for verification results */
  onVerification?: CollectorCallback;
  
  /** Callback for chaos results */
  onChaos?: ChaosCollectorCallback;
  
  /** Auto-calculate trust scores */
  autoTrust?: boolean;
}

/**
 * Metrics collector that transforms verifier results into metric results
 */
export class MetricsCollector {
  private config: CollectorConfig;
  private verificationCallback?: CollectorCallback;
  private chaosCallback?: ChaosCollectorCallback;
  private trustCallback?: (metric: TrustScoreMetric) => void;
  
  // Track for trust calculation
  private behaviorScores = new Map<string, number[]>();

  constructor(config: CollectorConfig) {
    this.config = config;
    this.verificationCallback = config.onVerification;
    this.chaosCallback = config.onChaos;
  }

  /**
   * Set verification callback
   */
  onVerification(callback: CollectorCallback): this {
    this.verificationCallback = callback;
    return this;
  }

  /**
   * Set chaos callback
   */
  onChaos(callback: ChaosCollectorCallback): this {
    this.chaosCallback = callback;
    return this;
  }

  /**
   * Set trust score callback
   */
  onTrustScore(callback: (metric: TrustScoreMetric) => void): this {
    this.trustCallback = callback;
    return this;
  }

  /**
   * Collect a verification result
   */
  collect(result: VerifierResult): VerifyMetricResult {
    const metricResult = this.transformVerification(result);
    
    // Track for trust calculation
    this.trackScore(result.behaviorName, result.score);
    
    // Call callback if set
    if (this.verificationCallback) {
      this.verificationCallback(metricResult);
    }
    
    // Auto-calculate trust if enabled
    if (this.config.autoTrust && this.trustCallback) {
      const trustScore = this.calculateTrustScore();
      this.trustCallback({
        domain: this.config.domain,
        score: trustScore,
      });
    }
    
    return metricResult;
  }

  /**
   * Collect a chaos test result
   */
  collectChaos(result: ChaosVerifierResult): ChaosMetricResult {
    const metricResult = this.transformChaos(result);
    
    if (this.chaosCallback) {
      this.chaosCallback(metricResult);
    }
    
    return metricResult;
  }

  /**
   * Transform verifier result to metric result
   */
  private transformVerification(result: VerifierResult): VerifyMetricResult {
    return {
      domain: this.config.domain,
      behavior: result.behaviorName,
      verdict: result.verdict,
      score: result.score,
      duration: result.timing.total / 1000, // Convert ms to seconds
      coverage: this.transformCoverage(result.coverage),
    };
  }

  /**
   * Transform chaos result to metric result
   */
  private transformChaos(result: ChaosVerifierResult): ChaosMetricResult {
    return {
      domain: this.config.domain,
      scenario: result.scenario,
      result: result.passed ? 'pass' : 'fail',
      duration: result.duration / 1000, // Convert ms to seconds
    };
  }

  /**
   * Transform coverage info
   */
  private transformCoverage(coverage: VerifierResult['coverage']): CoverageInfo {
    return {
      preconditions: this.calculateRatio(coverage.preconditions),
      postconditions: this.calculateRatio(coverage.postconditions),
      invariants: this.calculateRatio(coverage.invariants),
    };
  }

  private calculateRatio(coverage: { passed: number; total: number }): number {
    if (coverage.total === 0) return 1;
    return coverage.passed / coverage.total;
  }

  /**
   * Track score for trust calculation
   */
  private trackScore(behavior: string, score: number): void {
    if (!this.behaviorScores.has(behavior)) {
      this.behaviorScores.set(behavior, []);
    }
    
    const scores = this.behaviorScores.get(behavior)!;
    scores.push(score);
    
    // Keep only recent scores
    if (scores.length > 100) {
      scores.shift();
    }
  }

  /**
   * Calculate overall trust score for domain
   */
  calculateTrustScore(): number {
    if (this.behaviorScores.size === 0) {
      return 100;
    }
    
    let totalScore = 0;
    let behaviorCount = 0;
    
    for (const scores of this.behaviorScores.values()) {
      if (scores.length > 0) {
        // Use average of recent scores for each behavior
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        totalScore += avg;
        behaviorCount++;
      }
    }
    
    return behaviorCount > 0 ? totalScore / behaviorCount : 100;
  }

  /**
   * Reset collector state
   */
  reset(): void {
    this.behaviorScores.clear();
  }
}

/**
 * Create a metrics collector
 */
export function createCollector(config: CollectorConfig): MetricsCollector {
  return new MetricsCollector(config);
}

/**
 * Batch collector for multiple domains
 */
export class BatchCollector {
  private collectors = new Map<string, MetricsCollector>();
  private verificationCallback?: CollectorCallback;
  private chaosCallback?: ChaosCollectorCallback;

  /**
   * Set verification callback for all collectors
   */
  onVerification(callback: CollectorCallback): this {
    this.verificationCallback = callback;
    for (const collector of this.collectors.values()) {
      collector.onVerification(callback);
    }
    return this;
  }

  /**
   * Set chaos callback for all collectors
   */
  onChaos(callback: ChaosCollectorCallback): this {
    this.chaosCallback = callback;
    for (const collector of this.collectors.values()) {
      collector.onChaos(callback);
    }
    return this;
  }

  /**
   * Get or create collector for domain
   */
  forDomain(domain: string): MetricsCollector {
    if (!this.collectors.has(domain)) {
      const collector = new MetricsCollector({ domain });
      
      if (this.verificationCallback) {
        collector.onVerification(this.verificationCallback);
      }
      if (this.chaosCallback) {
        collector.onChaos(this.chaosCallback);
      }
      
      this.collectors.set(domain, collector);
    }
    
    return this.collectors.get(domain)!;
  }

  /**
   * Collect verification result with domain
   */
  collect(domain: string, result: VerifierResult): VerifyMetricResult {
    return this.forDomain(domain).collect(result);
  }

  /**
   * Collect chaos result with domain
   */
  collectChaos(domain: string, result: ChaosVerifierResult): ChaosMetricResult {
    return this.forDomain(domain).collectChaos(result);
  }

  /**
   * Get all trust scores
   */
  getAllTrustScores(): Map<string, number> {
    const scores = new Map<string, number>();
    
    for (const [domain, collector] of this.collectors) {
      scores.set(domain, collector.calculateTrustScore());
    }
    
    return scores;
  }

  /**
   * Reset all collectors
   */
  reset(): void {
    for (const collector of this.collectors.values()) {
      collector.reset();
    }
  }
}

/**
 * Create a batch collector
 */
export function createBatchCollector(): BatchCollector {
  return new BatchCollector();
}
