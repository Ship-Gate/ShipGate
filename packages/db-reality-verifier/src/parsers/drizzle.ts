/**
 * Drizzle Schema Parser
 */

import type { DatabaseSchema, Table, Column, Relation } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Parse Drizzle schema file (TypeScript)
 */
export function parseDrizzleSchema(filePath: string): DatabaseSchema {
  if (!existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  const tables: Table[] = [];
  const relations: Relation[] = [];

  // Extract table definitions
  // Pattern: export const tableName = pgTable('table_name', { ... })
  // or: export const tableName = mysqlTable('table_name', { ... })
  const tablePattern = /export\s+const\s+(\w+)\s*=\s*(?:pg|mysql|sqlite)Table\(['"`]([\w_]+)['"`]\s*,\s*\{([^}]+)\}\)/gs;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(content)) !== null) {
    const tableVarName = tableMatch[1];
    const tableName = (tableMatch[2] || tableVarName || '').trim();
    const tableBody = (tableMatch[3] || '').trim();
    if (!tableName) continue;

    const columns = extractDrizzleColumns(tableBody);
    const indexes = extractDrizzleIndexes(tableBody);

    tables.push({
      name: tableName,
      columns,
      indexes,
    });
  }

  // Extract relations
  // Pattern: export const tableRelations = relations(tableName, ({ one, many }) => ({ ... }))
  const relationPattern = /export\s+const\s+(\w+)Relations\s*=\s*relations\((\w+)\s*,\s*\([^)]*\)\s*=>\s*\(\{([^}]+)\}\)/gs;
  let relationMatch: RegExpExecArray | null;

  while ((relationMatch = relationPattern.exec(content)) !== null) {
    const tableName = relationMatch[2];
    const relationBody = relationMatch[3] || '';
    if (!tableName) continue;
    const extractedRelations = extractDrizzleRelations(tableName, relationBody);
    relations.push(...extractedRelations);
  }

  return {
    tables,
    relations,
    source: 'drizzle',
    sourceFile: filePath,
  };
}

/**
 * Extract columns from Drizzle table definition
 */
function extractDrizzleColumns(tableBody: string): Column[] {
  const columns: Column[] = [];
  const lines = tableBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Pattern: columnName: varchar('column_name', { length: 255 }),
    // or: columnName: integer('column_name').primaryKey(),
    // or: columnName: text('column_name').notNull(),
    const columnMatch = trimmed.match(/^(\w+):\s*(\w+)\(['"`]([\w_]+)['"`]([^,)]*)\)/);
    if (!columnMatch) continue;

    const [, , type, columnName, modifiers = ''] = columnMatch;
    if (!columnName || !type) continue;

    const column: Column = {
      name: columnName,
      type: mapDrizzleType(type),
      nullable: !modifiers.includes('.notNull()'),
      primaryKey: modifiers.includes('.primaryKey()'),
      unique: modifiers.includes('.unique()'),
    };

    // Extract default value
    const defaultMatch = modifiers.match(/\.default\(([^)]+)\)/);
    if (defaultMatch && defaultMatch[1]) {
      column.defaultValue = defaultMatch[1];
    }

    columns.push(column);
  }

  return columns;
}

/**
 * Map Drizzle type to SQL type
 */
function mapDrizzleType(drizzleType: string): string {
  const typeMap: Record<string, string> = {
    varchar: 'VARCHAR',
    text: 'TEXT',
    integer: 'INTEGER',
    bigint: 'BIGINT',
    boolean: 'BOOLEAN',
    timestamp: 'TIMESTAMP',
    date: 'DATE',
    json: 'JSON',
    uuid: 'UUID',
    decimal: 'DECIMAL',
    real: 'REAL',
    double: 'DOUBLE',
  };

  return typeMap[drizzleType.toLowerCase()] || drizzleType.toUpperCase();
}

/**
 * Extract indexes from Drizzle table definition
 */
function extractDrizzleIndexes(tableBody: string): Array<{ name: string; columns: string[]; unique?: boolean }> {
  const indexes: Array<{ name: string; columns: string[]; unique?: boolean }> = [];

  // Look for index definitions in the second parameter of pgTable
  // Pattern: (table) => ({ indexName: index('index_name').on(table.column) })
  const indexPattern = /\(table\)\s*=>\s*\(\{([^}]+)\}\)/s;
  const indexMatch = tableBody.match(indexPattern);
  if (!indexMatch) return indexes;

  const indexBody = indexMatch[1] || '';
  const indexLines = indexBody.split('\n');

  for (const line of indexLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: indexName: index('index_name').on(table.column1, table.column2)
    const indexMatch = trimmed.match(/(\w+):\s*(?:index|unique)\(['"`]([\w_]+)['"`]\)\.on\(([^)]+)\)/);
    if (indexMatch) {
      const indexName = indexMatch[2];
      const columnsStr = indexMatch[3];
      if (indexName === undefined || columnsStr === undefined) continue;
      const columns = columnsStr
        .split(',')
        .map((c) => c.trim().replace(/table\./g, ''))
        .filter(Boolean);

      indexes.push({
        name: indexName,
        columns,
        unique: trimmed.includes('unique('),
      });
    }
  }

  return indexes;
}

/**
 * Extract relations from Drizzle relations definition
 */
function extractDrizzleRelations(tableName: string, relationBody: string): Relation[] {
  const relations: Relation[] = [];
  const lines = relationBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: relationName: one(tableName, { fields: [tableName.id], references: [otherTable.id] })
    // or: relationName: many(otherTable)
    const oneMatch = trimmed.match(/(\w+):\s*one\((\w+)\s*,\s*\{[^}]*fields:\s*\[([^\]]+)\][^}]*references:\s*\[([^\]]+)\][^}]*\}\)/);
    if (oneMatch && oneMatch[2] && oneMatch[3] && oneMatch[4]) {
      const relatedTable = oneMatch[2];
      const localFields = oneMatch[3];
      const referencedFields = oneMatch[4];
      const localField = localFields.split('.')[1]?.trim() || '';
      const referencedField = referencedFields.split('.')[1]?.trim() || '';

      if (localField && referencedField) {
        relations.push({
          from: { table: tableName, column: localField },
          to: { table: relatedTable, column: referencedField },
          type: 'one-to-one',
        });
      }
      continue;
    }

    const manyMatch = trimmed.match(/(\w+):\s*many\((\w+)\)/);
    if (manyMatch && manyMatch[2]) {
      const relatedTable = manyMatch[2];
      relations.push({
        from: { table: tableName, column: 'id' },
        to: { table: relatedTable, column: 'id' },
        type: 'one-to-many',
      });
    }
  }

  return relations;
}
