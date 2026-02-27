/**
 * Rust resolver - type definitions
 * @module @isl-lang/hallucination-scanner/rust
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
 * Parsed Rust `use` statement
 */
export interface RustUse {
  /** Full path as written, e.g. "std::collections::HashMap" or "serde::Serialize" */
  path: string;
  /** First segment: "std" | "crate" | "super" | "self" | external crate name */
  root: string;
  /** Whether this is the standard library */
  isStd: boolean;
  /** Whether this is the current crate */
  isCrate: boolean;
  /** Whether this is a relative path (super/self) */
  isRelative: boolean;
  /** Location in source */
  location: SourceLocation;
  /** Raw text of the use item (for glob or list) */
  raw?: string;
}

/**
 * Parsed Cargo.toml [package] section
 */
export interface CargoPackage {
  name: string;
  version?: string;
  edition?: string;
}

/**
 * Dependency entry in Cargo.toml (version string or table)
 */
export type CargoDependencyValue = string | {
  version?: string;
  path?: string;
  git?: string;
  optional?: boolean;
  features?: string[];
};

/**
 * Parsed Cargo.toml manifest
 */
export interface CargoManifest {
  package?: CargoPackage;
  dependencies?: Record<string, CargoDependencyValue>;
  'dev-dependencies'?: Record<string, CargoDependencyValue>;
  'build-dependencies'?: Record<string, CargoDependencyValue>;
  [key: string]: unknown;
}

/**
 * Node in the Rust module graph (one .rs file)
 */
export interface RustModuleNode {
  path: string;
  uses: RustUse[];
  /** Resolved crate names used (external only; std/crate/super/self not included) */
  externalCrates: Set<string>;
  /** Child module paths (mod declarations or submodules) - optional for later */
  children: string[];
}

/**
 * Module graph for a Rust crate
 */
export interface RustModuleGraph {
  /** Entry paths (e.g. src/main.rs, src/lib.rs) */
  entries: string[];
  /** All nodes by normalized path */
  nodes: Map<string, RustModuleNode>;
  /** All external crate names referenced in the project */
  externalCrateRefs: Set<string>;
}

/**
 * Kind of dependency finding
 */
export type RustFindingKind = 'missing_crate' | 'fake_module' | 'unreachable_import';

/**
 * A single dependency/import finding
 */
export interface RustFinding {
  kind: RustFindingKind;
  message: string;
  path?: string;
  crate?: string;
  location: SourceLocation;
  suggestion?: string;
}

/**
 * Result of Cargo-aware dependency check
 */
export interface RustDependencyCheckResult {
  success: boolean;
  manifest: CargoManifest | null;
  graph: RustModuleGraph;
  findings: RustFinding[];
  /** Crates declared in Cargo.toml (dependencies + dev + build) */
  declaredCrates: Set<string>;
  /** Crates used in code but not in Cargo.toml */
  missingCrates: string[];
  /** Trust-relevant score 0-100 (100 = no issues) */
  trustScore: number;
}
