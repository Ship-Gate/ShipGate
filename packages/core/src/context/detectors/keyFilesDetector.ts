/**
 * Key Files Detector
 * 
 * Identifies important files in the repository for context.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { KeyFile } from '../contextTypes.js';

/**
 * Key file patterns by category
 */
const KEY_FILE_PATTERNS: Record<KeyFile['category'], { patterns: RegExp[]; reason: string }[]> = {
  route: [
    { patterns: [/^app\/api\/.*\.(ts|js)$/], reason: 'Next.js API route' },
    { patterns: [/^pages\/api\/.*\.(ts|js)$/], reason: 'Next.js pages API route' },
    { patterns: [/^src\/routes\/.*\.(ts|js)$/], reason: 'Route file' },
    { patterns: [/^routes\/.*\.(ts|js)$/], reason: 'Route file' },
    { patterns: [/^src\/app\/.*\/route\.(ts|js)$/], reason: 'Next.js route handler' },
    { patterns: [/router\.(ts|js)$/], reason: 'Router configuration' },
    { patterns: [/controller\.(ts|js)$/], reason: 'Controller file' },
    { patterns: [/views\.py$/], reason: 'Django views' },
  ],
  auth: [
    { patterns: [/auth\.(ts|js|py)$/], reason: 'Auth configuration' },
    { patterns: [/\[\.\.\.nextauth\]\.ts$/], reason: 'NextAuth route' },
    { patterns: [/auth\/.*\.(ts|js)$/], reason: 'Auth directory file' },
    { patterns: [/middleware\.(ts|js)$/], reason: 'Middleware (may contain auth)' },
    { patterns: [/passport\.(ts|js)$/], reason: 'Passport configuration' },
    { patterns: [/session\.(ts|js)$/], reason: 'Session configuration' },
    { patterns: [/jwt\.(ts|js)$/], reason: 'JWT configuration' },
  ],
  database: [
    { patterns: [/prisma\/schema\.prisma$/], reason: 'Prisma schema' },
    { patterns: [/db\.(ts|js)$/], reason: 'Database configuration' },
    { patterns: [/database\.(ts|js)$/], reason: 'Database configuration' },
    { patterns: [/connection\.(ts|js)$/], reason: 'Database connection' },
    { patterns: [/drizzle\.config\.(ts|js)$/], reason: 'Drizzle configuration' },
    { patterns: [/migrations\/.*\.(ts|js|sql)$/], reason: 'Database migration' },
    { patterns: [/models\.py$/], reason: 'Django models' },
  ],
  schema: [
    { patterns: [/schema\.(ts|js|graphql|gql)$/], reason: 'Schema definition' },
    { patterns: [/types\.(ts|js)$/], reason: 'Type definitions' },
    { patterns: [/\.graphql$/], reason: 'GraphQL schema' },
    { patterns: [/openapi\.(yaml|yml|json)$/], reason: 'OpenAPI spec' },
    { patterns: [/swagger\.(yaml|yml|json)$/], reason: 'Swagger spec' },
  ],
  config: [
    { patterns: [/^\.env(\.[^.]+)?$/], reason: 'Environment variables' },
    { patterns: [/next\.config\.(js|mjs|ts)$/], reason: 'Next.js config' },
    { patterns: [/nuxt\.config\.(js|ts)$/], reason: 'Nuxt config' },
    { patterns: [/vite\.config\.(js|ts)$/], reason: 'Vite config' },
    { patterns: [/tsconfig\.json$/], reason: 'TypeScript config' },
    { patterns: [/package\.json$/], reason: 'Package manifest' },
  ],
  middleware: [
    { patterns: [/middleware\.(ts|js)$/], reason: 'Middleware' },
    { patterns: [/middlewares?\/.*\.(ts|js)$/], reason: 'Middleware file' },
  ],
  model: [
    { patterns: [/models?\/.*\.(ts|js)$/], reason: 'Model file' },
    { patterns: [/entities?\/.*\.(ts|js)$/], reason: 'Entity file' },
    { patterns: [/schemas?\/.*\.(ts|js)$/], reason: 'Schema file' },
  ],
  other: [],
};

/**
 * Directories to skip when scanning
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  'venv',
  '.venv',
  'coverage',
  '.turbo',
]);

/**
 * Detects key files in the workspace
 */
export async function detectKeyFiles(
  workspacePath: string,
  maxDepth: number = 5
): Promise<KeyFile[]> {
  const keyFiles: KeyFile[] = [];
  
  await scanDirectory(workspacePath, '', keyFiles, maxDepth);
  
  // Sort by category importance
  const categoryOrder: KeyFile['category'][] = ['auth', 'database', 'schema', 'route', 'config', 'middleware', 'model', 'other'];
  keyFiles.sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.category);
    const bIndex = categoryOrder.indexOf(b.category);
    return aIndex - bIndex;
  });
  
  return keyFiles;
}

/**
 * Recursively scan directory for key files
 */
async function scanDirectory(
  basePath: string,
  relativePath: string,
  keyFiles: KeyFile[],
  maxDepth: number,
  currentDepth: number = 0
): Promise<void> {
  if (currentDepth > maxDepth) return;

  const fullPath = path.join(basePath, relativePath);
  
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      const normalizedPath = entryRelativePath.replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await scanDirectory(basePath, entryRelativePath, keyFiles, maxDepth, currentDepth + 1);
        }
      } else if (entry.isFile()) {
        const keyFile = categorizeFile(normalizedPath);
        if (keyFile) {
          keyFiles.push(keyFile);
        }
      }
    }
  } catch {
    // Directory not readable
  }
}

/**
 * Categorize a file based on patterns
 */
function categorizeFile(filePath: string): KeyFile | null {
  for (const [category, patterns] of Object.entries(KEY_FILE_PATTERNS)) {
    if (category === 'other') continue;

    for (const { patterns: regexes, reason } of patterns) {
      for (const regex of regexes) {
        if (regex.test(filePath)) {
          return {
            path: filePath,
            category: category as KeyFile['category'],
            reason,
            confidence: 'high',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Get a limited list of the most important key files
 */
export function prioritizeKeyFiles(keyFiles: KeyFile[], limit: number = 20): KeyFile[] {
  // Group by category and take top from each
  const byCategory = new Map<KeyFile['category'], KeyFile[]>();
  
  for (const file of keyFiles) {
    const existing = byCategory.get(file.category) || [];
    existing.push(file);
    byCategory.set(file.category, existing);
  }

  const result: KeyFile[] = [];
  const categoryLimits: Record<KeyFile['category'], number> = {
    auth: 3,
    database: 3,
    schema: 3,
    route: 4,
    config: 3,
    middleware: 2,
    model: 2,
    other: 0,
  };

  for (const [category, files] of byCategory) {
    const categoryLimit = categoryLimits[category];
    result.push(...files.slice(0, categoryLimit));
  }

  return result.slice(0, limit);
}
