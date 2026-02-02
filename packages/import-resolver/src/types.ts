// ============================================================================
// ISL Import Resolver - Type Definitions
// ============================================================================

import type * as AST from '@isl-lang/parser';

/**
 * Configuration options for the import resolver
 */
export interface ResolverOptions {
  /**
   * Base directory for resolving relative imports
   */
  basePath: string;

  /**
   * Whether import resolution is enabled (MVP mode toggle)
   * When false, any imports will result in an error explaining single-file mode
   */
  enableImports: boolean;

  /**
   * Maximum depth for import resolution to prevent infinite loops
   * Default: 100
   */
  maxDepth?: number;

  /**
   * Custom file reader function (for testing or virtual file systems)
   */
  readFile?: (path: string) => Promise<string>;

  /**
   * Custom file existence checker (for testing or virtual file systems)
   */
  fileExists?: (path: string) => Promise<boolean>;

  /**
   * File extension to use when resolving imports without extension
   * Default: '.isl'
   */
  defaultExtension?: string;
}

/**
 * Represents a resolved module with its AST and metadata
 */
export interface ResolvedModule {
  /**
   * Absolute path to the module file
   */
  path: string;

  /**
   * The parsed AST Domain
   */
  ast: AST.Domain;

  /**
   * Direct dependencies (import paths)
   */
  imports: string[];

  /**
   * Modules that this module imports (resolved paths)
   */
  dependencies: string[];
}

/**
 * Dependency graph for all modules
 */
export interface DependencyGraph {
  /**
   * Map of module path to resolved module
   */
  modules: Map<string, ResolvedModule>;

  /**
   * The entry point module path
   */
  entryPoint: string;

  /**
   * Topological sort order (from leaves to root)
   */
  sortedOrder: string[];
}

/**
 * Import specification from the AST
 */
export interface ImportSpec {
  /**
   * Items being imported
   */
  items: ImportItemSpec[];

  /**
   * Source module path
   */
  from: string;

  /**
   * Source location for error reporting
   */
  location: AST.SourceLocation;
}

/**
 * Individual import item
 */
export interface ImportItemSpec {
  /**
   * Original name in source module
   */
  name: string;

  /**
   * Alias in current module (optional)
   */
  alias?: string;

  /**
   * Source location for error reporting
   */
  location: AST.SourceLocation;
}

/**
 * Result of bundling multiple modules
 */
export interface BundleResult {
  /**
   * Whether bundling succeeded
   */
  success: boolean;

  /**
   * The bundled AST (if successful)
   */
  bundle?: AST.Domain;

  /**
   * Errors encountered during bundling
   */
  errors: ResolverError[];

  /**
   * Warnings encountered during bundling
   */
  warnings: ResolverWarning[];

  /**
   * The dependency graph
   */
  graph?: DependencyGraph;
}

/**
 * Error from the import resolver
 */
export interface ResolverError {
  code: ResolverErrorCode;
  message: string;
  path?: string;
  location?: AST.SourceLocation;
  details?: Record<string, unknown>;
}

/**
 * Warning from the import resolver
 */
export interface ResolverWarning {
  code: ResolverWarningCode;
  message: string;
  path?: string;
  location?: AST.SourceLocation;
}

/**
 * Error codes for resolver errors
 */
export enum ResolverErrorCode {
  // MVP Mode Errors
  IMPORTS_DISABLED = 'IMPORTS_DISABLED',
  
  // Resolution Errors
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  READ_ERROR = 'READ_ERROR',
  
  // Cycle Errors
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  
  // Merge Errors
  DUPLICATE_TYPE = 'DUPLICATE_TYPE',
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
  DUPLICATE_BEHAVIOR = 'DUPLICATE_BEHAVIOR',
  DUPLICATE_INVARIANT = 'DUPLICATE_INVARIANT',
  DUPLICATE_POLICY = 'DUPLICATE_POLICY',
  DUPLICATE_VIEW = 'DUPLICATE_VIEW',
  
  // Import Errors
  SYMBOL_NOT_FOUND = 'SYMBOL_NOT_FOUND',
  AMBIGUOUS_IMPORT = 'AMBIGUOUS_IMPORT',
  INVALID_IMPORT_PATH = 'INVALID_IMPORT_PATH',
}

/**
 * Warning codes for resolver warnings
 */
export enum ResolverWarningCode {
  UNUSED_IMPORT = 'UNUSED_IMPORT',
  SHADOWED_IMPORT = 'SHADOWED_IMPORT',
  DEPRECATED_MODULE = 'DEPRECATED_MODULE',
}

/**
 * Exported symbol from a module
 */
export interface ExportedSymbol {
  kind: 'type' | 'entity' | 'behavior' | 'invariant' | 'policy' | 'view';
  name: string;
  node: AST.ASTNode;
  sourcePath: string;
}

/**
 * Symbol table for a module
 */
export interface SymbolTable {
  /**
   * Map of symbol name to exported symbol
   */
  symbols: Map<string, ExportedSymbol>;

  /**
   * Module path
   */
  path: string;
}

/**
 * Merge conflict between two definitions
 */
export interface MergeConflict {
  kind: ExportedSymbol['kind'];
  name: string;
  firstDefinition: {
    path: string;
    location: AST.SourceLocation;
  };
  secondDefinition: {
    path: string;
    location: AST.SourceLocation;
  };
}

/**
 * Cycle in the dependency graph
 */
export interface DependencyCycle {
  /**
   * The modules involved in the cycle (in order)
   */
  path: string[];
}
