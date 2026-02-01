// ============================================================================
// Auto-Layout Algorithm
// ============================================================================

import type { ISLNode, ISLEdge, LayoutOptions } from '@/types';

const DEFAULT_OPTIONS: LayoutOptions = {
  direction: 'TB',
  nodeSpacing: 50,
  levelSpacing: 100,
};

interface NodeWithLevel {
  node: ISLNode;
  level: number;
  order: number;
}

/**
 * Apply auto-layout to nodes based on their relationships
 */
export function applyAutoLayout(
  nodes: ISLNode[],
  edges: ISLEdge[],
  options: Partial<LayoutOptions> = {}
): ISLNode[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (nodes.length === 0) return nodes;
  
  // Build adjacency map
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }
  
  // Assign levels using topological sort
  const levels = assignLevels(nodes, incoming);
  
  // Group nodes by level
  const levelGroups = new Map<number, ISLNode[]>();
  for (const [nodeId, level] of levels) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) levelGroups.get(level)!.push(node);
  }
  
  // Calculate positions
  const nodeWidth = 200;
  const nodeHeight = 150;
  const positioned = new Map<string, { x: number; y: number }>();
  
  const maxLevel = Math.max(...levels.values());
  
  for (let level = 0; level <= maxLevel; level++) {
    const nodesAtLevel = levelGroups.get(level) || [];
    const totalWidth = nodesAtLevel.length * (nodeWidth + opts.nodeSpacing) - opts.nodeSpacing;
    const startX = -totalWidth / 2;
    
    nodesAtLevel.forEach((node, index) => {
      const x = startX + index * (nodeWidth + opts.nodeSpacing);
      const y = level * (nodeHeight + opts.levelSpacing);
      
      if (opts.direction === 'LR') {
        positioned.set(node.id, { x: y, y: x });
      } else {
        positioned.set(node.id, { x, y });
      }
    });
  }
  
  // Apply positions to nodes
  return nodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) || node.position,
  }));
}

/**
 * Assign levels to nodes using modified Coffman-Graham algorithm
 */
function assignLevels(
  nodes: ISLNode[],
  incoming: Map<string, string[]>
): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  // Find root nodes (no incoming edges)
  const roots = nodes.filter(
    (n) => !incoming.has(n.id) || incoming.get(n.id)!.length === 0
  );
  
  // BFS from roots
  const queue: Array<{ id: string; level: number }> = roots.map((n) => ({
    id: n.id,
    level: 0,
  }));
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    
    if (visited.has(id)) {
      // Update level if we found a longer path
      if (levels.get(id)! < level) {
        levels.set(id, level);
      }
      continue;
    }
    
    visited.add(id);
    levels.set(id, level);
    
    // Add children
    const children = nodes.filter((n) => {
      const parents = incoming.get(n.id) || [];
      return parents.includes(id);
    });
    
    for (const child of children) {
      queue.push({ id: child.id, level: level + 1 });
    }
  }
  
  // Handle disconnected nodes
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  }
  
  return levels;
}

/**
 * Calculate optimal positions minimizing edge crossings
 */
export function minimizeEdgeCrossings(
  nodes: ISLNode[],
  edges: ISLEdge[]
): ISLNode[] {
  // Simple barycenter heuristic
  const nodePositions = new Map<string, { level: number; order: number }>();
  
  // Initialize positions
  nodes.forEach((node, index) => {
    nodePositions.set(node.id, { level: 0, order: index });
  });
  
  // Iterate to minimize crossings
  for (let iteration = 0; iteration < 10; iteration++) {
    for (const node of nodes) {
      const pos = nodePositions.get(node.id)!;
      const neighbors = edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => nodePositions.get(id)?.order || 0);
      
      if (neighbors.length > 0) {
        const avgOrder = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        pos.order = avgOrder;
      }
    }
    
    // Re-order nodes
    nodes.sort((a, b) => {
      const aPos = nodePositions.get(a.id)!;
      const bPos = nodePositions.get(b.id)!;
      return aPos.order - bPos.order;
    });
    
    // Update orders
    nodes.forEach((node, index) => {
      nodePositions.get(node.id)!.order = index;
    });
  }
  
  return nodes;
}

/**
 * Center the graph in the viewport
 */
export function centerGraph(nodes: ISLNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxY = Math.max(...nodes.map((n) => n.position.y));
  
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}
