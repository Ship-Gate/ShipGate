// ============================================================================
// ISL MCP Server - Translator Tool Types
// ============================================================================

import type { SourceLocation } from '@isl-lang/parser';

// ============================================================================
// Tool Input Types
// ============================================================================

/**
 * Input for isl_translate tool
 */
export interface TranslateInput {
  /** ISL source code to translate */
  source: string;
  /** Target format for translation */
  format: 'ast' | 'json' | 'yaml' | 'compact';
  /** Include source locations in output */
  includeLocations?: boolean;
  /** Pretty print the output */
  pretty?: boolean;
}

/**
 * Input for isl_validate_ast tool
 */
export interface ValidateASTInput {
  /** AST as JSON string */
  ast: string;
  /** Strict validation mode */
  strict?: boolean;
  /** Check only specific node kinds */
  nodeKinds?: string[];
}

/**
 * Input for isl_repair_ast tool
 */
export interface RepairASTInput {
  /** AST as JSON string */
  ast: string;
  /** Repair strategy */
  strategy?: 'minimal' | 'aggressive' | 'auto';
  /** Max repair iterations */
  maxIterations?: number;
}

/**
 * Input for isl_print tool
 */
export interface PrintInput {
  /** AST as JSON string */
  ast: string;
  /** Indentation style */
  indent?: number;
  /** Include comments from original source */
  preserveComments?: boolean;
  /** Output format style */
  style?: 'standard' | 'compact' | 'verbose';
}

// ============================================================================
// Tool Output Types
// ============================================================================

/**
 * Base result structure for all translator tools
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: TranslatorError[];
  warnings?: TranslatorWarning[];
  metadata?: ResultMetadata;
}

/**
 * Error structure for translator tools
 */
export interface TranslatorError {
  code: string;
  message: string;
  location?: SourceLocation;
  path?: string[];
  suggestion?: string;
}

/**
 * Warning structure for translator tools
 */
export interface TranslatorWarning {
  code: string;
  message: string;
  location?: SourceLocation;
  path?: string[];
}

/**
 * Metadata about the operation
 */
export interface ResultMetadata {
  processingTimeMs: number;
  inputSize: number;
  outputSize?: number;
  nodeCount?: number;
  repairCount?: number;
}

// ============================================================================
// Translate Tool Results
// ============================================================================

/**
 * Result for isl_translate tool
 */
export interface TranslateResult extends ToolResult<TranslateData> {
  data?: TranslateData;
}

export interface TranslateData {
  format: string;
  output: string;
  domain?: string;
  summary?: DomainSummary;
}

export interface DomainSummary {
  name: string;
  version: string;
  entityCount: number;
  behaviorCount: number;
  typeCount: number;
  entities: string[];
  behaviors: string[];
}

// ============================================================================
// Validate Tool Results
// ============================================================================

/**
 * Result for isl_validate_ast tool
 */
export interface ValidateASTResult extends ToolResult<ValidationData> {
  data?: ValidationData;
}

export interface ValidationData {
  valid: boolean;
  nodeCount: number;
  issues: ValidationIssue[];
  structure: StructureSummary;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path: string[];
  expected?: string;
  actual?: string;
}

export interface StructureSummary {
  rootKind: string;
  depth: number;
  nodeTypes: Record<string, number>;
}

// ============================================================================
// Repair Tool Results
// ============================================================================

/**
 * Result for isl_repair_ast tool
 */
export interface RepairASTResult extends ToolResult<RepairData> {
  data?: RepairData;
}

export interface RepairData {
  repaired: boolean;
  repairedAST: string;
  repairs: Repair[];
  remainingIssues: ValidationIssue[];
}

export interface Repair {
  type: 'added' | 'removed' | 'modified' | 'replaced';
  path: string[];
  description: string;
  before?: unknown;
  after?: unknown;
}

// ============================================================================
// Print Tool Results
// ============================================================================

/**
 * Result for isl_print tool
 */
export interface PrintResult extends ToolResult<PrintData> {
  data?: PrintData;
}

export interface PrintData {
  source: string;
  lineCount: number;
  characterCount: number;
}

// ============================================================================
// Tool Definitions for MCP
// ============================================================================

/**
 * Schema definitions for registering tools with MCP server
 */
export const TRANSLATOR_TOOL_SCHEMAS = {
  isl_translate: {
    name: 'isl_translate',
    description: 'Translate ISL source code to different formats (AST JSON, YAML, compact representation). Useful for programmatic access to ISL specifications.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string' as const,
          description: 'The ISL source code to translate',
        },
        format: {
          type: 'string' as const,
          enum: ['ast', 'json', 'yaml', 'compact'],
          description: 'Target format: ast (full AST), json (JSON representation), yaml (YAML format), compact (minimal representation)',
        },
        includeLocations: {
          type: 'boolean' as const,
          description: 'Include source locations in output (default: false)',
        },
        pretty: {
          type: 'boolean' as const,
          description: 'Pretty print the output (default: true)',
        },
      },
      required: ['source', 'format'],
    },
  },

  isl_validate_ast: {
    name: 'isl_validate_ast',
    description: 'Validate an ISL AST structure for correctness. Checks node types, required fields, and structural integrity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ast: {
          type: 'string' as const,
          description: 'The AST as a JSON string',
        },
        strict: {
          type: 'boolean' as const,
          description: 'Enable strict validation mode (default: false)',
        },
        nodeKinds: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Validate only specific node kinds',
        },
      },
      required: ['ast'],
    },
  },

  isl_repair_ast: {
    name: 'isl_repair_ast',
    description: 'Attempt to repair a malformed ISL AST by fixing structural issues, adding missing required fields, and correcting invalid values.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ast: {
          type: 'string' as const,
          description: 'The AST as a JSON string',
        },
        strategy: {
          type: 'string' as const,
          enum: ['minimal', 'aggressive', 'auto'],
          description: 'Repair strategy: minimal (fewest changes), aggressive (fix all issues), auto (determine automatically)',
        },
        maxIterations: {
          type: 'number' as const,
          description: 'Maximum repair iterations (default: 10)',
        },
      },
      required: ['ast'],
    },
  },

  isl_print: {
    name: 'isl_print',
    description: 'Pretty print an ISL AST back to ISL source code. Converts AST representation to human-readable ISL syntax.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ast: {
          type: 'string' as const,
          description: 'The AST as a JSON string',
        },
        indent: {
          type: 'number' as const,
          description: 'Indentation spaces (default: 2)',
        },
        preserveComments: {
          type: 'boolean' as const,
          description: 'Preserve comments from original source (default: false)',
        },
        style: {
          type: 'string' as const,
          enum: ['standard', 'compact', 'verbose'],
          description: 'Output style: standard, compact (minimal whitespace), verbose (extra documentation)',
        },
      },
      required: ['ast'],
    },
  },
} as const;

export type TranslatorToolName = keyof typeof TRANSLATOR_TOOL_SCHEMAS;
