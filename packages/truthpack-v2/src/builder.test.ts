/**
 * Truthpack Builder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { buildTruthpackSmart } from './builder.js';
import { loadTruthpackFromDir, detectDrift } from './drift.js';

describe('buildTruthpackSmart', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthpack-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should build truthpack from simple Fastify app', async () => {
    // Create test files
    const appDir = path.join(tempDir, 'app');
    await fs.mkdir(appDir, { recursive: true });

    const serverFile = path.join(appDir, 'server.ts');
    await fs.writeFile(
      serverFile,
      `
import Fastify from 'fastify';

const fastify = Fastify();

fastify.get('/health', async (req, res) => {
  return { status: 'ok' };
});

fastify.post('/api/users', async (req, res) => {
  return { id: 1 };
});

export default fastify;
`,
      'utf-8'
    );

    const result = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir: path.join(tempDir, '.truthpack'),
    });

    expect(result.success).toBe(true);
    expect(result.truthpack).toBeDefined();
    expect(result.truthpack!.routes.length).toBeGreaterThan(0);
    expect(result.stats.routesFound).toBeGreaterThan(0);
  });

  it('should build truthpack from Next.js App Router', async () => {
    const appDir = path.join(tempDir, 'app', 'api', 'users');
    await fs.mkdir(appDir, { recursive: true });

    const routeFile = path.join(appDir, 'route.ts');
    await fs.writeFile(
      routeFile,
      `
export async function GET(request: Request) {
  return Response.json({ users: [] });
}

export async function POST(request: Request) {
  return Response.json({ created: true });
}
`,
      'utf-8'
    );

    const result = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir: path.join(tempDir, '.truthpack'),
    });

    expect(result.success).toBe(true);
    expect(result.truthpack!.routes.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract env vars', async () => {
    const appDir = path.join(tempDir, 'app');
    await fs.mkdir(appDir, { recursive: true });

    const configFile = path.join(appDir, 'config.ts');
    await fs.writeFile(
      configFile,
      `
const dbUrl = process.env.DATABASE_URL || 'postgres://localhost';
const apiKey = process.env.API_KEY;
`,
      'utf-8'
    );

    const result = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir: path.join(tempDir, '.truthpack'),
    });

    expect(result.success).toBe(true);
    expect(result.truthpack!.envVars.length).toBeGreaterThanOrEqual(2);
    expect(result.truthpack!.envVars.some(e => e.name === 'DATABASE_URL')).toBe(true);
    expect(result.truthpack!.envVars.some(e => e.name === 'API_KEY')).toBe(true);
  });

  it('should include provenance information', async () => {
    const result = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir: path.join(tempDir, '.truthpack'),
    });

    expect(result.success).toBe(true);
    expect(result.truthpack!.provenance).toBeDefined();
    expect(result.truthpack!.provenance.nodeVersion).toBeDefined();
    expect(result.truthpack!.provenance.timestamp).toBeDefined();
    expect(result.truthpack!.provenance.generatorVersion).toBe('2.0.0');
  });

  it('should save previous truthpack for diff', async () => {
    // Build first truthpack
    const outputDir = path.join(tempDir, '.truthpack');
    const result1 = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir,
    });

    expect(result1.success).toBe(true);

    // Build second truthpack
    const result2 = await buildTruthpackSmart({
      repoRoot: tempDir,
      outputDir,
    });

    expect(result2.success).toBe(true);

    // Check that previous truthpack exists
    const previousDir = path.join(outputDir, '.previous');
    const previousTruthpack = await loadTruthpackFromDir(previousDir);
    expect(previousTruthpack).toBeDefined();
  });
});

describe('detectDrift', () => {
  it('should detect added routes', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthpack-drift-test-'));
    
    try {
      // Create old truthpack
      const oldDir = path.join(tempDir, 'old');
      await fs.mkdir(oldDir, { recursive: true });
      await fs.writeFile(
        path.join(oldDir, 'truthpack.json'),
        JSON.stringify({
          version: '2.0.0',
          provenance: {
            commitHash: 'abc123',
            nodeVersion: 'v18.0.0',
            packageManager: { name: 'pnpm', version: '8.0.0' },
            timestamp: new Date().toISOString(),
            generatorVersion: '2.0.0',
            repoRoot: tempDir,
          },
          routes: [
            {
              path: '/api/users',
              method: 'GET',
              handler: 'getUsers',
              file: 'server.ts',
              line: 10,
              parameters: [],
              middleware: [],
              confidence: 0.9,
              adapter: 'fastify',
            },
          ],
          envVars: [],
          dependencies: [],
          runtimeProbes: [],
          summary: {
            routes: 1,
            envVars: 0,
            dbTables: 0,
            dependencies: 0,
            runtimeProbes: 0,
            avgConfidence: 0.9,
          },
        }, null, 2),
        'utf-8'
      );

      // Create new truthpack with added route
      const newDir = path.join(tempDir, 'new');
      await fs.mkdir(newDir, { recursive: true });
      await fs.writeFile(
        path.join(newDir, 'truthpack.json'),
        JSON.stringify({
          version: '2.0.0',
          provenance: {
            commitHash: 'def456',
            nodeVersion: 'v18.0.0',
            packageManager: { name: 'pnpm', version: '8.0.0' },
            timestamp: new Date().toISOString(),
            generatorVersion: '2.0.0',
            repoRoot: tempDir,
          },
          routes: [
            {
              path: '/api/users',
              method: 'GET',
              handler: 'getUsers',
              file: 'server.ts',
              line: 10,
              parameters: [],
              middleware: [],
              confidence: 0.9,
              adapter: 'fastify',
            },
            {
              path: '/api/posts',
              method: 'GET',
              handler: 'getPosts',
              file: 'server.ts',
              line: 20,
              parameters: [],
              middleware: [],
              confidence: 0.9,
              adapter: 'fastify',
            },
          ],
          envVars: [],
          dependencies: [],
          runtimeProbes: [],
          summary: {
            routes: 2,
            envVars: 0,
            dbTables: 0,
            dependencies: 0,
            runtimeProbes: 0,
            avgConfidence: 0.9,
          },
        }, null, 2),
        'utf-8'
      );

      const oldTruthpack = await loadTruthpackFromDir(oldDir);
      const newTruthpack = await loadTruthpackFromDir(newDir);

      expect(oldTruthpack).toBeDefined();
      expect(newTruthpack).toBeDefined();

      const report = detectDrift(oldTruthpack!, newTruthpack!);

      expect(report.hasDrift).toBe(true);
      expect(report.summary.added).toBe(1);
      expect(report.changes.some(c => c.type === 'added' && c.item === 'GET /api/posts')).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect removed routes as breaking', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthpack-drift-test-'));
    
    try {
      const oldDir = path.join(tempDir, 'old');
      await fs.mkdir(oldDir, { recursive: true });
      await fs.writeFile(
        path.join(oldDir, 'truthpack.json'),
        JSON.stringify({
          version: '2.0.0',
          provenance: { commitHash: 'abc', nodeVersion: 'v18', packageManager: { name: 'pnpm', version: '8' }, timestamp: new Date().toISOString(), generatorVersion: '2.0.0', repoRoot: tempDir },
          routes: [{ path: '/api/users', method: 'GET', handler: 'getUsers', file: 'server.ts', line: 10, parameters: [], middleware: [], confidence: 0.9, adapter: 'fastify' }],
          envVars: [],
          dependencies: [],
          runtimeProbes: [],
          summary: { routes: 1, envVars: 0, dbTables: 0, dependencies: 0, runtimeProbes: 0, avgConfidence: 0.9 },
        }, null, 2),
        'utf-8'
      );

      const newDir = path.join(tempDir, 'new');
      await fs.mkdir(newDir, { recursive: true });
      await fs.writeFile(
        path.join(newDir, 'truthpack.json'),
        JSON.stringify({
          version: '2.0.0',
          provenance: { commitHash: 'def', nodeVersion: 'v18', packageManager: { name: 'pnpm', version: '8' }, timestamp: new Date().toISOString(), generatorVersion: '2.0.0', repoRoot: tempDir },
          routes: [],
          envVars: [],
          dependencies: [],
          runtimeProbes: [],
          summary: { routes: 0, envVars: 0, dbTables: 0, dependencies: 0, runtimeProbes: 0, avgConfidence: 0 },
        }, null, 2),
        'utf-8'
      );

      const oldTruthpack = await loadTruthpackFromDir(oldDir);
      const newTruthpack = await loadTruthpackFromDir(newDir);

      const report = detectDrift(oldTruthpack!, newTruthpack!);

      expect(report.hasDrift).toBe(true);
      expect(report.summary.removed).toBe(1);
      expect(report.summary.breaking).toBe(1);
      expect(report.changes.some(c => c.type === 'removed' && c.impact === 'breaking')).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
