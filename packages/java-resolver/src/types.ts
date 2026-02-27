/**

 * Java Resolver - Type Definitions

 *

 * @module @isl-lang/java-resolver

 */



/** Extracted import from Java source */

export interface JavaImport {

  /** Fully qualified package + class name (e.g. java.util.List) */

  fqn: string;

  /** Line number (1-based) */

  line: number;

  /** Column offset (0-based) */

  column: number;

  /** Whether this is a star import (import pkg.*) */

  isStarImport: boolean;

}



/** Resolved dependency from build tool */

export interface ResolvedDependency {

  /** Maven groupId or Gradle group */

  groupId: string;

  /** Maven artifactId or Gradle name */

  artifactId: string;

  /** Version string */

  version?: string;

  /** Scope (compile, test, etc.) */

  scope?: string;

}



/** Result of checking an import */

export interface ImportCheckResult {

  /** The checked import */

  import: JavaImport;

  /** Whether the import was resolved */

  resolved: boolean;

  /** Source of resolution */

  source?: 'jdk' | 'maven' | 'gradle' | 'source';

  /** Error if unresolved (fake package or unreachable) */

  error?: 'fake_package' | 'unreachable_class' | 'missing_dependency';

  /** Human-readable message */

  message?: string;

}



/** Hallucination detection result */

export interface HallucinationReport {

  /** All imports from the file */

  imports: JavaImport[];

  /** Check results per import */

  results: ImportCheckResult[];

  /** Imports that could not be resolved (potential hallucinations) */

  fakePackages: JavaImport[];

  /** Unreachable classes (import exists but class not found) */

  unreachableClasses: JavaImport[];

  /** Build tool used */

  buildTool: 'maven' | 'gradle' | 'none';

}



/** Java resolver options */

export interface JavaResolverOptions {

  /** Project root directory */

  projectRoot: string;

  /** Source directories (e.g. src/main/java) */

  sourceDirs?: string[];

  /** JDK modules to consider as available (default: java.*, javax.*) */

  jdkPackages?: string[];

}

