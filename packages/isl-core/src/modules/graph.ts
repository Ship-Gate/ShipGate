/**
 * ISL Module Graph Builder
 *
 * Builds and analyzes the module dependency graph, including:
 * - Topological sorting for correct load order
 * - Circular dependency detection using Tarjan's algorithm
 * - Version conflict detection
 */

import type { SourceSpan } from '../lexer/tokens.js';
import type { DomainDeclaration, UseStatement, ImportDeclaration } from '../ast/types.js';
import {
  type ModuleId,
  type ModulePath,
  type ImportEdge,
  type ModuleGraph,
  type ResolvedModule,
  type GraphBuildResult,
  type VersionConflict,
  createModuleId,
  createEmptyGraph,
} from './types.js';
import { ModuleResolver, extractExports } from './resolver.js';

// ============================================================================
// Module Graph Builder
// ============================================================================

/**
 * Options for building a module graph.
 */
export interface GraphBuildOptions {
  /** Module resolver instance */
  resolver: ModuleResolver;

  /** Function to read file contents */
  readFile: (path: string) => string;

  /** Function to parse ISL source */
  parseISL: (source: string, filename?: string) => {
    ast: DomainDeclaration | null;
    errors: Array<{ message: string; span: SourceSpan }>;
  };

  /** Maximum depth for transitive dependencies (default: 100) */
  maxDepth?: number;
}

/**
 * Builds a module dependency graph from entry point files.
 */
export class ModuleGraphBuilder {
  private options: Required<GraphBuildOptions>;
  private graph: ModuleGraph;
  private visiting: Set<ModuleId> = new Set();
  private visited: Set<ModuleId> = new Set();
  private versionMap: Map<string, { version: string; from: ModuleId; span: SourceSpan }> =
    new Map();

  constructor(options: GraphBuildOptions) {
    this.options = {
      ...options,
      maxDepth: options.maxDepth ?? 100,
    };
    this.graph = createEmptyGraph();
  }

  /**
   * Build the module graph from entry points.
   *
   * @param entryPoints - Array of file paths to start from
   * @returns Build result with graph or errors
   */
  build(entryPoints: string[]): GraphBuildResult {
    this.reset();

    const unresolved: Array<{ specifier: ModulePath; from: ModuleId; error: string }> = [];

    // Process each entry point
    for (const entryPath of entryPoints) {
      const moduleId = createModuleId(entryPath);
      this.graph.entryPoints.push(moduleId);

      try {
        this.processModule(moduleId, entryPath, 0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        unresolved.push({
          specifier: {
            raw: entryPath,
            span: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
          },
          from: moduleId,
          error: errorMessage,
        });
      }
    }

    // Detect cycles using Tarjan's algorithm
    const cycles = this.detectCycles();

    // Check for version conflicts
    const versionConflicts = this.detectVersionConflicts();

    // Compute topological order
    if (cycles.length === 0) {
      this.graph.order = this.topologicalSort();
    }

    // Determine success
    const success =
      cycles.length === 0 && versionConflicts.length === 0 && unresolved.length === 0;

    return {
      success,
      graph: this.graph,
      cycles: cycles.length > 0 ? cycles : undefined,
      versionConflicts: versionConflicts.length > 0 ? versionConflicts : undefined,
      unresolved: unresolved.length > 0 ? unresolved : undefined,
    };
  }

  /**
   * Process a single module and its dependencies.
   */
  private processModule(moduleId: ModuleId, filePath: string, depth: number): void {
    // Check depth limit
    if (depth > this.options.maxDepth) {
      throw new Error(`Maximum dependency depth (${this.options.maxDepth}) exceeded`);
    }

    // Skip if already processed
    if (this.visited.has(moduleId)) {
      return;
    }

    // Read and parse the file
    const source = this.options.readFile(filePath);
    const { ast, errors } = this.options.parseISL(source, filePath);

    if (!ast || errors.length > 0) {
      throw new Error(
        `Failed to parse ${filePath}: ${errors.map((e) => e.message).join(', ')}`
      );
    }

    // Extract exports
    const exports = extractExports(ast);

    // Add module to graph
    const resolvedModule: ResolvedModule = {
      id: moduleId,
      path: filePath,
      exports,
      ast,
    };
    this.graph.modules.set(moduleId, resolvedModule);
    this.visited.add(moduleId);

    // Process use statements
    for (const useStmt of ast.uses ?? []) {
      this.processUseStatement(useStmt, moduleId, filePath, depth);
    }

    // Process import statements
    for (const importDecl of ast.imports ?? []) {
      this.processImportDeclaration(importDecl, moduleId, filePath, depth);
    }
  }

  /**
   * Process a use statement and resolve the imported module.
   */
  private processUseStatement(
    useStmt: UseStatement,
    fromModule: ModuleId,
    fromPath: string,
    depth: number
  ): void {
    // Get the module specifier
    const raw =
      useStmt.module.kind === 'StringLiteral'
        ? useStmt.module.value
        : useStmt.module.name;

    const specifier: ModulePath = {
      raw,
      alias: useStmt.alias?.name,
      version: useStmt.version?.value,
      span: useStmt.span,
    };

    // Resolve the module
    const result = this.options.resolver.resolve(specifier, fromPath);

    if (!result.success || !result.module) {
      throw new Error(result.errorMessage ?? `Cannot resolve module '${raw}'`);
    }

    const toModule = result.module.id;

    // Track version for conflict detection
    if (specifier.version) {
      const baseModule = raw.replace(/@.*$/, ''); // Remove version from name
      this.trackVersion(baseModule, specifier.version, fromModule, useStmt.span);
    }

    // Add edge to graph
    this.graph.edges.push({
      from: fromModule,
      to: toModule,
      specifier,
      symbols: [], // use statement imports entire module
    });

    // Recursively process the imported module
    this.processModule(toModule, result.module.path, depth + 1);
  }

  /**
   * Process an import declaration and resolve the imported module.
   */
  private processImportDeclaration(
    importDecl: ImportDeclaration,
    fromModule: ModuleId,
    fromPath: string,
    depth: number
  ): void {
    const specifier: ModulePath = {
      raw: importDecl.from.value,
      span: importDecl.span,
    };

    // Resolve the module
    const result = this.options.resolver.resolve(specifier, fromPath);

    if (!result.success || !result.module) {
      throw new Error(
        result.errorMessage ?? `Cannot resolve module '${importDecl.from.value}'`
      );
    }

    const toModule = result.module.id;

    // Add edge to graph
    this.graph.edges.push({
      from: fromModule,
      to: toModule,
      specifier,
      symbols: importDecl.names.map((n) => n.name),
    });

    // Recursively process the imported module
    this.processModule(toModule, result.module.path, depth + 1);
  }

  /**
   * Track module versions for conflict detection.
   */
  private trackVersion(
    moduleName: string,
    version: string,
    from: ModuleId,
    span: SourceSpan
  ): void {
    const existing = this.versionMap.get(moduleName);
    if (existing && existing.version !== version) {
      // Version conflict will be reported later
    }
    this.versionMap.set(moduleName, { version, from, span });
  }

  /**
   * Detect circular dependencies using Tarjan's algorithm.
   * Returns all strongly connected components with more than one node.
   */
  private detectCycles(): ModuleId[][] {
    const cycles: ModuleId[][] = [];
    const index = new Map<ModuleId, number>();
    const lowlink = new Map<ModuleId, number>();
    const onStack = new Set<ModuleId>();
    const stack: ModuleId[] = [];
    let currentIndex = 0;

    const strongConnect = (v: ModuleId): void => {
      index.set(v, currentIndex);
      lowlink.set(v, currentIndex);
      currentIndex++;
      stack.push(v);
      onStack.add(v);

      // Get successors (modules that v imports)
      const successors = this.graph.edges
        .filter((e) => e.from === v)
        .map((e) => e.to);

      for (const w of successors) {
        if (!index.has(w)) {
          // Successor w has not yet been visited; recurse on it
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.has(w)) {
          // Successor w is on stack and hence in the current SCC
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
        }
      }

      // If v is a root node, pop the stack and generate an SCC
      if (lowlink.get(v) === index.get(v)) {
        const scc: ModuleId[] = [];
        let w: ModuleId;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== v);

        // Only report SCCs with more than one node (actual cycles)
        if (scc.length > 1) {
          cycles.push(scc.reverse());
        }
      }
    };

    // Run Tarjan's algorithm on all modules
    for (const moduleId of this.graph.modules.keys()) {
      if (!index.has(moduleId)) {
        strongConnect(moduleId);
      }
    }

    return cycles;
  }

  /**
   * Detect version conflicts across all imports.
   */
  private detectVersionConflicts(): VersionConflict[] {
    const conflicts: VersionConflict[] = [];
    const moduleVersions = new Map<
      string,
      Array<{ version: string; from: ModuleId; span: SourceSpan }>
    >();

    // Group imports by base module name
    for (const edge of this.graph.edges) {
      if (edge.specifier.version) {
        const baseName = edge.specifier.raw.replace(/@.*$/, '');
        const versions = moduleVersions.get(baseName) ?? [];
        versions.push({
          version: edge.specifier.version,
          from: edge.from,
          span: edge.specifier.span,
        });
        moduleVersions.set(baseName, versions);
      }
    }

    // Check for conflicts
    for (const [moduleName, versions] of moduleVersions) {
      const uniqueVersions = new Map<string, typeof versions>();
      for (const v of versions) {
        const existing = uniqueVersions.get(v.version);
        if (!existing) {
          uniqueVersions.set(v.version, [v]);
        } else {
          existing.push(v);
        }
      }

      if (uniqueVersions.size > 1) {
        const versionList = Array.from(uniqueVersions.values());
        const first = versionList[0]![0]!;
        const second = versionList[1]![0]!;

        conflicts.push({
          moduleId: createModuleId(moduleName),
          first: {
            from: first.from,
            version: first.version,
            span: first.span,
          },
          second: {
            from: second.from,
            version: second.version,
            span: second.span,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Compute topological sort of the module graph.
   * Returns modules in dependency order (dependencies first).
   */
  private topologicalSort(): ModuleId[] {
    const sorted: ModuleId[] = [];
    const visited = new Set<ModuleId>();
    const visiting = new Set<ModuleId>();

    const visit = (moduleId: ModuleId): void => {
      if (visited.has(moduleId)) return;
      if (visiting.has(moduleId)) {
        // This shouldn't happen if cycles are already detected
        return;
      }

      visiting.add(moduleId);

      // Visit dependencies first
      const dependencies = this.graph.edges
        .filter((e) => e.from === moduleId)
        .map((e) => e.to);

      for (const dep of dependencies) {
        visit(dep);
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      sorted.push(moduleId);
    };

    // Visit all modules
    for (const moduleId of this.graph.modules.keys()) {
      visit(moduleId);
    }

    return sorted;
  }

  /**
   * Reset the builder state for a new build.
   */
  private reset(): void {
    this.graph = createEmptyGraph();
    this.visiting.clear();
    this.visited.clear();
    this.versionMap.clear();
  }
}

// ============================================================================
// Cycle Error Formatting
// ============================================================================

/**
 * Format a cycle for human-readable error output.
 *
 * @param cycle - Array of module IDs forming the cycle
 * @param graph - The module graph for getting file paths
 * @returns Formatted error message
 */
export function formatCycleError(cycle: ModuleId[], graph: ModuleGraph): string {
  const lines: string[] = ['Circular import detected:', ''];

  for (let i = 0; i < cycle.length; i++) {
    const moduleId = cycle[i]!;
    const module = graph.modules.get(moduleId);
    const displayName = module?.path ?? moduleId;
    const shortName = displayName.split('/').pop() ?? displayName;

    const indent = '  '.repeat(i + 1);
    const arrow = i === cycle.length - 1 ? '(cycle back)' : '';

    lines.push(`${indent}└─► ${shortName} ${arrow}`);
  }

  // Add the first module again to show the cycle
  const firstModule = graph.modules.get(cycle[0]!);
  const firstName = firstModule?.path?.split('/').pop() ?? cycle[0];
  const finalIndent = '  '.repeat(cycle.length + 1);
  lines.push(`${finalIndent}└─► ${firstName} (cycle back)`);

  lines.push('');
  lines.push('To fix: Extract shared types to a common module that both can import.');

  return lines.join('\n');
}

/**
 * Format all cycles in a build result.
 */
export function formatAllCycles(result: GraphBuildResult): string[] {
  if (!result.cycles || !result.graph) {
    return [];
  }

  return result.cycles.map((cycle) => formatCycleError(cycle, result.graph!));
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a module graph builder with standard configuration.
 */
export function createGraphBuilder(options: GraphBuildOptions): ModuleGraphBuilder {
  return new ModuleGraphBuilder(options);
}

/**
 * Build a module graph from entry points (convenience function).
 */
export function buildModuleGraph(
  entryPoints: string[],
  options: GraphBuildOptions
): GraphBuildResult {
  const builder = new ModuleGraphBuilder(options);
  return builder.build(entryPoints);
}
