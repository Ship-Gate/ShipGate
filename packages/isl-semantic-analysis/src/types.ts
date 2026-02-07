/**
 * Semantic Analysis Types
 * 
 * Core type definitions for the semantic pass framework.
 */

import type { Domain, SourceLocation as ParserSourceLocation } from '@isl-lang/parser';
import type { Diagnostic, CodeFix, SourceLocation } from '@isl-lang/errors';

// ============================================================================
// Type Environment
// ============================================================================

/**
 * Type information for a symbol in the environment
 */
export interface TypeInfo {
  /** The resolved type name (e.g., 'String', 'Int', 'User') */
  typeName: string;
  /** Whether this type is nullable */
  nullable: boolean;
  /** Whether this type is an array */
  isArray: boolean;
  /** Generic type parameters (e.g., for Map<K, V>) */
  typeParams?: TypeInfo[];
  /** The original declaration location */
  declaredAt?: SourceLocation;
  /** Type constraints (e.g., min, max, pattern) */
  constraints?: TypeConstraint[];
}

/**
 * Type constraint from ISL type declarations
 */
export interface TypeConstraint {
  kind: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: unknown;
}

/**
 * Symbol kinds in the type environment
 */
export type SymbolKind = 
  | 'entity'
  | 'type'
  | 'enum'
  | 'behavior'
  | 'field'
  | 'parameter'
  | 'local'
  | 'invariant';

/**
 * Symbol entry in the type environment
 */
export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  type: TypeInfo;
  /** Parent scope (e.g., entity name for fields) */
  scope?: string;
  /** Whether this symbol is exported */
  exported?: boolean;
  /** Documentation comment */
  doc?: string;
}

/**
 * Type environment for semantic analysis passes
 * 
 * The type environment contains all type information resolved during
 * type checking. Semantic passes can query it for type information
 * without re-implementing type resolution.
 */
export interface TypeEnvironment {
  /**
   * Look up a symbol by name in the current scope chain
   */
  lookup(name: string): SymbolEntry | undefined;
  
  /**
   * Look up a symbol in a specific scope
   */
  lookupIn(scope: string, name: string): SymbolEntry | undefined;
  
  /**
   * Get all symbols of a specific kind
   */
  symbolsOfKind(kind: SymbolKind): SymbolEntry[];
  
  /**
   * Check if a type is assignable to another
   */
  isAssignableTo(source: TypeInfo, target: TypeInfo): boolean;
  
  /**
   * Get the entity declaration for a type name
   */
  getEntity(name: string): SymbolEntry | undefined;
  
  /**
   * Get all entity names
   */
  entityNames(): string[];
  
  /**
   * Get all behavior names
   */
  behaviorNames(): string[];
  
  /**
   * Get all type names (custom types + entities)
   */
  typeNames(): string[];
  
  /**
   * Check if a type name exists
   */
  hasType(name: string): boolean;
  
  /**
   * Get fields for an entity
   */
  fieldsOf(entityName: string): SymbolEntry[];
}

// ============================================================================
// Semantic Pass Interface
// ============================================================================

/**
 * Context provided to each semantic pass
 */
export interface PassContext {
  /** The parsed AST */
  ast: Domain;
  /** Type environment from type checking */
  typeEnv: TypeEnvironment;
  /** Source file path */
  filePath: string;
  /** Source file content (for generating fixes) */
  sourceContent: string;
  /** Configuration options for this pass */
  config?: Record<string, unknown>;
}

/**
 * Semantic analysis pass interface
 * 
 * Each pass implements a specific semantic check that runs after
 * parsing and type checking. Passes can declare dependencies on
 * other passes to ensure execution order.
 */
export interface SemanticPass {
  /** Unique identifier (e.g., 'unreachable-clauses') */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Description of what this pass checks */
  readonly description: string;
  
  /** IDs of passes that must run before this one */
  readonly dependencies?: string[];
  
  /** Pass priority (higher = runs earlier among peers) */
  readonly priority?: number;
  
  /** Whether this pass is enabled by default */
  readonly enabledByDefault?: boolean;
  
  /**
   * Run the semantic analysis pass
   * @returns Array of diagnostics (errors, warnings, hints)
   */
  run(ctx: PassContext): Diagnostic[];
}

/**
 * Pass metadata without the run function (for registration)
 */
export type PassDescriptor = Omit<SemanticPass, 'run'>;

// ============================================================================
// Pass Result Types
// ============================================================================

/**
 * Result from running a single pass
 */
export interface PassResult {
  /** Pass identifier */
  passId: string;
  /** Pass name */
  passName: string;
  /** Diagnostics produced by this pass */
  diagnostics: Diagnostic[];
  /** Execution time in milliseconds */
  durationMs: number;
  /** Whether the pass succeeded (no internal errors) */
  succeeded: boolean;
  /** Error message if the pass threw an exception */
  error?: string;
}

/**
 * Result from running all passes
 */
export interface AnalysisResult {
  /** Results from each pass */
  passResults: PassResult[];
  /** All diagnostics from all passes (deduplicated) */
  diagnostics: Diagnostic[];
  /** Whether all passes succeeded */
  allPassed: boolean;
  /** Summary statistics */
  stats: AnalysisStats;
  /** Cache hit information */
  cacheInfo: CacheInfo;
}

/**
 * Statistics from analysis run
 */
export interface AnalysisStats {
  /** Total number of passes registered */
  totalPasses: number;
  /** Number of passes that ran */
  passesRun: number;
  /** Number of passes skipped (cached) */
  passesSkipped: number;
  /** Total errors found */
  errorCount: number;
  /** Total warnings found */
  warningCount: number;
  /** Total hints found */
  hintCount: number;
  /** Total execution time */
  totalDurationMs: number;
}

/**
 * Cache information for analysis run
 */
export interface CacheInfo {
  /** Whether caching was enabled */
  enabled: boolean;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Content hash used for cache key */
  contentHash?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the semantic analyzer
 */
export interface AnalyzerConfig {
  /** Passes to explicitly enable (empty = all default passes) */
  enablePasses?: string[];
  /** Passes to explicitly disable */
  disablePasses?: string[];
  /** Whether to enable caching */
  cacheEnabled?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Maximum cache size */
  maxCacheEntries?: number;
  /** Whether to include hint-level diagnostics */
  includeHints?: boolean;
  /** Per-pass configuration */
  passConfig?: Record<string, Record<string, unknown>>;
  /** Stop on first error */
  failFast?: boolean;
  /** Maximum diagnostics to collect */
  maxDiagnostics?: number;
}

/**
 * Default analyzer configuration
 */
export const DEFAULT_ANALYZER_CONFIG: Required<AnalyzerConfig> = {
  enablePasses: [],
  disablePasses: [],
  cacheEnabled: true,
  cacheTtlMs: 60000, // 1 minute
  maxCacheEntries: 100,
  includeHints: false,
  passConfig: {},
  failFast: false,
  maxDiagnostics: 100,
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper to extract location from an AST node
 * @deprecated Use node.location directly - parser AST nodes have SourceLocation
 */
export function spanToLocation(
  loc: ParserSourceLocation | SourceLocation | undefined | null, 
  file: string
): SourceLocation {
  if (!loc) {
    return {
      file,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };
  }
  return {
    file: loc.file || file,
    line: loc.line || 1,
    column: loc.column || 1,
    endLine: loc.endLine || loc.line || 1,
    endColumn: loc.endColumn || loc.column || 1,
  };
}

/**
 * Get location from an AST node
 */
export function nodeLocation(node: { location: SourceLocation }, file: string): SourceLocation {
  if (node.location) {
    return {
      file: node.location.file || file,
      line: node.location.line,
      column: node.location.column,
      endLine: node.location.endLine,
      endColumn: node.location.endColumn,
    };
  }
  return { file, line: 1, column: 1, endLine: 1, endColumn: 1 };
}

/**
 * Create a diagnostic with code fix suggestion
 */
export interface DiagnosticWithFix extends Diagnostic {
  fix?: CodeFix;
}

/**
 * Pass factory function type
 */
export type PassFactory = (config?: Record<string, unknown>) => SemanticPass;
