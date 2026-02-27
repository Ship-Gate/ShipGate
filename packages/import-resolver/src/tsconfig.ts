// ============================================================================
// TypeScript Config Parser - Path Aliases and baseUrl Resolution
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * TypeScript compiler options (subset we care about)
 */
export interface TSConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

/**
 * Resolved path alias configuration
 */
export interface PathAliases {
  baseUrl: string;
  paths: Array<{
    pattern: string;
    replacements: string[];
  }>;
}

/**
 * Cache entry for tsconfig resolution
 */
interface TSConfigCache {
  config: PathAliases | null;
  hash: string;
  path: string;
}

/**
 * Parse tsconfig.json and resolve path aliases
 */
export async function parseTSConfig(
  tsconfigPath: string,
  projectRoot: string
): Promise<PathAliases | null> {
  try {
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    const config: TSConfig = JSON.parse(content);

    // Resolve baseUrl
    let baseUrl = projectRoot;
    if (config.compilerOptions?.baseUrl) {
      baseUrl = path.isAbsolute(config.compilerOptions.baseUrl)
        ? config.compilerOptions.baseUrl
        : path.resolve(path.dirname(tsconfigPath), config.compilerOptions.baseUrl);
    }

    // Parse paths
    const paths: PathAliases['paths'] = [];
    if (config.compilerOptions?.paths) {
      for (const [pattern, replacements] of Object.entries(config.compilerOptions.paths)) {
        paths.push({
          pattern,
          replacements: replacements.map((r) =>
            path.isAbsolute(r) ? r : path.resolve(baseUrl, r)
          ),
        });
      }
    }

    return {
      baseUrl,
      paths,
    };
  } catch {
    return null;
  }
}

/**
 * Find tsconfig.json starting from a directory and walking up
 */
export async function findTSConfig(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);

  while (current !== path.dirname(current)) {
    const tsconfigPath = path.join(current, 'tsconfig.json');
    try {
      await fs.access(tsconfigPath);
      return tsconfigPath;
    } catch {
      // Continue searching
    }

    current = path.dirname(current);
  }

  return null;
}

/**
 * Compute hash of tsconfig.json for cache invalidation
 */
export async function hashTSConfig(tsconfigPath: string): Promise<string> {
  try {
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch {
    return '';
  }
}

/**
 * Resolve a path alias (e.g., "@/*" -> "src/*")
 */
export function resolvePathAlias(
  importPath: string,
  aliases: PathAliases
): string[] {
  const candidates: string[] = [];

  // Try each path pattern
  for (const { pattern, replacements } of aliases.paths) {
    // Convert pattern to regex (e.g., "@/*" -> "^@/(.*)$")
    const regexPattern = pattern.replace(/\*/g, '(.+)');
    const regex = new RegExp(`^${regexPattern.replace(/\//g, '\\/')}$`);

    const match = importPath.match(regex);
    if (match) {
      const captured = match[1] || '';
      for (const replacement of replacements) {
        const resolved = replacement.replace(/\*/g, captured);
        candidates.push(resolved);
      }
    }
  }

  return candidates;
}

/**
 * Check if an import path matches a path alias pattern
 */
export function matchesPathAlias(importPath: string, aliases: PathAliases): boolean {
  for (const { pattern } of aliases.paths) {
    const regexPattern = pattern.replace(/\*/g, '(.+)');
    const regex = new RegExp(`^${regexPattern.replace(/\//g, '\\/')}$`);
    if (regex.test(importPath)) {
      return true;
    }
  }
  return false;
}
