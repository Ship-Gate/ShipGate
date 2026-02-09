/**
 * Cyclic Dependencies Detection Pass
 * 
 * Detects circular dependencies between:
 * - Entities (A references B, B references A)
 * - Behaviors (A triggers B, B triggers A)
 * - Types (A contains B, B contains A)
 * - Imports (cyclic import chains)
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import type { EntityDeclaration } from '@isl-lang/isl-core/ast';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Pass Definition
// ============================================================================

export const CyclicDependenciesPass: SemanticPass = {
  id: 'cyclic-dependencies',
  name: 'Cyclic Dependencies',
  description: 'Detects circular dependencies between entities, behaviors, and types',
  dependencies: [],
  priority: 40,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    // Build dependency graphs
    const entityDeps = buildEntityDependencyGraph(ast);
    const behaviorDeps = buildBehaviorDependencyGraph(ast);
    const typeDeps = buildTypeDependencyGraph(ast);

    // Detect cycles in each graph
    const entityCycles = detectCycles(entityDeps);
    const behaviorCycles = detectCycles(behaviorDeps);
    const typeCycles = detectCycles(typeDeps);

    // Report entity cycles
    for (const cycle of entityCycles) {
      const firstEntity = ast.entities?.find(e => e.name.name === cycle[0]);
      if (firstEntity) {
        diagnostics.push({
          code: 'E0360',
          category: 'semantic',
          severity: 'hint',
          message: `Circular entity dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          location: spanToLocation((firstEntity as { span?: unknown }).span, filePath),
          source: 'verifier',
          notes: [
            'Circular entity references can cause serialization issues',
            'They may also indicate a design issue',
          ],
          help: [
            'Use @inverse annotation if bidirectional relationship is intentional',
            'Consider using IDs instead of direct references',
            'Or restructure entities to remove the cycle',
          ],
        });
      }
    }

    // Report behavior cycles
    for (const cycle of behaviorCycles) {
      const firstBehavior = ast.behaviors?.find(b => b.name.name === cycle[0]);
      if (firstBehavior) {
        diagnostics.push({
          code: 'E0361',
          category: 'semantic',
          severity: 'warning',
          message: `Circular behavior dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          location: spanToLocation((firstBehavior as { span?: unknown }).span, filePath),
          source: 'verifier',
          notes: [
            'Circular behavior triggers can cause infinite loops',
            'This is usually a design error',
          ],
          help: [
            'Review the trigger chain and break the cycle',
            'Add termination conditions to prevent infinite loops',
            'Consider using async events with idempotency guards',
          ],
        });
      }
    }

    // Report type cycles
    for (const cycle of typeCycles) {
      const firstType = ast.types?.find(t => t.name.name === cycle[0]);
      if (firstType) {
        diagnostics.push({
          code: 'E0362',
          category: 'semantic',
          severity: 'warning',
          message: `Circular type dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          location: spanToLocation((firstType as { span?: unknown }).span, filePath),
          source: 'verifier',
          notes: [
            'Circular type definitions can cause infinite recursion',
            'Type resolution may fail for this type',
          ],
          help: [
            'Break the cycle by using base types or interfaces',
            'Use Optional<T> to allow null values in one direction',
          ],
        });
      }
    }

    // Check for deep nesting (potential performance issue)
    const deepNesting = detectDeepNesting(entityDeps, 5);
    for (const [entity, depth] of deepNesting) {
      const entityDecl = ast.entities?.find(e => e.name.name === entity);
      if (entityDecl) {
        diagnostics.push({
          code: 'E0363',
          category: 'semantic',
          severity: 'hint',
          message: `Entity '${entity}' has deep nesting (${depth} levels)`,
          location: spanToLocation((entityDecl as { span?: unknown }).span, filePath),
          source: 'verifier',
          notes: [
            'Deep entity nesting can cause performance issues',
            'Consider flattening the structure or using lazy loading',
          ],
          help: [
            'Use @lazy annotation for deeply nested references',
            'Or restructure to reduce nesting depth',
          ],
        });
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const cyclicDependenciesPass = CyclicDependenciesPass;

// ============================================================================
// Dependency Graph Building
// ============================================================================

type DependencyGraph = Map<string, Set<string>>;

function buildEntityDependencyGraph(ast: DomainDeclaration): DependencyGraph {
  const graph: DependencyGraph = new Map();
  const entityNames = new Set(ast.entities?.map(e => e.name.name) || []);

  for (const entity of ast.entities || []) {
    const deps = new Set<string>();
    
    for (const field of entity.fields || []) {
      const typeName = extractReferencedType(field.type);
      if (typeName && entityNames.has(typeName)) {
        deps.add(typeName);
      }
    }
    
    graph.set(entity.name.name, deps);
  }

  return graph;
}

function buildBehaviorDependencyGraph(ast: DomainDeclaration): DependencyGraph {
  const graph: DependencyGraph = new Map();
  const behaviorNames = new Set(ast.behaviors?.map(b => b.name.name) || []);

  for (const behavior of ast.behaviors || []) {
    const deps = new Set<string>();
    
    // Check postconditions for triggers
    if (behavior.postconditions) {
      const triggers = extractTriggeredBehaviors(behavior.postconditions);
      for (const trigger of triggers) {
        if (behaviorNames.has(trigger)) {
          deps.add(trigger);
        }
      }
    }

    // Check temporal block for triggers
    if (behavior.temporal) {
      const triggers = extractTriggeredBehaviors(behavior.temporal);
      for (const trigger of triggers) {
        if (behaviorNames.has(trigger)) {
          deps.add(trigger);
        }
      }
    }
    
    graph.set(behavior.name.name, deps);
  }

  return graph;
}

function buildTypeDependencyGraph(ast: DomainDeclaration): DependencyGraph {
  const graph: DependencyGraph = new Map();
  const typeNames = new Set(ast.types?.map(t => t.name.name) || []);

  for (const typeDef of ast.types || []) {
    const deps = new Set<string>();
    
    const referenced = extractAllReferencedTypes((typeDef as { type?: unknown }).type);
    for (const ref of referenced) {
      if (typeNames.has(ref)) {
        deps.add(ref);
      }
    }
    
    graph.set(typeDef.name.name, deps);
  }

  return graph;
}

// ============================================================================
// Cycle Detection (Tarjan's Algorithm)
// ============================================================================

function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (stack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
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

  for (const node of graph.keys()) {
    dfs(node);
  }

  // Remove duplicate cycles (same cycle reported from different starting points)
  return deduplicateCycles(cycles);
}

function deduplicateCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const cycle of cycles) {
    if (cycle.length === 0) continue;
    
    // Normalize by rotating to start with smallest element
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
  
  // Find the lexicographically smallest rotation
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIdx]) {
      minIdx = i;
    }
  }
  
  return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
}

// ============================================================================
// Deep Nesting Detection
// ============================================================================

function detectDeepNesting(
  graph: DependencyGraph,
  threshold: number
): Map<string, number> {
  const deepEntities = new Map<string, number>();
  const depths = new Map<string, number>();

  function getDepth(node: string, visiting: Set<string>): number {
    if (visiting.has(node)) {
      return 0; // Cycle - don't count
    }

    if (depths.has(node)) {
      return depths.get(node)!;
    }

    const deps = graph.get(node) || new Set();
    if (deps.size === 0) {
      depths.set(node, 0);
      return 0;
    }

    visiting.add(node);
    
    let maxChildDepth = 0;
    for (const dep of deps) {
      const childDepth = getDepth(dep, visiting);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    visiting.delete(node);
    
    const depth = maxChildDepth + 1;
    depths.set(node, depth);
    return depth;
  }

  for (const node of graph.keys()) {
    const depth = getDepth(node, new Set());
    if (depth >= threshold) {
      deepEntities.set(node, depth);
    }
  }

  return deepEntities;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractReferencedType(typeNode: unknown): string | null {
  if (!typeNode || typeof typeNode !== 'object') return null;

  const t = typeNode as {
    kind?: string;
    name?: { name?: string } | string;
    elementType?: unknown;
    inner?: unknown;
  };

  if (t.kind === 'SimpleType') {
    if (typeof t.name === 'string') return t.name;
    if (t.name && typeof t.name === 'object' && 'name' in t.name) {
      return t.name.name ?? null;
    }
  }

  // Array type - check element type
  if (t.kind === 'ArrayType' && t.elementType) {
    return extractReferencedType(t.elementType);
  }

  // Optional type - check inner type
  if (t.kind === 'OptionalType' && t.inner) {
    return extractReferencedType(t.inner);
  }

  return null;
}

function extractAllReferencedTypes(typeNode: unknown): Set<string> {
  const refs = new Set<string>();
  
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const t = node as {
      kind?: string;
      name?: { name?: string } | string;
      params?: unknown[];
      elementType?: unknown;
      inner?: unknown;
      types?: unknown[];
      fields?: Array<{ type?: unknown }>;
    };

    // Simple type reference
    if (t.kind === 'SimpleType') {
      const name = typeof t.name === 'string' ? t.name : t.name?.name;
      if (name) refs.add(name);
    }

    // Generic type parameters
    if (t.params) {
      for (const param of t.params) {
        walk(param);
      }
    }

    // Array element type
    if (t.elementType) {
      walk(t.elementType);
    }

    // Optional inner type
    if (t.inner) {
      walk(t.inner);
    }

    // Union types
    if (t.types) {
      for (const ut of t.types) {
        walk(ut);
      }
    }

    // Object/struct fields
    if (t.fields) {
      for (const field of t.fields) {
        walk(field.type);
      }
    }
  }

  walk(typeNode);
  return refs;
}

function extractTriggeredBehaviors(block: unknown): Set<string> {
  const triggers = new Set<string>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const n = node as {
      kind?: string;
      callee?: { name?: string; object?: { name?: string } };
      arguments?: unknown[];
    };

    // Look for trigger/emit/dispatch patterns
    if (n.kind === 'CallExpression') {
      const calleeName = n.callee?.name || n.callee?.object?.name;
      
      // Check for common trigger patterns
      if (calleeName === 'trigger' || calleeName === 'emit' || calleeName === 'dispatch') {
        // First argument is usually the behavior name
        if (n.arguments && n.arguments.length > 0) {
          const firstArg = n.arguments[0] as { value?: string; name?: string };
          if (firstArg.value) {
            triggers.add(firstArg.value);
          } else if (firstArg.name) {
            triggers.add(firstArg.name);
          }
        }
      }

      // Check for behavior.execute() patterns
      if (n.callee?.object?.name) {
        triggers.add(n.callee.object.name);
      }
    }

    // Recursively walk all properties
    for (const value of Object.values(node as object)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
      } else if (typeof value === 'object' && value !== null) {
        walk(value);
      }
    }
  }

  walk(block);
  return triggers;
}
