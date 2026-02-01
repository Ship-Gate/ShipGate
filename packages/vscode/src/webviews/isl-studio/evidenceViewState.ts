/**
 * Evidence View State Types
 * 
 * Type definitions for the evidence display webview panel.
 * All state is read-only for display purposes.
 */

/**
 * Verification result status
 */
export type VerificationStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Individual verification result item
 */
export interface VerificationResult {
  readonly id: string;
  readonly name: string;
  readonly status: VerificationStatus;
  readonly message?: string;
  readonly duration?: number;
  readonly category?: 'precondition' | 'postcondition' | 'invariant' | 'scenario';
}

/**
 * Assumption made during verification
 */
export interface Assumption {
  readonly id: string;
  readonly text: string;
  readonly source?: string;
  readonly confidence?: 'high' | 'medium' | 'low';
}

/**
 * Open question identified during verification
 */
export interface OpenQuestion {
  readonly id: string;
  readonly text: string;
  readonly priority?: 'critical' | 'high' | 'medium' | 'low';
  readonly suggestedAction?: string;
}

/**
 * File reference for navigation
 */
export interface FileReference {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
}

/**
 * Evidence report metadata
 */
export interface ReportMetadata {
  readonly specFile: FileReference;
  readonly reportFile?: FileReference;
  readonly fingerprint: string;
  readonly timestamp: string;
  readonly duration: number;
}

/**
 * Score breakdown by category
 */
export interface ScoreBreakdown {
  readonly preconditions?: number;
  readonly postconditions?: number;
  readonly invariants?: number;
  readonly scenarios?: number;
}

/**
 * Complete evidence view state
 */
export interface EvidenceViewState {
  /** Overall verification score (0-100) */
  readonly score: number;
  
  /** Score breakdown by category */
  readonly breakdown?: ScoreBreakdown;
  
  /** List of verification results */
  readonly results: ReadonlyArray<VerificationResult>;
  
  /** Assumptions made during verification */
  readonly assumptions: ReadonlyArray<Assumption>;
  
  /** Open questions identified */
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
  
  /** Report metadata for navigation */
  readonly metadata: ReportMetadata;
  
  /** Loading state */
  readonly isLoading?: boolean;
  
  /** Error message if any */
  readonly error?: string;
}

/**
 * Messages from webview to extension
 */
export type WebviewMessage =
  | { type: 'openSpec' }
  | { type: 'openReport' }
  | { type: 'copyFingerprint' }
  | { type: 'refresh' }
  | { type: 'navigateToResult'; resultId: string };

/**
 * Messages from extension to webview
 */
export type ExtensionMessage =
  | { type: 'updateState'; state: EvidenceViewState }
  | { type: 'setLoading'; isLoading: boolean }
  | { type: 'setError'; error: string };

/**
 * Create initial empty state
 */
export function createInitialState(): EvidenceViewState {
  return {
    score: 0,
    results: [],
    assumptions: [],
    openQuestions: [],
    metadata: {
      specFile: { path: '' },
      fingerprint: '',
      timestamp: new Date().toISOString(),
      duration: 0
    },
    isLoading: true
  };
}

/**
 * Calculate summary counts from results
 */
export function calculateSummary(results: ReadonlyArray<VerificationResult>): {
  pass: number;
  partial: number;
  fail: number;
  total: number;
} {
  return results.reduce(
    (acc, result) => {
      acc.total++;
      switch (result.status) {
        case 'PASS':
          acc.pass++;
          break;
        case 'PARTIAL':
          acc.partial++;
          break;
        case 'FAIL':
          acc.fail++;
          break;
      }
      return acc;
    },
    { pass: 0, partial: 0, fail: 0, total: 0 }
  );
}
