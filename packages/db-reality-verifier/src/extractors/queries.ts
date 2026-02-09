/**
 * Query Extractors
 * 
 * Extract database queries from source code
 */

import type { ExtractedQuery } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';
import { glob } from 'glob';

/**
 * Extract all queries from source files
 */
export async function extractQueriesFromFiles(
  sourceFiles: string[],
  repoRoot: string = process.cwd()
): Promise<ExtractedQuery[]> {
  const queries: ExtractedQuery[] = [];

  // Expand glob patterns
  const expandedFiles: string[] = [];
  for (const pattern of sourceFiles) {
    try {
      const matches = await glob(pattern, { cwd: repoRoot, absolute: true });
      expandedFiles.push(...matches);
    } catch {
      // If glob fails, try as direct file path
      const fullPath = pattern.startsWith('/') ? pattern : `${repoRoot}/${pattern}`;
      if (existsSync(fullPath)) {
        expandedFiles.push(fullPath);
      }
    }
  }

  for (const filePath of expandedFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const fileQueries = extractQueriesFromContent(content, filePath);
      queries.push(...fileQueries);
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return queries;
}

/**
 * Extract queries from file content
 */
function extractQueriesFromContent(content: string, filePath: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // Extract Prisma queries
  queries.push(...extractPrismaQueries(content, filePath));

  // Extract Drizzle queries
  queries.push(...extractDrizzleQueries(content, filePath));

  // Extract SQL template literals
  queries.push(...extractSqlTemplateQueries(content, filePath));

  // Extract raw SQL strings
  queries.push(...extractRawSqlQueries(content, filePath));

  return queries;
}

/**
 * Extract Prisma ORM queries
 * Pattern: prisma.modelName.operation(...)
 */
function extractPrismaQueries(content: string, filePath: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // Pattern: prisma.modelName.findMany|findUnique|findFirst|create|update|delete|upsert|aggregate|count
  const prismaPattern = /prisma\s*\.\s*(\w+)\s*\.\s*(findMany|findUnique|findFirst|create|update|delete|upsert|aggregate|count|createMany|updateMany|deleteMany)/g;

  let match: RegExpExecArray | null;
  while ((match = prismaPattern.exec(content)) !== null) {
    const modelName = match[1] || '';
    const operation = match[2] || '';

    const line = getLineNumber(content, match.index);
    const column = getColumnNumber(content, match.index);

    // Determine query type
    let queryType: ExtractedQuery['type'] = 'unknown';
    if (operation.includes('find') || operation === 'aggregate' || operation === 'count') {
      queryType = 'select';
    } else if (operation.includes('create')) {
      queryType = 'insert';
    } else if (operation.includes('update')) {
      queryType = 'update';
    } else if (operation.includes('delete')) {
      queryType = 'delete';
    }

    // Extract columns from the query (best-effort)
    const columns = extractColumnsFromPrismaQuery(content, match.index);

    queries.push({
      type: queryType,
      tables: [modelName],
      columns,
      filePath,
      line,
      column,
      source: extractSourceSnippet(content, match.index, 5),
      confidence: 0.95, // High confidence for Prisma queries
      orm: 'prisma',
    });
  }

  return queries;
}

/**
 * Extract Drizzle queries
 * Pattern: db.select().from(table) or db.insert(table) or db.update(table)
 */
function extractDrizzleQueries(content: string, filePath: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // Pattern: db.select().from(tableName) or db.insert(tableName) or db.update(tableName)
  const drizzleSelectPattern = /(?:db|drizzle)\s*\.\s*select\(\)\s*\.\s*from\((\w+)\)/g;
  const drizzleInsertPattern = /(?:db|drizzle)\s*\.\s*insert\((\w+)\)/g;
  const drizzleUpdatePattern = /(?:db|drizzle)\s*\.\s*update\((\w+)\)/g;
  const drizzleDeletePattern = /(?:db|drizzle)\s*\.\s*delete\((\w+)\)/g;

  const patterns = [
    { regex: drizzleSelectPattern, type: 'select' as const },
    { regex: drizzleInsertPattern, type: 'insert' as const },
    { regex: drizzleUpdatePattern, type: 'update' as const },
    { regex: drizzleDeletePattern, type: 'delete' as const },
  ];

  for (const { regex, type } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const tableName = match[1] || '';
      const line = getLineNumber(content, match.index);
      const column = getColumnNumber(content, match.index);

      // Extract columns from select query
      const columns = type === 'select' ? extractColumnsFromDrizzleSelect(content, match.index) : [];

      queries.push({
        type,
        tables: [tableName],
        columns,
        filePath,
        line,
        column,
        source: extractSourceSnippet(content, match.index, 5),
        confidence: 0.9, // High confidence for Drizzle queries
        orm: 'drizzle',
      });
    }
  }

  return queries;
}

/**
 * Extract SQL template literals
 * Pattern: sql`SELECT * FROM table` or Prisma.sql`SELECT * FROM table`
 */
function extractSqlTemplateQueries(content: string, filePath: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // Pattern: (sql|Prisma.sql|Sql)`SELECT ... FROM table ...`
  const sqlTemplatePattern = /(?:sql|Prisma\.sql|Sql)\s*`([^`]+)`/g;

  let match: RegExpExecArray | null;
  while ((match = sqlTemplatePattern.exec(content)) !== null) {
    const sql = match[1] || '';
    const line = getLineNumber(content, match.index);
    const column = getColumnNumber(content, match.index);

    const parsed = parseSqlQuery(sql);
    if (parsed) {
      queries.push({
        ...parsed,
        filePath,
        line,
        column,
        source: extractSourceSnippet(content, match.index, 3),
        confidence: 0.85, // Good confidence for SQL templates
        orm: 'sql-template',
      });
    }
  }

  return queries;
}

/**
 * Extract raw SQL strings
 * Pattern: "SELECT * FROM table" or 'SELECT * FROM table'
 */
function extractRawSqlQueries(content: string, filePath: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // Pattern: "SELECT ..." or 'SELECT ...' (but not in comments)
  const sqlStringPattern = /(['"])\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+[^'"]*\1/gi;

  let match: RegExpExecArray | null;
  while ((match = sqlStringPattern.exec(content)) !== null) {
    const keyword = match[2];
    if (keyword === undefined) continue;
    const sql = keyword + match[0].slice(keyword.length + 1, -1); // Remove quotes
    const line = getLineNumber(content, match.index);
    const column = getColumnNumber(content, match.index);

    // Skip if it's in a comment
    const beforeMatch = content.substring(0, match.index);
    if (beforeMatch.includes('//') && !beforeMatch.includes('\n')) {
      continue;
    }

    const parsed = parseSqlQuery(sql);
    if (parsed) {
      queries.push({
        ...parsed,
        filePath,
        line,
        column,
        source: extractSourceSnippet(content, match.index, 3),
        confidence: 0.7, // Lower confidence for raw SQL (might be dynamic)
        orm: 'raw-sql',
      });
    }
  }

  return queries;
}

/**
 * Parse SQL query to extract tables and columns
 */
function parseSqlQuery(sql: string): Omit<ExtractedQuery, 'filePath' | 'line' | 'column' | 'source' | 'confidence' | 'orm'> | null {
  const normalized = sql.trim().toUpperCase();

  // Determine query type
  let type: ExtractedQuery['type'] = 'unknown';
  if (normalized.startsWith('SELECT')) type = 'select';
  else if (normalized.startsWith('INSERT')) type = 'insert';
  else if (normalized.startsWith('UPDATE')) type = 'update';
  else if (normalized.startsWith('DELETE')) type = 'delete';

  // Extract tables
  const tables: string[] = [];
  
  // FROM clause
  const fromMatch = normalized.match(/FROM\s+(?:`|")?(\w+)(?:`|")?/i);
  if (fromMatch) {
    tables.push(fromMatch[1] || '');
  }

  // JOIN clauses
  const joinMatches = normalized.matchAll(/JOIN\s+(?:`|")?(\w+)(?:`|")?/gi);
  for (const joinMatch of joinMatches) {
    if (joinMatch[1]) tables.push(joinMatch[1]);
  }

  // INSERT INTO table
  const insertMatch = normalized.match(/INSERT\s+INTO\s+(?:`|")?(\w+)(?:`|")?/i);
  if (insertMatch) {
    tables.push(insertMatch[1] || '');
  }

  // UPDATE table
  const updateMatch = normalized.match(/UPDATE\s+(?:`|")?(\w+)(?:`|")?/i);
  if (updateMatch) {
    tables.push(updateMatch[1] || '');
  }

  // DELETE FROM table
  const deleteMatch = normalized.match(/DELETE\s+FROM\s+(?:`|")?(\w+)(?:`|")?/i);
  if (deleteMatch) {
    tables.push(deleteMatch[1] || '');
  }

  // Extract columns (SELECT column1, column2 FROM ...)
  const columns: string[] = [];
  if (type === 'select') {
    const selectMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const columnList = selectMatch[1] || '';
      if (columnList !== '*') {
        const columnNames = columnList.split(',').map((c) => {
          const col = c.trim();
          // Remove table prefix: table.column -> column
          const dotIndex = col.lastIndexOf('.');
          return dotIndex >= 0 ? col.substring(dotIndex + 1) : col;
        });
        columns.push(...columnNames.filter(Boolean));
      }
    }
  }

  if (tables.length === 0) {
    return null; // No tables found
  }

  return {
    type,
    tables,
    columns,
  };
}

/**
 * Extract columns from Prisma query (best-effort)
 */
function extractColumnsFromPrismaQuery(content: string, index: number): string[] {
  // Look for select/include clauses
  const snippet = content.substring(index, index + 500);
  const selectMatch = snippet.match(/select:\s*\{([^}]+)\}/);
  if (selectMatch && selectMatch[1]) {
    const selectBody = selectMatch[1];
    const columns = selectBody
      .split(',')
      .map((c) => {
        const trimmed = c.trim().split(':')[0];
        return trimmed?.trim();
      })
      .filter((c): c is string => Boolean(c));
    return columns;
  }

  return [];
}

/**
 * Extract columns from Drizzle select query
 */
function extractColumnsFromDrizzleSelect(content: string, index: number): string[] {
  const snippet = content.substring(index, index + 500);
  const selectMatch = snippet.match(/select\(([^)]+)\)/);
  if (selectMatch && selectMatch[1]) {
    const selectBody = selectMatch[1];
    // Pattern: table.column or { column: table.column }
    const columns = selectBody
      .split(',')
      .map((c) => {
        const trimmed = c.trim();
        const dotIndex = trimmed.lastIndexOf('.');
        return dotIndex >= 0 ? trimmed.substring(dotIndex + 1) : trimmed;
      })
      .filter((c): c is string => Boolean(c));
    return columns;
  }

  return [];
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Get column number from character index
 */
function getColumnNumber(content: string, index: number): number {
  const lines = content.substring(0, index).split('\n');
  const lastLine = lines[lines.length - 1] || '';
  return lastLine.length + 1;
}

/**
 * Extract source code snippet around index
 */
function extractSourceSnippet(content: string, index: number, contextLines: number): string {
  const lines = content.split('\n');
  const lineNum = getLineNumber(content, index) - 1;
  const start = Math.max(0, lineNum - contextLines);
  const end = Math.min(lines.length, lineNum + contextLines + 1);
  return lines.slice(start, end).join('\n');
}
