// ============================================================================
// ISL Discovery Types
// ============================================================================

/**
 * ISL symbol from specification (behavior, entity, etc.)
 */
export interface ISLSymbol {
  /** Symbol type */
  type: 'behavior' | 'entity' | 'type' | 'enum';
  /** Symbol name */
  name: string;
  /** Domain name */
  domain: string;
  /** Spec file path */
  specFile: string;
  /** Line range in spec file */
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Code symbol found in implementation
 */
export interface CodeSymbol {
  /** Symbol type */
  type: 'function' | 'route' | 'class' | 'method' | 'export';
  /** Symbol name */
  name: string;
  /** File path */
  file: string;
  /** Line range */
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  /** Additional metadata (route path, HTTP method, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Binding between ISL symbol and code symbol
 */
export interface Binding {
  /** ISL symbol */
  islSymbol: ISLSymbol;
  /** Code symbol */
  codeSymbol: CodeSymbol;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence for this binding */
  evidence: Evidence[];
  /** Strategy used to discover this binding */
  strategy: DiscoveryStrategy;
}

/**
 * Evidence supporting a binding
 */
export interface Evidence {
  /** Type of evidence */
  type: 'name_match' | 'path_match' | 'ast_pattern' | 'config_hint' | 'naming_convention' | 'route_matching';
  /** Description */
  description: string;
  /** Confidence contribution (0-1) */
  confidence: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Discovery strategy type
 */
export type DiscoveryStrategy =
  | 'filesystem_heuristics'
  | 'ast_scanning'
  | 'naming_conventions'
  | 'config_hints'
  | 'route_matching';

/**
 * Discovery result
 */
export interface DiscoveryResult {
  /** All bindings found */
  bindings: Binding[];
  /** ISL symbols that couldn't be bound */
  unboundSymbols: ISLSymbol[];
  /** Code symbols that couldn't be matched */
  unmatchedCodeSymbols: CodeSymbol[];
  /** Statistics */
  stats: {
    totalISLSymbols: number;
    totalCodeSymbols: number;
    boundCount: number;
    averageConfidence: number;
    strategyBreakdown: Record<DiscoveryStrategy, number>;
  };
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /** Root directory to search */
  rootDir: string;
  /** ISL spec file(s) */
  specFiles: string[];
  /** Code directories to search */
  codeDirs?: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Enable AST scanning */
  enableAST?: boolean;
  /** Enable filesystem heuristics */
  enableFilesystem?: boolean;
  /** Enable naming conventions */
  enableNaming?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Bindings file format (.shipgate.bindings.json)
 */
export interface BindingsFile {
  /** Format version */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Spec files */
  specs: string[];
  /** Bindings */
  bindings: BindingEntry[];
}

/**
 * Binding entry in bindings file
 */
export interface BindingEntry {
  /** ISL symbol reference */
  isl: {
    type: string;
    name: string;
    domain: string;
    specFile: string;
    location: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
  /** Code symbol reference */
  code: {
    type: string;
    name: string;
    file: string;
    location: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    metadata?: Record<string, unknown>;
  };
  /** Confidence score */
  confidence: number;
  /** Evidence */
  evidence: Evidence[];
  /** Strategy */
  strategy: DiscoveryStrategy;
}
