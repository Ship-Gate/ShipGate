/**
 * ISL Migration V2
 *
 * Convert existing contract sources (OpenAPI, Zod, TypeScript) into
 * starter ISL AST with openQuestions for unknowns.
 */

export { migrateToISL } from './migrate.js';

export type {
  MigrationSource,
  MigrationResult,
  MigrationConfig,
  OpenQuestion,
  QuestionCategory,
  QuestionPriority,
  MigrationStats,
  ExtractedType,
  ExtractedOperation,
  ExtractedProperty,
  SourceType,
} from './types.js';

export { DEFAULT_CONFIG, createLocation, generateQuestionId, PRIMITIVE_MAP } from './types.js';

export { openAPIAdapter } from './sources/openapi.js';
export { zodAdapter } from './sources/zod.js';
export { typescriptAdapter } from './sources/typescript.js';
