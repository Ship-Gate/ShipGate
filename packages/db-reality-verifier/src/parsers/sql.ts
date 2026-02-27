/**
 * SQL Migration Parser (Best-effort)
 * 
 * Parses CREATE TABLE statements from SQL migration files
 */

import type { DatabaseSchema, Table, Column } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Parse SQL migration file (best-effort)
 */
export function parseSqlMigration(filePath: string): DatabaseSchema {
  if (!existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  const tables: Table[] = [];

  // Extract CREATE TABLE statements
  // Pattern: CREATE TABLE [IF NOT EXISTS] table_name ( ... )
  const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(([^)]+)\)/gis;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = createTablePattern.exec(content)) !== null) {
    const tableName = tableMatch[1];
    const tableBody = tableMatch[2] || '';
    if (!tableName) continue;

    const columns = extractSqlColumns(tableBody);
    const indexes = extractSqlIndexes(content, tableName);

    tables.push({
      name: tableName,
      columns,
      indexes,
    });
  }

  return {
    tables,
    relations: [], // Relations harder to extract from raw SQL
    source: 'sql',
    sourceFile: filePath,
  };
}

/**
 * Extract columns from CREATE TABLE body
 */
function extractSqlColumns(tableBody: string): Column[] {
  const columns: Column[] = [];
  const columnDefs = tableBody.split(',').map((s) => s.trim());

  for (const def of columnDefs) {
    if (!def || def.startsWith('CONSTRAINT') || def.startsWith('PRIMARY KEY') || def.startsWith('FOREIGN KEY')) {
      continue;
    }

    // Pattern: column_name TYPE [CONSTRAINTS]
    // Examples:
    //   id INTEGER PRIMARY KEY
    //   email VARCHAR(255) NOT NULL UNIQUE
    //   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    const columnMatch = def.match(/^(`|")?(\w+)(`|")?\s+(\w+)(?:\([^)]+\))?\s*(.*)?$/i);
    if (!columnMatch) continue;

    const columnName = columnMatch[2];
    const type = columnMatch[4];
    const constraints = columnMatch[5] || '';
    if (!columnName || !type) continue;

    const column: Column = {
      name: columnName,
      type: type.toUpperCase(),
      nullable: !constraints.toUpperCase().includes('NOT NULL'),
      primaryKey: constraints.toUpperCase().includes('PRIMARY KEY'),
      unique: constraints.toUpperCase().includes('UNIQUE'),
    };

    // Extract default value
    const defaultMatch = constraints.match(/DEFAULT\s+([^\s]+)/i);
    if (defaultMatch && defaultMatch[1]) {
      column.defaultValue = defaultMatch[1];
    }

    columns.push(column);
  }

  return columns;
}

/**
 * Extract indexes from SQL (look for CREATE INDEX statements)
 */
function extractSqlIndexes(content: string, tableName: string): Array<{ name: string; columns: string[]; unique?: boolean }> {
  const indexes: Array<{ name: string; columns: string[]; unique?: boolean }> = [];

  // Pattern: CREATE [UNIQUE] INDEX index_name ON table_name (column1, column2)
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const indexPattern = new RegExp(
    `CREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:[\`"]?)(\\w+)(?:[\`"]?)\\s+ON\\s+(?:[\`"]?)${escapedTableName}(?:[\`"]?)\\s*\\(([^)]+)\\)`,
    'gi'
  );

  let indexMatch: RegExpExecArray | null;
  while ((indexMatch = indexPattern.exec(content)) !== null) {
    const unique = !!indexMatch[1];
    const indexName = indexMatch[2];
    const columnsStr = indexMatch[3] || '';

    const columns = columnsStr
      .split(',')
      .map((c) => c.trim().replace(/`|"/g, ''))
      .filter(Boolean);

    indexes.push({
      name: indexName || '',
      columns,
      unique,
    });
  }

  return indexes;
}
