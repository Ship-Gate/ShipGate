/**
 * Cycle Detection
 * 
 * Detect circular dependencies in the dependency graph.
 */

import type { DependencyGraph, DependencyEdge } from './analyzer.js';

export interface Cycle {
  /** Nodes involved in the cycle */
  nodes: string[];
  /** Edges forming the cycle */
  edges: DependencyEdge[];
  /** Cycle type */
  type: 'domain' | 'entity' | 'type' | 'mixed';
  /** Human-readable description */
  description: string;
}

export interface CycleDetectionResult {
  /** Whether cycles were found */
  hasCycles: boolean;
  /** All detected cycles */
  cycles: Cycle[];
  /** Strongly connected components with size > 1 */
  stronglyConnected: string[][];
}

/**
 * Detect all cycles in the dependency graph
 */
export function detectCycles(graph: DependencyGraph): CycleDetectionResult {
  const cycles: Cycle[] = [];

  // Build adjacency list
  const adjacency = buildAdjacencyList(graph);

  // Find all strongly connected components using Tarjan's algorithm
  const sccs = findStronglyConnectedComponents(adjacency);

  // Filter SCCs with more than one node (these contain cycles)
  const cyclicSccs = sccs.filter((scc) => scc.length > 1);

  // Extract cycles from SCCs
  for (const scc of cyclicSccs) {
    const sccCycles = extractCyclesFromSCC(scc, graph);
    cycles.push(...sccCycles);
  }

  // Also detect simple cycles using DFS
  const simpleCycles = detectSimpleCycles(adjacency, graph);
  
  // Merge and deduplicate cycles
  const allCycles = mergeCycles(cycles, simpleCycles);

  return {
    hasCycles: allCycles.length > 0,
    cycles: allCycles,
    stronglyConnected: cyclicSccs,
  };
}

/**
 * Detect only domain-level cycles
 */
export function detectDomainCycles(graph: DependencyGraph): Cycle[] {
  const cycles: Cycle[] = [];

  // Build domain-only adjacency list
  const adjacency = new Map<string, Set<string>>();

  for (const [domainName, summary] of graph.domains) {
    const domainId = `domain:${domainName}`;
    adjacency.set(domainId, new Set());

    for (const imp of summary.imports) {
      adjacency.get(domainId)!.add(`domain:${imp}`);
    }
  }

  // Find cycles using DFS
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      // Found cycle
      const cycleStart = path.indexOf(node);
      const cycleNodes = path.slice(cycleStart);
      cycleNodes.push(node);

      const edges = graph.edges.filter(
        (e) =>
          cycleNodes.includes(e.from) &&
          cycleNodes.includes(e.to) &&
          e.from.startsWith('domain:') &&
          e.to.startsWith('domain:')
      );

      cycles.push({
        nodes: cycleNodes,
        edges,
        type: 'domain',
        description: `Domain cycle: ${cycleNodes.map((n) => n.replace('domain:', '')).join(' -> ')}`,
      });
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    const neighbors = adjacency.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, node]);
    }

    stack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Build adjacency list from graph
 */
function buildAdjacencyList(graph: DependencyGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const nodeId of graph.nodes.keys()) {
    adjacency.set(nodeId, new Set());
  }

  // Add edges
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Set());
    }
    adjacency.get(edge.from)!.add(edge.to);
  }

  return adjacency;
}

/**
 * Tarjan's algorithm for finding strongly connected components
 */
function findStronglyConnectedComponents(
  adjacency: Map<string, Set<string>>
): string[][] {
  const sccs: string[][] = [];
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let currentIndex = 0;

  function strongConnect(v: string): void {
    index.set(v, currentIndex);
    lowlink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjacency.get(v) ?? new Set();
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const v of adjacency.keys()) {
    if (!index.has(v)) {
      strongConnect(v);
    }
  }

  return sccs;
}

/**
 * Extract individual cycles from a strongly connected component
 */
function extractCyclesFromSCC(scc: string[], graph: DependencyGraph): Cycle[] {
  const cycles: Cycle[] = [];

  // Build subgraph for SCC
  const sccSet = new Set(scc);
  const edges = graph.edges.filter(
    (e) => sccSet.has(e.from) && sccSet.has(e.to)
  );

  // Find a simple cycle through all nodes
  const cycleType = determineCycleType(scc);
  const description = generateCycleDescription(scc, cycleType);

  cycles.push({
    nodes: scc,
    edges,
    type: cycleType,
    description,
  });

  return cycles;
}

/**
 * Detect simple cycles using DFS
 */
function detectSimpleCycles(
  adjacency: Map<string, Set<string>>,
  graph: DependencyGraph
): Cycle[] {
  const cycles: Cycle[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adjacency.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStart);
        cycleNodes.push(neighbor);

        const edges = graph.edges.filter(
          (e) =>
            cycleNodes.includes(e.from) &&
            cycleNodes.includes(e.to)
        );

        const cycleType = determineCycleType(cycleNodes);

        cycles.push({
          nodes: cycleNodes,
          edges,
          type: cycleType,
          description: generateCycleDescription(cycleNodes, cycleType),
        });
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Determine the type of a cycle based on its nodes
 */
function determineCycleType(nodes: string[]): 'domain' | 'entity' | 'type' | 'mixed' {
  const types = new Set(nodes.map((n) => {
    if (n.startsWith('domain:')) return 'domain';
    if (n.includes(':entity:')) return 'entity';
    if (n.includes(':type:') || n.includes(':enum:')) return 'type';
    return 'other';
  }));

  if (types.size === 1) {
    const type = types.values().next().value;
    if (type === 'domain') return 'domain';
    if (type === 'entity') return 'entity';
    if (type === 'type') return 'type';
  }

  return 'mixed';
}

/**
 * Generate human-readable cycle description
 */
function generateCycleDescription(nodes: string[], type: string): string {
  const names = nodes.map((n) => {
    const parts = n.split(':');
    return parts[parts.length - 1];
  });

  const uniqueNames = names.slice(0, -1); // Remove duplicate end node
  return `${type.charAt(0).toUpperCase() + type.slice(1)} cycle: ${uniqueNames.join(' -> ')} -> ${uniqueNames[0]}`;
}

/**
 * Merge and deduplicate cycles
 */
function mergeCycles(cycles1: Cycle[], cycles2: Cycle[]): Cycle[] {
  const seen = new Set<string>();
  const result: Cycle[] = [];

  for (const cycle of [...cycles1, ...cycles2]) {
    // Normalize cycle for comparison (sort nodes)
    const normalized = [...cycle.nodes].sort().join(',');
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(cycle);
    }
  }

  return result;
}

/**
 * Get cycle severity based on type and size
 */
export function getCycleSeverity(cycle: Cycle): 'low' | 'medium' | 'high' | 'critical' {
  // Domain cycles are most severe
  if (cycle.type === 'domain') {
    return cycle.nodes.length > 3 ? 'critical' : 'high';
  }

  // Entity cycles are medium severity
  if (cycle.type === 'entity') {
    return cycle.nodes.length > 3 ? 'high' : 'medium';
  }

  // Type cycles are lower severity
  if (cycle.type === 'type') {
    return cycle.nodes.length > 5 ? 'medium' : 'low';
  }

  // Mixed cycles depend on size
  return cycle.nodes.length > 4 ? 'high' : 'medium';
}

/**
 * Suggest how to break a cycle
 */
export function suggestCycleFix(cycle: Cycle): string[] {
  const suggestions: string[] = [];

  if (cycle.type === 'domain') {
    suggestions.push('Consider extracting shared types to a common domain');
    suggestions.push('Use interface/protocol domains to break direct dependencies');
    suggestions.push('Evaluate if one domain should merge into another');
  }

  if (cycle.type === 'entity') {
    suggestions.push('Use ID references instead of direct entity references');
    suggestions.push('Extract shared fields to a separate type');
    suggestions.push('Consider using a join entity for many-to-many relationships');
  }

  if (cycle.type === 'type') {
    suggestions.push('Use forward declarations or type aliases');
    suggestions.push('Extract common base type');
  }

  // Find the weakest link (edge with fewest other connections)
  if (cycle.edges.length > 0) {
    suggestions.push(`Consider removing the dependency: ${cycle.edges[0]?.from} -> ${cycle.edges[0]?.to}`);
  }

  return suggestions;
}
