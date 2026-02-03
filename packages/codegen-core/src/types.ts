/**
 * @isl-lang/codegen-core - Type Definitions
 *
 * Core types for deterministic code generation.
 */

// ============================================================================
// Import Types
// ============================================================================

/**
 * Represents a single import statement
 */
export interface ImportStatement {
  /** Module specifier (e.g., 'zod', './types.js') */
  moduleSpecifier: string;
  /** Default import name */
  defaultImport?: string;
  /** Named imports */
  namedImports?: NamedImport[];
  /** Namespace import (import * as X) */
  namespaceImport?: string;
  /** Is this a type-only import? */
  isTypeOnly?: boolean;
}

export interface NamedImport {
  name: string;
  alias?: string;
  isTypeOnly?: boolean;
}

/**
 * Import grouping configuration
 */
export interface ImportGroupConfig {
  /** External packages (npm packages) */
  external: string[];
  /** ISL runtime packages */
  isl: string[];
  /** Patterns for each group (regex) */
  patterns?: {
    external?: RegExp;
    isl?: RegExp;
    sibling?: RegExp;
    parent?: RegExp;
  };
}

// ============================================================================
// Type Sorting Types
// ============================================================================

/**
 * Represents a type declaration for sorting
 */
export interface TypeDeclaration {
  /** Type name */
  name: string;
  /** Types this declaration depends on */
  dependencies: string[];
  /** Original declaration order (from ISL source) */
  declarationOrder: number;
  /** Kind of type for grouping */
  kind: 'utility' | 'enum' | 'alias' | 'interface' | 'behavior';
}

/**
 * Configuration for topological sorting
 */
export interface TopologicalSortConfig {
  /** How to break ties between equal-priority items */
  tieBreaker?: 'alphabetical' | 'declaration-order';
  /** Whether to group by kind first */
  groupByKind?: boolean;
}

// ============================================================================
// Formatter Types
// ============================================================================

/**
 * Supported output languages
 */
export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'graphql';

/**
 * Formatting configuration
 */
export interface FormatConfig {
  /** Target language */
  language: Language;
  /** Indentation style */
  indent: 'spaces' | 'tabs';
  /** Number of spaces for indentation (if using spaces) */
  indentSize: number;
  /** Maximum line width */
  printWidth: number;
  /** Use trailing commas */
  trailingComma: 'none' | 'es5' | 'all';
  /** Use single quotes */
  singleQuote: boolean;
  /** Add semicolons */
  semi: boolean;
  /** End files with newline */
  endOfLine: 'lf' | 'crlf' | 'auto';
}

/**
 * Default format configurations by language
 */
export const DEFAULT_FORMAT_CONFIGS: Record<Language, FormatConfig> = {
  typescript: {
    language: 'typescript',
    indent: 'spaces',
    indentSize: 2,
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: true,
    semi: true,
    endOfLine: 'lf',
  },
  javascript: {
    language: 'javascript',
    indent: 'spaces',
    indentSize: 2,
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: true,
    semi: true,
    endOfLine: 'lf',
  },
  python: {
    language: 'python',
    indent: 'spaces',
    indentSize: 4,
    printWidth: 88,
    trailingComma: 'all',
    singleQuote: false,
    semi: false,
    endOfLine: 'lf',
  },
  go: {
    language: 'go',
    indent: 'tabs',
    indentSize: 4,
    printWidth: 100,
    trailingComma: 'none',
    singleQuote: false,
    semi: false,
    endOfLine: 'lf',
  },
  rust: {
    language: 'rust',
    indent: 'spaces',
    indentSize: 4,
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: false,
    semi: true,
    endOfLine: 'lf',
  },
  graphql: {
    language: 'graphql',
    indent: 'spaces',
    indentSize: 2,
    printWidth: 80,
    trailingComma: 'none',
    singleQuote: false,
    semi: false,
    endOfLine: 'lf',
  },
};

// ============================================================================
// Generated File Types
// ============================================================================

/**
 * Represents a generated file
 */
export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** Generated content */
  content: string;
  /** Source ISL file path */
  sourcePath?: string;
  /** Content hash for change detection */
  contentHash?: string;
}

/**
 * Header configuration for generated files
 */
export interface HeaderConfig {
  /** Generator package name */
  generator: string;
  /** Generator version */
  version: string;
  /** Source ISL file path */
  sourcePath?: string;
  /** Include content hash */
  includeHash?: boolean;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

// ============================================================================
// Printer Types
// ============================================================================

/**
 * Code printer interface for building generated code
 */
export interface CodePrinter {
  /** Current indentation level */
  readonly indentLevel: number;
  /** Write a line of code */
  writeLine(line: string): void;
  /** Write without newline */
  write(text: string): void;
  /** Write a blank line */
  blankLine(): void;
  /** Increase indentation */
  indent(): void;
  /** Decrease indentation */
  dedent(): void;
  /** Write a block with increased indentation */
  writeBlock(opener: string, closer: string, content: () => void): void;
  /** Get the generated code */
  toString(): string;
}
