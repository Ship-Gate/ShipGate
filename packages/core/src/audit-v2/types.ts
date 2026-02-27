/**
 * Audit V2 Types
 *
 * Type definitions for the enhanced audit engine that detects
 * likely implementations and generates evidence-like audit reports.
 */

/**
 * Severity level for risk flags
 */
export type RiskSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Categories of detectable behaviors
 */
export type BehaviorCategory =
  | 'route'
  | 'handler'
  | 'auth'
  | 'database'
  | 'webhook'
  | 'middleware'
  | 'service'
  | 'unknown';

/**
 * Framework hints for better detection
 */
export type FrameworkHint =
  | 'nextjs-app'
  | 'nextjs-pages'
  | 'express'
  | 'fastify'
  | 'hono'
  | 'nestjs'
  | 'koa'
  | 'unknown';

/**
 * A detected candidate in the codebase
 */
export interface DetectedCandidate {
  /** Unique identifier */
  id: string;
  /** Category of the detected behavior */
  category: BehaviorCategory;
  /** Human-readable name/label */
  name: string;
  /** File path relative to workspace root */
  filePath: string;
  /** Starting line number */
  line: number;
  /** Ending line number */
  endLine?: number;
  /** Code snippet */
  snippet?: string;
  /** Detection confidence (0-1) */
  confidence: number;
  /** HTTP method (for routes) */
  httpMethod?: string;
  /** Route path (for routes) */
  routePath?: string;
  /** Function/method name */
  functionName?: string;
  /** Detected framework */
  framework?: FrameworkHint;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A risk flag identified during audit
 */
export interface RiskFlag {
  /** Unique identifier */
  id: string;
  /** Risk category */
  category:
    | 'auth-without-rate-limit'
    | 'webhook-without-signature'
    | 'route-without-auth'
    | 'route-without-validation'
    | 'db-without-transaction'
    | 'unhandled-error'
    | 'hardcoded-secret'
    | 'sql-injection-risk'
    | 'other';
  /** Severity level */
  severity: RiskSeverity;
  /** Human-readable description */
  description: string;
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Code snippet showing the issue */
  snippet?: string;
  /** Suggested remediation */
  suggestion: string;
  /** Related candidate IDs */
  relatedCandidates?: string[];
}

/**
 * Behavior mapping from spec to candidates
 */
export interface BehaviorMapping {
  /** Behavior name (e.g., from ISL spec or detected) */
  behaviorName: string;
  /** Category of behavior */
  category: BehaviorCategory;
  /** Detected candidates for this behavior */
  candidates: DetectedCandidate[];
  /** Risk flags for this behavior */
  riskFlags: RiskFlag[];
  /** Coverage status */
  status: 'found' | 'partial' | 'missing';
  /** Notes/observations */
  notes: string[];
}

/**
 * Summary statistics for the audit report
 */
export interface AuditSummaryV2 {
  /** Total candidates detected */
  totalCandidates: number;
  /** Candidates by category */
  candidatesByCategory: Record<BehaviorCategory, number>;
  /** Total risk flags */
  totalRiskFlags: number;
  /** Risk flags by severity */
  risksBySeverity: Record<RiskSeverity, number>;
  /** Files scanned */
  filesScanned: number;
  /** Detected frameworks */
  detectedFrameworks: FrameworkHint[];
  /** Overall health score (0-100) */
  healthScore: number;
}

/**
 * Complete audit report (evidence-like format)
 */
export interface AuditReportV2 {
  /** Report version */
  version: '2.0';
  /** Unique report identifier */
  reportId: string;
  /** Workspace path audited */
  workspacePath: string;
  /** When the audit was performed */
  auditedAt: string;
  /** Audit duration in milliseconds */
  durationMs: number;
  /** Summary statistics */
  summary: AuditSummaryV2;
  /** Behavior mappings */
  behaviorMappings: BehaviorMapping[];
  /** All detected candidates */
  candidates: DetectedCandidate[];
  /** All risk flags */
  riskFlags: RiskFlag[];
  /** Warnings during audit */
  warnings: string[];
  /** Audit metadata */
  metadata: {
    /** Engine version */
    engineVersion: string;
    /** Detected frameworks */
    frameworks: FrameworkHint[];
    /** Directories scanned */
    directoriesScanned: number;
  };
}

/**
 * Audit options
 */
export interface AuditOptionsV2 {
  /** Maximum depth to scan */
  maxDepth?: number;
  /** Directories to ignore */
  ignoreDirs?: string[];
  /** File extensions to include */
  includeExtensions?: string[];
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Include code snippets in report */
  includeSnippets?: boolean;
  /** Maximum snippet lines */
  maxSnippetLines?: number;
}

/**
 * Default audit options
 */
export const DEFAULT_AUDIT_OPTIONS_V2: Required<AuditOptionsV2> = {
  maxDepth: 15,
  ignoreDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    'venv',
    'coverage',
    '.turbo',
    '.cache',
  ],
  includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'],
  minConfidence: 0.4,
  includeSnippets: true,
  maxSnippetLines: 10,
};

/**
 * Detector result from a single detector
 */
export interface DetectorResult {
  /** Candidates found by this detector */
  candidates: DetectedCandidate[];
  /** Risk flags found by this detector */
  riskFlags: RiskFlag[];
  /** Framework hints from this detector */
  frameworkHints: FrameworkHint[];
}

/**
 * Interface for all detectors
 */
export interface Detector {
  /** Detector name */
  name: string;
  /** Run detection on file content */
  detect(
    content: string,
    filePath: string,
    options: AuditOptionsV2
  ): DetectorResult;
}
