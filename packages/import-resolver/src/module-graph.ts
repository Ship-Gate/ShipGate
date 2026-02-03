// ============================================================================
// ISL Module Graph Builder
// ============================================================================

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { parse } from '@isl-lang/parser';
import type * as AST from '@isl-lang/parser';
import {
  StdlibRegistryManager,
  getStdlibRegistry,
  type ResolvedStdlibModule,
} from './stdlib-registry.js';
import type {
  ResolverOptions,
  ResolvedModule,
  DependencyGraph,
  ImportSpec,
  ImportItemSpec,
  ResolverError,
  DependencyCycle,
} from './types.js';
import {
  moduleNotFoundError,
  parseError,
  readError,
  circularDependencyError,
  maxDepthExceededError,
  invalidImportPathError,
  symbolNotFoundError,
} from './errors.js';

// ============================================================================
// Use Statement Types
// ============================================================================

/**
 * Parsed use statement from AST
 */
export interface UseStatementSpec {
  /** Module name or path */
  module: string;
  /** Optional alias for the module */
  alias?: string;
  /** Optional version constraint */
  version?: string;
  /** Source location for error reporting */
  location: AST.SourceLocation;
  /** Whether this is a stdlib module */
  isStdlib: boolean;
}

// ============================================================================
// Extended Types for Module Graph
// ============================================================================

/**
 * Import with alias information
 */
export interface AliasedImport {
  /** Original name in source module */
  name: string;
  /** Alias in current module (if different) */
  alias: string;
  /** Source module path */
  from: string;
  /** Whether this is a stdlib import */
  isStdlib: boolean;
}

/**
 * Extended resolved module with alias tracking
 */
export interface GraphModule extends ResolvedModule {
  /** Imported symbols with aliases */
  importedSymbols: AliasedImport[];
  /** Use statements (whole module imports) */
  useStatements: UseStatementSpec[];
  /** Whether this is a stdlib module */
  isStdlib: boolean;
  /** Source content (for debugging) */
  source?: string;
  /** Import chain that led to this module (for error reporting) */
  importChain: string[];
}

/**
 * Module graph with merged AST capability
 */
export interface ModuleGraph extends DependencyGraph {
  /** Extended modules with alias info */
  graphModules: Map<string, GraphModule>;
  /** Merged AST (all imports resolved and merged) */
  mergedAST?: AST.Domain;
  /** Cycles detected in the graph */
  cycles: DependencyCycle[];
  /** Resolution errors */
  errors: ResolverError[];
  /** Debug information */
  debug?: ModuleGraphDebug;
}

/**
 * Debug information for the module graph
 */
export interface ModuleGraphDebug {
  /** Resolution trace showing order of module loading */
  resolutionTrace: string[];
  /** Import chains for each module */
  importChains: Map<string, string[]>;
  /** Time taken to resolve each module */
  timings: Map<string, number>;
}

/**
 * AST cache entry for performance
 */
export interface ASTCacheEntry {
  /** Parsed AST */
  ast: AST.Domain;
  /** Source content hash for cache invalidation */
  contentHash: string;
  /** Timestamp when cached */
  cachedAt: number;
}

/**
 * AST cache for performance optimization
 */
export interface ASTCache {
  /** Get cached AST for a file path */
  get(filePath: string, contentHash: string): ASTCacheEntry | undefined;
  /** Cache an AST for a file path */
  set(filePath: string, entry: ASTCacheEntry): void;
  /** Clear the cache */
  clear(): void;
  /** Get cache statistics */
  stats(): { hits: number; misses: number; size: number };
}

/**
 * Options for module graph building
 */
export interface ModuleGraphOptions extends Partial<ResolverOptions> {
  /** Include debug information */
  debug?: boolean;
  /** Stdlib registry manager (uses default if not provided) */
  stdlibRegistry?: StdlibRegistryManager;
  /** Whether to merge ASTs into a single domain */
  mergeAST?: boolean;
  /** Include source code in modules (for debugging) */
  includeSource?: boolean;
  /** AST cache for performance (optional) */
  astCache?: ASTCache;
  /** Enable caching (creates in-memory cache if no astCache provided) */
  enableCaching?: boolean;
}

// ============================================================================
// Module Graph Builder
// ============================================================================

/**
 * Simple in-memory AST cache implementation
 */
class InMemoryASTCache implements ASTCache {
  private cache = new Map<string, ASTCacheEntry>();
  private hits = 0;
  private misses = 0;

  get(filePath: string, contentHash: string): ASTCacheEntry | undefined {
    const entry = this.cache.get(filePath);
    if (entry && entry.contentHash === contentHash) {
      this.hits++;
      return entry;
    }
    this.misses++;
    return undefined;
  }

  set(filePath: string, entry: ASTCacheEntry): void {
    this.cache.set(filePath, entry);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }
}

/**
 * Simple hash function for cache invalidation
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Builds a complete module graph from an entry point,
 * resolving all imports including stdlib modules.
 */
export class ModuleGraphBuilder {
  private options: Required<ModuleGraphOptions> & { astCache?: ASTCache; enableCaching: boolean };
  private stdlibRegistry: StdlibRegistryManager;
  private moduleCache: Map<string, GraphModule> = new Map();
  private astCache: ASTCache | undefined;
  private errors: ResolverError[] = [];
  private cycles: DependencyCycle[] = [];
  private debugInfo: ModuleGraphDebug = {
    resolutionTrace: [],
    importChains: new Map(),
    timings: new Map(),
  };

  constructor(options: ModuleGraphOptions = {}) {
    this.stdlibRegistry = options.stdlibRegistry ?? getStdlibRegistry();
    
    // Set up AST caching
    const enableCaching = options.enableCaching ?? true;
    this.astCache = options.astCache ?? (enableCaching ? new InMemoryASTCache() : undefined);
    
    this.options = {
      basePath: options.basePath ?? process.cwd(),
      enableImports: options.enableImports ?? true,
      maxDepth: options.maxDepth ?? 100,
      defaultExtension: options.defaultExtension ?? '.isl',
      debug: options.debug ?? false,
      mergeAST: options.mergeAST ?? true,
      includeSource: options.includeSource ?? false,
      readFile: options.readFile ?? this.defaultReadFile.bind(this),
      fileExists: options.fileExists ?? this.defaultFileExists.bind(this),
      stdlibRegistry: this.stdlibRegistry,
      astCache: this.astCache,
      enableCaching,
    };
  }

  private async defaultReadFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  private async defaultFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the module graph starting from an entry point
   */
  async build(entryPoint: string): Promise<ModuleGraph> {
    this.moduleCache.clear();
    this.errors = [];
    this.cycles = [];
    this.debugInfo = {
      resolutionTrace: [],
      importChains: new Map(),
      timings: new Map(),
    };

    const startTime = Date.now();
    const absoluteEntry = path.isAbsolute(entryPoint)
      ? entryPoint
      : path.resolve(this.options.basePath, entryPoint);

    // Check if entry file exists
    const exists = await this.options.fileExists(absoluteEntry);
    if (!exists) {
      this.errors.push(moduleNotFoundError(entryPoint, absoluteEntry, [absoluteEntry]));
      return this.buildEmptyGraph(absoluteEntry);
    }

    // Resolve the entry module and all its dependencies
    const visited = new Set<string>();
    const resolving = new Set<string>();

    await this.resolveModule(absoluteEntry, [], visited, resolving);

    // Build the graph
    const normalizedEntry = this.normalizePath(absoluteEntry);
    const sortedOrder = this.topologicalSort(normalizedEntry);

    // Merge ASTs if requested
    let mergedAST: AST.Domain | undefined;
    if (this.options.mergeAST && this.errors.length === 0) {
      mergedAST = this.mergeASTs(sortedOrder);
    }

    const graph: ModuleGraph = {
      modules: new Map(this.moduleCache),
      graphModules: new Map(this.moduleCache),
      entryPoint: normalizedEntry,
      sortedOrder,
      mergedAST,
      cycles: this.cycles,
      errors: this.errors,
    };

    if (this.options.debug) {
      graph.debug = {
        ...this.debugInfo,
        timings: new Map([
          ...this.debugInfo.timings,
          ['total', Date.now() - startTime],
        ]),
      };
      
      // Add AST cache stats if available
      if (this.astCache) {
        const cacheStats = this.astCache.stats();
        this.debugInfo.timings.set('ast_cache_hits', cacheStats.hits);
        this.debugInfo.timings.set('ast_cache_misses', cacheStats.misses);
      }
    }

    return graph;
  }

  /**
   * Resolve a single module and its dependencies
   */
  private async resolveModule(
    absolutePath: string,
    importStack: string[],
    visited: Set<string>,
    resolving: Set<string>
  ): Promise<GraphModule | null> {
    const startTime = Date.now();
    const normalizedPath = this.normalizePath(absolutePath);

    if (this.options.debug) {
      this.debugInfo.resolutionTrace.push(normalizedPath);
    }

    // Check module cache
    if (this.moduleCache.has(normalizedPath)) {
      return this.moduleCache.get(normalizedPath)!;
    }

    // Check for circular dependency - include full chain in error
    if (resolving.has(normalizedPath)) {
      const cycleStart = importStack.indexOf(normalizedPath);
      const cyclePath = cycleStart >= 0 
        ? [...importStack.slice(cycleStart), normalizedPath]
        : [...importStack, normalizedPath];
      const cycle: DependencyCycle = { path: cyclePath };
      this.cycles.push(cycle);
      this.errors.push(this.createCircularDependencyError(cycle, importStack));
      return null;
    }

    // Check max depth
    if (importStack.length >= this.options.maxDepth) {
      this.errors.push(maxDepthExceededError(this.options.maxDepth, importStack));
      return null;
    }

    // Mark as resolving
    resolving.add(normalizedPath);
    const newStack = [...importStack, normalizedPath];

    if (this.options.debug) {
      this.debugInfo.importChains.set(normalizedPath, newStack);
    }

    // Read the file
    let source: string;
    try {
      source = await this.options.readFile(normalizedPath);
    } catch (err) {
      this.errors.push(readError(normalizedPath, err instanceof Error ? err.message : String(err)));
      resolving.delete(normalizedPath);
      return null;
    }

    // Try AST cache first
    const contentHash = simpleHash(source);
    let ast: AST.Domain;
    
    const cachedAST = this.astCache?.get(normalizedPath, contentHash);
    if (cachedAST) {
      ast = cachedAST.ast;
    } else {
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
      ast = parseResult.domain;
      
      // Cache the parsed AST
      this.astCache?.set(normalizedPath, {
        ast,
        contentHash,
        cachedAt: Date.now(),
      });
    }

    // Extract and process imports (from import statements)
    const { importSpecs, importedSymbols } = this.extractImports(ast, normalizedPath);
    
    // Extract and process use statements
    const useStatements = this.extractUseStatements(ast, normalizedPath);
    
    const dependencies: string[] = [];
    const baseDir = path.dirname(normalizedPath);

    // Process import statements
    for (const importSpec of importSpecs) {
      const resolvedPath = await this.resolveImportPath(
        importSpec.from,
        baseDir,
        importSpec.location
      );

      if (!resolvedPath) {
        continue; // Error already added
      }

      dependencies.push(resolvedPath);

      // Recursively resolve non-stdlib dependencies
      if (!this.isStdlibPath(importSpec.from)) {
        await this.resolveModule(resolvedPath, newStack, visited, resolving);
      }
    }

    // Process use statements
    for (const useStmt of useStatements) {
      const resolvedPath = await this.resolveUseStatementPath(
        useStmt,
        baseDir
      );

      if (!resolvedPath) {
        continue; // Error already added
      }

      if (!dependencies.includes(resolvedPath)) {
        dependencies.push(resolvedPath);
      }

      // Recursively resolve non-stdlib dependencies
      if (!useStmt.isStdlib) {
        await this.resolveModule(resolvedPath, newStack, visited, resolving);
      }
    }

    // Create the graph module
    const module: GraphModule = {
      path: normalizedPath,
      ast,
      imports: importSpecs.map(i => i.from),
      dependencies,
      importedSymbols,
      useStatements,
      isStdlib: false,
      source: this.options.includeSource ? source : undefined,
      importChain: newStack,
    };

    // Cache and mark as visited
    this.moduleCache.set(normalizedPath, module);
    visited.add(normalizedPath);
    resolving.delete(normalizedPath);

    if (this.options.debug) {
      this.debugInfo.timings.set(normalizedPath, Date.now() - startTime);
    }

    return module;
  }

  /**
   * Create a detailed circular dependency error with full import chain
   */
  private createCircularDependencyError(cycle: DependencyCycle, importStack: string[]): ResolverError {
    const cyclePath = cycle.path;
    const cycleDisplay = cyclePath.map((p, i) => {
      const shortPath = path.basename(p);
      const prefix = i === 0 ? '┌─► ' : i === cyclePath.length - 1 ? '└─► ' : '│   ';
      return prefix + shortPath;
    }).join('\n');

    const fullChain = importStack.map((p, i) => {
      const shortPath = path.basename(p);
      return `  ${i + 1}. ${shortPath}`;
    }).join('\n');

    return {
      code: 'CIRCULAR_DEPENDENCY' as any,
      message: `Circular dependency detected:\n\n${cycleDisplay}\n\nFull import chain:\n${fullChain}\n\n` +
        `Circular imports are not allowed. Consider:\n` +
        `  • Extracting shared types into a common module\n` +
        `  • Restructuring the dependency hierarchy\n` +
        `  • Using dependency injection for runtime dependencies`,
      details: { 
        cycle: cycle.path, 
        fullChain: importStack,
        shortCycle: cycle.path.map(p => path.basename(p)),
      },
    };
  }

  /**
   * Extract use statements from AST
   */
  private extractUseStatements(ast: AST.Domain, fromPath: string): UseStatementSpec[] {
    const useStatements: UseStatementSpec[] = [];
    
    // Access uses array from AST (DomainDeclaration has 'uses' field)
    const uses = (ast as any).uses ?? [];
    
    for (const use of uses) {
      // Get module name - can be Identifier or StringLiteral
      const moduleName = use.module?.kind === 'StringLiteral' 
        ? use.module.value 
        : use.module?.name;
      
      if (!moduleName) continue;
      
      const isStdlib = this.isStdlibPath(moduleName);
      
      useStatements.push({
        module: moduleName,
        alias: use.alias?.name,
        version: use.version?.value,
        location: use.span ? this.spanToLocation(use.span, fromPath) : this.defaultLocation(fromPath),
        isStdlib,
      });
    }
    
    return useStatements;
  }

  /**
   * Resolve a use statement path to an absolute file path
   */
  private async resolveUseStatementPath(
    useStmt: UseStatementSpec,
    baseDir: string
  ): Promise<string | null> {
    const moduleName = useStmt.module;
    
    // Handle stdlib modules
    if (useStmt.isStdlib) {
      const stdlibPath = this.stdlibRegistry.resolveModuleFile(moduleName);
      if (stdlibPath) {
        return this.normalizePath(stdlibPath);
      }
      // Stdlib module not found - add error with suggestions
      const availableModules = this.stdlibRegistry.getAvailableModules();
      const suggestions = this.getSimilarModules(moduleName, availableModules);
      this.errors.push(this.createModuleNotFoundError(moduleName, suggestions, useStmt.location));
      return null;
    }

    // Handle relative paths (string literals like "./local")
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      return this.resolveImportPath(moduleName, baseDir, useStmt.location);
    }

    // Handle bare module names that aren't stdlib
    this.errors.push(invalidImportPathError(
      moduleName,
      'Module name must be a stdlib module (stdlib-*), relative path (./...), or @isl/ scoped package',
      useStmt.location
    ));
    return null;
  }

  /**
   * Create a module not found error with suggestions
   */
  private createModuleNotFoundError(
    moduleName: string,
    suggestions: string[],
    location: AST.SourceLocation
  ): ResolverError {
    let message = `Module not found: "${moduleName}"`;
    
    if (suggestions.length > 0) {
      message += `\n\nDid you mean:\n${suggestions.map(s => `  • ${s}`).join('\n')}`;
    }
    
    message += `\n\nAvailable stdlib modules:\n` +
      `  • stdlib-auth (authentication, sessions, OAuth)\n` +
      `  • stdlib-rate-limit (rate limiting, quotas)\n` +
      `  • stdlib-audit (audit logging)\n` +
      `  • stdlib-payments (payment processing)\n` +
      `  • stdlib-uploads (file uploads)`;
    
    return {
      code: 'MODULE_NOT_FOUND' as any,
      message,
      path: moduleName,
      location,
      details: { moduleName, suggestions },
    };
  }

  /**
   * Get similar module names using Levenshtein distance
   */
  private getSimilarModules(input: string, available: string[]): string[] {
    const maxDistance = 3;
    const inputLower = input.toLowerCase();
    
    return available
      .map(mod => ({
        name: mod,
        distance: this.levenshteinDistance(inputLower, mod.toLowerCase()),
      }))
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(({ name }) => name);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Convert SourceSpan to SourceLocation
   */
  private spanToLocation(span: any, file: string): AST.SourceLocation {
    return {
      file,
      line: span.start?.line ?? 1,
      column: span.start?.column ?? 1,
      endLine: span.end?.line ?? span.start?.line ?? 1,
      endColumn: span.end?.column ?? span.start?.column ?? 1,
    };
  }

  /**
   * Create default location for error reporting
   */
  private defaultLocation(file: string): AST.SourceLocation {
    return {
      file,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };
  }

  /**
   * Extract imports from AST with alias support
   */
  private extractImports(ast: AST.Domain, fromPath: string): {
    importSpecs: ImportSpec[];
    importedSymbols: AliasedImport[];
  } {
    const importSpecs: ImportSpec[] = [];
    const importedSymbols: AliasedImport[] = [];

    for (const imp of ast.imports) {
      const items: ImportItemSpec[] = imp.items.map(item => ({
        name: item.name.name,
        alias: item.alias?.name,
        location: item.location,
      }));

      importSpecs.push({
        items,
        from: imp.from.value,
        location: imp.location,
      });

      // Track aliased imports
      const isStdlib = this.isStdlibPath(imp.from.value);
      for (const item of items) {
        importedSymbols.push({
          name: item.name,
          alias: item.alias ?? item.name,
          from: imp.from.value,
          isStdlib,
        });
      }
    }

    return { importSpecs, importedSymbols };
  }

  /**
   * Check if a path is a stdlib module
   */
  private isStdlibPath(importPath: string): boolean {
    return importPath.startsWith('@isl/') || 
           importPath.startsWith('stdlib-') ||
           this.stdlibRegistry.isStdlibModule(importPath);
  }

  /**
   * Resolve an import path to an absolute file path
   */
  private async resolveImportPath(
    importPath: string,
    baseDir: string,
    location: AST.SourceLocation
  ): Promise<string | null> {
    // Handle stdlib imports
    if (this.isStdlibPath(importPath)) {
      const stdlibPath = this.stdlibRegistry.resolveModuleFile(importPath);
      if (stdlibPath) {
        return this.normalizePath(stdlibPath);
      }
      // Stdlib module not found - this is okay for now, we'll use exported types
      return null;
    }

    // Validate relative path
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      this.errors.push(invalidImportPathError(
        importPath,
        'Import path must be a relative path starting with "./" or "../", or a stdlib module (@isl/...)',
        location
      ));
      return null;
    }

    // Resolve relative path
    let resolvedPath = path.resolve(baseDir, importPath);

    // Add extension if not present
    if (!path.extname(resolvedPath)) {
      resolvedPath = resolvedPath + this.options.defaultExtension;
    }

    resolvedPath = this.normalizePath(resolvedPath);

    // Check if file exists
    const searchedPaths: string[] = [resolvedPath];
    let exists = await this.options.fileExists(resolvedPath);

    // Try with default extension
    if (!exists && !resolvedPath.endsWith(this.options.defaultExtension)) {
      const withExtension = resolvedPath + this.options.defaultExtension;
      searchedPaths.push(withExtension);
      if (await this.options.fileExists(withExtension)) {
        resolvedPath = withExtension;
        exists = true;
      }
    }

    // Try index file in directory
    if (!exists) {
      const indexPath = path.join(resolvedPath.replace(/\.isl$/, ''), 'index' + this.options.defaultExtension);
      searchedPaths.push(indexPath);
      if (await this.options.fileExists(indexPath)) {
        resolvedPath = indexPath;
        exists = true;
      }
    }

    if (!exists) {
      this.errors.push(moduleNotFoundError(importPath, resolvedPath, searchedPaths, location));
      return null;
    }

    return resolvedPath;
  }

  /**
   * Topological sort of modules (dependencies first)
   */
  private topologicalSort(entryPoint: string): string[] {
    const outDegree = new Map<string, number>();
    const dependedBy = new Map<string, string[]>();

    for (const [modulePath, module] of this.moduleCache) {
      outDegree.set(modulePath, module.dependencies.length);
      if (!dependedBy.has(modulePath)) {
        dependedBy.set(modulePath, []);
      }

      for (const dep of module.dependencies) {
        const dependers = dependedBy.get(dep) || [];
        dependers.push(modulePath);
        dependedBy.set(dep, dependers);
      }
    }

    // Find leaf nodes (no dependencies)
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
   * Merge ASTs from all modules in dependency order
   */
  private mergeASTs(sortedOrder: string[]): AST.Domain {
    const defaultLocation: AST.SourceLocation = {
      file: 'merged',
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };

    // Start with an empty domain
    const merged: AST.Domain = {
      kind: 'Domain',
      name: { kind: 'Identifier', name: 'merged', location: defaultLocation },
      version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: defaultLocation,
    };

    const seenTypes = new Set<string>();
    const seenEntities = new Set<string>();
    const seenBehaviors = new Set<string>();
    const seenInvariants = new Set<string>();

    for (const modulePath of sortedOrder) {
      const module = this.moduleCache.get(modulePath);
      if (!module) continue;

      const ast = module.ast;

      // Merge types (skip duplicates)
      for (const type of ast.types) {
        const name = type.name.name;
        if (!seenTypes.has(name)) {
          merged.types.push(type);
          seenTypes.add(name);
        }
      }

      // Merge entities (skip duplicates)
      for (const entity of ast.entities) {
        const name = entity.name.name;
        if (!seenEntities.has(name)) {
          merged.entities.push(entity);
          seenEntities.add(name);
        }
      }

      // Merge behaviors (skip duplicates)
      for (const behavior of ast.behaviors) {
        const name = behavior.name.name;
        if (!seenBehaviors.has(name)) {
          merged.behaviors.push(behavior);
          seenBehaviors.add(name);
        }
      }

      // Merge invariants (skip duplicates by name)
      for (const invariant of ast.invariants) {
        const name = invariant.name.name;
        if (!seenInvariants.has(name)) {
          merged.invariants.push(invariant);
          seenInvariants.add(name);
        }
      }

      // Merge policies
      merged.policies.push(...ast.policies);

      // Merge views
      merged.views.push(...ast.views);

      // Merge scenarios
      merged.scenarios.push(...ast.scenarios);

      // Merge chaos
      merged.chaos.push(...ast.chaos);
    }

    return merged;
  }

  /**
   * Normalize path for consistent cross-platform handling
   */
  private normalizePath(p: string): string {
    return path.normalize(p).replace(/\\/g, '/');
  }

  /**
   * Build an empty graph for error cases
   */
  private buildEmptyGraph(entryPoint: string): ModuleGraph {
    return {
      modules: new Map(),
      graphModules: new Map(),
      entryPoint: this.normalizePath(entryPoint),
      sortedOrder: [],
      cycles: this.cycles,
      errors: this.errors,
    };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): ModuleGraphDebug {
    return this.debugInfo;
  }

  /**
   * Get AST cache statistics
   */
  getCacheStats(): { hits: number; misses: number; size: number } | null {
    return this.astCache?.stats() ?? null;
  }

  /**
   * Clear the AST cache
   */
  clearCache(): void {
    this.astCache?.clear();
    this.moduleCache.clear();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Build a module graph from an entry point
 */
export async function buildModuleGraph(
  entryPoint: string,
  options: ModuleGraphOptions = {}
): Promise<ModuleGraph> {
  const builder = new ModuleGraphBuilder(options);
  return builder.build(entryPoint);
}

/**
 * Get the merged AST from a module graph
 */
export function getMergedAST(graph: ModuleGraph): AST.Domain | undefined {
  return graph.mergedAST;
}

/**
 * Check if a module graph has circular dependencies
 */
export function hasCircularDependencies(graph: ModuleGraph): boolean {
  return graph.cycles.length > 0;
}

/**
 * Format debug information as a string
 */
export function formatGraphDebug(graph: ModuleGraph): string {
  if (!graph.debug) {
    return 'No debug information available. Build with debug: true option.';
  }

  const lines: string[] = [
    '=== Module Graph Debug ===',
    '',
    '--- Resolution Order ---',
    ...graph.debug.resolutionTrace.map((p, i) => `${i + 1}. ${p}`),
    '',
    '--- Module Timings ---',
    ...Array.from(graph.debug.timings.entries()).map(
      ([path, time]) => `${path}: ${time}ms`
    ),
    '',
    '--- Import Chains ---',
  ];

  for (const [path, chain] of graph.debug.importChains) {
    lines.push(`${path}:`);
    lines.push(`  ${chain.join(' -> ')}`);
  }

  if (graph.cycles.length > 0) {
    lines.push('', '--- Circular Dependencies ---');
    for (const cycle of graph.cycles) {
      lines.push(`  ${cycle.path.join(' -> ')}`);
    }
  }

  if (graph.errors.length > 0) {
    lines.push('', '--- Errors ---');
    for (const error of graph.errors) {
      lines.push(`  [${error.code}] ${error.message}`);
    }
  }

  return lines.join('\n');
}
