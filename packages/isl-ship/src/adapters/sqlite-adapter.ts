/**
 * SQLiteAdapter — SQLite database configuration
 *
 * Uses file-based SQLite. No external DB required. Ideal for local dev and tests.
 */

import type { DatabaseAdapter } from './database-adapter.js';

export const SQLiteAdapter: DatabaseAdapter = {
  name: 'SQLite',
  provider: 'sqlite',

  generateDatasource(): string {
    return [
      'datasource db {',
      '  provider = "sqlite"',
      '  url      = env("DATABASE_URL")',
      '}',
    ].join('\n');
  },

  generateEnvVars(options?: { dbName?: string; dbUrl?: string }): Record<string, string> {
    const url = options?.dbUrl ?? 'file:./dev.db';
    return {
      DATABASE_URL: url,
      NODE_ENV: 'development',
      PORT: '3000',
    };
  },

  getConnectionPoolConfig(): object {
    return {};
  },

  getMigrationCommands(): string[] {
    return ['prisma migrate dev', 'prisma migrate deploy'];
  },

  getSeedCommand(): string {
    return 'tsx prisma/seed.ts';
  },
};
