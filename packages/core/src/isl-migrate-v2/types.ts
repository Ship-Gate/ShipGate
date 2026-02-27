/**
 * ISL Migration V2 Types
 *
 * Enhanced type definitions for converting contract sources
 * (OpenAPI, Zod, TypeScript) into ISL AST with explicit
 * openQuestions tracking for unknowns.
 */

import type {
  Domain,
  TypeDefinition,
  SourceLocation,
} from '@isl-lang/parser';

// ============================================================================
// Source Contract Types
// ============================================================================

/**
 * Supported source contract formats
 */
export type SourceType = 'openapi' | 'zod' | 'typescript';

/**
 * Input source for migration
 */
export interface MigrationSource {
  /** Unique identifier */
  id: string;
  /** Source type */
  sourceType: SourceType;
  /** Display name */
  name: string;
  /** File path (for reference) */
  filePath: string;
  /** Raw content */
  content: string;
  /** Version info if available */
  version?: string;
}

// ============================================================================
// Open Questions - Tracking Unknowns
// ============================================================================

/**
 * Categories of open questions generated during migration
 */
export type QuestionCategory =
  | 'type_mapping'       // Type couldn't be precisely mapped
  | 'constraint_loss'    // Constraints couldn't be preserved
  | 'behavior_contract'  // Missing pre/post conditions
  | 'security'           // Security requirements unclear
  | 'validation'         // Validation rules unclear
  | 'relationship'       // Entity relationships unclear
  | 'naming'             // Naming ambiguities
  | 'semantics';         // Semantic meaning unclear

/**
 * Priority levels for open questions
 */
export type QuestionPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * An open question generated during migration
 * Represents something the migrator couldn't determine automatically
 */
export interface OpenQuestion {
  /** Unique identifier */
  id: string;
  /** Category of the question */
  category: QuestionCategory;
  /** Priority for resolution */
  priority: QuestionPriority;
  /** Human-readable question/description */
  question: string;
  /** Context about where this came from */
  sourceContext?: {
    file: string;
    path?: string;  // JSON path or source location
    line?: number;
  };
  /** Target element in the generated ISL */
  targetElement?: string;
  /** Suggested resolution or options */
  suggestion?: string;
  /** Possible answers/options */
  options?: string[];
  /** Related question IDs */
  relatedQuestions?: string[];
}

// ============================================================================
// Extracted Intermediate Types
// ============================================================================

/**
 * Extracted type information (before ISL conversion)
 */
export interface ExtractedType {
  kind: 'primitive' | 'object' | 'array' | 'enum' | 'union' | 'reference' | 'unknown';
  name?: string;
  primitiveType?: string;
  properties?: ExtractedProperty[];
  itemType?: ExtractedType;
  enumValues?: Array<string | number>;
  unionTypes?: ExtractedType[];
  refName?: string;
  constraints?: TypeConstraints;
  nullable?: boolean;
  description?: string;
}

/**
 * Extracted property/field information
 */
export interface ExtractedProperty {
  name: string;
  type: ExtractedType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  source?: 'path' | 'query' | 'header' | 'body' | 'cookie';
}

/**
 * Type constraints that can be extracted
 */
export interface TypeConstraints {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  [key: string]: unknown;
}

/**
 * Extracted operation/endpoint information
 */
export interface ExtractedOperation {
  name: string;
  method?: string;
  path?: string;
  description?: string;
  inputs: ExtractedProperty[];
  output?: ExtractedType;
  errors: ExtractedError[];
  security?: string[];
  tags?: string[];
}

/**
 * Extracted error information
 */
export interface ExtractedError {
  name: string;
  statusCode?: number;
  description?: string;
  schema?: ExtractedType;
}

// ============================================================================
// Migration Result
// ============================================================================

/**
 * Statistics from migration
 */
export interface MigrationStats {
  /** Total types extracted */
  typesExtracted: number;
  /** Total behaviors created */
  behaviorsCreated: number;
  /** Total entities inferred */
  entitiesInferred: number;
  /** Count of open questions */
  openQuestionsCount: number;
  /** Types that needed fallback */
  fallbacksUsed: number;
  /** Processing time in ms */
  durationMs: number;
}

/**
 * Result of migration
 */
export interface MigrationResult {
  /** Generated ISL AST (partial Domain) */
  ast: Partial<Domain>;
  /** Open questions that need human review */
  openQuestions: OpenQuestion[];
  /** Migration statistics */
  stats: MigrationStats;
  /** Source IDs that were processed */
  processedSources: string[];
  /** Raw canonical ISL output */
  islOutput?: string;
}

// ============================================================================
// Migration Configuration
// ============================================================================

/**
 * Configuration options for migration
 */
export interface MigrationConfig {
  /** Domain name (default: inferred) */
  domainName?: string;
  /** Domain version */
  version?: string;
  /** Generate placeholder preconditions */
  generatePreconditions?: boolean;
  /** Generate placeholder postconditions */
  generatePostconditions?: boolean;
  /** Infer entities from types */
  inferEntities?: boolean;
  /** Strict mode - fail on unknowns vs add questions */
  strict?: boolean;
  /** Naming convention */
  naming?: 'camelCase' | 'PascalCase' | 'preserve';
}

/**
 * Default migration configuration
 */
export const DEFAULT_CONFIG: Required<MigrationConfig> = {
  domainName: 'MigratedAPI',
  version: '1.0.0',
  generatePreconditions: true,
  generatePostconditions: true,
  inferEntities: true,
  strict: false,
  naming: 'PascalCase',
};

// ============================================================================
// Source Adapter Interface
// ============================================================================

/**
 * Interface for source-specific adapters
 */
export interface SourceAdapter {
  readonly sourceType: SourceType;
  extractTypes(source: MigrationSource): ExtractedType[];
  extractOperations(source: MigrationSource): ExtractedOperation[];
}

// ============================================================================
// ISL Primitive Types
// ============================================================================

export type ISLPrimitive =
  | 'String'
  | 'Int'
  | 'Decimal'
  | 'Boolean'
  | 'Timestamp'
  | 'UUID'
  | 'Duration';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a synthetic source location
 */
export function createLocation(file: string): SourceLocation {
  return {
    file,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

/**
 * Generate unique question ID
 */
export function generateQuestionId(category: QuestionCategory, index: number): string {
  return `q-${category}-${index}-${Date.now().toString(36)}`;
}

/**
 * Map source primitive types to ISL primitives
 */
export const PRIMITIVE_MAP: Record<string, ISLPrimitive> = {
  // String types
  'string': 'String',
  'String': 'String',
  // Integer types
  'int': 'Int',
  'Int': 'Int',
  'integer': 'Int',
  'int32': 'Int',
  'int64': 'Int',
  // Decimal types
  'number': 'Decimal',
  'Decimal': 'Decimal',
  'float': 'Decimal',
  'double': 'Decimal',
  // Boolean types
  'boolean': 'Boolean',
  'Boolean': 'Boolean',
  'bool': 'Boolean',
  // Timestamp types
  'Date': 'Timestamp',
  'date': 'Timestamp',
  'datetime': 'Timestamp',
  'date-time': 'Timestamp',
  'Timestamp': 'Timestamp',
  // UUID types
  'uuid': 'UUID',
  'UUID': 'UUID',
  // Duration types
  'duration': 'Duration',
  'Duration': 'Duration',
};
