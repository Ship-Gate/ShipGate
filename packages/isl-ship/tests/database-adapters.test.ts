/**
 * DatabaseAdapter tests
 */

import { describe, it, expect } from 'vitest';
import {
  getDatabaseAdapter,
  getAdapterIds,
  SQLiteAdapter,
  PostgresAdapter,
  getPgBouncerUrl,
} from '../src/adapters/index.js';

describe('DatabaseAdapter', () => {
  describe('getDatabaseAdapter', () => {
    it('returns SQLiteAdapter for sqlite', () => {
      const adapter = getDatabaseAdapter('sqlite');
      expect(adapter).toBe(SQLiteAdapter);
      expect(adapter.name).toBe('SQLite');
      expect(adapter.provider).toBe('sqlite');
    });

    it('returns PostgresAdapter for postgres', () => {
      const adapter = getDatabaseAdapter('postgres');
      expect(adapter).toBe(PostgresAdapter);
      expect(adapter.name).toBe('PostgreSQL');
      expect(adapter.provider).toBe('postgresql');
    });

    it('defaults to SQLiteAdapter for unknown id', () => {
      const adapter = getDatabaseAdapter('unknown');
      expect(adapter).toBe(SQLiteAdapter);
    });

    it('is case-insensitive', () => {
      expect(getDatabaseAdapter('POSTGRES')).toBe(PostgresAdapter);
      expect(getDatabaseAdapter('SQLite')).toBe(SQLiteAdapter);
    });
  });

  describe('getAdapterIds', () => {
    it('returns sqlite and postgres', () => {
      expect(getAdapterIds()).toEqual(['sqlite', 'postgres']);
    });
  });

  describe('SQLiteAdapter', () => {
    it('generates correct datasource block', () => {
      const block = SQLiteAdapter.generateDatasource();
      expect(block).toContain('provider = "sqlite"');
      expect(block).toContain('url      = env("DATABASE_URL")');
    });

    it('generates env vars with default file path', () => {
      const env = SQLiteAdapter.generateEnvVars();
      expect(env.DATABASE_URL).toBe('file:./dev.db');
    });

    it('generates env vars with custom dbUrl', () => {
      const env = SQLiteAdapter.generateEnvVars({ dbUrl: 'file:./custom.db' });
      expect(env.DATABASE_URL).toBe('file:./custom.db');
    });

    it('returns empty connection pool config', () => {
      expect(SQLiteAdapter.getConnectionPoolConfig()).toEqual({});
    });

    it('returns migration commands', () => {
      expect(SQLiteAdapter.getMigrationCommands()).toEqual([
        'prisma migrate dev',
        'prisma migrate deploy',
      ]);
    });

    it('returns seed command', () => {
      expect(SQLiteAdapter.getSeedCommand()).toBe('tsx prisma/seed.ts');
    });

    it('has no getDockerComposeService', () => {
      expect(SQLiteAdapter.getDockerComposeService).toBeUndefined();
    });
  });

  describe('PostgresAdapter', () => {
    it('generates correct datasource block', () => {
      const block = PostgresAdapter.generateDatasource();
      expect(block).toContain('provider = "postgresql"');
      expect(block).toContain('url      = env("DATABASE_URL")');
    });

    it('generates env vars with dbName', () => {
      const env = PostgresAdapter.generateEnvVars({ dbName: 'MyApp' });
      expect(env.DATABASE_URL).toContain('my-app');
      expect(env.DATABASE_URL_DOCKER).toContain('my-app');
    });

    it('generates env vars with custom dbUrl', () => {
      const url = 'postgresql://user:pass@host:5432/db';
      const env = PostgresAdapter.generateEnvVars({ dbUrl: url });
      expect(env.DATABASE_URL).toBe(url);
    });

    it('returns connection pool config', () => {
      const config = PostgresAdapter.getConnectionPoolConfig();
      expect(config).toMatchObject({
        connection_limit: 10,
        pool_timeout: 20,
        pgbouncer: true,
      });
    });

    it('returns migration commands', () => {
      expect(PostgresAdapter.getMigrationCommands()).toEqual([
        'prisma migrate dev',
        'prisma migrate deploy',
      ]);
    });

    it('returns seed command', () => {
      expect(PostgresAdapter.getSeedCommand()).toBe('tsx prisma/seed.ts');
    });

    it('generates Docker Compose service with healthcheck', () => {
      const service = PostgresAdapter.getDockerComposeService!({ dbName: 'TestDb' });
      expect(service).toMatchObject({
        image: 'postgres:16-alpine',
        environment: {
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: 'postgres',
          POSTGRES_DB: 'test-db',
        },
      });
      expect((service as { healthcheck?: { test: string[] } }).healthcheck?.test).toContain(
        'pg_isready -U postgres'
      );
    });
  });

  describe('getPgBouncerUrl', () => {
    it('appends pgbouncer params to URL without query', () => {
      const url = 'postgresql://user:pass@host:5432/db';
      expect(getPgBouncerUrl(url)).toContain('pgbouncer=true');
      expect(getPgBouncerUrl(url)).toContain('connection_limit=10');
    });

    it('appends with & when URL has existing query', () => {
      const url = 'postgresql://user:pass@host:5432/db?schema=public';
      const result = getPgBouncerUrl(url);
      expect(result).toContain('?');
      expect(result).toContain('pgbouncer=true');
    });
  });
});
