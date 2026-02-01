// ============================================================================
// ISL MCP Server - Pipeline Tool Types
// ============================================================================

/**
 * Standard output paths for the pipeline
 */
export interface OutputPaths {
  /** Path to the .vibecheck directory */
  vibecheck: string;
  /** Path to generated specs */
  specs: string;
  /** Path to generated reports */
  reports: string;
  /** Path to generated runtime code */
  runtime?: string;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  /** Root path of the workspace */
  root: string;
  /** Output paths */
  paths: OutputPaths;
}

// ============================================================================
// isl_build Types
// ============================================================================

/**
 * Input for isl_build tool
 */
export interface BuildInput {
  /** Natural language prompt describing the behavior to specify */
  prompt: string;
  /** Optional domain name (defaults to 'Generated') */
  domainName?: string;
  /** Optional version (defaults to '1.0.0') */
  version?: string;
  /** Optional workspace path (defaults to process.cwd()) */
  workspacePath?: string;
  /** Whether to write files to disk (defaults to true) */
  writeFiles?: boolean;
}

/**
 * Generated file info (no content, just metadata)
 */
export interface GeneratedFileInfo {
  /** Relative path from workspace root */
  path: string;
  /** File type */
  type: 'spec' | 'types' | 'runtime' | 'test' | 'report';
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Report summary for build output (no timestamps)
 */
export interface BuildReportSummary {
  /** Domain name */
  domain: string;
  /** Domain version */
  version: string;
  /** Number of entities defined */
  entityCount: number;
  /** Number of behaviors defined */
  behaviorCount: number;
  /** Entity names */
  entities: string[];
  /** Behavior names */
  behaviors: string[];
  /** Parse status */
  parseStatus: 'success' | 'error';
  /** Type check status */
  typeCheckStatus: 'success' | 'error' | 'skipped';
  /** Number of warnings */
  warningCount: number;
  /** Number of errors */
  errorCount: number;
}

/**
 * Result for isl_build tool
 */
export interface BuildResult {
  success: boolean;
  /** Report summary */
  report?: BuildReportSummary;
  /** Generated file paths */
  files?: GeneratedFileInfo[];
  /** Error message if failed */
  error?: string;
  /** Error code for structured errors */
  errorCode?: BuildErrorCode;
  /** Suggestion for fixing the error */
  suggestion?: string;
  /** Output paths */
  paths?: OutputPaths;
}

/**
 * Error codes for build failures
 */
export type BuildErrorCode =
  | 'MISSING_LLM_KEY'
  | 'INVALID_PROMPT'
  | 'PARSE_ERROR'
  | 'TYPE_ERROR'
  | 'CODEGEN_ERROR'
  | 'FILESYSTEM_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// isl_verify Types
// ============================================================================

/**
 * Input for isl_verify tool
 */
export interface VerifyInput {
  /** Workspace path (defaults to process.cwd()) */
  workspacePath?: string;
  /** Path to specs directory (defaults to .vibecheck/specs) */
  specsPath?: string;
  /** Path to implementation files (optional, auto-detected if not provided) */
  implementationPath?: string;
  /** Specific behaviors to verify (optional, verifies all if not provided) */
  behaviors?: string[];
  /** Test framework to use */
  framework?: 'vitest' | 'jest';
}

/**
 * Category score in verification report
 */
export interface CategoryScore {
  /** Score from 0-100 */
  score: number;
  /** Number of passed checks */
  passed: number;
  /** Number of failed checks */
  failed: number;
  /** Total number of checks */
  total: number;
}

/**
 * Verification failure detail
 */
export interface VerificationFailure {
  /** Category of the failure */
  category: 'postconditions' | 'invariants' | 'scenarios' | 'temporal' | 'chaos';
  /** Name of the failing check */
  name: string;
  /** Impact level */
  impact: 'critical' | 'high' | 'medium' | 'low';
  /** Error message */
  error?: string;
}

/**
 * Verification report summary (no timestamps)
 */
export interface VerifyReportSummary {
  /** Overall trust score (0-100) */
  trustScore: number;
  /** Confidence level (0-100) */
  confidence: number;
  /** Deployment recommendation */
  recommendation: 'production_ready' | 'staging_recommended' | 'shadow_mode' | 'not_ready' | 'critical_issues';
  /** Score breakdown by category */
  breakdown: {
    postconditions: CategoryScore;
    invariants: CategoryScore;
    scenarios: CategoryScore;
    temporal: CategoryScore;
  };
  /** Total tests run */
  totalTests: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Detailed failures */
  failures: VerificationFailure[];
}

/**
 * Result for isl_verify tool
 */
export interface VerifyResult {
  success: boolean;
  /** Verification report */
  report?: VerifyReportSummary;
  /** Error message if failed */
  error?: string;
  /** Error code for structured errors */
  errorCode?: VerifyErrorCode;
  /** Suggestion for fixing the error */
  suggestion?: string;
  /** Path to full report file */
  reportPath?: string;
}

/**
 * Error codes for verify failures
 */
export type VerifyErrorCode =
  | 'NO_SPECS_FOUND'
  | 'NO_IMPLEMENTATION_FOUND'
  | 'PARSE_ERROR'
  | 'TEST_RUNNER_ERROR'
  | 'FILESYSTEM_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Tool Schemas for MCP
// ============================================================================

/**
 * Schema definitions for registering tools with MCP server
 */
export const PIPELINE_TOOL_SCHEMAS = {
  isl_build: {
    name: 'isl_build',
    description: 'Build ISL specifications from a natural language prompt. Generates spec files, TypeScript types, and runtime verification code. Returns a summary report and file paths.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string' as const,
          description: 'Natural language description of the behavior to specify (e.g., "A user registration system with email validation")',
        },
        domainName: {
          type: 'string' as const,
          description: 'Name for the domain (default: "Generated")',
        },
        version: {
          type: 'string' as const,
          description: 'Version string (default: "1.0.0")',
        },
        workspacePath: {
          type: 'string' as const,
          description: 'Workspace root path (default: current directory)',
        },
        writeFiles: {
          type: 'boolean' as const,
          description: 'Whether to write generated files to disk (default: true)',
        },
      },
      required: ['prompt'],
    },
  },

  isl_verify: {
    name: 'isl_verify',
    description: 'Verify an implementation against ISL specifications. Runs generated tests and returns a trust score report with category breakdowns.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspacePath: {
          type: 'string' as const,
          description: 'Workspace root path (default: current directory)',
        },
        specsPath: {
          type: 'string' as const,
          description: 'Path to specs directory (default: .vibecheck/specs)',
        },
        implementationPath: {
          type: 'string' as const,
          description: 'Path to implementation files (auto-detected if not provided)',
        },
        behaviors: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Specific behaviors to verify (verifies all if not provided)',
        },
        framework: {
          type: 'string' as const,
          enum: ['vitest', 'jest'],
          description: 'Test framework to use (default: vitest)',
        },
      },
      required: [],
    },
  },
} as const;

export type PipelineToolName = keyof typeof PIPELINE_TOOL_SCHEMAS;
