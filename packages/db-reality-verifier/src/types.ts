/**
 * Core types for Database Reality Verifier
 */

/**
 * Database schema representation
 */
export interface DatabaseSchema {
  tables: Table[];
  relations: Relation[];
  source: 'prisma' | 'drizzle' | 'sql';
  sourceFile: string;
}

/**
 * Table definition
 */
export interface Table {
  name: string;
  columns: Column[];
  indexes?: Index[];
}

/**
 * Column definition
 */
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string;
  foreignKey?: ForeignKey;
}

/**
 * Foreign key reference
 */
export interface ForeignKey {
  table: string;
  column: string;
}

/**
 * Index definition
 */
export interface Index {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * Relation between tables
 */
export interface Relation {
  from: { table: string; column: string };
  to: { table: string; column: string };
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

/**
 * Extracted query from source code
 */
export interface ExtractedQuery {
  type: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
  tables: string[];
  columns: string[];
  filePath: string;
  line: number;
  column: number;
  source: string; // Original code snippet
  confidence: number; // 0-1, how confident we are this is a real query
  orm: 'prisma' | 'drizzle' | 'raw-sql' | 'sql-template' | 'unknown';
}

/**
 * Mismatch detected between query and schema
 */
export interface Mismatch {
  severity: 'error' | 'warning' | 'info';
  message: string;
  query: ExtractedQuery;
  issue: 'missing-table' | 'missing-column' | 'missing-relation' | 'type-mismatch';
  expected?: string | undefined;
  actual: string;
  suggestion?: string | undefined; // Closest match suggestion
  confidence: number; // 0-1, how confident we are this is a real issue
}

/**
 * Verification result
 */
export interface VerificationResult {
  mismatches: Mismatch[];
  totalQueries: number;
  verifiedQueries: number;
  schema: DatabaseSchema;
}

/**
 * Options for verification
 */
export interface VerificationOptions {
  schemaFiles: string[];
  sourceFiles: string[];
  minConfidence?: number; // Minimum confidence to report (default: 0.7)
  includeWarnings?: boolean; // Include warnings (default: true)
  maxSuggestions?: number; // Max typo suggestions per mismatch (default: 3)
}
