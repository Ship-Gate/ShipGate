/**
 * Audit Types for ISL Coverage Analysis
 *
 * Types for workspace auditing that produces coverage reports
 * comparing detected implementations against ISL specifications.
 */

/**
 * Risk level for detected issues
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Coverage status for a behavior
 */
export type CoverageStatus = 'covered' | 'partial' | 'missing' | 'unknown';

/**
 * Type of detected implementation
 */
export type ImplementationType = 'route' | 'handler' | 'guard' | 'middleware' | 'service' | 'model' | 'unknown';

/**
 * Detected implementation in the codebase
 */
export interface DetectedImplementation {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Type of implementation */
  type: ImplementationType;
  /** File path relative to workspace root */
  filePath: string;
  /** Line number where detected */
  line: number;
  /** End line (for multi-line implementations) */
  endLine?: number;
  /** HTTP method (for routes) */
  httpMethod?: string;
  /** Route path (for routes) */
  routePath?: string;
  /** Function/method name */
  functionName?: string;
  /** Detected patterns in implementation */
  patterns: DetectedPattern[];
  /** Confidence of detection */
  confidence: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A pattern detected in an implementation
 */
export interface DetectedPattern {
  /** Pattern type */
  type: 'auth-check' | 'validation' | 'error-handling' | 'logging' | 'database' | 'external-call' | 'assertion';
  /** Pattern description */
  description: string;
  /** Line number */
  line: number;
  /** Code snippet */
  snippet?: string;
}

/**
 * ISL behavior from a spec file
 */
export interface ISLBehavior {
  /** Behavior name from spec */
  name: string;
  /** Domain the behavior belongs to */
  domain: string;
  /** Spec file path */
  specPath: string;
  /** Preconditions defined */
  preconditions: string[];
  /** Postconditions defined */
  postconditions: string[];
  /** Invariants referenced */
  invariants: string[];
  /** Effects declared */
  effects: string[];
}

/**
 * Mapping between ISL behavior and detected implementation
 */
export interface BehaviorMapping {
  /** ISL behavior */
  behavior: ISLBehavior;
  /** Matched implementations */
  implementations: DetectedImplementation[];
  /** Coverage status */
  status: CoverageStatus;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Clauses covered vs total */
  clausesCovered: number;
  totalClauses: number;
  /** Matching confidence */
  confidence: number;
  /** Notes about the mapping */
  notes: string[];
}

/**
 * A risky zone identified in the codebase
 */
export interface RiskyZone {
  /** Unique identifier */
  id: string;
  /** File path */
  filePath: string;
  /** Line range */
  startLine: number;
  endLine: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Category of risk */
  category: 'unprotected-route' | 'missing-validation' | 'no-auth' | 'unsafe-operation' | 'uncovered-behavior' | 'dead-code';
  /** Description of the risk */
  description: string;
  /** Suggested action */
  suggestion: string;
  /** Related ISL behavior (if any) */
  relatedBehavior?: string;
  /** Code snippet */
  snippet?: string;
}

/**
 * Summary statistics for the audit
 */
export interface AuditSummary {
  /** Total ISL behaviors in specs */
  totalBehaviors: number;
  /** Behaviors with implementations */
  implementedBehaviors: number;
  /** Behaviors partially implemented */
  partialBehaviors: number;
  /** Behaviors with no implementation */
  missingBehaviors: number;
  /** Overall coverage percentage */
  coveragePercent: number;
  /** Total detected implementations */
  totalImplementations: number;
  /** Implementations without matching spec */
  unmappedImplementations: number;
  /** Total risky zones found */
  riskyZonesCount: number;
  /** Risk breakdown by level */
  riskBreakdown: Record<RiskLevel, number>;
}

/**
 * Complete audit report
 */
export interface AuditReport {
  /** Report version */
  version: '1.0';
  /** Unique report identifier */
  reportId: string;
  /** Workspace path audited */
  workspacePath: string;
  /** Specs path */
  specsPath: string;
  /** When the audit was performed */
  auditedAt: string;
  /** Audit duration in milliseconds */
  durationMs: number;
  /** Summary statistics */
  summary: AuditSummary;
  /** Behavior mappings */
  behaviorMappings: BehaviorMapping[];
  /** Detected implementations */
  detectedImplementations: DetectedImplementation[];
  /** Risky zones */
  riskyZones: RiskyZone[];
  /** Warnings during audit */
  warnings: string[];
  /** Audit metadata */
  metadata: {
    /** Agent version */
    agentVersion: string;
    /** Files scanned */
    filesScanned: number;
    /** Spec files processed */
    specFilesProcessed: number;
  };
}

/**
 * Options for audit
 */
export interface AuditOptions {
  /** Maximum depth to scan */
  maxDepth?: number;
  /** Directories to ignore */
  ignoreDirs?: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** Whether to include code snippets */
  includeSnippets?: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Default audit options
 */
export const DEFAULT_AUDIT_OPTIONS: Required<AuditOptions> = {
  maxDepth: 15,
  ignoreDirs: ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', 'coverage'],
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go'],
  includeSnippets: true,
  minConfidence: 0.3,
  timeoutMs: 60000,
};
