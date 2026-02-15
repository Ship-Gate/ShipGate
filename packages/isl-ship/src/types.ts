/**
 * ISL Ship - Types
 *
 * Core types for the full-stack application generator.
 */

import type { Domain } from '@isl-lang/parser';

// ============================================================================
// Configuration
// ============================================================================

export type BackendFramework = 'express' | 'fastify' | 'nextjs';
export type DatabaseEngine = 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
export type ORM = 'prisma' | 'drizzle';
export type FrontendFramework = 'nextjs' | 'react' | 'none';
export type CSSFramework = 'tailwind' | 'css-modules' | 'none';

export interface ShipStack {
  backend: BackendFramework;
  database: DatabaseEngine;
  orm: ORM;
  frontend: FrontendFramework;
  css: CSSFramework;
  docker: boolean;
  runtime: boolean;
}

export interface ShipOptions {
  /** ISL spec file path */
  specPath: string;
  /** Output directory for generated project */
  outputDir: string;
  /** Technology stack selection */
  stack: ShipStack;
  /** Project name override */
  projectName?: string;
  /** Deployment platform (vercel, docker, railway, fly) */
  deploy?: string;
  /** Override DATABASE_URL (from --db-url) */
  dbUrl?: string;
  /** Overwrite existing files */
  force?: boolean;
  /** Include runtime contract enforcement */
  contracts?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// Generated Output
// ============================================================================

export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** File contents */
  content: string;
  /** Layer this file belongs to */
  layer: 'backend' | 'frontend' | 'database' | 'contracts' | 'config' | 'scaffold';
}

export interface ShipResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Project name */
  projectName: string;
  /** All generated files */
  files: GeneratedFile[];
  /** Generation errors */
  errors: string[];
  /** Generation warnings */
  warnings: string[];
  /** Duration in ms */
  duration: number;
  /** Summary stats */
  stats: ShipStats;
}

export interface ShipStats {
  entities: number;
  behaviors: number;
  endpoints: number;
  screens: number;
  events: number;
  workflows: number;
  totalFiles: number;
}

// ============================================================================
// Helpers
// ============================================================================

export const DEFAULT_STACK: ShipStack = {
  backend: 'express',
  database: 'postgres',
  orm: 'prisma',
  frontend: 'nextjs',
  css: 'tailwind',
  docker: true,
  runtime: true,
};

export function resolveStack(partial?: Partial<ShipStack>): ShipStack {
  return { ...DEFAULT_STACK, ...partial };
}

/** Convert PascalCase to snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/** Convert PascalCase to kebab-case */
export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

/** Convert PascalCase to camelCase */
export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Map ISL type names to TypeScript types */
export function islTypeToTS(typeName: string): string {
  const map: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Decimal: 'number',
    Boolean: 'boolean',
    Timestamp: 'Date',
    UUID: 'string',
    Duration: 'number',
  };
  return map[typeName] ?? typeName;
}

/** Map ISL type names to Prisma types */
export function islTypeToPrisma(typeName: string): string {
  const map: Record<string, string> = {
    String: 'String',
    Int: 'Int',
    Decimal: 'Float',
    Boolean: 'Boolean',
    Timestamp: 'DateTime',
    UUID: 'String',
    Duration: 'Int',
    Json: 'Json',
  };
  return map[typeName] ?? typeName;
}
