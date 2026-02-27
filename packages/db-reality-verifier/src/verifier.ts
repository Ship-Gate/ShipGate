/**
 * Database Reality Verifier
 * 
 * Compares extracted queries against schema models
 */

import type {
  DatabaseSchema,
  ExtractedQuery,
  Mismatch,
  VerificationResult,
  VerificationOptions,
} from './types.js';
import { levenshteinDistance } from './utils.js';

/**
 * Verify database queries against schema
 */
export function verifyQueries(
  schema: DatabaseSchema,
  queries: ExtractedQuery[],
  options: VerificationOptions
): VerificationResult {
  const mismatches: Mismatch[] = [];
  const minConfidence = options.minConfidence ?? 0.7;

  for (const query of queries) {
    // Skip queries with low confidence (likely dynamic query builders)
    if (query.confidence < minConfidence) {
      continue;
    }

    const queryMismatches = verifyQuery(schema, query, options);
    mismatches.push(...queryMismatches);
  }

  const verifiedQueries = queries.filter((q) => q.confidence >= minConfidence).length - mismatches.length;

  return {
    mismatches,
    totalQueries: queries.length,
    verifiedQueries,
    schema,
  };
}

/**
 * Verify a single query against schema
 */
function verifyQuery(
  schema: DatabaseSchema,
  query: ExtractedQuery,
  options: VerificationOptions
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  // Verify tables
  for (const tableName of query.tables) {
    const table = schema.tables.find((t) => t.name === tableName || t.name.toLowerCase() === tableName.toLowerCase());

    if (!table) {
      // Table doesn't exist - check for typos
      const suggestion = findClosestTable(schema, tableName, options.maxSuggestions ?? 3);

      const mismatch: Mismatch = {
        severity: 'error',
        message: `Table "${tableName}" does not exist in schema`,
        query,
        issue: 'missing-table',
        actual: tableName,
        confidence: query.confidence,
      };
      if (suggestion.length > 0) {
        mismatch.suggestion = `Did you mean: ${suggestion.join(', ')}?`;
      }
      mismatches.push(mismatch);
      continue;
    }

    // Verify columns
    for (const columnName of query.columns) {
      if (!columnName) continue; // Skip empty columns

      const column = table.columns.find(
        (c) => c.name === columnName || c.name.toLowerCase() === columnName.toLowerCase()
      );

      if (!column) {
        // Column doesn't exist - check for typos
        const suggestion = findClosestColumn(table, columnName, options.maxSuggestions ?? 3);

        const mismatch: Mismatch = {
          severity: 'warning',
          message: `Column "${columnName}" does not exist in table "${tableName}"`,
          query,
          issue: 'missing-column',
          actual: columnName,
          confidence: query.confidence * 0.9, // Slightly lower confidence for column mismatches
        };
        if (suggestion.length > 0) {
          mismatch.suggestion = `Did you mean: ${suggestion.join(', ')}?`;
        }
        mismatches.push(mismatch);
      }
    }
  }

  // Verify relations (if query involves joins)
  if (query.tables.length > 1) {
    const relationMismatches = verifyRelations(schema, query, options);
    mismatches.push(...relationMismatches);
  }

  return mismatches;
}

/**
 * Verify relations between tables
 */
function verifyRelations(
  schema: DatabaseSchema,
  query: ExtractedQuery,
  _options: VerificationOptions
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  // Check if there's a relation between the tables
  for (let i = 0; i < query.tables.length - 1; i++) {
    const table1 = query.tables[i];
    const table2 = query.tables[i + 1];

    if (!table1 || !table2) continue;

    const relation = schema.relations.find(
      (r) =>
        (r.from.table === table1 && r.to.table === table2) ||
        (r.from.table === table2 && r.to.table === table1)
    );

    if (!relation) {
      mismatches.push({
        severity: 'warning',
        message: `No relation found between tables "${table1}" and "${table2}"`,
        query,
        issue: 'missing-relation',
        actual: `${table1} <-> ${table2}`,
        confidence: query.confidence * 0.8, // Lower confidence for relation checks
      });
    }
  }

  return mismatches;
}

/**
 * Find closest matching table name
 */
function findClosestTable(
  schema: DatabaseSchema,
  tableName: string,
  maxSuggestions: number
): string[] {
  const distances = schema.tables.map((table) => ({
    name: table.name,
    distance: levenshteinDistance(tableName.toLowerCase(), table.name.toLowerCase()),
  }));

  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest if distance is reasonable (within 3 characters or 50% of length)
  const maxDistance = Math.min(3, Math.floor(tableName.length * 0.5));
  return distances
    .filter((d) => d.distance <= maxDistance && d.distance < tableName.length)
    .slice(0, maxSuggestions)
    .map((d) => d.name);
}

/**
 * Find closest matching column name
 */
function findClosestColumn(
  table: { columns: Array<{ name: string }> },
  columnName: string,
  maxSuggestions: number
): string[] {
  const distances = table.columns.map((column) => ({
    name: column.name,
    distance: levenshteinDistance(columnName.toLowerCase(), column.name.toLowerCase()),
  }));

  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest if distance is reasonable (within 2 characters or 40% of length)
  const maxDistance = Math.min(2, Math.floor(columnName.length * 0.4));
  return distances
    .filter((d) => d.distance <= maxDistance && d.distance < columnName.length)
    .slice(0, maxSuggestions)
    .map((d) => d.name);
}
