// ============================================================================
// Import Statement Parser
// ============================================================================

import type { ParsedImport } from './types.js';

/**
 * Parse import statements from TypeScript/JavaScript source code
 */
export function parseImports(source: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const lines = source.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const trimmed = line.trim();

    // Match various import patterns
    const patterns = [
      // import { ... } from '...'
      /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/,
      // import ... from '...'
      /^import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/,
      // import '...'
      /^import\s+['"]([^'"]+)['"]/,
      // import * as ... from '...'
      /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
      // import ... = require('...')
      /^import\s+(\w+)\s*=\s*require\s*\(['"]([^'"]+)['"]\)/,
      // export { ... } from '...'
      /^export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/,
      // export * from '...'
      /^export\s+\*\s+from\s+['"]([^'"]+)['"]/,
      // export ... from '...'
      /^export\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const isTypeOnly = trimmed.includes('import type') || trimmed.includes('export type');
        const specifier = match[2] ?? match[1]!; // Use second group if available, otherwise first
        let symbols: string[] | undefined;

        // Extract symbols from named imports (braced list) or single default
        // Use trimmed line to detect braced form: content inside {} never contains '{'
        if (match[1] && trimmed.includes('{')) {
          const symbolStr = match[1].replace(/[{}]/g, '').trim();
          symbols = symbolStr
            .split(',')
            .map((s) => {
              const parts = s.trim().split(/\s+as\s+/);
              return parts[parts.length - 1]!.trim();
            })
            .filter(Boolean);
        } else if (match[1] && !match[1].startsWith("'") && !match[1].startsWith('"')) {
          // Single default import
          symbols = [match[1].trim()];
        }

        // Find column position
        const column = line.indexOf('import') !== -1 
          ? line.indexOf('import') + 1
          : line.indexOf('export') !== -1
          ? line.indexOf('export') + 1
          : 1;

        const parsedImport: ParsedImport = {
          specifier,
          isTypeOnly,
          file: filePath,
          line: lineIndex + 1,
          column,
          statement: trimmed,
        };
        if (symbols) {
          parsedImport.symbols = symbols;
        }
        imports.push(parsedImport);

        break; // Only match first pattern
      }
    }
  }

  return imports;
}

/**
 * Check if an import specifier is a relative/absolute path
 */
export function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
}

/**
 * Check if an import specifier is a Node.js built-in module
 */
export function isNodeBuiltin(specifier: string): boolean {
  const builtins = [
    'fs',
    'path',
    'http',
    'https',
    'url',
    'util',
    'stream',
    'events',
    'buffer',
    'crypto',
    'os',
    'child_process',
    'cluster',
    'dgram',
    'dns',
    'net',
    'readline',
    'repl',
    'tls',
    'tty',
    'vm',
    'zlib',
    'assert',
    'console',
    'process',
    'querystring',
    'string_decoder',
    'timers',
    'punycode',
    'module',
    'perf_hooks',
    'worker_threads',
  ];

  return builtins.includes(specifier);
}
