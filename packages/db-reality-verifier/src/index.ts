/**
 * Database Reality Verifier (Agent 30)
 * 
 * Main API for verifying database queries against schemas
 */

import type { VerificationResult, VerificationOptions } from './types.js';
import { loadSchema } from './schema-loader.js';
import { extractQueriesFromFiles } from './extractors/queries.js';
import { verifyQueries } from './verifier.js';

/**
 * Verify database queries against schema
 */
export async function verifyDatabaseQueries(
  options: VerificationOptions
): Promise<VerificationResult> {
  // Load schema
  const schema = await loadSchema(options.schemaFiles);
  if (!schema) {
    throw new Error('Could not load database schema from provided files');
  }

  // Extract queries from source files
  const queries = await extractQueriesFromFiles(options.sourceFiles);

  // Verify queries against schema
  const result = verifyQueries(schema, queries, options);

  return result;
}

/**
 * Verify queries with explicit schema
 */
export function verifyQueriesAgainstSchema(
  schema: Parameters<typeof verifyQueries>[0],
  queries: Parameters<typeof verifyQueries>[1],
  options: VerificationOptions
): VerificationResult {
  return verifyQueries(schema, queries, options);
}

// Export types
export type {
  DatabaseSchema,
  Table,
  Column,
  Relation,
  ExtractedQuery,
  Mismatch,
  VerificationResult,
  VerificationOptions,
} from './types.js';

// Export parsers
export { parsePrismaSchema } from './parsers/prisma.js';
export { parseDrizzleSchema } from './parsers/drizzle.js';
export { parseSqlMigration } from './parsers/sql.js';

// Export extractors
export { extractQueriesFromFiles } from './extractors/queries.js';

// Export utilities
export { levenshteinDistance } from './utils.js';
