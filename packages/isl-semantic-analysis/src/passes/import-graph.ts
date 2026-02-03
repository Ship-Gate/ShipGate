/**
 * Import Graph & Cycle Detection Pass
 * 
 * Builds a directed graph of import relationships and detects:
 * - Circular import dependencies
 * - Missing imported modules
 * - Duplicate imports
 * - Deterministic import ordering for reproducible analysis
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type {
  DomainDeclaration,
  ImportDeclaration,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Error Codes
// ============================================================================

const ERRORS = {
  CIRCULAR_IMPORT: 'E0100',
  IMPORT_NOT_FOUND: 'E0101',
  DUPLICATE_IMPORT: 'E0102',
  IMPORT_ORDER_SUGGESTION: 'E0103',
  SELF_IMPORT: 'E0104',
  UNUSED_IMPORT: 'E0105',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ImportGraphNode {
  path: string;
  imports: Set<string>;
  importedBy: Set<string>;
  declaration?: ImportDeclaration;
}

export interface ImportGraphResult {
  /** Module dependency graph: path → imported paths */
  graph: Map<string, Set<string>>;
  /** Reverse graph: path → modules that import this */
  reverseGraph: Map<string, Set<string>>;
  /** Topologically sorted module order (dependency-first) */
  order: string[];
  /** Detected import cycles */
  cycles: string[][];
  /** Map of import declarations by path */
  declarations: Map<string, ImportDeclaration>;
}

// ============================================================================
// Pass Definition
// ============================================================================

export const ImportGraphPass: SemanticPass = {
  id: 'import-graph',
  name: 'Import Graph',
  description: 'Builds import graph, detects cycles, and determines processing order',
  dependencies: [],
  priority: 100,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    // Build import graph
    const graphResult = buildImportGraph(ast, filePath);

    // Store result in context for downstream passes
    (ctx as PassContext & { importGraph?: ImportGraphResult }).importGraph = graphResult;

    // Check for self-imports
    diagnostics.push(...checkSelfImports(ast, filePath));

    // Check for duplicate imports
    diagnostics.push(...checkDuplicateImports(ast, filePath));

    // Check for circular imports
    diagnostics.push(...reportCycles(graphResult.cycles, ast, filePath));

    // Check for unused imports (if we can determine usage)
    diagnostics.push(...checkUnusedImports(ast, filePath));

    return diagnostics;
  },
};

export const importGraphPass = ImportGraphPass;

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build the import dependency graph from AST
 */
export function buildImportGraph(ast: DomainDeclaration, filePath: string): ImportGraphResult {
  const graph = new Map<string, Set<string>>();
  const reverseGraph = new Map<string, Set<string>>();
  const declarations = new Map<string, ImportDeclaration>();

  // Initialize current module
  graph.set(filePath, new Set());

  // Process imports
  const imports = ast.imports || [];
  for (const imp of imports) {
    const importPath = resolveImportPath(imp, filePath);
    
    if (importPath) {
      // Add to forward graph
      const deps = graph.get(filePath) || new Set();
      deps.add(importPath);
      graph.set(filePath, deps);

      // Add to reverse graph
      const importers = reverseGraph.get(importPath) || new Set();
      importers.add(filePath);
      reverseGraph.set(importPath, importers);

      // Store declaration
      declarations.set(importPath, imp);
    }
  }

  // Detect cycles using Tarjan's algorithm
  const cycles = detectCycles(graph);

  // Compute topological order (deterministic)
  const order = topologicalSort(graph);

  return {
    graph,
    reverseGraph,
    order,
    cycles,
    declarations,
  };
}

/**
 * Resolve import path to absolute/normalized form
 */
function resolveImportPath(imp: ImportDeclaration, currentFile: string): string | null {
  // Handle different import declaration shapes
  const source = getImportSource(imp);
  if (!source) return null;

  // If it's already absolute or a package name, return as-is
  if (!source.startsWith('.')) {
    return source;
  }

  // Resolve relative path
  const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
  return normalizePath(currentDir + '/' + source);
}

function getImportSource(imp: ImportDeclaration): string | null {
  // Handle various import declaration shapes
  const node = imp as unknown as Record<string, unknown>;
  
  if (typeof node.source === 'string') {
    return node.source;
  }
  
  if (node.source && typeof node.source === 'object') {
    const src = node.source as { value?: string; name?: string };
    if (typeof src.value === 'string') return src.value;
    if (typeof src.name === 'string') return src.name;
  }
  
  if (typeof node.path === 'string') {
    return node.path;
  }
  
  if (node.path && typeof node.path === 'object') {
    const p = node.path as { value?: string };
    if (typeof p.value === 'string') return p.value;
  }

  if (typeof node.from === 'string') {
    return node.from;
  }

  return null;
}

function normalizePath(path: string): string {
  const parts = path.split('/');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }

  return result.join('/');
}

// ============================================================================
// Cycle Detection (Tarjan's SCC Algorithm)
// ============================================================================

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (stack.has(node)) {
      // Found a cycle - extract it
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        if (cycle.length > 0) {
          cycles.push(cycle);
        }
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    stack.add(node);
    path.push(node);

    const deps = graph.get(node) || new Set();
    for (const dep of deps) {
      dfs(dep);
    }

    path.pop();
    stack.delete(node);
  }

  // Visit all nodes in deterministic order
  const sortedNodes = Array.from(graph.keys()).sort();
  for (const node of sortedNodes) {
    dfs(node);
  }

  return deduplicateCycles(cycles);
}

function deduplicateCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const cycle of cycles) {
    if (cycle.length === 0) continue;

    // Normalize by rotating to start with lexicographically smallest element
    const normalized = normalizeCycle(cycle);
    const key = normalized.join('→');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }

  return unique;
}

function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) return cycle;

  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIdx]) {
      minIdx = i;
    }
  }

  return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
}

// ============================================================================
// Topological Sort (Kahn's Algorithm for determinism)
// ============================================================================

function topologicalSort(graph: Map<string, Set<string>>): string[] {
  // Count incoming edges for each node
  const inDegree = new Map<string, number>();
  
  // Initialize all nodes
  for (const node of graph.keys()) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    for (const dep of graph.get(node) || []) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
  }

  // Find all nodes with no incoming edges, sorted for determinism
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }
  queue.sort();

  const result: string[] = [];

  while (queue.length > 0) {
    // Take the lexicographically smallest node for determinism
    queue.sort();
    const node = queue.shift()!;
    result.push(node);

    // Decrease in-degree of all neighbors
    for (const dep of graph.get(node) || []) {
      const newDegree = (inDegree.get(dep) || 1) - 1;
      inDegree.set(dep, newDegree);
      
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  // If we couldn't process all nodes, there's a cycle
  // In that case, add remaining nodes in sorted order
  if (result.length < inDegree.size) {
    const remaining = Array.from(inDegree.keys())
      .filter(n => !result.includes(n))
      .sort();
    result.push(...remaining);
  }

  return result;
}

// ============================================================================
// Diagnostic Checks
// ============================================================================

function checkSelfImports(ast: DomainDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const imp of ast.imports || []) {
    const source = getImportSource(imp);
    if (!source) continue;

    const resolved = resolveImportPath(imp, filePath);
    if (resolved === filePath || resolved === normalizePath(filePath)) {
      diagnostics.push({
        code: ERRORS.SELF_IMPORT,
        category: 'semantic',
        severity: 'error',
        message: `Module cannot import itself`,
        location: spanToLocation(imp.span, filePath),
        source: 'verifier',
        help: ['Remove the self-import'],
      });
    }
  }

  return diagnostics;
}

function checkDuplicateImports(ast: DomainDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, ImportDeclaration>();

  for (const imp of ast.imports || []) {
    const source = getImportSource(imp);
    if (!source) continue;

    const resolved = resolveImportPath(imp, filePath) || source;

    if (seen.has(resolved)) {
      const first = seen.get(resolved)!;
      diagnostics.push({
        code: ERRORS.DUPLICATE_IMPORT,
        category: 'semantic',
        severity: 'warning',
        message: `Duplicate import of '${source}'`,
        location: spanToLocation(imp.span, filePath),
        source: 'verifier',
        notes: ['This module is already imported'],
        help: ['Remove the duplicate import'],
        tags: ['unnecessary'],
        relatedInformation: [{
          message: 'First import here',
          location: spanToLocation(first.span, filePath),
        }],
      });
    } else {
      seen.set(resolved, imp);
    }
  }

  return diagnostics;
}

function reportCycles(cycles: string[][], ast: DomainDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const cycle of cycles) {
    // Find the import declaration for the first module in the cycle
    const cycleStr = cycle.join(' → ') + ' → ' + cycle[0];
    
    // Find the import that creates this cycle
    const imports = ast.imports || [];
    const relevantImport = imports.find(imp => {
      const source = getImportSource(imp);
      const resolved = source ? resolveImportPath(imp, filePath) : null;
      return resolved && cycle.includes(resolved);
    });

    const location = relevantImport 
      ? spanToLocation(relevantImport.span, filePath)
      : spanToLocation(ast.span, filePath);

    diagnostics.push({
      code: ERRORS.CIRCULAR_IMPORT,
      category: 'semantic',
      severity: 'error',
      message: `Circular import detected: ${cycleStr}`,
      location,
      source: 'verifier',
      notes: [
        'Circular imports can cause initialization issues',
        'They may also indicate a design problem',
      ],
      help: [
        'Break the cycle by extracting shared types to a separate module',
        'Or restructure the code to remove the circular dependency',
      ],
    });
  }

  return diagnostics;
}

function checkUnusedImports(ast: DomainDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Collect all imported names
  const importedNames = new Map<string, ImportDeclaration>();
  for (const imp of ast.imports || []) {
    const names = getImportedNames(imp);
    for (const name of names) {
      importedNames.set(name, imp);
    }
  }

  // Collect all used names in the AST
  const usedNames = collectUsedNames(ast);

  // Report unused imports
  for (const [name, imp] of importedNames) {
    if (!usedNames.has(name)) {
      diagnostics.push({
        code: ERRORS.UNUSED_IMPORT,
        category: 'semantic',
        severity: 'warning',
        message: `Imported name '${name}' is never used`,
        location: spanToLocation(imp.span, filePath),
        source: 'verifier',
        tags: ['unnecessary'],
        help: ['Remove the unused import'],
      });
    }
  }

  return diagnostics;
}

function getImportedNames(imp: ImportDeclaration): string[] {
  const names: string[] = [];
  const node = imp as unknown as Record<string, unknown>;

  // Handle: import { Foo, Bar } from "..."
  if (Array.isArray(node.specifiers)) {
    for (const spec of node.specifiers) {
      const s = spec as { name?: string; imported?: { name?: string }; local?: { name?: string } };
      if (s.local?.name) names.push(s.local.name);
      else if (s.imported?.name) names.push(s.imported.name);
      else if (s.name) names.push(s.name);
    }
  }

  // Handle: import Foo from "..."
  if (node.default && typeof node.default === 'object') {
    const d = node.default as { name?: string };
    if (d.name) names.push(d.name);
  }

  // Handle: import * as Foo from "..."
  if (node.namespace && typeof node.namespace === 'object') {
    const n = node.namespace as { name?: string };
    if (n.name) names.push(n.name);
  }

  // Handle ISL-style: import TypeName from "..."
  if (node.name && typeof node.name === 'object') {
    const n = node.name as { name?: string };
    if (n.name) names.push(n.name);
  }

  return names;
}

function collectUsedNames(ast: DomainDeclaration): Set<string> {
  const used = new Set<string>();

  function walkNode(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const n = node as Record<string, unknown>;

    // Collect identifiers
    if (n.kind === 'Identifier' && typeof n.name === 'string') {
      used.add(n.name);
    }

    // Collect type references
    if (n.kind === 'SimpleType' || n.kind === 'ReferenceType') {
      if (n.name && typeof n.name === 'object') {
        const nameNode = n.name as { name?: string };
        if (nameNode.name) used.add(nameNode.name);
      } else if (typeof n.name === 'string') {
        used.add(n.name);
      }
    }

    // Recurse into children
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          walkNode(item);
        }
      } else if (typeof value === 'object' && value !== null) {
        walkNode(value);
      }
    }
  }

  // Walk entities, behaviors, types, etc.
  for (const entity of ast.entities || []) {
    walkNode(entity);
  }
  for (const behavior of ast.behaviors || []) {
    walkNode(behavior);
  }
  for (const type of ast.types || []) {
    walkNode(type);
  }
  for (const enumDecl of ast.enums || []) {
    walkNode(enumDecl);
  }

  return used;
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Check if two modules form a direct cycle
 */
export function hasDirectCycle(graph: Map<string, Set<string>>, a: string, b: string): boolean {
  const aDeps = graph.get(a);
  const bDeps = graph.get(b);
  return !!(aDeps?.has(b) && bDeps?.has(a));
}

/**
 * Get all transitive dependencies of a module
 */
export function getTransitiveDeps(graph: Map<string, Set<string>>, module: string): Set<string> {
  const result = new Set<string>();
  const queue = [module];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = graph.get(current) || new Set();
    for (const dep of deps) {
      result.add(dep);
      queue.push(dep);
    }
  }

  return result;
}

/**
 * Get processing order (imports processed before dependents)
 */
export function getProcessingOrder(graphResult: ImportGraphResult): string[] {
  // Reverse the topological order so dependencies come first
  return [...graphResult.order].reverse();
}
