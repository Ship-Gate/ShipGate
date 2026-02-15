/**
 * Minimal pipeline types for certificate adapter
 *
 * Avoids hard dependency on @isl-lang/core.
 */

export interface PipelineResult {
  status: string;
  report: {
    specFingerprint: string;
    clauseResults?: unknown[];
    artifacts?: unknown[];
    scoreSummary: {
      overallScore: number;
      passCount: number;
      totalClauses: number;
      passRate: number;
      recommendation: 'ship' | 'review' | 'block';
    };
    /** Security scan results (from verification pipeline) */
    securityScan?: {
      hasBlockingFindings: boolean;
      hasWarnings: boolean;
      summary: { critical: number; high: number; medium: number; low: number };
      checks: Array<{ check: string; passed: boolean; findingCount: number }>;
    };
    [key: string]: unknown;
  };
  steps: Record<string, { durationMs?: number; success?: boolean; data?: unknown } | undefined>;
  totalDurationMs: number;
}
