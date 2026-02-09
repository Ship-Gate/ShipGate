/**
 * Schema Loader
 * 
 * Detects and loads database schemas from various sources
 */

import type { DatabaseSchema } from './types.js';
import { parsePrismaSchema } from './parsers/prisma.js';
import { parseDrizzleSchema } from './parsers/drizzle.js';
import { parseSqlMigration } from './parsers/sql.js';
import { existsSync } from 'node:fs';
import { glob } from 'glob';
import path from 'node:path';

/**
 * Load schema from file(s)
 */
export async function loadSchema(schemaFiles: string[], repoRoot: string = process.cwd()): Promise<DatabaseSchema | null> {
  // Expand glob patterns
  const expandedFiles: string[] = [];
  for (const pattern of schemaFiles) {
    const matches = await glob(pattern, { cwd: repoRoot, absolute: true });
    expandedFiles.push(...matches);
  }

  // Try Prisma schema first
  for (const file of expandedFiles) {
    if (file.endsWith('.prisma') || file.includes('schema.prisma')) {
      if (existsSync(file)) {
        return parsePrismaSchema(file);
      }
    }
  }

  // Try Drizzle schema
  for (const file of expandedFiles) {
    if (file.endsWith('.ts') && (file.includes('schema') || file.includes('drizzle'))) {
      if (existsSync(file)) {
        try {
          return parseDrizzleSchema(file);
        } catch {
          // Continue to next file
        }
      }
    }
  }

  // Try SQL migrations
  for (const file of expandedFiles) {
    if (file.endsWith('.sql') || file.includes('migration')) {
      if (existsSync(file)) {
        try {
          return parseSqlMigration(file);
        } catch {
          // Continue to next file
        }
      }
    }
  }

  // Auto-detect common schema locations
  const commonPaths = [
    path.join(repoRoot, 'prisma', 'schema.prisma'),
    path.join(repoRoot, 'src', 'db', 'schema.ts'),
    path.join(repoRoot, 'src', 'db', 'schema.prisma'),
    path.join(repoRoot, 'drizzle', 'schema.ts'),
    path.join(repoRoot, 'db', 'schema.ts'),
  ];

  for (const schemaPath of commonPaths) {
    if (existsSync(schemaPath)) {
      if (schemaPath.endsWith('.prisma')) {
        return parsePrismaSchema(schemaPath);
      } else if (schemaPath.endsWith('.ts')) {
        try {
          return parseDrizzleSchema(schemaPath);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Load multiple schemas and merge them
 */
export async function loadSchemas(schemaFiles: string[], repoRoot: string = process.cwd()): Promise<DatabaseSchema | null> {
  const schemas: DatabaseSchema[] = [];

  // Expand glob patterns
  const expandedFiles: string[] = [];
  for (const pattern of schemaFiles) {
    try {
      const matches = await glob(pattern, { cwd: repoRoot, absolute: true });
      expandedFiles.push(...matches);
    } catch {
      // If glob fails, try as direct file path
      const fullPath = pattern.startsWith('/') ? pattern : path.join(repoRoot, pattern);
      if (existsSync(fullPath)) {
        expandedFiles.push(fullPath);
      }
    }
  }

  for (const file of expandedFiles) {
    if (!existsSync(file)) continue;

    try {
      if (file.endsWith('.prisma')) {
        schemas.push(parsePrismaSchema(file));
      } else if (file.endsWith('.ts') && (file.includes('schema') || file.includes('drizzle'))) {
        schemas.push(parseDrizzleSchema(file));
      } else if (file.endsWith('.sql')) {
        schemas.push(parseSqlMigration(file));
      }
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  if (schemas.length === 0) {
    return null;
  }

  // Merge schemas
  return mergeSchemas(schemas);
}

/**
 * Merge multiple schemas into one
 */
function mergeSchemas(schemas: DatabaseSchema[]): DatabaseSchema {
  const firstSource = schemas[0]?.source;
  const merged: DatabaseSchema = {
    tables: [],
    relations: [],
    source: firstSource === 'prisma' || firstSource === 'drizzle' || firstSource === 'sql' ? firstSource : 'prisma',
    sourceFile: schemas.map((s) => s.sourceFile).join(', '),
  };

  const tableMap = new Map<string, DatabaseSchema['tables'][0]>();

  for (const schema of schemas) {
    for (const table of schema.tables) {
      const existing = tableMap.get(table.name);
      if (existing) {
        // Merge columns
        const columnMap = new Map(existing.columns.map((c) => [c.name, c]));
        for (const column of table.columns) {
          if (!columnMap.has(column.name)) {
            columnMap.set(column.name, column);
          }
        }
        existing.columns = Array.from(columnMap.values());
      } else {
        tableMap.set(table.name, { ...table });
      }
    }

    merged.relations.push(...schema.relations);
  }

  merged.tables = Array.from(tableMap.values());
  return merged;
}
