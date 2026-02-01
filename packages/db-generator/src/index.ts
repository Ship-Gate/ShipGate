/**
 * ISL Database Generator
 * 
 * Generate database schemas and migrations from ISL entity definitions.
 * Supports PostgreSQL, MySQL, SQLite, and various ORMs.
 */

export { SQLGenerator, generateSQL, type SQLOptions } from './sql/generator.js';
export { PrismaGenerator, generatePrismaSchema, type PrismaOptions } from './prisma/generator.js';
export { DrizzleGenerator, generateDrizzleSchema, type DrizzleOptions } from './drizzle/generator.js';
export { MigrationGenerator, generateMigrations, type MigrationOptions } from './migrations/generator.js';

export type { GeneratedFile, DatabaseTable, Column, Index, ForeignKey, DatabaseSchema } from './types.js';
