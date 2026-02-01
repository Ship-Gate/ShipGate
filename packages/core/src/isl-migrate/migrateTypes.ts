/**
 * ISL Migration Types
 * 
 * Type definitions for converting existing contract sources
 * (OpenAPI, Zod, TypeScript) into ISL AST.
 */

import type {
  Domain,
  TypeDeclaration,
  Behavior,
  Entity,
  Field,
  TypeDefinition,
  SourceLocation,
} from '@isl-lang/parser';

/**
 * Supported source contract formats
 */
export type ContractSourceType = 'openapi' | 'zod' | 'typescript';

/**
 * Input contract to be migrated
 */
export interface ApiContract {
  /** Unique identifier for the contract */
  id: string;
  /** Source type */
  sourceType: ContractSourceType;
  /** Name of the contract/API */
  name: string;
  /** Source file path */
  sourcePath: string;
  /** Raw source content */
  content: string;
  /** Version (if available) */
  version?: string;
}

/**
 * OpenAPI-specific contract input
 */
export interface OpenAPIContract extends ApiContract {
  sourceType: 'openapi';
  /** Parsed OpenAPI spec (if pre-parsed) */
  parsed?: OpenAPISpec;
}

/**
 * Zod-specific contract input
 */
export interface ZodContract extends ApiContract {
  sourceType: 'zod';
  /** Export names to extract */
  exports?: string[];
}

/**
 * TypeScript-specific contract input
 */
export interface TypeScriptContract extends ApiContract {
  sourceType: 'typescript';
  /** Interface/type names to extract */
  typeNames?: string[];
}

/**
 * Simplified OpenAPI spec structure (subset used for migration)
 */
export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths?: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: OpenAPISchema }>;
  };
  responses?: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  tags?: string[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

export interface OpenAPIResponse {
  description?: string;
  content?: Record<string, { schema?: OpenAPISchema }>;
}

export interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: Array<string | number>;
  $ref?: string;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  default?: unknown;
}

/**
 * Priority levels for migration notes
 */
export type NotePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Categories of migration notes
 */
export type NoteCategory = 
  | 'type_mapping'      // Type conversion issues
  | 'constraint_loss'   // Constraints that couldn't be preserved
  | 'behavior_gap'      // Missing behavior/contract info
  | 'security_unknown'  // Security requirements unclear
  | 'naming'            // Naming convention issues
  | 'validation'        // Validation rules unclear
  | 'relationship'      // Entity relationships unclear
  | 'general';          // General notes

/**
 * A note generated during migration (compatible with evidence OpenQuestion)
 */
export interface MigrationNote {
  /** Unique identifier */
  id: string;
  /** Note category */
  category: NoteCategory;
  /** Priority for resolution */
  priority: NotePriority;
  /** Human-readable description */
  description: string;
  /** Source location in original contract */
  sourceLocation?: {
    file: string;
    path?: string;  // JSON path or AST path
    line?: number;
  };
  /** Target location in generated ISL */
  targetElement?: string;
  /** Suggested resolution */
  suggestion?: string;
  /** Related element IDs */
  relatedElements?: string[];
}

/**
 * Result of migrating contracts to ISL
 */
export interface MigrationResult {
  /** Generated ISL AST (partial Domain) */
  ast: Partial<Domain>;
  /** Migration notes and open questions */
  notes: MigrationNote[];
  /** Statistics about the migration */
  stats: MigrationStats;
  /** Source contracts that were processed */
  processedContracts: string[];
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  /** Total types extracted */
  typesExtracted: number;
  /** Total behaviors/endpoints extracted */
  behaviorsExtracted: number;
  /** Total entities inferred */
  entitiesInferred: number;
  /** Count of open questions generated */
  openQuestions: number;
  /** Types that required fallback mapping */
  typeFallbacks: number;
  /** Processing time in ms */
  durationMs: number;
}

/**
 * Configuration for migration process
 */
export interface MigrationConfig {
  /** Domain name to use (default: inferred from contracts) */
  domainName?: string;
  /** Domain version */
  version?: string;
  /** Generate placeholder preconditions */
  generatePlaceholderPreconditions?: boolean;
  /** Generate placeholder postconditions */
  generatePlaceholderPostconditions?: boolean;
  /** Infer entities from types */
  inferEntities?: boolean;
  /** Strict mode: fail on unknown types (default: false, adds notes) */
  strictMode?: boolean;
  /** Naming convention: 'camelCase' | 'PascalCase' | 'preserve' */
  namingConvention?: 'camelCase' | 'PascalCase' | 'preserve';
}

/**
 * Default migration configuration
 */
export const DEFAULT_MIGRATION_CONFIG: Required<MigrationConfig> = {
  domainName: 'MigratedAPI',
  version: '1.0.0',
  generatePlaceholderPreconditions: true,
  generatePlaceholderPostconditions: true,
  inferEntities: true,
  strictMode: false,
  namingConvention: 'PascalCase',
};

/**
 * Type mapping from source types to ISL primitive types
 */
export type ISLPrimitiveTypeName = 
  | 'String' 
  | 'Int' 
  | 'Decimal' 
  | 'Boolean' 
  | 'Timestamp' 
  | 'UUID' 
  | 'Duration';

/**
 * Type mapping result
 */
export interface TypeMappingResult {
  /** Mapped ISL type definition */
  type: TypeDefinition;
  /** Whether this was a fallback/approximation */
  isFallback: boolean;
  /** Note if type couldn't be precisely mapped */
  note?: MigrationNote;
}

/**
 * Extracted endpoint/operation info (pre-behavior)
 */
export interface ExtractedOperation {
  /** Operation name/ID */
  name: string;
  /** HTTP method (if applicable) */
  method?: string;
  /** Path (if applicable) */
  path?: string;
  /** Description */
  description?: string;
  /** Input fields */
  inputs: ExtractedField[];
  /** Output type */
  output?: ExtractedType;
  /** Error types */
  errors: ExtractedError[];
  /** Security requirements */
  security?: string[];
  /** Tags/categories */
  tags?: string[];
}

/**
 * Extracted field info
 */
export interface ExtractedField {
  name: string;
  type: ExtractedType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  source?: 'path' | 'query' | 'header' | 'body';
}

/**
 * Extracted type info (before ISL conversion)
 */
export interface ExtractedType {
  kind: 'primitive' | 'object' | 'array' | 'enum' | 'union' | 'reference' | 'unknown';
  name?: string;
  primitiveType?: string;
  properties?: ExtractedField[];
  itemType?: ExtractedType;
  enumValues?: Array<string | number>;
  unionTypes?: ExtractedType[];
  refName?: string;
  constraints?: Record<string, unknown>;
  nullable?: boolean;
}

/**
 * Extracted error info
 */
export interface ExtractedError {
  name: string;
  statusCode?: number;
  description?: string;
  schema?: ExtractedType;
}

/**
 * Source adapter interface for different contract types
 */
export interface SourceAdapter<T extends ApiContract = ApiContract> {
  /** Source type this adapter handles */
  readonly sourceType: ContractSourceType;
  
  /** Extract types from the contract */
  extractTypes(contract: T): ExtractedType[];
  
  /** Extract operations/endpoints from the contract */
  extractOperations(contract: T): ExtractedOperation[];
  
  /** Parse raw content if needed */
  parse?(content: string): unknown;
}

/**
 * Helper to create a synthetic source location for migrated elements
 */
export function createMigrationLocation(sourcePath: string): SourceLocation {
  return {
    file: sourcePath,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

/**
 * Generate a unique ID for migration notes
 */
export function generateNoteId(category: NoteCategory, index: number): string {
  return `migrate-${category}-${index}-${Date.now().toString(36)}`;
}
