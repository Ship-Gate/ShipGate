/**
 * Go resolver - type definitions
 * @module @isl-lang/hallucination-scanner/go
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
 * Parsed Go import statement
 */
export interface GoImport {
  /** Import path as written, e.g. "fmt", "github.com/foo/bar" */
  path: string;
  /** Whether this is a Go standard library package */
  isStdlib: boolean;
  /** Whether this is an internal (same-module) package */
  isInternal: boolean;
  /** Whether this is an external (third-party) package */
  isExternal: boolean;
  /** The module root for external imports (e.g. "github.com/foo/bar" from "github.com/foo/bar/baz") */
  moduleRoot?: string | undefined;
  /** Location in source */
  location: SourceLocation;
}

/**
 * Kind of dependency finding
 */
export type GoFindingKind =
  | 'missing_module'
  | 'fake_package'
  | 'unknown_stdlib'
  | 'unresolved_internal';

/**
 * A single dependency/import finding
 */
export interface GoFinding {
  kind: GoFindingKind;
  message: string;
  /** Import path that triggered the finding */
  importPath: string;
  /** Module root if external */
  moduleRoot?: string;
  location: SourceLocation;
  suggestion?: string;
}

/**
 * Parsed go.mod info (minimal re-export for resolver use)
 */
export interface GoModInfo {
  /** Module path from "module" directive */
  modulePath: string;
  /** Go version if present */
  goVersion?: string | undefined;
  /** Required modules: path -> version */
  require: Map<string, string>;
  /** Replace directives: from -> to */
  replace: Map<string, string>;
  /** Directory containing go.mod */
  dir: string;
}

/**
 * Result of Go dependency resolution
 */
export interface GoDependencyCheckResult {
  success: boolean;
  /** Parsed go.mod, null if not found */
  goMod: GoModInfo | null;
  /** All parsed imports across scanned files */
  imports: GoImport[];
  /** Findings (ghost imports, missing modules, etc.) */
  findings: GoFinding[];
  /** Modules declared in go.mod */
  declaredModules: Set<string>;
  /** Modules used in code but not in go.mod */
  missingModules: string[];
  /** Trust score 0-100 (100 = no issues) */
  trustScore: number;
}
