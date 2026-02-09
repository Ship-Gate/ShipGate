/**
 * Truthpack Builder
 *
 * Smart builder that uses adapters to extract facts from codebase.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import type {
  TruthpackV2,
  TruthpackProvenance,
  TruthpackDependency,
  TruthpackDbSchema,
  TruthpackAuthModel,
  TruthpackRuntimeProbe,
  TruthpackRoute,
  TruthpackEnvVar,
} from './schema.js';
import { createEmptyTruthpack, computeTruthpackHash } from './schema.js';
import { ADAPTERS, type AdapterContext } from './adapters/index.js';

export interface BuildTruthpackOptions {
  /** Repository root path */
  repoRoot: string;
  /** Output directory for truthpack files */
  outputDir?: string;
  /** File patterns to include (default: all .ts, .tsx, .js, .jsx) */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Whether to include dependencies */
  includeDependencies?: boolean;
  /** Whether to detect DB schema */
  detectDbSchema?: boolean;
  /** Whether to detect auth model */
  detectAuth?: boolean;
  /** Whether to detect runtime probes */
  detectRuntimeProbes?: boolean;
}

export interface BuildTruthpackResult {
  success: boolean;
  truthpack?: TruthpackV2;
  errors: string[];
  warnings: string[];
  stats: {
    filesScanned: number;
    routesFound: number;
    envVarsFound: number;
    durationMs: number;
  };
}

/**
 * Build truthpack from codebase
 */
export async function buildTruthpackSmart(
  options: BuildTruthpackOptions
): Promise<BuildTruthpackResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = {
    filesScanned: 0,
    routesFound: 0,
    envVarsFound: 0,
    durationMs: 0,
  };

  try {
    // Get provenance
    const provenance = await getProvenance(options.repoRoot);

    // Create empty truthpack
    const truthpack = createEmptyTruthpack(provenance);

    // Find all source files
    const sourceFiles = await findSourceFiles(
      options.repoRoot,
      options.includePatterns,
      options.excludePatterns
    );

    stats.filesScanned = sourceFiles.length;

    // Step 1: Extract routes and env vars using adapters
    const pluginGraph = new Map<string, { prefix: string; file: string }>();
    
    for (const filePath of sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const context: AdapterContext = {
          repoRoot: options.repoRoot,
          filePath,
          content,
        };

        // Build plugin graph for Fastify prefix resolution
        if (content.includes('.register(')) {
          const relativePath = path.relative(options.repoRoot, filePath);
          const registrations = extractFastifyRegistrations(content);
          for (const reg of registrations) {
            pluginGraph.set(reg.pluginId, { prefix: reg.prefix, file: relativePath });
          }
        }

        // Try each adapter
        for (const adapter of ADAPTERS) {
          if (adapter.canHandle(context)) {
            const result = await adapter.extract(context);
            truthpack.routes.push(...result.routes);
            truthpack.envVars.push(...result.envVars);
            break; // Use first matching adapter
          }
        }
      } catch (err) {
        warnings.push(`Failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Step 2: Resolve Fastify prefixes across plugin graph
    truthpack.routes = resolveFastifyPrefixes(truthpack.routes, pluginGraph);

    // Step 3: Deduplicate routes (same method + path)
    truthpack.routes = deduplicateRoutes(truthpack.routes);
    stats.routesFound = truthpack.routes.length;

    // Deduplicate env vars
    truthpack.envVars = deduplicateEnvVars(truthpack.envVars);
    stats.envVarsFound = truthpack.envVars.length;

    // Extract dependencies if requested
    if (options.includeDependencies !== false) {
      truthpack.dependencies = await extractDependencies(options.repoRoot);
    }

    // Detect DB schema if requested
    if (options.detectDbSchema !== false) {
      const dbSchema = await detectDbSchema(options.repoRoot);
      if (dbSchema) {
        truthpack.dbSchema = dbSchema;
      }
    }

    // Detect auth model if requested
    if (options.detectAuth !== false) {
      const authModel = await detectAuthModel(options.repoRoot, truthpack.routes);
      if (authModel) {
        truthpack.auth = authModel;
      }
    }

    // Detect runtime probes if requested
    if (options.detectRuntimeProbes !== false) {
      truthpack.runtimeProbes = await detectRuntimeProbes(options.repoRoot, truthpack.routes);
    }

    // Compute summary
    truthpack.summary = {
      routes: truthpack.routes.length,
      envVars: truthpack.envVars.length,
      dbTables: truthpack.dbSchema?.tables.length ?? 0,
      dependencies: truthpack.dependencies.length,
      runtimeProbes: truthpack.runtimeProbes.length,
      avgConfidence: computeAverageConfidence(truthpack),
    };

    stats.durationMs = Date.now() - startTime;

    // Write to output directory if specified
    if (options.outputDir) {
      await writeTruthpack(truthpack, options.outputDir);
    }

    return {
      success: true,
      truthpack,
      errors,
      warnings,
      stats,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      errors,
      warnings,
      stats: { ...stats, durationMs: Date.now() - startTime },
    };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────────

async function getProvenance(repoRoot: string): Promise<TruthpackProvenance> {
  let commitHash = 'unknown';
  let commitMessage: string | undefined;

  try {
    commitHash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
    commitMessage = execSync('git log -1 --pretty=%s', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    // Not a git repo or git not available
  }

  const nodeVersion = process.version;
  let packageManager: { name: 'pnpm' | 'npm' | 'yarn'; version: string } = { name: 'npm', version: 'unknown' };

  try {
    if (await fileExists(path.join(repoRoot, 'pnpm-lock.yaml'))) {
      const version = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
      packageManager = { name: 'pnpm', version };
    } else if (await fileExists(path.join(repoRoot, 'yarn.lock'))) {
      const version = execSync('yarn --version', { encoding: 'utf-8' }).trim();
      packageManager = { name: 'yarn', version };
    } else {
      const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
      packageManager = { name: 'npm', version };
    }
  } catch {
    // Package manager detection failed
  }

  return {
    commitHash,
    commitMessage,
    nodeVersion,
    packageManager,
    timestamp: new Date().toISOString(),
    generatorVersion: '2.0.0',
    repoRoot,
  };
}

async function findSourceFiles(
  repoRoot: string,
  includePatterns?: string[],
  excludePatterns?: string[]
): Promise<string[]> {
  const files: string[] = [];
  const patterns = includePatterns ?? ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
  const exclude = excludePatterns ?? [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/build/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
  ];

  async function walkDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoRoot, fullPath);

      // Check exclude patterns
      if (exclude.some(pattern => matchesPattern(relativePath, pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        // Check include patterns
        if (patterns.some(pattern => matchesPattern(relativePath, pattern))) {
          files.push(fullPath);
        }
      }
    }
  }

  await walkDir(repoRoot);
  return files;
}

function matchesPattern(filePath: string, pattern: string): boolean {
  // Simple glob matching
  const regex = new RegExp(
    '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\//g, '\\/') + '$'
  );
  return regex.test(filePath);
}

function deduplicateRoutes(routes: TruthpackRoute[]): TruthpackRoute[] {
  const seen = new Set<string>();
  return routes.filter(route => {
    const key = `${route.method}:${route.path}`;
    if (seen.has(key)) {
      // Keep route with higher confidence
      const existing = routes.find(r => `${r.method}:${r.path}` === key && seen.has(key));
      if (existing && route.confidence > existing.confidence) {
        const index = routes.indexOf(existing);
        routes[index] = route;
      }
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deduplicateEnvVars(envVars: typeof envVars): typeof envVars {
  const seen = new Map<string, typeof envVars[0]>();
  for (const envVar of envVars) {
    const existing = seen.get(envVar.name);
    if (!existing || envVar.confidence > existing.confidence) {
      seen.set(envVar.name, envVar);
    }
  }
  return Array.from(seen.values());
}

async function extractDependencies(repoRoot: string): Promise<TruthpackDependency[]> {
  const dependencies: TruthpackDependency[] = [];
  const packageJsonPath = path.join(repoRoot, 'package.json');

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // Extract production dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'production',
          usedIn: [], // Could be enhanced to track actual usage
          workspace: false,
        });
      }
    }

    // Extract dev dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'development',
          usedIn: [],
          workspace: false,
        });
      }
    }
  } catch {
    // package.json not found or invalid
  }

  return dependencies;
}

async function detectDbSchema(repoRoot: string): Promise<TruthpackDbSchema | undefined> {
  // Look for Prisma schema
  const prismaSchemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
  if (await fileExists(prismaSchemaPath)) {
    const content = await fs.readFile(prismaSchemaPath, 'utf-8');
    const tables = extractPrismaTables(content);

    return {
      type: 'postgresql', // Default, could be detected from datasource
      schemaFile: path.relative(repoRoot, prismaSchemaPath),
      tables,
      orm: 'prisma',
      confidence: 0.95,
    };
  }

  // Look for TypeORM entities
  // Look for Sequelize models
  // etc.

  return undefined;
}

function extractPrismaTables(content: string): typeof TruthpackDbSchema.prototype.tables {
  const tables: typeof TruthpackDbSchema.prototype.tables = [];
  const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  let match: RegExpExecArray | null;

  while ((match = modelPattern.exec(content)) !== null) {
    const tableName = match[1];
    const fieldsContent = match[2];
    const columns: typeof TruthpackDbTable.prototype.columns = [];

    const fieldPattern = /(\w+)\s+(\w+)(\??)(\s+@.*)?/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldPattern.exec(fieldsContent)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const nullable = fieldMatch[3] === '?';
      const isPrimaryKey = fieldMatch[4]?.includes('@id') ?? false;

      columns.push({
        name: fieldName,
        type: fieldType,
        nullable,
        primaryKey: isPrimaryKey,
      });
    }

    tables.push({ name: tableName, columns });
  }

  return tables;
}

async function detectAuthModel(
  repoRoot: string,
  routes: typeof routes
): Promise<TruthpackAuthModel | undefined> {
  // Look for auth-related routes
  const authRoutes: Record<string, string> = {};
  for (const route of routes) {
    const pathLower = route.path.toLowerCase();
    if (pathLower.includes('/login')) authRoutes.login = route.path;
    if (pathLower.includes('/logout')) authRoutes.logout = route.path;
    if (pathLower.includes('/register')) authRoutes.register = route.path;
    if (pathLower.includes('/refresh')) authRoutes.refresh = route.path;
    if (pathLower.includes('/callback')) authRoutes.callback = route.path;
  }

  if (Object.keys(authRoutes).length === 0) {
    return undefined;
  }

  // Detect provider from dependencies or config
  let provider = 'unknown';
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps['@clerk/nextjs'] || deps['@clerk/clerk-sdk-node']) provider = 'clerk';
    else if (deps['next-auth']) provider = 'next-auth';
    else if (deps['passport']) provider = 'passport';
    else if (deps['jsonwebtoken']) provider = 'jwt';
  }

  return {
    provider,
    middleware: [],
    routes: authRoutes,
    configFiles: [],
    confidence: 0.7,
  };
}

async function detectRuntimeProbes(
  repoRoot: string,
  routes: typeof routes
): Promise<TruthpackRuntimeProbe[]> {
  const probes: TruthpackRuntimeProbe[] = [];

  // Create HTTP probes for routes
  for (const route of routes) {
    if (route.method === 'GET' && route.path.includes('health')) {
      probes.push({
        type: 'http',
        endpoint: route.path,
        healthCheck: route.path,
        confidence: 0.8,
      });
    }
  }

  return probes;
}

function computeAverageConfidence(truthpack: TruthpackV2): number {
  const confidences: number[] = [];
  truthpack.routes.forEach(r => confidences.push(r.confidence));
  truthpack.envVars.forEach(e => confidences.push(e.confidence));
  if (truthpack.dbSchema) confidences.push(truthpack.dbSchema.confidence);
  if (truthpack.auth) confidences.push(truthpack.auth.confidence);
  truthpack.runtimeProbes.forEach(p => confidences.push(p.confidence));

  if (confidences.length === 0) return 0;
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

async function savePreviousTruthpack(outputDir: string): Promise<void> {
  try {
    const truthpackPath = path.join(outputDir, 'truthpack.json');
    if (await fileExists(truthpackPath)) {
      const previousDir = path.join(outputDir, '.previous');
      await fs.mkdir(previousDir, { recursive: true });
      const content = await fs.readFile(truthpackPath, 'utf-8');
      await fs.writeFile(path.join(previousDir, 'truthpack.json'), content, 'utf-8');
    }
  } catch {
    // Ignore errors when saving previous
  }
}

async function writeTruthpack(truthpack: TruthpackV2, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  // Write main truthpack.json
  await fs.writeFile(
    path.join(outputDir, 'truthpack.json'),
    JSON.stringify(truthpack, null, 2),
    'utf-8'
  );

  // Write individual files for compatibility with v1 loaders
  await fs.writeFile(
    path.join(outputDir, 'routes.json'),
    JSON.stringify({ routes: truthpack.routes }, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(outputDir, 'env.json'),
    JSON.stringify({ variables: truthpack.envVars }, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(outputDir, 'meta.json'),
    JSON.stringify({
      version: truthpack.version,
      generatedAt: truthpack.provenance.timestamp,
      hash: computeTruthpackHash(truthpack),
      scannerVersions: {
        routes: '2.0.0',
        env: '2.0.0',
        auth: '2.0.0',
        contracts: '2.0.0',
      },
      summary: truthpack.summary,
    }, null, 2),
    'utf-8'
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract Fastify plugin registrations from content
 */
function extractFastifyRegistrations(content: string): Array<{ pluginId: string; prefix: string }> {
  const registrations: Array<{ pluginId: string; prefix: string }> = [];
  const registerPattern = /(?:await\s+)?(?:fastify|app|server)\s*\.\s*register\s*\(\s*([^,)]+)\s*(?:,\s*\{([^}]+)\})?\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = registerPattern.exec(content)) !== null) {
    const pluginId = match[1].trim();
    const optionsStr = match[2] || '';
    const prefixMatch = optionsStr.match(/prefix\s*:\s*['"`]([^'"`]+)['"`]/);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    registrations.push({ pluginId, prefix });
  }

  return registrations;
}

/**
 * Resolve Fastify route prefixes based on plugin registration graph
 */
function resolveFastifyPrefixes(
  routes: TruthpackRoute[],
  pluginGraph: Map<string, { prefix: string; file: string }>
): TruthpackRoute[] {
  // For each route, check if its file is registered as a plugin and apply prefix
  const resolvedRoutes: TruthpackRoute[] = [];
  for (const route of routes) {
    // Check if this route's file is registered as a plugin
    let prefixToApply = '';
    for (const [pluginId, { prefix }] of pluginGraph.entries()) {
      // Simple heuristic: if plugin ID matches file name or import path
      const routeFileBase = path.basename(route.file, path.extname(route.file));
      if (pluginId.includes(routeFileBase) || pluginId.includes(route.file)) {
        prefixToApply = prefix;
        break;
      }
    }

    // Apply prefix if found and route doesn't already have it
    const routeCopy = { ...route };
    if (prefixToApply && !routeCopy.path.startsWith(prefixToApply)) {
      routeCopy.path = prefixToApply + (routeCopy.path.startsWith('/') ? routeCopy.path : '/' + routeCopy.path);
    }

    resolvedRoutes.push(routeCopy);
  }

  return resolvedRoutes;
}
