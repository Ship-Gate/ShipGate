// ============================================================================
// ISL Import Resolver - AST Bundler
// Merges multiple ISL modules into a single bundled AST with canonical ordering
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  DependencyGraph,
  ResolvedModule,
  BundleResult,
  ResolverError,
  ResolverWarning,
  MergeConflict,
  ExportedSymbol,
} from './types.js';
import { ResolverErrorCode } from './types.js';
import {
  duplicateSymbolError,
  symbolNotFoundError,
  shadowedImportWarning,
} from './errors.js';
import { ImportResolver } from './resolver.js';

/**
 * Bundler options
 */
export interface BundlerOptions {
  /**
   * Whether to allow symbol shadowing (local definitions override imports)
   * Default: false (emit error on conflict)
   */
  allowShadowing?: boolean;

  /**
   * Whether to strip import declarations from the bundled AST
   * Default: true
   */
  stripImports?: boolean;

  /**
   * Custom domain name for the bundle (defaults to entry point domain name)
   */
  bundleDomainName?: string;

  /**
   * Version for the bundled domain
   */
  bundleVersion?: string;
}

/**
 * Default bundler options
 */
const DEFAULT_BUNDLER_OPTIONS: BundlerOptions = {
  allowShadowing: false,
  stripImports: true,
};

/**
 * AST Bundler
 * 
 * Merges multiple ISL modules into a single bundled AST.
 * Handles:
 * - Fragment merging (types, entities, behaviors, etc.)
 * - Conflict detection (duplicate names)
 * - Symbol resolution (imported symbols)
 * - Canonical ordering (deterministic output)
 */
export class Bundler {
  private options: Required<BundlerOptions>;
  private errors: ResolverError[] = [];
  private warnings: ResolverWarning[] = [];

  constructor(options: BundlerOptions = {}) {
    // Filter out undefined values to preserve defaults
    const definedOptions: BundlerOptions = {};
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) {
        (definedOptions as Record<string, unknown>)[key] = value;
      }
    }
    
    this.options = {
      ...DEFAULT_BUNDLER_OPTIONS,
      ...definedOptions,
    } as Required<BundlerOptions>;
  }

  /**
   * Bundle modules from a dependency graph
   */
  bundle(graph: DependencyGraph): BundleResult {
    this.errors = [];
    this.warnings = [];

    // Get the entry point module
    const entryModule = graph.modules.get(graph.entryPoint);
    if (!entryModule) {
      this.errors.push({
        code: ResolverErrorCode.MODULE_NOT_FOUND,
        message: `Entry point module not found: ${graph.entryPoint}`,
        path: graph.entryPoint,
      });
      return {
        success: false,
        errors: this.errors,
        warnings: this.warnings,
        graph,
      };
    }

    // Build symbol tables for all modules
    const resolver = new ImportResolver({
      basePath: '',
      enableImports: true,
    });
    
    const symbolTables = new Map<string, Map<string, ExportedSymbol>>();
    for (const [path, module] of graph.modules) {
      const table = resolver.buildSymbolTable(module);
      symbolTables.set(path, table.symbols);
    }

    // Check for conflicts between modules
    const conflicts = this.detectConflicts(graph, symbolTables);
    if (conflicts.length > 0 && !this.options.allowShadowing) {
      for (const conflict of conflicts) {
        this.errors.push(duplicateSymbolError(conflict));
      }
      return {
        success: false,
        errors: this.errors,
        warnings: this.warnings,
        graph,
      };
    }

    // Validate imports (check that imported symbols exist)
    this.validateImports(graph, symbolTables);
    if (this.errors.length > 0) {
      return {
        success: false,
        errors: this.errors,
        warnings: this.warnings,
        graph,
      };
    }

    // Merge modules in topological order
    const bundle = this.mergeModules(graph, entryModule);

    return {
      success: true,
      bundle,
      errors: this.errors,
      warnings: this.warnings,
      graph,
    };
  }

  /**
   * Detect conflicts between modules (duplicate definitions)
   */
  private detectConflicts(
    graph: DependencyGraph,
    symbolTables: Map<string, Map<string, ExportedSymbol>>
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];
    const seen = new Map<string, { symbol: ExportedSymbol; path: string }>();

    // Process in topological order (dependencies first)
    for (const modulePath of graph.sortedOrder) {
      const symbols = symbolTables.get(modulePath);
      if (!symbols) continue;

      for (const [name, symbol] of symbols) {
        const existing = seen.get(name);
        
        if (existing && existing.symbol.kind === symbol.kind) {
          conflicts.push({
            kind: symbol.kind,
            name,
            firstDefinition: {
              path: existing.path,
              location: existing.symbol.node.location,
            },
            secondDefinition: {
              path: modulePath,
              location: symbol.node.location,
            },
          });
        } else if (!existing) {
          seen.set(name, { symbol, path: modulePath });
        }
      }
    }

    return conflicts;
  }

  /**
   * Validate that all imported symbols exist in their source modules
   */
  private validateImports(
    graph: DependencyGraph,
    symbolTables: Map<string, Map<string, ExportedSymbol>>
  ): void {
    for (const [modulePath, module] of graph.modules) {
      const moduleSymbols = symbolTables.get(modulePath);
      
      for (let i = 0; i < module.ast.imports.length; i++) {
        const imp = module.ast.imports[i];
        const depPath = module.dependencies[i];
        
        if (!imp || !depPath) continue;
        
        const depSymbols = symbolTables.get(depPath);
        if (!depSymbols) continue;

        for (const item of imp.items) {
          const symbolName = item.name.name;
          
          if (!depSymbols.has(symbolName)) {
            this.errors.push(symbolNotFoundError(
              symbolName,
              imp.from.value,
              Array.from(depSymbols.keys()),
              item.location
            ));
          }

          // Check for shadowing
          const localName = item.alias?.name ?? symbolName;
          if (moduleSymbols?.has(localName)) {
            const localSymbol = moduleSymbols.get(localName)!;
            this.warnings.push(shadowedImportWarning(
              symbolName,
              imp.from.value,
              {
                path: modulePath,
                location: localSymbol.node.location,
              },
              item.location
            ));
          }
        }
      }
    }
  }

  /**
   * Merge all modules into a single bundled AST
   */
  private mergeModules(
    graph: DependencyGraph,
    entryModule: ResolvedModule
  ): AST.Domain {
    // Use the entry domain as the base
    const entryAst = entryModule.ast;
    
    // Create the bundle domain
    const bundle: AST.Domain = {
      kind: 'Domain',
      name: this.options.bundleDomainName
        ? { kind: 'Identifier', name: this.options.bundleDomainName, location: entryAst.name.location }
        : entryAst.name,
      version: this.options.bundleVersion
        ? { kind: 'StringLiteral', value: this.options.bundleVersion, location: entryAst.version.location }
        : entryAst.version,
      owner: entryAst.owner,
      uses: [],
      imports: this.options.stripImports ? [] : entryAst.imports,
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      apis: [],
      storage: [],
      workflows: [],
      events: [],
      handlers: [],
      screens: [],
      location: entryAst.location,
    };

    // Collect all fragments in topological order (dependencies first)
    const allTypes: AST.TypeDeclaration[] = [];
    const allEntities: AST.Entity[] = [];
    const allBehaviors: AST.Behavior[] = [];
    const allInvariants: AST.InvariantBlock[] = [];
    const allPolicies: AST.Policy[] = [];
    const allViews: AST.View[] = [];
    const allScenarios: AST.ScenarioBlock[] = [];
    const allChaos: AST.ChaosBlock[] = [];

    // Track seen names to handle duplicates (last-write-wins if shadowing allowed)
    const seenTypes = new Set<string>();
    const seenEntities = new Set<string>();
    const seenBehaviors = new Set<string>();
    const seenInvariants = new Set<string>();
    const seenPolicies = new Set<string>();
    const seenViews = new Set<string>();

    // Process in topological order
    for (const modulePath of graph.sortedOrder) {
      const module = graph.modules.get(modulePath);
      if (!module) continue;
      const ast = module.ast;

      // Add types (with deduplication)
      for (const type of ast.types) {
        const name = type.name.name;
        if (this.options.allowShadowing || !seenTypes.has(name)) {
          if (seenTypes.has(name)) {
            // Remove the old one (last-write-wins)
            const idx = allTypes.findIndex(t => t.name.name === name);
            if (idx !== -1) allTypes.splice(idx, 1);
          }
          allTypes.push(type);
          seenTypes.add(name);
        }
      }

      // Add entities
      for (const entity of ast.entities) {
        const name = entity.name.name;
        if (this.options.allowShadowing || !seenEntities.has(name)) {
          if (seenEntities.has(name)) {
            const idx = allEntities.findIndex(e => e.name.name === name);
            if (idx !== -1) allEntities.splice(idx, 1);
          }
          allEntities.push(entity);
          seenEntities.add(name);
        }
      }

      // Add behaviors
      for (const behavior of ast.behaviors) {
        const name = behavior.name.name;
        if (this.options.allowShadowing || !seenBehaviors.has(name)) {
          if (seenBehaviors.has(name)) {
            const idx = allBehaviors.findIndex(b => b.name.name === name);
            if (idx !== -1) allBehaviors.splice(idx, 1);
          }
          allBehaviors.push(behavior);
          seenBehaviors.add(name);
        }
      }

      // Add invariants
      for (const invariant of ast.invariants) {
        const name = invariant.name.name;
        if (this.options.allowShadowing || !seenInvariants.has(name)) {
          if (seenInvariants.has(name)) {
            const idx = allInvariants.findIndex(i => i.name.name === name);
            if (idx !== -1) allInvariants.splice(idx, 1);
          }
          allInvariants.push(invariant);
          seenInvariants.add(name);
        }
      }

      // Add policies
      for (const policy of ast.policies) {
        const name = policy.name.name;
        if (this.options.allowShadowing || !seenPolicies.has(name)) {
          if (seenPolicies.has(name)) {
            const idx = allPolicies.findIndex(p => p.name.name === name);
            if (idx !== -1) allPolicies.splice(idx, 1);
          }
          allPolicies.push(policy);
          seenPolicies.add(name);
        }
      }

      // Add views
      for (const view of ast.views) {
        const name = view.name.name;
        if (this.options.allowShadowing || !seenViews.has(name)) {
          if (seenViews.has(name)) {
            const idx = allViews.findIndex(v => v.name.name === name);
            if (idx !== -1) allViews.splice(idx, 1);
          }
          allViews.push(view);
          seenViews.add(name);
        }
      }

      // Add scenarios (allow duplicates - they can have same behavior name)
      allScenarios.push(...ast.scenarios);

      // Add chaos (allow duplicates)
      allChaos.push(...ast.chaos);
    }

    // Apply canonical ordering (alphabetical by name for deterministic output)
    bundle.types = this.sortByName(allTypes);
    bundle.entities = this.sortByName(allEntities);
    bundle.behaviors = this.sortByName(allBehaviors);
    bundle.invariants = this.sortByName(allInvariants);
    bundle.policies = this.sortByName(allPolicies);
    bundle.views = this.sortByName(allViews);
    bundle.scenarios = this.sortByBehaviorName(allScenarios);
    bundle.chaos = this.sortByBehaviorName(allChaos);

    return bundle;
  }

  /**
   * Sort AST nodes by name for canonical ordering
   */
  private sortByName<T extends { name: AST.Identifier }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.name.name.localeCompare(b.name.name));
  }

  /**
   * Sort scenario/chaos blocks by behavior name
   */
  private sortByBehaviorName<T extends { behaviorName: AST.Identifier }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.behaviorName.name.localeCompare(b.behaviorName.name));
  }
}

/**
 * Convenience function to bundle modules
 */
export function bundleModules(
  graph: DependencyGraph,
  options: BundlerOptions = {}
): BundleResult {
  const bundler = new Bundler(options);
  return bundler.bundle(graph);
}

/**
 * Create an empty bundle AST (for single-file mode or error cases)
 */
export function createEmptyBundle(
  domainName: string,
  version: string = '1.0.0'
): AST.Domain {
  const location: AST.SourceLocation = {
    file: 'bundle.isl',
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };

  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name: domainName, location },
    version: { kind: 'StringLiteral', value: version, location },
    uses: [],
    imports: [],
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    apis: [],
    storage: [],
    workflows: [],
    events: [],
    handlers: [],
    screens: [],
    location,
  };
}
