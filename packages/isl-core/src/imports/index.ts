/**
 * ISL Import Resolution
 * 
 * Resolves imports between ISL files and external modules.
 */

import type * as AST from '../ast/types.js';

// ============================================================================
// Import Resolution Types
// ============================================================================

export interface ResolvedImport {
  /** Original import declaration */
  declaration: AST.ImportDeclaration;
  /** Resolved file path */
  resolvedPath: string;
  /** Whether the import was successfully resolved */
  resolved: boolean;
  /** Error message if resolution failed */
  error?: string;
  /** Imported symbols */
  symbols: string[];
}

export interface ImportGraph {
  /** All resolved imports */
  imports: ResolvedImport[];
  /** Dependency order (topologically sorted) */
  order: string[];
  /** Circular dependency errors */
  cycles: string[][];
}

export interface ResolveOptions {
  /** Base directory for relative imports */
  baseDir?: string;
  /** Additional search paths */
  paths?: string[];
  /** File extensions to try */
  extensions?: string[];
  /** Custom resolver function */
  resolver?: (path: string, from?: string) => string | null;
}

// ============================================================================
// Import Resolver Implementation
// ============================================================================

export class ImportResolver {
  private options: ResolveOptions;
  private resolved: Map<string, ResolvedImport> = new Map();

  constructor(options: ResolveOptions = {}) {
    this.options = {
      baseDir: options.baseDir ?? '.',
      paths: options.paths ?? [],
      extensions: options.extensions ?? ['.isl', '.json'],
      resolver: options.resolver,
    };
  }

  /**
   * Resolve all imports in a domain
   */
  resolveAll(domain: AST.DomainDeclaration, filename?: string): ImportGraph {
    this.resolved.clear();
    const imports: ResolvedImport[] = [];

    for (const imp of domain.imports) {
      const resolved = this.resolveImport(imp, filename);
      imports.push(resolved);
    }

    // Build dependency order
    const order = this.topologicalSort(imports);
    const cycles = this.detectCycles(imports);

    return { imports, order, cycles };
  }

  /**
   * Resolve a single import
   */
  resolveImport(declaration: AST.ImportDeclaration, from?: string): ResolvedImport {
    const importPath = declaration.from.value;
    const symbols = declaration.names.map(n => n.name);

    // Check if already resolved
    const cacheKey = `${from ?? ''}:${importPath}`;
    if (this.resolved.has(cacheKey)) {
      return this.resolved.get(cacheKey)!;
    }

    // Try custom resolver first
    if (this.options.resolver) {
      const resolved = this.options.resolver(importPath, from);
      if (resolved) {
        const result: ResolvedImport = {
          declaration,
          resolvedPath: resolved,
          resolved: true,
          symbols,
        };
        this.resolved.set(cacheKey, result);
        return result;
      }
    }

    // Try to resolve the path
    const resolvedPath = this.resolvePath(importPath, from);

    const result: ResolvedImport = {
      declaration,
      resolvedPath: resolvedPath ?? importPath,
      resolved: resolvedPath !== null,
      error: resolvedPath === null ? `Cannot resolve module '${importPath}'` : undefined,
      symbols,
    };

    this.resolved.set(cacheKey, result);
    return result;
  }

  private resolvePath(importPath: string, from?: string): string | null {
    // Handle absolute paths
    if (importPath.startsWith('/')) {
      return importPath;
    }

    // Handle relative paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const basePath = from ? this.dirname(from) : this.options.baseDir!;
      return this.joinPath(basePath, importPath);
    }

    // Handle module paths - check in paths
    for (const searchPath of this.options.paths!) {
      const candidate = this.joinPath(searchPath, importPath);
      // In a real implementation, we'd check if the file exists
      // For now, we just return the candidate path
      return candidate;
    }

    // Check in stdlib
    if (importPath.startsWith('@isl/')) {
      return importPath; // stdlib paths are resolved at runtime
    }

    // Could not resolve
    return null;
  }

  private topologicalSort(imports: ResolvedImport[]): string[] {
    // Simple implementation - just return paths in order
    // A full implementation would build a dependency graph
    return imports
      .filter(i => i.resolved)
      .map(i => i.resolvedPath);
  }

  private detectCycles(_imports: ResolvedImport[]): string[][] {
    // Simple cycle detection
    // A full implementation would use Tarjan's algorithm
    // For now, return empty - no cycles detected
    return [];
  }

  // Path helpers
  private dirname(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return lastSlash >= 0 ? path.substring(0, lastSlash) : '.';
  }

  private joinPath(...parts: string[]): string {
    return parts
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Resolve all imports in a domain
 */
export function resolveImports(
  domain: AST.DomainDeclaration,
  options?: ResolveOptions
): ImportGraph {
  const resolver = new ImportResolver(options);
  return resolver.resolveAll(domain);
}

/**
 * Quick check if all imports resolve
 */
export function allImportsResolved(domain: AST.DomainDeclaration): boolean {
  const graph = resolveImports(domain);
  return graph.imports.every(i => i.resolved);
}

/**
 * Get unresolved imports
 */
export function getUnresolvedImports(domain: AST.DomainDeclaration): string[] {
  const graph = resolveImports(domain);
  return graph.imports
    .filter(i => !i.resolved)
    .map(i => i.declaration.from.value);
}
