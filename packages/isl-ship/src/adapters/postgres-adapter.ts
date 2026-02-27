/**
 * PostgresAdapter — PostgreSQL database configuration
 *
 * Production-ready with PgBouncer-compatible URL format, connection pooling,
 * and Docker Compose for local development.
 */

import type { DatabaseAdapter } from './database-adapter.js';
import { toKebabCase } from '../types.js';

const DEFAULT_LOCAL_URL = 'postgresql://postgres:postgres@localhost:5432/mydb?schema=public';
const DEFAULT_DOCKER_URL = (dbName: string) =>
  `postgresql://postgres:postgres@db:5432/${dbName}?schema=public`;

/** PgBouncer-compatible URL format: add ?pgbouncer=true for transaction pooling */
export function getPgBouncerUrl(baseUrl: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}pgbouncer=true&connection_limit=10`;
}

export const PostgresAdapter: DatabaseAdapter = {
  name: 'PostgreSQL',
  provider: 'postgresql',

  generateDatasource(): string {
    return [
      'datasource db {',
      '  provider = "postgresql"',
      '  url      = env("DATABASE_URL")',
      '}',
    ].join('\n');
  },

  generateEnvVars(options?: { dbName?: string; dbUrl?: string }): Record<string, string> {
    const dbName = options?.dbName ? toKebabCase(options.dbName) : 'mydb';
    const localUrl = options?.dbUrl ?? `postgresql://postgres:postgres@localhost:5432/${dbName}?schema=public`;
    const dockerUrl = DEFAULT_DOCKER_URL(dbName);

    return {
      DATABASE_URL: localUrl,
      DATABASE_URL_DOCKER: dockerUrl,
      NODE_ENV: 'development',
      PORT: '3000',
    };
  },

  getConnectionPoolConfig(): object {
    return {
      connection_limit: 10,
      pool_timeout: 20,
      pgbouncer: true,
    };
  },

  getMigrationCommands(): string[] {
    return ['prisma migrate dev', 'prisma migrate deploy'];
  },

  getSeedCommand(): string {
    return 'tsx prisma/seed.ts';
  },

  getDockerComposeService(options?: { dbName?: string }): object {
    const dbName = options?.dbName ? toKebabCase(options.dbName) : 'mydb';

    return {
      image: 'postgres:16-alpine',
      environment: {
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'postgres',
        POSTGRES_DB: dbName,
      },
      ports: ['5432:5432'],
      volumes: ['pgdata:/var/lib/postgresql/data'],
      healthcheck: {
        test: ['CMD-SHELL', 'pg_isready -U postgres'],
        interval: '5s',
        timeout: '5s',
        retries: 5,
      },
    };
  },
};
