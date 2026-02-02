// ============================================================================
// Verification Integration
// ============================================================================

import * as Sentry from '@sentry/node';
import type { Integration, Event, EventHint } from '@sentry/types';

import type { VerifyResult, ISLContext, Verdict } from '../types';

/**
 * Verification Integration for Sentry
 *
 * This integration specifically handles verification results
 * and provides detailed tracking of verification outcomes.
 */
export class VerificationIntegration implements Integration {
  static id = 'ISLVerification';
  name = VerificationIntegration.id;

  private verdictCounts: Record<Verdict, number> = {
    verified: 0,
    risky: 0,
    unsafe: 0,
  };

  /**
   * Setup the integration
   */
  setupOnce(): void {
    Sentry.addEventProcessor((event: Event, hint?: EventHint) => {
      return this.processEvent(event, hint);
    });
  }

  /**
   * Process verification-related events
   */
  processEvent(event: Event, _hint?: EventHint): Event | null {
    // Check if this is a verification event
    const verificationContext = event.contexts?.verification as
      | Record<string, unknown>
      | undefined;

    if (!verificationContext) {
      return event;
    }

    // Track verdict counts
    const verdict = verificationContext.verdict as Verdict;
    if (verdict && verdict in this.verdictCounts) {
      this.verdictCounts[verdict]++;
    }

    // Enhance event with verification metrics
    event.extra = {
      ...event.extra,
      verification_metrics: {
        total_verifications: Object.values(this.verdictCounts).reduce((a, b) => a + b, 0),
        verdict_distribution: { ...this.verdictCounts },
      },
    };

    return event;
  }

  /**
   * Record a verification result
   */
  recordVerification(result: VerifyResult): void {
    // Update verdict counts
    this.verdictCounts[result.verdict]++;

    // Set context
    Sentry.setContext('isl.verification', {
      domain: result.domain,
      behavior: result.behavior,
      verdict: result.verdict,
      score: result.score,
      coverage: result.coverage,
      failed_count: result.failed.length,
      passed_count: result.passed.length,
    });

    // Add breadcrumbs for failed checks
    for (const failed of result.failed) {
      Sentry.addBreadcrumb({
        category: 'isl.check.failed',
        message: `${failed.category}: ${failed.name}`,
        level: 'warning',
        data: {
          type: failed.category,
          expression: failed.expression,
          error: failed.error,
        },
      });
    }

    // Add summary breadcrumb
    Sentry.addBreadcrumb({
      category: 'isl.verification',
      message: `Verification ${result.verdict}: ${result.domain}.${result.behavior}`,
      level: result.verdict === 'unsafe' ? 'error' : result.verdict === 'risky' ? 'warning' : 'info',
      data: {
        domain: result.domain,
        behavior: result.behavior,
        verdict: result.verdict,
        score: result.score,
        failed: result.failed.length,
        passed: result.passed.length,
      },
    });

    // Capture as error if unsafe
    if (result.verdict === 'unsafe') {
      Sentry.captureMessage(
        `Verification failed: ${result.domain}.${result.behavior}`,
        {
          level: 'error',
          tags: {
            'isl.domain': result.domain,
            'isl.behavior': result.behavior,
            'isl.verdict': result.verdict,
          },
          contexts: {
            isl: {
              domain: result.domain,
              behavior: result.behavior,
              timestamp: Date.now(),
            } satisfies ISLContext,
            verification: {
              score: result.score,
              coverage: result.coverage,
              failed_checks: result.failed.map((f) => ({
                name: f.name,
                category: f.category,
                expression: f.expression,
              })),
            },
          },
          fingerprint: [
            '{{ default }}',
            result.domain,
            result.behavior,
            'verification',
            result.verdict,
          ],
        }
      );
    }
  }

  /**
   * Get verdict statistics
   */
  getVerdictStats(): Record<Verdict, number> {
    return { ...this.verdictCounts };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.verdictCounts = {
      verified: 0,
      risky: 0,
      unsafe: 0,
    };
  }
}

/**
 * Create verification integration instance
 */
export function createVerificationIntegration(): VerificationIntegration {
  return new VerificationIntegration();
}

/**
 * Global verification integration instance
 */
let globalVerificationIntegration: VerificationIntegration | null = null;

/**
 * Get or create the global verification integration
 */
export function getVerificationIntegration(): VerificationIntegration {
  if (!globalVerificationIntegration) {
    globalVerificationIntegration = new VerificationIntegration();
  }
  return globalVerificationIntegration;
}

/**
 * Record a verification result using the global integration
 */
export function recordVerification(result: VerifyResult): void {
  getVerificationIntegration().recordVerification(result);
}
