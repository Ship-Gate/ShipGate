/**
 * ISL Module Resolution Types
 *
 * Type definitions for the module resolution system including
 * module identifiers, import edges, and the module dependency graph.
 */

import type { SourceSpan } from '../lexer/tokens.js';
import type { DomainDeclaration } from '../ast/types.js';

// ============================================================================
// Module Identification
// ============================================================================

/**
 * Unique module identifier (normalized absolute path or package specifier).
 * Branded type to prevent accidental string assignment.
 *
 * Examples:
 * - "/Users/dev/project/auth.isl"
 * - "@isl-lang/stdlib/auth/session-create.isl"
 * - "@isl-lang/stdlib/auth@1.0.0"
 */
export type ModuleId = string & { readonly __brand: 'ModuleId' };

/**
 * Create a ModuleId from a string (normalized path).
 */
export function createModuleId(path: string): ModuleId {
  // Normalize path separators
  const normalized = path.replace(/\\/g, '/');
  return normalized as ModuleId;
}

/**
 * Original import specifier as written in source code.
 *
 * Captures the raw specifier along with optional alias and version.
 */
export interface ModulePath {
  /** Raw specifier as written (e.g., "stdlib-auth", "./local") */
  raw: string;

  /** Optional alias from "use X as Y" */
  alias?: string;

  /** Optional version constraint from "use X@1.0.0" */
  version?: string;

  /** Source location for error reporting */
  span: SourceSpan;
}

// ============================================================================
// Module Graph Structure
// ============================================================================

/**
 * Edge in the module dependency graph.
 *
 * Represents a single import from one module to another.
 */
export interface ImportEdge {
  /** Module that contains the import statement */
  from: ModuleId;

  /** Module being imported */
  to: ModuleId;

  /** Original import specifier with alias/version info */
  specifier: ModulePath;

  /** Specific symbols imported (empty array = whole module via `use`) */
  symbols: string[];
}

/**
 * Symbol kind for exported symbols.
 */
export type ExportKind = 'entity' | 'behavior' | 'type' | 'enum' | 'invariants';

/**
 * Exported symbol from a module.
 */
export interface ExportedSymbol {
  /** Symbol name */
  name: string;

  /** What kind of declaration this is */
  kind: ExportKind;

  /** Whether this symbol is publicly accessible (default: true for ISL) */
  isPublic: boolean;
}

/**
 * Module metadata after resolution.
 */
export interface ResolvedModule {
  /** Unique identifier for this module */
  id: ModuleId;

  /** Absolute filesystem path to the module file */
  path: string;

  /** Resolved version (if specified or detected from package.json) */
  version?: string;

  /** List of symbols exported by this module */
  exports: ExportedSymbol[];

  /** Parsed AST (cached after first parse) */
  ast?: DomainDeclaration;

  /** File modification time for cache invalidation */
  mtime?: number;
}

/**
 * Complete module dependency graph.
 *
 * Contains all resolved modules and their relationships.
 */
export interface ModuleGraph {
  /** All resolved modules keyed by ModuleId */
  modules: Map<ModuleId, ResolvedModule>;

  /** All import edges in the graph */
  edges: ImportEdge[];

  /** Entry point modules (files explicitly loaded) */
  entryPoints: ModuleId[];

  /** Topologically sorted module order (dependencies before dependents) */
  order: ModuleId[];
}

// ============================================================================
// Resolution Configuration
// ============================================================================

/**
 * Configuration options for the module resolver.
 */
export interface ResolverConfig {
  /** Project root directory (for resolving bare specifiers) */
  projectRoot: string;

  /** Additional search paths relative to project root */
  searchPaths?: string[];

  /** File extensions to try when resolving */
  extensions?: string[];

  /** Path to stdlib package (defaults to @isl-lang/stdlib in node_modules) */
  stdlibPath?: string;

  /** Custom resolver function for special cases */
  customResolver?: (specifier: string, from: string) => string | null;

  /** Whether to follow symlinks when normalizing paths */
  followSymlinks?: boolean;
}

/**
 * Default resolver configuration.
 */
export const DEFAULT_RESOLVER_CONFIG: Partial<ResolverConfig> = {
  searchPaths: ['.', 'intents/', 'specs/'],
  extensions: ['.isl', '/index.isl'],
  followSymlinks: true,
};

// ============================================================================
// Resolution Results
// ============================================================================

/**
 * Result of resolving a single module specifier.
 */
export interface ResolutionResult {
  /** Whether resolution succeeded */
  success: boolean;

  /** Resolved module (if successful) */
  module?: ResolvedModule;

  /** Error code if resolution failed */
  errorCode?: 'MODULE_NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_SPECIFIER';

  /** Human-readable error message */
  errorMessage?: string;

  /** Candidates that were tried (for debugging) */
  triedPaths?: string[];
}

/**
 * Result of building the complete module graph.
 */
export interface GraphBuildResult {
  /** Whether the graph was built successfully */
  success: boolean;

  /** The module graph (if successful) */
  graph?: ModuleGraph;

  /** Circular dependencies detected (arrays of module IDs forming cycles) */
  cycles?: ModuleId[][];

  /** Version conflicts detected */
  versionConflicts?: VersionConflict[];

  /** Modules that failed to resolve */
  unresolved?: Array<{ specifier: ModulePath; from: ModuleId; error: string }>;
}

/**
 * Represents a version conflict between two imports of the same module.
 */
export interface VersionConflict {
  /** Module that has conflicting versions */
  moduleId: ModuleId;

  /** First import with version */
  first: {
    from: ModuleId;
    version: string;
    span: SourceSpan;
  };

  /** Second import with conflicting version */
  second: {
    from: ModuleId;
    version: string;
    span: SourceSpan;
  };
}

// ============================================================================
// Stdlib Mapping
// ============================================================================

/**
 * Stdlib category inferred from module name.
 */
export type StdlibCategory = 'auth' | 'payments' | 'uploads';

/**
 * Mapping of stdlib module names to their paths.
 */
export interface StdlibModuleInfo {
  /** Category (auth, payments, uploads) */
  category: StdlibCategory;

  /** Base module name without stdlib- prefix */
  name: string;

  /** Full path within @isl-lang/stdlib package */
  path: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a specifier is a relative path.
 */
export function isRelativePath(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Check if a specifier is a stdlib module.
 */
export function isStdlibModule(specifier: string): boolean {
  return specifier.startsWith('stdlib-');
}

/**
 * Check if a specifier is a scoped package (@org/name).
 */
export function isScopedPackage(specifier: string): boolean {
  return specifier.startsWith('@');
}

/**
 * Parse a module specifier to extract name, version, and alias.
 *
 * Examples:
 * - "stdlib-auth" → { name: "stdlib-auth" }
 * - "stdlib-auth@1.0.0" → { name: "stdlib-auth", version: "1.0.0" }
 * - "stdlib-auth as auth" → { name: "stdlib-auth", alias: "auth" }
 * - "stdlib-auth@1.0.0 as auth" → { name: "stdlib-auth", version: "1.0.0", alias: "auth" }
 */
export function parseModuleSpecifier(specifier: string): {
  name: string;
  version?: string;
  alias?: string;
} {
  // Remove alias part first
  let alias: string | undefined;
  let remaining = specifier;

  const asMatch = specifier.match(/^(.+?)\s+as\s+(\w+)$/);
  if (asMatch) {
    remaining = (asMatch[1] ?? remaining).trim();
    alias = asMatch[2];
  }

  // Extract version
  let version: string | undefined;
  let name = remaining;

  const versionMatch = remaining.match(/^(.+?)@([^@]+)$/);
  if (versionMatch) {
    name = versionMatch[1] ?? remaining;
    version = versionMatch[2];
  }

  return { name, version, alias };
}

/**
 * Infer stdlib category from module name.
 *
 * @param moduleName - Module name like "stdlib-auth" or "session-create"
 * @returns Category or null if not a known stdlib module
 */
export function inferStdlibCategory(moduleName: string): StdlibCategory | null {
  // Remove stdlib- prefix if present
  const baseName = moduleName.replace(/^stdlib-/, '');

  // Known module to category mappings
  const categoryMap: Record<string, StdlibCategory> = {
    // Auth modules
    auth: 'auth',
    'oauth-login': 'auth',
    'password-reset': 'auth',
    'session-create': 'auth',
    'rate-limit-login': 'auth',

    // Payment modules
    payments: 'payments',
    'process-payment': 'payments',
    'process-refund': 'payments',
    'subscription-create': 'payments',
    'webhook-handle': 'payments',

    // Upload modules
    uploads: 'uploads',
    'upload-image': 'uploads',
    'store-blob': 'uploads',
    'validate-mime': 'uploads',
  };

  return categoryMap[baseName] ?? null;
}

/**
 * Create an empty module graph.
 */
export function createEmptyGraph(): ModuleGraph {
  return {
    modules: new Map(),
    edges: [],
    entryPoints: [],
    order: [],
  };
}
