/**
 * Coherence Engine Types
 *
 * Project manifest and coherence check result types.
 */

// ============================================================================
// PROJECT MANIFEST
// ============================================================================

/**
 * Entry for a single file in the project manifest.
 */
export interface ManifestEntry {
  /** Exported symbols (functions, classes, types, constants) */
  exports: string[];
  /** Type/interface names exported */
  types: string[];
  /** Import specifiers this file depends on (relative paths, @/ aliases, package names) */
  dependencies: string[];
}

/**
 * Map of file path → manifest entry.
 * Used to track what each generated file exports and imports.
 */
export type ProjectManifest = Map<string, ManifestEntry>;

// ============================================================================
// PARSED IMPORT/EXPORT
// ============================================================================

/**
 * A parsed import statement.
 */
export interface ParsedImport {
  /** Module specifier (e.g. './utils', '@/lib/db', 'zod') */
  specifier: string;
  /** Named imports (or default import name) */
  names: string[];
  /** Whether this is a type-only import */
  typeOnly: boolean;
  /** Line number (1-based) */
  line: number;
}

/**
 * A parsed export (symbol name).
 */
export interface ParsedExport {
  /** Exported symbol name */
  name: string;
  /** Whether it's a type/interface export */
  isType: boolean;
  /** Line number (1-based) */
  line: number;
}

// ============================================================================
// COHERENCE CHECK RESULTS
// ============================================================================

/**
 * An unresolved import - the specifier doesn't resolve to a generated file.
 */
export interface UnresolvedImport {
  /** File containing the import */
  file: string;
  /** The import specifier that failed */
  specifier: string;
  /** Line number */
  line: number;
  /** Suggested fix (if auto-fixable) */
  suggestedFix?: string;
  /** Reason the import failed */
  reason: 'missing_file' | 'wrong_path' | 'missing_extension' | 'unknown';
}

/**
 * Result of a coherence check.
 */
export interface CoherenceCheckResult {
  /** Whether all imports resolve */
  coherent: boolean;
  /** Unresolved imports */
  unresolved: UnresolvedImport[];
  /** Auto-fixes that were applied */
  autoFixes: Array<{ file: string; specifier: string; fix: string }>;
}

// ============================================================================
// CODECEN CONTEXT
// ============================================================================

/**
 * Context to inject into codegen prompts before generating each file.
 */
export interface CodegenContext {
  /** Current manifest (what's been generated so far) */
  manifest: Record<string, { exports: string[]; types: string[]; dependencies: string[] }>;
  /** Suggested import paths for common modules */
  suggestedImports: string[];
}
