// ============================================================================
// ISL Import Resolver - Module Resolution and Cycle Detection
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse } from '@isl-lang/parser';
import type * as AST from '@isl-lang/parser';
import type {
  ResolverOptions,
  ResolvedModule,
  DependencyGraph,
  ImportSpec,
  ResolverError,
  DependencyCycle,
  SymbolTable,
  ExportedSymbol,
} from './types.js';
import {
  importsDisabledError,
  moduleNotFoundError,
  parseError,
  readError,
  circularDependencyError,
  maxDepthExceededError,
  invalidImportPathError,
} from './errors.js';
import {
  parseTSConfig,
  findTSConfig,
  hashTSConfig,
  resolvePathAlias,
  matchesPathAlias,
  type PathAliases,
} from './tsconfig.js';
import {
  resolvePackageExport,
  findPackageJson,
} from './package-exports.js';
import {
  ResolverCache,
  hashLockfile,
  getFileMtime,
  type CacheKey,
} from './cache.js';

/**
 * Default resolver options
 */
const DEFAULT_OPTIONS: Partial<ResolverOptions> = {
  maxDepth: 100,
  defaultExtension: '.isl',
  enableImports: true,
};

/**
 * Import Resolver class
 * 
 * Resolves local module imports (./foo.isl, ../bar.isl), detects cycles,
 * and builds a dependency graph for bundling.
 * 
 * Supports:
 * - TS path aliases (paths + baseUrl)
 * - Extension resolution order
 * - Index file resolution
 * - Package exports resolution
 * - Fast caching (tsconfig hash + lockfile hash + file mtime)
 */
export class ImportResolver {
  private options: Required<ResolverOptions>;
  private cache: Map<string, ResolvedModule> = new Map();
  private resolverCache: ResolverCache;
  private errors: ResolverError[] = [];
  private pathAliases: PathAliases | null = null;
  private tsconfigHash: string = '';
  private lockfileHash: string = '';
  private projectRoot: string;

  constructor(options: ResolverOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      readFile: options.readFile ?? this.defaultReadFile.bind(this),
      fileExists: options.fileExists ?? this.defaultFileExists.bind(this),
      extensions: options.extensions ?? [options.defaultExtension ?? '.isl'],
      projectRoot: options.projectRoot ?? options.basePath,
      enableCache: options.enableCache ?? true,
    } as Required<ResolverOptions>;

    this.projectRoot = this.options.projectRoot;
    this.resolverCache = new ResolverCache();
    
    // Initialize tsconfig and lockfile hashes
    this.initializeConfig().catch(() => {
      // Silently fail - will resolve without path aliases
    });
  }

  /**
   * Initialize tsconfig and lockfile hashes
   */
  private async initializeConfig(): Promise<void> {
    // Find and parse tsconfig
    const tsconfigPath = this.options.tsconfigPath
      ? this.options.tsconfigPath
      : await findTSConfig(this.projectRoot);

    if (tsconfigPath) {
      this.tsconfigHash = await hashTSConfig(tsconfigPath);
      this.pathAliases = await parseTSConfig(tsconfigPath, this.projectRoot);
    }

    // Hash lockfile
    this.lockfileHash = await hashLockfile(this.projectRoot);
  }

  /**
   * Default file reader using Node.js fs
   */
  private async defaultReadFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Default file existence checker using Node.js fs
   */
  private async defaultFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve all imports starting from an entry point file
   */
  async resolve(entryPoint: string): Promise<{
    success: boolean;
    graph?: DependencyGraph;
    errors: ResolverError[];
  }> {
    this.cache.clear();
    this.errors = [];

    const absoluteEntry = path.isAbsolute(entryPoint)
      ? entryPoint
      : path.resolve(this.options.basePath, entryPoint);

    // Check if entry file exists
    const exists = await this.options.fileExists(absoluteEntry);
    if (!exists) {
      this.errors.push(moduleNotFoundError(
        entryPoint,
        absoluteEntry,
        [absoluteEntry]
      ));
      return { success: false, errors: this.errors };
    }

    // Resolve the entry module and all its dependencies
    const visited = new Set<string>();
    const resolving = new Set<string>();
    
    const module = await this.resolveModule(
      absoluteEntry,
      [],
      visited,
      resolving
    );

    if (!module || this.errors.length > 0) {
      return { success: false, errors: this.errors };
    }

    // Build the dependency graph
    const graph = this.buildGraph(absoluteEntry);
    
    return {
      success: true,
      graph,
      errors: this.errors,
    };
  }

  /**
   * Normalize path for consistent cross-platform handling
   */
  private normalizePath(p: string): string {
    // Normalize and convert backslashes to forward slashes for consistent handling
    return path.normalize(p).replace(/\\/g, '/');
  }

  /**
   * Resolve a single module and its dependencies
   */
  private async resolveModule(
    absolutePath: string,
    importStack: string[],
    visited: Set<string>,
    resolving: Set<string>
  ): Promise<ResolvedModule | null> {
    // Normalize path
    const normalizedPath = this.normalizePath(absolutePath);

    // Check cache
    if (this.cache.has(normalizedPath)) {
      return this.cache.get(normalizedPath)!;
    }

    // Check for cycle
    if (resolving.has(normalizedPath)) {
      const cycleStart = importStack.indexOf(normalizedPath);
      const cyclePath = importStack.slice(cycleStart);
      const cycle: DependencyCycle = { path: cyclePath };
      this.errors.push(circularDependencyError(cycle));
      return null;
    }

    // Check depth
    if (importStack.length >= this.options.maxDepth) {
      this.errors.push(maxDepthExceededError(
        this.options.maxDepth,
        importStack
      ));
      return null;
    }

    // Mark as resolving
    resolving.add(normalizedPath);
    const newStack = [...importStack, normalizedPath];

    // Read and parse the file
    let source: string;
    try {
      source = await this.options.readFile(normalizedPath);
    } catch (err) {
      this.errors.push(readError(
        normalizedPath,
        err instanceof Error ? err.message : String(err)
      ));
      resolving.delete(normalizedPath);
      return null;
    }

    // Parse the source
    const parseResult = parse(source, normalizedPath);
    if (!parseResult.success || !parseResult.domain) {
      this.errors.push(parseError(
        normalizedPath,
        parseResult.errors.map(e => ({
          message: e.message,
          location: e.location,
        }))
      ));
      resolving.delete(normalizedPath);
      return null;
    }

    const ast = parseResult.domain;

    // Extract imports
    const importSpecs = this.extractImports(ast);
    
    // Check if imports are enabled (MVP mode toggle)
    if (importSpecs.length > 0 && !this.options.enableImports) {
      for (const importSpec of importSpecs) {
        this.errors.push(importsDisabledError(importSpec.from, importSpec.location));
      }
      resolving.delete(normalizedPath);
      return null;
    }

    // Resolve all import paths
    const dependencies: string[] = [];
    const baseDir = path.dirname(normalizedPath);

    for (const importSpec of importSpecs) {
      // Validate import path format
      if (!this.isValidImportPath(importSpec.from)) {
        this.errors.push(invalidImportPathError(
          importSpec.from,
          'Import path must be relative (./ or ../), a TS path alias, or a node module',
          importSpec.location
        ));
        continue;
      }

      const resolvedPath = await this.resolveImportPath(
        importSpec.from,
        baseDir,
        importSpec.location
      );
      
      if (!resolvedPath) {
        continue; // Error already added
      }

      dependencies.push(resolvedPath);

      // Recursively resolve the dependency
      await this.resolveModule(
        resolvedPath,
        newStack,
        visited,
        resolving
      );
    }

    // Create resolved module
    const module: ResolvedModule = {
      path: normalizedPath,
      ast,
      imports: importSpecs.map(i => i.from),
      dependencies,
    };

    // Cache and mark as visited
    this.cache.set(normalizedPath, module);
    visited.add(normalizedPath);
    resolving.delete(normalizedPath);

    return module;
  }

  /**
   * Extract import specifications from a Domain AST
   */
  private extractImports(ast: AST.Domain): ImportSpec[] {
    return ast.imports.map(imp => ({
      items: imp.items.map(item => ({
        name: item.name.name,
        alias: item.alias?.name,
        location: item.location,
      })),
      from: imp.from.value,
      location: imp.location,
    }));
  }

  /**
   * Resolve an import path to an absolute file path
   * Supports:
   * - Relative paths (./foo, ../bar)
   * - TS path aliases (@/components, @utils/*)
   * - Node modules (lodash, @types/node)
   * - Package exports (package.json exports field)
   */
  private async resolveImportPath(
    importPath: string,
    baseDir: string,
    location: AST.SourceLocation
  ): Promise<string | null> {
    const searchedPaths: string[] = [];

    // Check cache first
    if (this.options.enableCache) {
      const fileMtime = await getFileMtime(baseDir);
      const cacheKey: CacheKey = {
        tsconfigHash: this.tsconfigHash,
        lockfileHash: this.lockfileHash,
        fileMtime,
        importPath,
        baseDir,
      };
      const cached = this.resolverCache.get(cacheKey);
      if (cached) {
        return cached.path;
      }
    }

    // 1. Try relative path resolution
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const resolved = await this.resolveRelativePath(importPath, baseDir, searchedPaths);
      if (resolved) {
        return resolved;
      }
    }

    // 2. Try TS path aliases
    if (this.pathAliases && matchesPathAlias(importPath, this.pathAliases)) {
      const candidates = resolvePathAlias(importPath, this.pathAliases);
      for (const candidate of candidates) {
        searchedPaths.push(candidate);
        const resolved = await this.tryResolveFile(candidate, searchedPaths);
        if (resolved) {
          return resolved;
        }
      }
    }

    // 3. Try node_modules resolution
    const nodeModuleResolved = await this.resolveNodeModule(importPath, searchedPaths);
    if (nodeModuleResolved) {
      return nodeModuleResolved;
    }

    // Not found
    this.errors.push(moduleNotFoundError(
      importPath,
      importPath,
      searchedPaths,
      location
    ));
    return null;
  }

  /**
   * Resolve a relative path (./foo or ../bar)
   */
  private async resolveRelativePath(
    importPath: string,
    baseDir: string,
    searchedPaths: string[]
  ): Promise<string | null> {
    let resolvedPath = path.resolve(baseDir, importPath);
    resolvedPath = this.normalizePath(resolvedPath);

    return this.tryResolveFile(resolvedPath, searchedPaths);
  }

  /**
   * Try to resolve a file path with extensions and index files
   */
  private async tryResolveFile(
    filePath: string,
    searchedPaths: string[]
  ): Promise<string | null> {
    // If path already has an extension, try it directly
    const ext = path.extname(filePath);
    if (ext) {
      searchedPaths.push(filePath);
      if (await this.options.fileExists(filePath)) {
        return filePath;
      }
    }

    // Try each extension in order
    for (const extension of this.options.extensions) {
      const withExt = filePath + extension;
      searchedPaths.push(withExt);
      if (await this.options.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try index files in directory
    for (const extension of this.options.extensions) {
      const indexPath = path.join(filePath, 'index' + extension);
      searchedPaths.push(indexPath);
      if (await this.options.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Resolve a node module (package name)
   */
  private async resolveNodeModule(
    importPath: string,
    searchedPaths: string[]
  ): Promise<string | null> {
    // Find package.json
    const packageInfo = await findPackageJson(importPath, this.projectRoot);
    if (!packageInfo) {
      return null;
    }

    // Extract subpath
    const parts = importPath.split('/');
    let subpath = '.';
    if (importPath.startsWith('@')) {
      if (parts.length > 2) {
        subpath = './' + parts.slice(2).join('/');
      }
    } else {
      if (parts.length > 1) {
        subpath = './' + parts.slice(1).join('/');
      }
    }

    // Try package.json exports field
    const resolved = await resolvePackageExport(
      packageInfo.path,
      subpath,
      ['import', 'types', 'default']
    );

    if (resolved) {
      searchedPaths.push(resolved);
      if (await this.options.fileExists(resolved)) {
        return resolved;
      }
    }

    // Fallback: try main/types fields
    if (subpath === '.') {
      if (packageInfo.packageJson.types) {
        const typesPath = path.join(packageInfo.path, packageInfo.packageJson.types);
        searchedPaths.push(typesPath);
        if (await this.options.fileExists(typesPath)) {
          return typesPath;
        }
      }
      if (packageInfo.packageJson.main) {
        const mainPath = path.join(packageInfo.path, packageInfo.packageJson.main);
        searchedPaths.push(mainPath);
        if (await this.options.fileExists(mainPath)) {
          return mainPath;
        }
      }
    }

    return null;
  }

  /**
   * Check if an import path is valid
   */
  private isValidImportPath(importPath: string): boolean {
    // Relative path
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return true;
    }

    // Bare file path (e.g. "types.isl") must be relative
    const hasIslExtension = this.options.extensions.some(ext => importPath.endsWith(ext));
    if (hasIslExtension && !importPath.startsWith('./') && !importPath.startsWith('../')) {
      return false;
    }

    // TS path alias
    if (this.pathAliases && matchesPathAlias(importPath, this.pathAliases)) {
      return true;
    }

    // Node module (not starting with / or .)
    if (!importPath.startsWith('/') && !importPath.startsWith('.')) {
      return true;
    }

    return false;
  }

  /**
   * Build the dependency graph from resolved modules
   */
  private buildGraph(entryPoint: string): DependencyGraph {
    const modules = new Map(this.cache);
    
    // Normalize entry point path to match module keys
    const normalizedEntry = this.normalizePath(entryPoint);
    
    // Topological sort using Kahn's algorithm
    const sortedOrder = this.topologicalSort(normalizedEntry, modules);
    
    return {
      modules,
      entryPoint: normalizedEntry,
      sortedOrder,
    };
  }

  /**
   * Topological sort of modules (from leaves to root)
   * Dependencies (leaves) come before the modules that depend on them
   */
  private topologicalSort(
    _entryPoint: string,
    modules: Map<string, ResolvedModule>
  ): string[] {
    // Track out-degree (number of dependencies each module has)
    const outDegree = new Map<string, number>();
    // Track who depends on each module (reverse edges)
    const dependedBy = new Map<string, string[]>();

    // Initialize
    for (const [modulePath, module] of modules) {
      outDegree.set(modulePath, module.dependencies.length);
      if (!dependedBy.has(modulePath)) {
        dependedBy.set(modulePath, []);
      }
      
      // Build reverse edge map
      for (const dep of module.dependencies) {
        const dependers = dependedBy.get(dep) || [];
        dependers.push(modulePath);
        dependedBy.set(dep, dependers);
      }
    }

    // Find all leaf nodes (modules with no dependencies, outDegree = 0)
    const queue: string[] = [];
    for (const [modulePath, degree] of outDegree) {
      if (degree === 0) {
        queue.push(modulePath);
      }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      // For each module that depends on current, decrease its out-degree
      const dependers = dependedBy.get(current) || [];
      for (const depender of dependers) {
        const newDegree = (outDegree.get(depender) || 1) - 1;
        outDegree.set(depender, newDegree);
        if (newDegree === 0) {
          queue.push(depender);
        }
      }
    }

    return sorted;
  }

  /**
   * Build a symbol table for a module
   */
  buildSymbolTable(module: ResolvedModule): SymbolTable {
    const symbols = new Map<string, ExportedSymbol>();
    const ast = module.ast;

    // Add types
    for (const type of ast.types) {
      symbols.set(type.name.name, {
        kind: 'type',
        name: type.name.name,
        node: type,
        sourcePath: module.path,
      });
    }

    // Add entities
    for (const entity of ast.entities) {
      symbols.set(entity.name.name, {
        kind: 'entity',
        name: entity.name.name,
        node: entity,
        sourcePath: module.path,
      });
    }

    // Add behaviors
    for (const behavior of ast.behaviors) {
      symbols.set(behavior.name.name, {
        kind: 'behavior',
        name: behavior.name.name,
        node: behavior,
        sourcePath: module.path,
      });
    }

    // Add invariants
    for (const invariant of ast.invariants) {
      symbols.set(invariant.name.name, {
        kind: 'invariant',
        name: invariant.name.name,
        node: invariant,
        sourcePath: module.path,
      });
    }

    // Add policies
    for (const policy of ast.policies) {
      symbols.set(policy.name.name, {
        kind: 'policy',
        name: policy.name.name,
        node: policy,
        sourcePath: module.path,
      });
    }

    // Add views
    for (const view of ast.views) {
      symbols.set(view.name.name, {
        kind: 'view',
        name: view.name.name,
        node: view,
        sourcePath: module.path,
      });
    }

    return {
      symbols,
      path: module.path,
    };
  }

  /**
   * Get cached module
   */
  getModule(absolutePath: string): ResolvedModule | undefined {
    return this.cache.get(this.normalizePath(absolutePath));
  }

  /**
   * Get all resolved modules
   */
  getAllModules(): Map<string, ResolvedModule> {
    return new Map(this.cache);
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.cache.clear();
    this.errors = [];
  }
}

/**
 * Convenience function to resolve imports
 */
export async function resolveImports(
  entryPoint: string,
  options: Partial<ResolverOptions> = {}
): Promise<{
  success: boolean;
  graph?: DependencyGraph;
  errors: ResolverError[];
}> {
  const resolver = new ImportResolver({
    basePath: options.basePath ?? path.dirname(entryPoint),
    enableImports: options.enableImports ?? true,
    ...options,
  });
  
  return resolver.resolve(entryPoint);
}
