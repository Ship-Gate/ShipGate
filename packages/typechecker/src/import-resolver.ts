// ============================================================================
// Import Graph Resolution for TypeChecker
// ============================================================================

import path from 'node:path';
import type { SourceLocation, Symbol } from './types';
import type { Diagnostic } from './errors';
import { SymbolTableBuilder } from './symbols';
import { createError } from './errors';

/**
 * Import graph node representing a module
 */
export interface ImportGraphNode {
  path: string;
  ast: unknown; // Domain AST
  imports: string[]; // Import paths
  importedBy: Set<string>; // Modules that import this one
  symbolTable?: SymbolTableBuilder;
}

/**
 * Import graph with cycle detection
 */
export interface ImportGraph {
  nodes: Map<string, ImportGraphNode>;
  cycles: string[][];
}

/**
 * Options for import resolution
 */
export interface ImportResolverOptions {
  basePath: string;
  readFile?: (path: string) => Promise<string>;
  fileExists?: (path: string) => Promise<boolean>;
  parseFile?: (content: string, path: string) => Promise<{ success: boolean; domain?: unknown; errors?: unknown[] }>;
  enableCache?: boolean;
}

/**
 * Content hash for caching
 */
function hashContent(content: string): string {
  // Simple hash function for caching
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Resolve relative import path
 */
function resolveRelativePath(from: string, importPath: string): string {
  const fromDir = path.dirname(from);
  
  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return path.resolve(fromDir, importPath);
  }
  
  // Absolute path
  if (path.isAbsolute(importPath)) {
    return importPath;
  }
  
  // Default: resolve relative to fromDir
  return path.resolve(fromDir, importPath);
}

/**
 * Build import graph with cycle detection
 */
export class ImportGraphResolver {
  private options: Required<ImportResolverOptions>;
  private cache: Map<string, { hash: string; node: ImportGraphNode }> = new Map();
  private diagnostics: Diagnostic[] = [];

  constructor(options: ImportResolverOptions) {
    this.options = {
      readFile: options.readFile ?? this.defaultReadFile.bind(this),
      fileExists: options.fileExists ?? this.defaultFileExists.bind(this),
      parseFile: options.parseFile ?? this.defaultParseFile.bind(this),
      enableCache: options.enableCache ?? true,
      basePath: options.basePath,
    };
  }

  private async defaultReadFile(path: string): Promise<string> {
    const fs = await import('node:fs/promises');
    return fs.readFile(path, 'utf-8');
  }

  private async defaultFileExists(path: string): Promise<boolean> {
    try {
      const fs = await import('node:fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async defaultParseFile(content: string, path: string): Promise<{ success: boolean; domain?: unknown; errors?: unknown[] }> {
    // Default: try to use @isl-lang/parser
    try {
      const { parse } = await import('@isl-lang/parser');
      const result = parse(content, path);
      return {
        success: result.success,
        domain: result.domain,
        errors: result.errors,
      };
    } catch {
      return { success: false, errors: [{ message: 'Parser not available' }] };
    }
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Resolve import graph starting from entry point
   */
  async resolveGraph(entryPath: string): Promise<ImportGraph> {
    this.diagnostics = [];
    const nodes = new Map<string, ImportGraphNode>();
    const cycles: string[][] = [];
    const resolving = new Set<string>();
    const visited = new Set<string>();

    await this.resolveModule(entryPath, [], nodes, resolving, visited, cycles);

    return { nodes, cycles };
  }

  /**
   * Resolve a single module and its dependencies
   */
  private async resolveModule(
    path: string,
    importStack: string[],
    nodes: Map<string, ImportGraphNode>,
    resolving: Set<string>,
    visited: Set<string>,
    cycles: string[][]
  ): Promise<ImportGraphNode | null> {
    const normalizedPath = this.normalizePath(path);

    // Check cache
    if (this.options.enableCache && this.cache.has(normalizedPath)) {
      const cached = this.cache.get(normalizedPath)!;
      const node = { ...cached.node };
      nodes.set(normalizedPath, node);
      return node;
    }

    // Check for cycle
    if (resolving.has(normalizedPath)) {
      const cycleStart = importStack.indexOf(normalizedPath);
      const cycle = cycleStart >= 0
        ? [...importStack.slice(cycleStart), normalizedPath]
        : [...importStack, normalizedPath];
      cycles.push(cycle);
      
      this.diagnostics.push(createError(
        'ISL_T001',
        `Circular import detected: ${cycle.join(' -> ')}`,
        this.getLocationForPath(normalizedPath),
        undefined,
        ['Circular imports create infinite dependency chains'],
        ['Break the cycle by extracting shared types to a common module']
      ));
      return null;
    }

    // Check if file exists
    const exists = await this.options.fileExists(normalizedPath);
    if (!exists) {
      this.diagnostics.push(createError(
        'ISL_T002',
        `Module not found: ${normalizedPath}`,
        this.getLocationForPath(normalizedPath),
        undefined,
        [`Import path: ${importStack.length > 0 ? importStack[importStack.length - 1] : 'entry'}`],
        ['Check the import path and ensure the file exists']
      ));
      return null;
    }

    // Mark as resolving
    resolving.add(normalizedPath);
    const newStack = [...importStack, normalizedPath];

    // Read and parse file
    let content: string;
    try {
      content = await this.options.readFile(normalizedPath);
    } catch (err) {
      resolving.delete(normalizedPath);
      this.diagnostics.push(createError(
        'ISL_T003',
        `Failed to read file: ${normalizedPath}`,
        this.getLocationForPath(normalizedPath),
        undefined,
        [err instanceof Error ? err.message : String(err)],
        ['Check file permissions and ensure the file is readable']
      ));
      return null;
    }

    // Parse file
    const parseResult = await this.options.parseFile(content, normalizedPath);
    if (!parseResult.success || !parseResult.domain) {
      resolving.delete(normalizedPath);
      this.diagnostics.push(createError(
        'ISL_T004',
        `Parse error in ${normalizedPath}`,
        this.getLocationForPath(normalizedPath),
        undefined,
        parseResult.errors?.map(e => (e as { message: string }).message) || ['Unknown parse error'],
        ['Fix syntax errors in the file']
      ));
      return null;
    }

    const domain = parseResult.domain as { imports?: Array<{ from: { value: string }; location: SourceLocation }> };

    // Extract imports
    const imports: string[] = [];
    if (domain.imports) {
      for (const imp of domain.imports) {
        const importPath = resolveRelativePath(normalizedPath, imp.from.value);
        imports.push(importPath);
      }
    }

    // Create node
    const node: ImportGraphNode = {
      path: normalizedPath,
      ast: domain,
      imports,
      importedBy: new Set(),
    };

    // Resolve dependencies
    for (const importPath of imports) {
      const dep = await this.resolveModule(importPath, newStack, nodes, resolving, visited, cycles);
      if (dep) {
        dep.importedBy.add(normalizedPath);
      }
    }

    // Mark as visited
    visited.add(normalizedPath);
    resolving.delete(normalizedPath);
    nodes.set(normalizedPath, node);

    // Cache with content hash
    if (this.options.enableCache) {
      const hash = hashContent(content);
      this.cache.set(normalizedPath, { hash, node });
    }

    return node;
  }

  /**
   * Normalize path for consistent handling
   */
  private normalizePath(p: string): string {
    return path.normalize(p).replace(/\\/g, '/');
  }

  /**
   * Get a location for a path (used for errors)
   */
  private getLocationForPath(path: string): SourceLocation {
    return {
      file: path,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
