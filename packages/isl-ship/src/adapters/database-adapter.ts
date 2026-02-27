/**
 * DatabaseAdapter — Abstraction for database-specific configuration
 *
 * Used by isl ship and isl vibe to generate Prisma schemas, env vars,
 * docker-compose, migration commands, and seed scripts.
 */

export interface DatabaseAdapter {
  /** Human-readable name (e.g. "SQLite", "PostgreSQL") */
  name: string;
  /** Prisma datasource provider name */
  provider: string;
  /** Generate Prisma datasource block */
  generateDatasource(): string;
  /** Environment variables for .env / .env.example */
  generateEnvVars(options?: { dbName?: string; dbUrl?: string }): Record<string, string>;
  /** Connection pool config (for PgBouncer-compatible URLs, etc.) */
  getConnectionPoolConfig(): object;
  /** Migration commands (e.g. prisma migrate dev, prisma migrate deploy) */
  getMigrationCommands(): string[];
  /** Seed command (e.g. tsx prisma/seed.ts) */
  getSeedCommand(): string;
  /** Docker Compose service for local dev (optional) */
  getDockerComposeService?(options?: { dbName?: string }): object;
}

export type DatabaseAdapterId = 'sqlite' | 'postgres';
