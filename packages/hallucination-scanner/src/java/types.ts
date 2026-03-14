/**
 * Java resolver - type definitions
 * @module @isl-lang/hallucination-scanner/java
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
 * Parsed Java import statement
 */
export interface JavaImport {
  /** Full import path as written, e.g. "java.util.List", "com.google.gson.Gson" */
  path: string;
  /** Whether this is a JDK standard library import (java.*, javax.*) */
  isStdlib: boolean;
  /** Whether this is a wildcard import (ends with .*) */
  isWildcard: boolean;
  /** Whether this is a static import */
  isStatic: boolean;
  /** The top-level package group, e.g. "com.google.gson" for "com.google.gson.Gson" */
  groupId?: string | undefined;
  /** The artifact this likely belongs to (best guess from groupId) */
  artifactHint?: string | undefined;
  /** Location in source */
  location: SourceLocation;
  /** Raw text of the import statement */
  raw: string;
}

/**
 * Kind of dependency finding
 */
export type JavaFindingKind =
  | 'missing_dependency'    // Used in code but not in build config
  | 'phantom_package'       // No build config found; cannot verify
  | 'deprecated_package'    // Import from known deprecated package
  | 'wildcard_import'       // Wildcard imports hide actual dependencies
  | 'unknown_package';      // Package doesn't match any known group

/**
 * A single dependency/import finding
 */
export interface JavaFinding {
  kind: JavaFindingKind;
  message: string;
  /** Import path that triggered the finding */
  importPath: string;
  /** Resolved group/artifact if applicable */
  groupId?: string;
  artifactId?: string;
  location: SourceLocation;
  suggestion?: string;
}

/**
 * Parsed Maven pom.xml dependency
 */
export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version?: string;
  scope?: string;
}

/**
 * Parsed Gradle dependency
 */
export interface GradleDependency {
  configuration: string;
  group: string;
  name: string;
  version?: string;
}

/**
 * Build configuration info (Maven or Gradle)
 */
export interface JavaBuildConfig {
  type: 'maven' | 'gradle';
  dependencies: Array<MavenDependency | GradleDependency>;
  /** All declared group IDs */
  declaredGroups: Set<string>;
}

/**
 * Result of Java dependency resolution
 */
export interface JavaDependencyCheckResult {
  success: boolean;
  /** Build config info, null if not found */
  buildConfig: JavaBuildConfig | null;
  /** All parsed imports across scanned files */
  imports: JavaImport[];
  /** Findings (missing deps, phantom packages, etc.) */
  findings: JavaFinding[];
  /** Groups declared in build config */
  declaredGroups: Set<string>;
  /** Groups used in code but not in build config */
  missingGroups: string[];
  /** Trust score 0-100 (100 = no issues) */
  trustScore: number;
}
