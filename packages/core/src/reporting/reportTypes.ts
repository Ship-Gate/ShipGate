/**
 * Report Types for ShipGate Verification Reports
 *
 * Defines the structure for formatted verification reports in
 * Markdown, PDF, JSON, and HTML formats. These reports are designed
 * for stakeholders who don't use the CLI directly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Report Format & Scope
// ─────────────────────────────────────────────────────────────────────────────

/** Supported output formats */
export type ReportFormat = 'markdown' | 'pdf' | 'json' | 'html';

/** Report scope controls how much detail is included */
export type ReportScope = 'full' | 'summary' | 'failures-only';

/** Verdict from verification (matches UnifiedVerdict in CLI) */
export type ReportVerdict = 'SHIP' | 'NO_SHIP' | 'WARN';

/** File-level status */
export type FileStatus = 'PASS' | 'WARN' | 'FAIL';

/** How a file was verified */
export type FileVerificationMethod =
  | 'ISL verified'
  | 'Specless'
  | 'Fake feature'
  | 'Skipped';

// ─────────────────────────────────────────────────────────────────────────────
// Report Options
// ─────────────────────────────────────────────────────────────────────────────

/** Options for generating a report */
export interface ReportOptions {
  /** Output format */
  format: ReportFormat;
  /** Report scope — controls level of detail */
  scope: ReportScope;
  /** Include actionable recommendations */
  includeRecommendations: boolean;
  /** Include coverage trend (requires historical data) */
  includeTrends: boolean;
  /** File path to write the report to */
  outputPath: string;
  /** Custom report title (default: "ShipGate Verification Report") */
  title?: string;
  /** Custom CSS for HTML/PDF reports */
  customCss?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Data Model
// ─────────────────────────────────────────────────────────────────────────────

/** Repository metadata shown in report header */
export interface ReportRepositoryInfo {
  /** Repository URL or identifier (e.g. "github.com/acme/api") */
  repository: string;
  /** Branch name */
  branch: string;
  /** Commit hash (short) */
  commit?: string;
}

/** Per-file verification result for the report */
export interface ReportFileResult {
  /** Relative file path */
  file: string;
  /** PASS / WARN / FAIL */
  status: FileStatus;
  /** How this file was verified */
  method: FileVerificationMethod;
  /** Score 0.00 - 1.00 */
  score: number;
  /** ISL spec file (if any) */
  specFile?: string;
  /** Human-readable blocker messages */
  blockers: string[];
  /** Human-readable finding description */
  finding?: string;
  /** Recommendation for fixing */
  recommendation?: string;
}

/** Coverage summary metrics */
export interface ReportCoverageSummary {
  /** Total files analyzed */
  totalFiles: number;
  /** Files with ISL specs */
  specCoveredFiles: number;
  /** ISL coverage percentage (0-100) */
  coveragePercent: number;
  /** Files passing verification */
  passingFiles: number;
  /** Files with warnings */
  warningFiles: number;
  /** Files failing verification */
  failingFiles: number;
}

/** Historical data point for trend charts */
export interface TrendDataPoint {
  /** ISO date string */
  date: string;
  /** Coverage percentage */
  coverage: number;
  /** Overall score */
  score: number;
  /** PR or commit identifier */
  label?: string;
}

/** A single recommendation */
export interface ReportRecommendation {
  /** Priority order (1 = highest) */
  priority: number;
  /** The recommendation text */
  text: string;
  /** File or path this applies to */
  target?: string;
}

/** Complete report data used by all formatters */
export interface ReportData {
  /** Report generation timestamp (ISO 8601) */
  generatedAt: string;
  /** Overall verdict */
  verdict: ReportVerdict;
  /** Overall score 0.00 - 1.00 */
  score: number;
  /** Repository info */
  repository: ReportRepositoryInfo;
  /** Coverage summary */
  coverage: ReportCoverageSummary;
  /** Per-file results */
  files: ReportFileResult[];
  /** Verification mode used */
  mode: string;
  /** Total verification duration in ms */
  duration: number;
  /** Blockers (aggregated) */
  blockers: string[];
  /** Recommendations */
  recommendations: ReportRecommendation[];
  /** Historical trend data (optional, for trend charts) */
  trends?: TrendDataPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatter Interface
// ─────────────────────────────────────────────────────────────────────────────

/** Result from a report generation call */
export interface ReportResult {
  /** Whether report generation succeeded */
  success: boolean;
  /** Format that was generated */
  format: ReportFormat;
  /** Path where report was written (undefined if stdout) */
  outputPath?: string;
  /** The rendered report content (for markdown/json/html) */
  content?: string;
  /** Size in bytes */
  sizeBytes?: number;
  /** Error message if generation failed */
  error?: string;
}
