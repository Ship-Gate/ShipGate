// ============================================================================
// Phantom Dependency Scanner - Type Definitions
// ============================================================================

/**
 * Options for scanning dependencies
 */
export interface ScannerOptions {
  /**
   * Project root directory
   */
  projectRoot: string;

  /**
   * Files or directories to scan
   * If not provided, scans all TypeScript/JavaScript files in projectRoot
   */
  files?: string[];

  /**
   * Whether to check npm registry for missing packages
   * Default: false (to avoid blocking CI)
   */
  checkRegistry?: boolean;

  /**
   * Registry check timeout in milliseconds
   * Default: 5000 (5 seconds)
   */
  registryTimeout?: number;

  /**
   * Cache directory for registry checks
   * Default: .phantom-scanner-cache in project root
   */
  cacheDir?: string;

  /**
   * Maximum number of registry checks per run
   * Default: 50
   */
  maxRegistryChecks?: number;

  /**
   * Whether to include typo suggestions
   * Default: true
   */
  suggestTypos?: boolean;

  /**
   * Custom file reader (for testing)
   */
  readFile?: (path: string) => Promise<string>;

  /**
   * Custom file existence checker (for testing)
   */
  fileExists?: (path: string) => Promise<boolean>;
}

/**
 * A finding from the scanner
 */
export interface Finding {
  /**
   * Type of finding
   */
  kind: FindingKind;

  /**
   * Package or module name that caused the issue
   */
  packageName: string;

  /**
   * File where the issue was found
   */
  file: string;

  /**
   * Line number (1-indexed)
   */
  line: number;

  /**
   * Column number (1-indexed)
   */
  column: number;

  /**
   * Import statement that caused the issue
   */
  importStatement: string;

  /**
   * Confidence score (0-100)
   * Higher = more confident this is a real issue
   */
  confidence: number;

  /**
   * Suggested fixes (typo candidates, etc.)
   */
  suggestions?: string[];

  /**
   * Additional context
   */
  details?: Record<string, unknown>;
}

/**
 * Types of findings
 */
export enum FindingKind {
  /**
   * Package is imported but not in package.json dependencies
   */
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',

  /**
   * Import cannot be resolved (file doesn't exist)
   */
  UNRESOLVABLE_IMPORT = 'UNRESOLVABLE_IMPORT',

  /**
   * Imported symbol is not exported from the module
   */
  SYMBOL_NOT_EXPORTED = 'SYMBOL_NOT_EXPORTED',

  /**
   * Package doesn't exist on npm registry
   */
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
}

/**
 * Result of scanning
 */
export interface ScanResult {
  /**
   * All findings
   */
  findings: Finding[];

  /**
   * Number of files scanned
   */
  filesScanned: number;

  /**
   * Total number of imports checked
   */
  importsChecked: number;

  /**
   * Whether registry checks were performed
   */
  registryChecksPerformed: boolean;

  /**
   * Number of registry checks made
   */
  registryChecksMade: number;

  /**
   * Errors encountered during scanning
   */
  errors: Error[];
}

/**
 * Workspace information
 */
export interface WorkspaceInfo {
  /**
   * Whether this is a pnpm workspace
   */
  isPnpmWorkspace: boolean;

  /**
   * Workspace root directory
   */
  workspaceRoot: string;

  /**
   * List of workspace package names
   */
  workspacePackages: string[];

  /**
   * Map of package name to package path
   */
  packageMap: Map<string, string>;
}

/**
 * Package.json structure (subset we care about)
 */
export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Import statement parsed from source code
 */
export interface ParsedImport {
  /**
   * Module specifier (e.g., "lodash", "./utils", "@types/node")
   */
  specifier: string;

  /**
   * Imported symbols (if named imports)
   */
  symbols?: string[];

  /**
   * Whether it's a type-only import
   */
  isTypeOnly: boolean;

  /**
   * File where this import was found
   */
  file: string;

  /**
   * Line number (1-indexed)
   */
  line: number;

  /**
   * Column number (1-indexed)
   */
  column: number;

  /**
   * Full import statement text
   */
  statement: string;
}
