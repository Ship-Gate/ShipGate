/**
 * ISL Contract Migration Module
 * 
 * Converts existing contract sources (OpenAPI, Zod, TypeScript) into
 * starter ISL AST with conservative handling of unknowns.
 * 
 * @module @isl/core/isl-migrate
 * 
 * @example
 * ```typescript
 * import { migrateContracts } from '@isl/core/isl-migrate';
 * 
 * const result = migrateContracts([
 *   {
 *     id: 'api-1',
 *     sourceType: 'openapi',
 *     name: 'UserAPI',
 *     sourcePath: 'openapi.json',
 *     content: openAPIContent
 *   }
 * ]);
 * 
 * // result.ast - Partial<Domain> with types, behaviors, entities
 * // result.notes - Open questions for manual review
 * // result.stats - Migration statistics
 * ```
 */

export {
  migrateContracts,
  type ApiContract,
  type MigrationResult,
  type MigrationNote,
  type MigrationConfig,
} from './migrate.js';

export {
  // Types
  type ContractSourceType,
  type OpenAPIContract,
  type ZodContract,
  type TypeScriptContract,
  type MigrationStats,
  type NotePriority,
  type NoteCategory,
  type ExtractedType,
  type ExtractedOperation,
  type ExtractedField,
  type ExtractedError,
  type TypeMappingResult,
  type SourceAdapter,
  
  // Config
  DEFAULT_MIGRATION_CONFIG,
  
  // Utilities
  createMigrationLocation,
  generateNoteId,
} from './migrateTypes.js';

// Source adapters (for advanced usage)
export { openAPIAdapter } from './sources/openapi.js';
export { zodAdapter } from './sources/zod.js';
export { typescriptAdapter } from './sources/typescript.js';
