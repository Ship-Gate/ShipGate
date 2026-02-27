/**
 * Report Viewer Types
 * 
 * Type definitions for evidence report viewing with source location
 * support for clause navigation.
 */

/**
 * Source location in a file for navigation
 */
export interface SourceLocation {
  /** Absolute file path */
  readonly filePath: string;
  /** Start line (1-based) */
  readonly startLine: number;
  /** End line (1-based) */
  readonly endLine: number;
  /** Start column (0-based, optional) */
  readonly startColumn?: number;
  /** End column (0-based, optional) */
  readonly endColumn?: number;
}

/**
 * Clause verification status
 */
export type ClauseStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIP';

/**
 * Clause category/type
 */
export type ClauseCategory = 
  | 'precondition'
  | 'postcondition'
  | 'invariant'
  | 'scenario'
  | 'effect'
  | 'state';

/**
 * Priority/impact level for failed clauses
 */
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual clause result with source location
 */
export interface ClauseResult {
  /** Unique clause identifier */
  readonly id: string;
  /** Human-readable clause name/description */
  readonly name: string;
  /** Verification status */
  readonly status: ClauseStatus;
  /** Category of the clause */
  readonly category: ClauseCategory;
  /** Source location for navigation */
  readonly location?: SourceLocation;
  /** Detailed message (especially for failures) */
  readonly message?: string;
  /** Expected value (for assertions) */
  readonly expected?: string;
  /** Actual value (for assertions) */
  readonly actual?: string;
  /** Impact level if failed */
  readonly impact?: ImpactLevel;
  /** Execution duration in ms */
  readonly duration?: number;
  /** Stack trace for failures */
  readonly stackTrace?: string;
  /** Suggested fix for failures */
  readonly suggestedFix?: string;
}

/**
 * Report summary statistics
 */
export interface ReportSummary {
  /** Total number of clauses */
  readonly total: number;
  /** Number of passing clauses */
  readonly passed: number;
  /** Number of partial clauses */
  readonly partial: number;
  /** Number of failing clauses */
  readonly failed: number;
  /** Number of skipped clauses */
  readonly skipped: number;
  /** Overall score (0-100) */
  readonly score: number;
  /** Breakdown by category */
  readonly byCategory?: Record<ClauseCategory, {
    total: number;
    passed: number;
    failed: number;
  }>;
}

/**
 * Evidence report metadata
 */
export interface ReportMetadata {
  /** Source spec file path */
  readonly specPath: string;
  /** Report file path (if saved) */
  readonly reportPath?: string;
  /** Unique fingerprint/hash */
  readonly fingerprint: string;
  /** When the report was generated */
  readonly timestamp: string;
  /** Total execution duration in ms */
  readonly duration: number;
  /** ISL version used */
  readonly islVersion?: string;
  /** Environment info */
  readonly environment?: string;
}

/**
 * Complete evidence report structure
 */
export interface EvidenceReport {
  /** Report format version */
  readonly version: string;
  /** Report metadata */
  readonly metadata: ReportMetadata;
  /** Summary statistics */
  readonly summary: ReportSummary;
  /** All clause results */
  readonly clauses: ReadonlyArray<ClauseResult>;
}

/**
 * Report viewer panel state
 */
export interface ReportViewerState {
  /** Current report (null if none loaded) */
  readonly report: EvidenceReport | null;
  /** Loading state */
  readonly isLoading: boolean;
  /** Error message if any */
  readonly error?: string;
  /** Currently selected clause ID */
  readonly selectedClauseId?: string;
  /** Filter by status */
  readonly statusFilter?: ClauseStatus | 'ALL';
  /** Filter by category */
  readonly categoryFilter?: ClauseCategory | 'ALL';
}

/**
 * Messages from webview to extension
 */
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'openFile'; location: SourceLocation }
  | { type: 'fixNext' }
  | { type: 'selectClause'; clauseId: string }
  | { type: 'refresh' }
  | { type: 'copyClipboard'; text: string }
  | { type: 'filterByStatus'; status: ClauseStatus | 'ALL' }
  | { type: 'filterByCategory'; category: ClauseCategory | 'ALL' };

/**
 * Messages from extension to webview
 */
export type ExtensionToWebviewMessage =
  | { type: 'loadReport'; report: EvidenceReport }
  | { type: 'setLoading'; isLoading: boolean }
  | { type: 'setError'; error: string }
  | { type: 'highlightClause'; clauseId: string }
  | { type: 'updateFilters'; statusFilter?: ClauseStatus | 'ALL'; categoryFilter?: ClauseCategory | 'ALL' };

/**
 * Create initial empty state
 */
export function createInitialState(): ReportViewerState {
  return {
    report: null,
    isLoading: true,
    statusFilter: 'ALL',
    categoryFilter: 'ALL'
  };
}

/**
 * Calculate summary from clause results
 */
export function calculateSummary(clauses: ReadonlyArray<ClauseResult>): ReportSummary {
  const summary: ReportSummary = {
    total: clauses.length,
    passed: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
    score: 0,
    byCategory: {} as Record<ClauseCategory, { total: number; passed: number; failed: number }>
  };

  const mutableSummary = summary as { -readonly [K in keyof ReportSummary]: ReportSummary[K] };
  
  for (const clause of clauses) {
    switch (clause.status) {
      case 'PASS':
        mutableSummary.passed++;
        break;
      case 'PARTIAL':
        mutableSummary.partial++;
        break;
      case 'FAIL':
        mutableSummary.failed++;
        break;
      case 'SKIP':
        mutableSummary.skipped++;
        break;
    }

    // Update category breakdown
    if (mutableSummary.byCategory) {
      const cat = clause.category;
      if (!mutableSummary.byCategory[cat]) {
        mutableSummary.byCategory[cat] = { total: 0, passed: 0, failed: 0 };
      }
      mutableSummary.byCategory[cat].total++;
      if (clause.status === 'PASS') {
        mutableSummary.byCategory[cat].passed++;
      } else if (clause.status === 'FAIL') {
        mutableSummary.byCategory[cat].failed++;
      }
    }
  }

  // Calculate score
  const verifiedClauses = mutableSummary.total - mutableSummary.skipped;
  if (verifiedClauses > 0) {
    mutableSummary.score = Math.round(
      ((mutableSummary.passed + mutableSummary.partial * 0.5) / verifiedClauses) * 100
    );
  }

  return summary;
}

/**
 * Get the highest-impact failing clause
 */
export function getHighestImpactFailure(clauses: ReadonlyArray<ClauseResult>): ClauseResult | undefined {
  const failingClauses = clauses.filter(c => c.status === 'FAIL');
  if (failingClauses.length === 0) return undefined;

  const impactOrder: Record<ImpactLevel, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return failingClauses.reduce((highest, current) => {
    const currentImpact = impactOrder[current.impact ?? 'medium'];
    const highestImpact = impactOrder[highest.impact ?? 'medium'];
    return currentImpact > highestImpact ? current : highest;
  });
}

/**
 * Filter clauses by status and category
 */
export function filterClauses(
  clauses: ReadonlyArray<ClauseResult>,
  statusFilter?: ClauseStatus | 'ALL',
  categoryFilter?: ClauseCategory | 'ALL'
): ClauseResult[] {
  return clauses.filter(clause => {
    if (statusFilter && statusFilter !== 'ALL' && clause.status !== statusFilter) {
      return false;
    }
    if (categoryFilter && categoryFilter !== 'ALL' && clause.category !== categoryFilter) {
      return false;
    }
    return true;
  });
}
