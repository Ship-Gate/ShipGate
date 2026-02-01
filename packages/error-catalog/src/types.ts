/**
 * Type definitions for error catalog
 */

/**
 * HTTP status code category
 */
export type HttpStatusCategory =
  | 'client_error'    // 4xx
  | 'server_error'    // 5xx
  | 'success'         // 2xx (for completeness)
  | 'redirect';       // 3xx

/**
 * Error severity level
 */
export type ErrorSeverity =
  | 'critical'   // System is unusable
  | 'error'      // Action failed
  | 'warning'    // Degraded but functional
  | 'info';      // Informational

/**
 * Error definition extracted from ISL
 */
export interface ErrorDefinition {
  /** Unique error identifier (e.g., "DUPLICATE_EMAIL") */
  id: string;

  /** Numeric error code (e.g., "AUTH_001") */
  code: string;

  /** Domain this error belongs to */
  domain: string;

  /** HTTP status code */
  httpStatus: number;

  /** Human-readable error message */
  message: string;

  /** Detailed description */
  description: string;

  /** Whether the operation can be retried */
  retriable: boolean;

  /** Retry delay in seconds (if retriable) */
  retryAfter?: number;

  /** Error severity */
  severity: ErrorSeverity;

  /** When this error occurs */
  causes: string[];

  /** How to resolve this error */
  resolutions: string[];

  /** Related error IDs */
  relatedErrors: string[];

  /** Example error response */
  example?: ErrorExample;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** Source file where error was defined */
  sourceFile?: string;

  /** Line number in source file */
  sourceLine?: number;

  /** Tags for categorization */
  tags: string[];

  /** Deprecation info if deprecated */
  deprecated?: {
    since: string;
    replacement?: string;
    message: string;
  };
}

/**
 * Example error response
 */
export interface ErrorExample {
  /** Example request that causes this error */
  request?: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  };

  /** Example error response */
  response: {
    status: number;
    body: Record<string, unknown>;
  };
}

/**
 * Error group (by domain, category, etc.)
 */
export interface ErrorGroup {
  /** Group identifier */
  id: string;

  /** Group display name */
  name: string;

  /** Group description */
  description?: string;

  /** Errors in this group */
  errors: ErrorDefinition[];

  /** Child groups (for hierarchical grouping) */
  children?: ErrorGroup[];
}

/**
 * Catalog configuration
 */
export interface CatalogConfig {
  /** Glob pattern for ISL input files */
  inputGlob: string;

  /** How to group errors */
  groupBy?: 'domain' | 'httpStatus' | 'severity' | 'tag';

  /** How to sort errors within groups */
  sortBy?: 'code' | 'id' | 'httpStatus' | 'severity';

  /** Output configurations */
  outputs: {
    markdown?: MarkdownConfig;
    json?: JsonConfig;
    typescript?: TypeScriptConfig;
    openapi?: OpenAPIConfig;
    website?: WebsiteConfig;
  };
}

/**
 * Markdown generator config
 */
export interface MarkdownConfig {
  /** Output directory */
  outputDir: string;

  /** Single file or split by group */
  splitByGroup?: boolean;

  /** Include table of contents */
  includeToc?: boolean;

  /** Include examples */
  includeExamples?: boolean;

  /** Template file (handlebars) */
  template?: string;
}

/**
 * JSON generator config
 */
export interface JsonConfig {
  /** Output file path */
  outputFile: string;

  /** Pretty print JSON */
  pretty?: boolean;

  /** Include source locations */
  includeSourceLocations?: boolean;
}

/**
 * TypeScript generator config
 */
export interface TypeScriptConfig {
  /** Output file path */
  outputFile: string;

  /** Generate error classes */
  generateClasses?: boolean;

  /** Generate type guards */
  generateTypeGuards?: boolean;

  /** Generate factory functions */
  generateFactories?: boolean;

  /** Base error class name */
  baseClassName?: string;
}

/**
 * OpenAPI generator config
 */
export interface OpenAPIConfig {
  /** Output file path */
  outputFile: string;

  /** OpenAPI version (3.0 or 3.1) */
  version?: '3.0' | '3.1';

  /** Include in components/schemas */
  includeSchemas?: boolean;

  /** Include in components/responses */
  includeResponses?: boolean;
}

/**
 * Website generator config
 */
export interface WebsiteConfig {
  /** Output directory */
  outputDir: string;

  /** Site title */
  title?: string;

  /** Site description */
  description?: string;

  /** Include search functionality */
  includeSearch?: boolean;

  /** Theme (light, dark, auto) */
  theme?: 'light' | 'dark' | 'auto';

  /** Custom CSS file */
  customCss?: string;

  /** Logo URL */
  logo?: string;
}

/**
 * Generator output
 */
export interface GeneratorOutput {
  /** Output file path */
  path: string;

  /** File content */
  content: string;

  /** Output type */
  type: 'markdown' | 'json' | 'typescript' | 'yaml' | 'html' | 'css' | 'js';
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  /** Extracted errors */
  errors: ErrorDefinition[];

  /** Extraction warnings */
  warnings: ExtractionWarning[];

  /** Source files processed */
  sourceFiles: string[];
}

/**
 * Extraction warning
 */
export interface ExtractionWarning {
  /** Warning message */
  message: string;

  /** Source file */
  file: string;

  /** Line number */
  line?: number;

  /** Warning severity */
  severity: 'warning' | 'info';
}
