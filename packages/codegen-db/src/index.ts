/**
 * @intentos/codegen-db
 * 
 * Generate database adapters (Prisma, Drizzle, TypeORM) from ISL entities.
 */

export { generate } from './generator.js';
export { generateRepositories } from './repository.js';
export { generateMigrations } from './migrations.js';

// Adapters
export { PrismaGenerator } from './adapters/prisma.js';
export { DrizzleGenerator } from './adapters/drizzle.js';
export { TypeORMGenerator } from './adapters/typeorm.js';
export { SQLGenerator } from './adapters/sql.js';

// Types
export type {
  GeneratorOptions,
  GeneratedFile,
  DatabaseAdapter,
  DatabaseProvider,
  NormalizedEntity,
  NormalizedEnum,
  NormalizedField,
  FieldType,
  FieldConstraints,
  DefaultValue,
  IndexDefinition,
  UniqueConstraint,
  RelationDefinition,
  GeneratorContext,
  DatabaseAdapterGenerator,
} from './types.js';
