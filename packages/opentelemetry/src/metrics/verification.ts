import {
  MeterProvider,
  Counter,
  Histogram,
  Meter,
} from '@opentelemetry/sdk-metrics';
import { Attributes } from '@opentelemetry/api';
import { VerificationVerdict, CheckType } from '../semantic-attributes';

/**
 * Verification metrics collector
 */
export class VerificationMetrics {
  private meter: Meter;

  // Counters
  private verificationTotal: Counter;
  private verificationByVerdict: Counter;
  private checkTotal: Counter;
  private checkByResult: Counter;

  // Histograms
  private verificationDuration: Histogram;
  private checkDuration: Histogram;
  private verificationScore: Histogram;

  constructor(meterProvider?: MeterProvider) {
    const provider = meterProvider ?? new MeterProvider();
    this.meter = provider.getMeter('isl-verification-metrics', '1.0.0');

    // Initialize counters
    this.verificationTotal = this.meter.createCounter('isl_verification_total', {
      description: 'Total number of verifications executed',
      unit: '1',
    });

    this.verificationByVerdict = this.meter.createCounter('isl_verification_by_verdict', {
      description: 'Verifications by verdict (pass/fail/error/skip)',
      unit: '1',
    });

    this.checkTotal = this.meter.createCounter('isl_check_total', {
      description: 'Total number of checks executed',
      unit: '1',
    });

    this.checkByResult = this.meter.createCounter('isl_check_by_result', {
      description: 'Checks by result (pass/fail)',
      unit: '1',
    });

    // Initialize histograms
    this.verificationDuration = this.meter.createHistogram(
      'isl_verification_duration_seconds',
      {
        description: 'Verification duration in seconds',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
          ],
        },
      }
    );

    this.checkDuration = this.meter.createHistogram('isl_check_duration_seconds', {
      description: 'Check duration in seconds',
      unit: 's',
      advice: {
        explicitBucketBoundaries: [
          0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
        ],
      },
    });

    this.verificationScore = this.meter.createHistogram('isl_verification_score', {
      description: 'Verification trust score distribution',
      unit: '1',
      advice: {
        explicitBucketBoundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      },
    });
  }

  /**
   * Record a verification execution
   */
  recordVerification(
    domain: string,
    behavior: string,
    verdict: VerificationVerdict,
    duration: number,
    score?: number
  ): void {
    const attributes: Attributes = {
      domain,
      behavior,
    };

    const verdictAttributes: Attributes = {
      ...attributes,
      verdict,
    };

    this.verificationTotal.add(1, attributes);
    this.verificationByVerdict.add(1, verdictAttributes);
    this.verificationDuration.record(duration / 1000, attributes);

    if (score !== undefined) {
      this.verificationScore.record(score, attributes);
    }
  }

  /**
   * Record a check execution
   */
  recordCheck(
    type: CheckType,
    passed: boolean,
    duration: number,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      type,
      ...attributes,
    };

    const resultAttributes: Attributes = {
      ...baseAttributes,
      result: passed ? 'pass' : 'fail',
    };

    this.checkTotal.add(1, baseAttributes);
    this.checkByResult.add(1, resultAttributes);
    this.checkDuration.record(duration / 1000, baseAttributes);
  }

  /**
   * Record batch verification results
   */
  recordBatch(results: VerificationBatchResult): void {
    for (const result of results.verifications) {
      this.recordVerification(
        result.domain,
        result.behavior,
        result.verdict,
        result.duration,
        result.score
      );

      for (const check of result.checks ?? []) {
        this.recordCheck(check.type, check.passed, check.duration ?? 0, {
          domain: result.domain,
          behavior: result.behavior,
        });
      }
    }
  }
}

/**
 * Batch verification result structure
 */
export interface VerificationBatchResult {
  verifications: Array<{
    domain: string;
    behavior: string;
    verdict: VerificationVerdict;
    duration: number;
    score?: number;
    checks?: Array<{
      type: CheckType;
      passed: boolean;
      duration?: number;
    }>;
  }>;
}

/**
 * Create verification metrics instance
 */
export function createVerificationMetrics(
  meterProvider?: MeterProvider
): VerificationMetrics {
  return new VerificationMetrics(meterProvider);
}
