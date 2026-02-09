// ============================================================================
// Code Symbol Scanner
// ============================================================================

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { CodeSymbol } from './types.js';

/**
 * Scan codebase for symbols (functions, routes, exports, etc.)
 */
export async function scanCodebase(
  rootDir: string,
  codeDirs: string[] = [],
  includePatterns: string[] = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  excludePatterns: string[] = ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.js']
): Promise<CodeSymbol[]> {
  const symbols: CodeSymbol[] = [];
  const dirsToScan = codeDirs.length > 0 ? codeDirs : [rootDir];

  for (const dir of dirsToScan) {
    await scanDirectory(dir, rootDir, includePatterns, excludePatterns, symbols);
  }

  return symbols;
}

/**
 * Recursively scan a directory
 */
async function scanDirectory(
  dir: string,
  rootDir: string,
  includePatterns: string[],
  excludePatterns: string[],
  symbols: CodeSymbol[]
): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath);

      // Check exclude patterns
      if (excludePatterns.some(pattern => matchesPattern(relPath, pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, rootDir, includePatterns, excludePatterns, symbols);
      } else if (entry.isFile()) {
        // Check include patterns
        if (includePatterns.some(pattern => matchesPattern(relPath, pattern))) {
          const fileSymbols = await scanFile(fullPath, rootDir);
          symbols.push(...fileSymbols);
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
}

/**
 * Check if a path matches a glob pattern (simple implementation)
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob to regex (simplified)
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Scan a single file for symbols
 */
async function scanFile(filePath: string, rootDir: string): Promise<CodeSymbol[]> {
  const symbols: CodeSymbol[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');
    const relPath = relative(rootDir, filePath);
    const lines = content.split('\n');

    // Scan for Fastify routes
    symbols.push(...scanFastifyRoutes(content, relPath, lines));

    // Scan for function exports
    symbols.push(...scanFunctionExports(content, relPath, lines));

    // Scan for class exports
    symbols.push(...scanClassExports(content, relPath, lines));
  } catch (error) {
    // Skip files that can't be read
  }

  return symbols;
}

/**
 * Scan for Fastify route handlers
 */
function scanFastifyRoutes(content: string, filePath: string, lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  // Pattern: app.get('/path', handler) or fastify.post('/path', handler)
  const routePattern = /(?:app|fastify|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(content)) !== null) {
    const method = match[1]!.toUpperCase();
    const path = match[2]!;
    const line = getLineNumber(content, match.index);

    // Try to extract handler name
    const handlerName = extractHandlerName(content, match.index);

    symbols.push({
      type: 'route',
      name: handlerName || `${method} ${path}`,
      file: filePath,
      location: {
        start: { line, column: 1 },
        end: { line, column: 1 },
      },
      metadata: {
        method,
        path,
        handlerName,
      },
    });
  }

  // Pattern: app.route({ method: 'GET', url: '/path', handler })
  const routeConfigPattern = /\.route\s*\(\s*\{([^}]+)\}/gs;
  while ((match = routeConfigPattern.exec(content)) !== null) {
    const configStr = match[1]!;
    const methodMatch = configStr.match(/method\s*:\s*['"`](\w+)['"`]/i);
    const urlMatch = configStr.match(/url\s*:\s*['"`]([^'"`]+)['"`]/i);

    if (methodMatch && urlMatch) {
      const line = getLineNumber(content, match.index);
      const method = methodMatch[1]!.toUpperCase();
      const path = urlMatch[1]!;
      const handlerName = extractHandlerName(content, match.index);

      symbols.push({
        type: 'route',
        name: handlerName || `${method} ${path}`,
        file: filePath,
        location: {
          start: { line, column: 1 },
          end: { line, column: 1 },
        },
        metadata: {
          method,
          path,
          handlerName,
        },
      });
    }
  }

  return symbols;
}

/**
 * Scan for exported functions
 */
function scanFunctionExports(content: string, filePath: string, lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  // Pattern: export function functionName
  const exportFunctionPattern = /export\s+(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match: RegExpExecArray | null;

  while ((match = exportFunctionPattern.exec(content)) !== null) {
    const name = match[1]!;
    const line = getLineNumber(content, match.index);

    symbols.push({
      type: 'function',
      name,
      file: filePath,
      location: {
        start: { line, column: 1 },
        end: { line, column: 1 },
      },
    });
  }

  // Pattern: export const functionName = function/arrow
  const exportConstFunctionPattern = /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g;
  while ((match = exportConstFunctionPattern.exec(content)) !== null) {
    const name = match[1]!;
    const line = getLineNumber(content, match.index);

    symbols.push({
      type: 'function',
      name,
      file: filePath,
      location: {
        start: { line, column: 1 },
        end: { line, column: 1 },
      },
    });
  }

  return symbols;
}

/**
 * Scan for exported classes
 */
function scanClassExports(content: string, filePath: string, lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  // Pattern: export class ClassName
  const exportClassPattern = /export\s+class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match: RegExpExecArray | null;

  while ((match = exportClassPattern.exec(content)) !== null) {
    const name = match[1]!;
    const line = getLineNumber(content, match.index);

    symbols.push({
      type: 'class',
      name,
      file: filePath,
      location: {
        start: { line, column: 1 },
        end: { line, column: 1 },
      },
    });
  }

  return symbols;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract handler name from route registration
 */
function extractHandlerName(content: string, routeIndex: number): string | null {
  // Look for handler function name after the route path
  const afterRoute = content.substring(routeIndex);
  const handlerMatch = afterRoute.match(/,\s*(?:async\s+)?(?:function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/);
  if (handlerMatch) {
    return handlerMatch[1]!;
  }

  // Look for arrow function
  const arrowMatch = afterRoute.match(/,\s*\([^)]*\)\s*=>\s*\{/);
  if (arrowMatch) {
    // Try to find a variable name before this
    const beforeArrow = content.substring(0, routeIndex);
    const varMatch = beforeArrow.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^=]*$/);
    if (varMatch) {
      return varMatch[1]!;
    }
  }

  return null;
}
