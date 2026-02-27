/**
 * ISL Spec Quality Scorer — Type Definitions
 *
 * Types for scoring ISL specifications across five quality dimensions:
 * completeness, specificity, security, testability, and consistency.
 */

import type { Domain } from '@isl-lang/parser';

// ============================================================================
// Quality Dimensions
// ============================================================================

/**
 * The five quality dimensions scored for every ISL spec.
 */
export type QualityDimension =
  | 'completeness'
  | 'specificity'
  | 'security'
  | 'testability'
  | 'consistency';

// ============================================================================
// Scores
// ============================================================================

/**
 * Score for a single quality dimension.
 */
export interface DimensionScore {
  /** 0-100 numeric score */
  score: number;
  /** Human-readable findings (both positive and negative) */
  findings: string[];
}

// ============================================================================
// Suggestions
// ============================================================================

/**
 * An actionable suggestion for improving spec quality.
 */
export interface QualitySuggestion {
  /** Which dimension this suggestion relates to */
  dimension: QualityDimension;
  /** How important the suggestion is */
  severity: 'info' | 'warning' | 'critical';
  /** Human-readable description of the suggestion */
  message: string;
  /** Optional ISL code example to add */
  example?: string;
}

// ============================================================================
// Quality Report
// ============================================================================

/**
 * Full quality report for an ISL specification file.
 */
export interface SpecQualityReport {
  /** File that was scored */
  file: string;
  /** Overall composite score 0-100 */
  overallScore: number;
  /** Per-dimension breakdown */
  dimensions: {
    completeness: DimensionScore;
    specificity: DimensionScore;
    security: DimensionScore;
    testability: DimensionScore;
    consistency: DimensionScore;
  };
  /** Actionable suggestions for improvement */
  suggestions: QualitySuggestion[];
  /** Duration of scoring in milliseconds */
  durationMs: number;
}

// ============================================================================
// Checker Interface
// ============================================================================

/**
 * A single dimension checker receives a parsed Domain and returns
 * the score plus any suggestions it generates.
 */
export interface DimensionChecker {
  /** Which dimension this checker evaluates */
  dimension: QualityDimension;
  /** Evaluate the domain and return results */
  check(domain: Domain, file: string): DimensionCheckResult;
}

/**
 * Result from a single dimension checker.
 */
export interface DimensionCheckResult {
  score: DimensionScore;
  suggestions: QualitySuggestion[];
}

// ============================================================================
// Scorer Options
// ============================================================================

/**
 * Options for the spec quality scorer.
 */
export interface SpecQualityOptions {
  /** Minimum score to consider a pass (default: 60) */
  minScore?: number;
  /** Dimensions to skip (e.g. skip security for a data-only spec) */
  skipDimensions?: QualityDimension[];
  /** Custom weights per dimension (must sum to roughly 1.0) */
  weights?: Partial<Record<QualityDimension, number>>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default weights for each dimension — equal weighting */
export const DEFAULT_WEIGHTS: Record<QualityDimension, number> = {
  completeness: 0.25,
  specificity: 0.20,
  security: 0.20,
  testability: 0.20,
  consistency: 0.15,
};
