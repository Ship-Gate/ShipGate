/**
 * TypeScript/JavaScript resolver - type definitions
 * @module @isl-lang/hallucination-scanner/ts
 */

/**
 * Source location for diagnostics
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Parsed TS/JS import statement
 */
export interface TsImport {
  /** The module specifier as written, e.g. "express", "./utils", "@scope/pkg" */
  specifier: string;
  /** Whether this is a Node.js built-in (e.g. "fs", "node:path") */
  isBuiltin: boolean;
  /** Whether this is a relative import (starts with . or ..) */
  isRelative: boolean;
  /** Whether this is a scoped package (starts with @) */
  isScoped: boolean;
  /** Package name (bare specifier root): "express", "@scope/pkg" */
  packageName?: string | undefined;
  /** The import kind */
  kind: TsImportKind;
  /** Location in source */
  location: SourceLocation;
  /** Raw text of the import statement */
  raw: string;
}

/**
 * Import statement kind
 */
export type TsImportKind =
  | 'import'          // import x from 'y'  /  import { x } from 'y'
  | 'import-type'     // import type { X } from 'y'
  | 'dynamic'         // import('y')  /  await import('y')
  | 'require'         // require('y')  /  const x = require('y')
  | 'export-from';    // export { x } from 'y'  /  export * from 'y'

/**
 * Kind of dependency finding
 */
export type TsFindingKind =
  | 'missing_package'      // Used in code but not in package.json
  | 'phantom_package'      // No package.json found; cannot verify
  | 'ghost_import'         // Import of a non-existent relative module
  | 'unknown_builtin'      // Looks like a builtin but isn't (e.g. "node:fakemod")
  | 'type_only_missing';   // Type-only import for package not in devDependencies

/**
 * A single dependency/import finding
 */
export interface TsFinding {
  kind: TsFindingKind;
  message: string;
  /** The import specifier that triggered the finding */
  specifier: string;
  /** Resolved package name if applicable */
  packageName?: string;
  location: SourceLocation;
  suggestion?: string;
}

/**
 * Parsed package.json manifest (relevant fields only)
 */
export interface PackageManifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Result of TS/JS dependency resolution
 */
export interface TsDependencyCheckResult {
  success: boolean;
  /** Parsed package.json, null if not found */
  manifest: PackageManifest | null;
  /** All parsed imports across scanned files */
  imports: TsImport[];
  /** Findings (ghost imports, missing packages, etc.) */
  findings: TsFinding[];
  /** Packages declared in package.json (all dep sections) */
  declaredPackages: Set<string>;
  /** Packages used in code but not in package.json */
  missingPackages: string[];
  /** Trust score 0-100 (100 = no issues) */
  trustScore: number;
}
