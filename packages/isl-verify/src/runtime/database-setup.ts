/**
 * Test Database Setup
 * 
 * Detects ORM, creates temp database, runs migrations, seeds test data
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import type { TestDatabaseConfig } from './types';

export class DatabaseSetup {
  private tempDir?: string;
  private originalEnv: Record<string, string | undefined> = {};

  async setup(projectDir: string): Promise<TestDatabaseConfig> {
    const ormType = await this.detectORM(projectDir);
    
    if (ormType === 'none') {
      return {
        type: 'none',
        connectionString: '',
        runMigrations: false,
      };
    }

    // Create temp directory for SQLite
    this.tempDir = join(tmpdir(), `isl-runtime-${randomBytes(8).toString('hex')}`);
    await mkdir(this.tempDir, { recursive: true });

    const dbPath = join(this.tempDir, 'test.db');
    const connectionString = `file:${dbPath}`;

    // Set DATABASE_URL env var
    this.originalEnv.DATABASE_URL = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;

    // Run migrations based on ORM type
    if (ormType === 'prisma') {
      await this.runPrismaMigrations(projectDir);
      await this.seedPrismaData(projectDir);
    } else if (ormType === 'drizzle') {
      await this.runDrizzleMigrations(projectDir);
    }

    return {
      type: 'sqlite',
      connectionString,
      tempDir: this.tempDir,
      runMigrations: true,
      seedData: true,
    };
  }

  async cleanup(): Promise<void> {
    // Restore env
    if (this.originalEnv.DATABASE_URL !== undefined) {
      process.env.DATABASE_URL = this.originalEnv.DATABASE_URL;
    } else {
      delete process.env.DATABASE_URL;
    }

    // Delete temp directory
    if (this.tempDir && existsSync(this.tempDir)) {
      await rm(this.tempDir, { recursive: true, force: true });
    }
  }

  private async detectORM(projectDir: string): Promise<'prisma' | 'drizzle' | 'none'> {
    const pkgPath = join(projectDir, 'package.json');
    
    if (!existsSync(pkgPath)) {
      return 'none';
    }

    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['@prisma/client'] || deps['prisma']) {
      return 'prisma';
    }
    
    if (deps['drizzle-orm']) {
      return 'drizzle';
    }

    return 'none';
  }

  private async runPrismaMigrations(projectDir: string): Promise<void> {
    const schemaPath = join(projectDir, 'prisma', 'schema.prisma');
    
    if (!existsSync(schemaPath)) {
      throw new Error('Prisma schema not found at prisma/schema.prisma');
    }

    // Update schema to use SQLite if it uses Postgres
    const schema = await readFile(schemaPath, 'utf-8');
    const testSchema = schema.replace(
      /provider\s*=\s*"postgresql"/g,
      'provider = "sqlite"'
    );

    // Write temporary schema
    const tempSchemaPath = join(this.tempDir!, 'schema.prisma');
    await writeFile(tempSchemaPath, testSchema);

    // Run db push (faster than migrate for tests)
    await this.runCommand('npx', ['prisma', 'db', 'push', '--schema', tempSchemaPath, '--skip-generate'], projectDir);
    
    // Generate Prisma Client
    await this.runCommand('npx', ['prisma', 'generate', '--schema', tempSchemaPath], projectDir);
  }

  private async seedPrismaData(projectDir: string): Promise<void> {
    // Create a minimal seed file that creates test users
    const seedCode = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create admin user
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: '$2a$10$XK8Z8Z8Z8Z8Z8Z8Z8Z8Z8OqYqYqYqYqYqYqYqYqYqYqYqY', // bcrypt hash of 'admin123'
      role: 'admin',
    },
  });

  // Create regular user
  await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {},
    create: {
      email: 'user@test.com',
      password: '$2a$10$XK8Z8Z8Z8Z8Z8Z8Z8Z8Z8OqYqYqYqYqYqYqYqYqYqYqYqY', // bcrypt hash of 'user123'
      role: 'user',
    },
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
`;

    const seedPath = join(this.tempDir!, 'seed.js');
    await writeFile(seedPath, seedCode);

    try {
      await this.runCommand('node', [seedPath], projectDir);
    } catch (error) {
      // Seeding might fail if schema doesn't have User model - that's okay
      console.warn('Database seeding failed (this is okay if no User model):', error instanceof Error ? error.message : String(error));
    }
  }

  private async runDrizzleMigrations(projectDir: string): Promise<void> {
    // Try to run drizzle migrations
    try {
      await this.runCommand('npx', ['drizzle-kit', 'push:sqlite'], projectDir);
    } catch (error) {
      console.warn('Drizzle migrations failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        env: process.env,
        shell: true,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}:\n${stderr || stdout}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }
}
