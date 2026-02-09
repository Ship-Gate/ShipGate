/**
 * Types for Fake Success UI Detector
 */

/**
 * Framework type detected
 */
export type FrameworkType = 'react' | 'vue' | 'generic' | 'unknown';

/**
 * Pattern type detected
 */
export type PatternType =
  | 'catch-returns-success'
  | 'try-catch-toast-success'
  | 'promise-catch-default-success';

/**
 * Call chain evidence showing the flow from error to fake success
 */
export interface CallChainEvidence {
  /** The error origin (catch block, promise rejection, etc.) */
  errorOrigin: {
    line: number;
    column: number;
    type: 'catch' | 'promise-catch' | 'error-handler';
  };
  /** The success display (toast, notification, return value) */
  successDisplay: {
    line: number;
    column: number;
    type: 'toast' | 'notification' | 'return' | 'state-update';
    method?: string; // e.g., 'toast.success', 'showNotification'
  };
  /** Intermediate steps in the chain */
  intermediateSteps?: Array<{
    line: number;
    column: number;
    description: string;
  }>;
}

/**
 * A detected fake success pattern
 */
export interface FakeSuccessClaim {
  /** Unique identifier */
  id: string;
  /** Pattern type */
  patternType: PatternType;
  /** File path relative to workspace root */
  filePath: string;
  /** Starting line number */
  startLine: number;
  /** Ending line number */
  endLine: number;
  /** Starting column */
  startColumn: number;
  /** Ending column */
  endColumn: number;
  /** Detected framework */
  framework: FrameworkType;
  /** Call chain evidence */
  callChain: CallChainEvidence;
  /** Code snippet showing the issue */
  snippet: string;
  /** The error that was swallowed */
  swallowedError?: {
    line: number;
    column: number;
    type: string; // e.g., 'Error', 'ApiError'
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Detection result
 */
export interface DetectionResult {
  /** All detected claims */
  claims: FakeSuccessClaim[];
  /** Files scanned */
  filesScanned: number;
  /** Detection duration in milliseconds */
  durationMs: number;
}

/**
 * Detection options
 */
export interface DetectionOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Include code snippets in claims */
  includeSnippets?: boolean;
  /** Maximum snippet lines */
  maxSnippetLines?: number;
  /** Framework-specific detection */
  frameworkHints?: FrameworkType[];
}
