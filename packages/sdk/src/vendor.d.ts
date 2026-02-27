/**
 * Local type declarations for workspace dependencies whose DTS
 * builds may not be available at SDK build time.
 *
 * These types mirror the minimal surface the SDK actually uses.
 */

declare module '@isl-lang/core/spec-quality' {
  import type { Domain } from '@isl-lang/parser';

  export interface DimensionScore {
    score: number;
    findings: string[];
  }

  export interface QualitySuggestion {
    dimension: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    example?: string;
  }

  export interface SpecQualityReport {
    file: string;
    overallScore: number;
    dimensions: {
      completeness: DimensionScore;
      specificity: DimensionScore;
      security: DimensionScore;
      testability: DimensionScore;
      consistency: DimensionScore;
    };
    suggestions: QualitySuggestion[];
    durationMs: number;
  }

  export interface SpecQualityOptions {
    minScore?: number;
    skipDimensions?: string[];
    weights?: Partial<Record<string, number>>;
  }

  export function scoreSpec(
    domain: Domain,
    file: string,
    options?: SpecQualityOptions,
  ): SpecQualityReport;
}
