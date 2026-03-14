/**
 * Dependency graph builder for incremental verification.
 *
 * Parses import/require statements from TypeScript/JavaScript files to build
 * a bidirectional dependency graph, then computes the transitive closure of
 * affected files from a set of changed files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface DependencyGraph {
  /** file → files it imports */
  nodes: Map<string, string[]>;
  /** file → files that import it (reverse edges) */
  dependents: Map<string, string[]>;
}

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Build a bidirectional dependency graph from a list of source files.
 * All paths stored in the graph are relative to `projectRoot`.
 */
export async function buildDependencyGraph(
  files: string[],
  projectRoot: string,
): Promise<DependencyGraph> {
  const nodes = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const file of files) {
    const absPath = path.resolve(projectRoot, file);
    const imports = await extractImports(absPath, projectRoot);

    nodes.set(file, imports);

    for (const imp of imports) {
      const existing = dependents.get(imp) ?? [];
      if (!existing.includes(file)) {
        existing.push(file);
      }
      dependents.set(imp, existing);
    }
  }

  return { nodes, dependents };
}

/**
 * Starting from a set of changed files, walk the dependents graph transitively
 * to find every file that could be affected.
 */
export function getAffectedFiles(
  changedFiles: string[],
  graph: DependencyGraph,
): string[] {
  const affected = new Set<string>(changedFiles);
  const queue = [...changedFiles];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const deps = graph.dependents.get(current) ?? [];

    for (const dep of deps) {
      if (!affected.has(dep)) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }

  return [...affected];
}

/**
 * Extract resolved import paths from a TypeScript/JavaScript file.
 * Returns paths relative to projectRoot.
 */
async function extractImports(
  filePath: string,
  projectRoot: string,
): Promise<string[]> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const rawSpecifiers = parseImportSpecifiers(content);
  const dir = path.dirname(filePath);
  const resolved: string[] = [];

  for (const specifier of rawSpecifiers) {
    if (!isRelativeSpecifier(specifier)) continue;

    const absResolved = await resolveSpecifier(specifier, dir);
    if (absResolved) {
      resolved.push(path.relative(projectRoot, absResolved));
    }
  }

  return resolved;
}

/**
 * Regex-based import parser that handles:
 *  - import ... from 'specifier'
 *  - import('specifier')
 *  - require('specifier')
 *  - export ... from 'specifier'
 *
 * Intentionally avoids a full TS parser to keep this dependency-free and fast.
 */
function parseImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  // Static imports/exports: import/export ... from 'specifier'
  const staticRe = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(source)) !== null) {
    if (match[1]) specifiers.push(match[1]);
  }

  // Side-effect imports: import 'specifier'
  const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectRe.exec(source)) !== null) {
    if (match[1] && !specifiers.includes(match[1])) specifiers.push(match[1]);
  }

  // Dynamic imports: import('specifier')
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRe.exec(source)) !== null) {
    if (match[1] && !specifiers.includes(match[1])) specifiers.push(match[1]);
  }

  // require('specifier')
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRe.exec(source)) !== null) {
    if (match[1] && !specifiers.includes(match[1])) specifiers.push(match[1]);
  }

  return specifiers;
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

/**
 * Resolve a relative import specifier to an absolute file path,
 * trying common TypeScript extension conventions.
 */
async function resolveSpecifier(
  specifier: string,
  fromDir: string,
): Promise<string | null> {
  // Handle .js → .ts mapping (ESM imports often use .js for .ts files)
  const basePath = path.resolve(fromDir, specifier);
  const stripped = stripJsExtension(basePath);

  const candidates = [
    basePath,
    ...TS_EXTENSIONS.map((ext) => stripped + ext),
    ...TS_EXTENSIONS.map((ext) => path.join(basePath, 'index' + ext)),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

function stripJsExtension(p: string): string {
  if (p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs') || p.endsWith('.cjs')) {
    return p.slice(0, p.lastIndexOf('.'));
  }
  return p;
}
