/**
 * Impact Analysis
 * 
 * Analyze the impact of changes to ISL specifications.
 */

import type { DependencyGraph, DependencyNode } from './analyzer.js';

export type ChangeType = 
  | 'add'
  | 'remove'
  | 'modify'
  | 'rename'
  | 'type_change'
  | 'constraint_change';

export interface ImpactNode {
  /** Node ID */
  id: string;
  /** Node type */
  type: DependencyNode['type'];
  /** Node name */
  name: string;
  /** Domain the node belongs to */
  domain: string;
  /** Impact level */
  impactLevel: 'direct' | 'indirect' | 'potential';
  /** Distance from changed node */
  distance: number;
  /** Why this node is impacted */
  reason: string;
  /** Specific impacts on this node */
  impacts: ImpactDetail[];
}

export interface ImpactDetail {
  /** Type of impact */
  type: 'breaking' | 'behavioral' | 'cosmetic';
  /** Description */
  description: string;
  /** Affected aspect (field, parameter, etc.) */
  aspect?: string;
}

export interface ImpactAnalysis {
  /** The changed node */
  changedNode: string;
  /** Type of change */
  changeType: ChangeType;
  /** All impacted nodes */
  impactedNodes: ImpactNode[];
  /** Summary statistics */
  summary: ImpactSummary;
  /** Recommendations */
  recommendations: string[];
}

export interface ImpactSummary {
  /** Total nodes impacted */
  totalImpacted: number;
  /** Directly impacted nodes */
  directlyImpacted: number;
  /** Indirectly impacted nodes */
  indirectlyImpacted: number;
  /** Potentially impacted nodes */
  potentiallyImpacted: number;
  /** Domains impacted */
  domainsImpacted: string[];
  /** Breaking changes count */
  breakingChanges: number;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Analyze impact of a change to a node
 */
export function analyzeImpact(
  graph: DependencyGraph,
  nodeId: string,
  changeType: ChangeType
): ImpactAnalysis {
  const changedNode = graph.nodes.get(nodeId);
  
  if (!changedNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const impactedNodes: ImpactNode[] = [];
  const visited = new Set<string>();
  const domainsImpacted = new Set<string>();

  // Find direct dependents (distance 1)
  const directDependents = findDependents(graph, nodeId);
  
  for (const dependent of directDependents) {
    const node = graph.nodes.get(dependent);
    if (!node) continue;

    visited.add(dependent);
    domainsImpacted.add(node.domain);

    const impacts = calculateImpacts(changeType, changedNode, node, graph);
    
    impactedNodes.push({
      id: dependent,
      type: node.type,
      name: node.name,
      domain: node.domain,
      impactLevel: 'direct',
      distance: 1,
      reason: `Directly depends on ${changedNode.name}`,
      impacts,
    });
  }

  // Find indirect dependents (distance 2+)
  const queue: Array<{ id: string; distance: number }> = directDependents.map((id) => ({
    id,
    distance: 1,
  }));

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;
    
    const indirectDependents = findDependents(graph, id);
    
    for (const dependent of indirectDependents) {
      if (visited.has(dependent)) continue;
      
      const node = graph.nodes.get(dependent);
      if (!node) continue;

      visited.add(dependent);
      domainsImpacted.add(node.domain);

      const newDistance = distance + 1;
      const impacts = calculateIndirectImpacts(changeType, node, newDistance);
      
      impactedNodes.push({
        id: dependent,
        type: node.type,
        name: node.name,
        domain: node.domain,
        impactLevel: newDistance <= 2 ? 'indirect' : 'potential',
        distance: newDistance,
        reason: `Transitively depends on ${changedNode.name} (${newDistance} hops)`,
        impacts,
      });

      // Only continue if within reasonable distance
      if (newDistance < 5) {
        queue.push({ id: dependent, distance: newDistance });
      }
    }
  }

  // Calculate summary
  const breakingChanges = impactedNodes.reduce(
    (count, node) => count + node.impacts.filter((i) => i.type === 'breaking').length,
    0
  );

  const summary: ImpactSummary = {
    totalImpacted: impactedNodes.length,
    directlyImpacted: impactedNodes.filter((n) => n.impactLevel === 'direct').length,
    indirectlyImpacted: impactedNodes.filter((n) => n.impactLevel === 'indirect').length,
    potentiallyImpacted: impactedNodes.filter((n) => n.impactLevel === 'potential').length,
    domainsImpacted: Array.from(domainsImpacted),
    breakingChanges,
    riskLevel: calculateRiskLevel(impactedNodes, breakingChanges, domainsImpacted.size),
  };

  // Generate recommendations
  const recommendations = generateRecommendations(
    changeType,
    changedNode,
    impactedNodes,
    summary
  );

  return {
    changedNode: nodeId,
    changeType,
    impactedNodes,
    summary,
    recommendations,
  };
}

/**
 * Analyze impact of removing a node
 */
export function analyzeRemovalImpact(
  graph: DependencyGraph,
  nodeId: string
): ImpactAnalysis {
  return analyzeImpact(graph, nodeId, 'remove');
}

/**
 * Analyze impact of modifying a type
 */
export function analyzeTypeChangeImpact(
  graph: DependencyGraph,
  nodeId: string
): ImpactAnalysis {
  return analyzeImpact(graph, nodeId, 'type_change');
}

/**
 * Find all nodes that depend on a given node
 */
function findDependents(graph: DependencyGraph, nodeId: string): string[] {
  const dependents: string[] = [];
  
  for (const edge of graph.edges) {
    if (edge.to === nodeId) {
      dependents.push(edge.from);
    }
  }

  return dependents;
}

/**
 * Calculate specific impacts on a directly dependent node
 */
function calculateImpacts(
  changeType: ChangeType,
  changedNode: DependencyNode,
  dependentNode: DependencyNode,
  _graph: DependencyGraph
): ImpactDetail[] {
  const impacts: ImpactDetail[] = [];

  switch (changeType) {
    case 'remove':
      impacts.push({
        type: 'breaking',
        description: `${changedNode.name} will no longer exist`,
        aspect: 'reference',
      });
      break;

    case 'rename':
      impacts.push({
        type: 'breaking',
        description: `Reference to ${changedNode.name} will be invalid`,
        aspect: 'import',
      });
      break;

    case 'type_change':
      impacts.push({
        type: 'breaking',
        description: `Type of ${changedNode.name} changed, may cause type errors`,
        aspect: 'type',
      });
      break;

    case 'modify':
      if (dependentNode.type === 'behavior') {
        impacts.push({
          type: 'behavioral',
          description: `Behavior ${dependentNode.name} may need updates`,
          aspect: 'implementation',
        });
      } else {
        impacts.push({
          type: 'behavioral',
          description: `May affect validation or processing logic`,
          aspect: 'logic',
        });
      }
      break;

    case 'constraint_change':
      impacts.push({
        type: 'behavioral',
        description: `Constraint changes may affect validation`,
        aspect: 'validation',
      });
      break;

    case 'add':
      impacts.push({
        type: 'cosmetic',
        description: `New functionality available`,
        aspect: 'feature',
      });
      break;
  }

  return impacts;
}

/**
 * Calculate impacts for indirectly dependent nodes
 */
function calculateIndirectImpacts(
  changeType: ChangeType,
  _node: DependencyNode,
  distance: number
): ImpactDetail[] {
  const impacts: ImpactDetail[] = [];

  if (changeType === 'remove' || changeType === 'rename') {
    impacts.push({
      type: distance <= 2 ? 'breaking' : 'behavioral',
      description: `Transitively affected by change`,
      aspect: 'dependency',
    });
  } else if (changeType === 'type_change') {
    impacts.push({
      type: distance <= 2 ? 'behavioral' : 'cosmetic',
      description: `May need type updates`,
      aspect: 'type',
    });
  } else {
    impacts.push({
      type: 'cosmetic',
      description: `May be affected by change`,
      aspect: 'indirect',
    });
  }

  return impacts;
}

/**
 * Calculate overall risk level
 */
function calculateRiskLevel(
  impactedNodes: ImpactNode[],
  breakingChanges: number,
  domainsCount: number
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: many breaking changes across multiple domains
  if (breakingChanges > 10 || (breakingChanges > 5 && domainsCount > 2)) {
    return 'critical';
  }

  // High: multiple breaking changes or many domains
  if (breakingChanges > 3 || domainsCount > 3) {
    return 'high';
  }

  // Medium: some breaking changes or multiple nodes
  if (breakingChanges > 0 || impactedNodes.length > 5) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate recommendations based on impact analysis
 */
function generateRecommendations(
  changeType: ChangeType,
  changedNode: DependencyNode,
  impactedNodes: ImpactNode[],
  summary: ImpactSummary
): string[] {
  const recommendations: string[] = [];

  // Risk-based recommendations
  if (summary.riskLevel === 'critical') {
    recommendations.push('Consider breaking this change into smaller, incremental changes');
    recommendations.push('Create a detailed migration plan before proceeding');
    recommendations.push('Notify all affected domain owners');
  }

  if (summary.riskLevel === 'high') {
    recommendations.push('Review all directly impacted nodes before making changes');
    recommendations.push('Add tests for affected behaviors');
  }

  // Change-type specific recommendations
  if (changeType === 'remove') {
    recommendations.push('Mark as deprecated first, then remove after migration period');
    if (impactedNodes.length > 0) {
      recommendations.push(`Update ${impactedNodes.length} dependent ${impactedNodes.length === 1 ? 'node' : 'nodes'} before removal`);
    }
  }

  if (changeType === 'rename') {
    recommendations.push('Update all imports and references in dependent domains');
    recommendations.push('Consider using type aliases during transition');
  }

  if (changeType === 'type_change') {
    recommendations.push('Ensure type compatibility or provide migration path');
    recommendations.push('Update generated code in all affected packages');
  }

  // Domain-specific recommendations
  if (summary.domainsImpacted.length > 1) {
    recommendations.push('Coordinate with owners of: ' + summary.domainsImpacted.join(', '));
  }

  // Node-type specific recommendations
  if (changedNode.type === 'entity') {
    recommendations.push('Update database schema if entity structure changed');
    recommendations.push('Regenerate types and validation code');
  }

  if (changedNode.type === 'behavior') {
    recommendations.push('Update API documentation');
    recommendations.push('Regenerate client SDKs');
  }

  return recommendations;
}

/**
 * Compare two versions of a graph to find all changes
 */
export function compareGraphs(
  oldGraph: DependencyGraph,
  newGraph: DependencyGraph
): Array<{ nodeId: string; changeType: ChangeType }> {
  const changes: Array<{ nodeId: string; changeType: ChangeType }> = [];

  // Find removed nodes
  for (const [nodeId] of oldGraph.nodes) {
    if (!newGraph.nodes.has(nodeId)) {
      changes.push({ nodeId, changeType: 'remove' });
    }
  }

  // Find added nodes
  for (const [nodeId] of newGraph.nodes) {
    if (!oldGraph.nodes.has(nodeId)) {
      changes.push({ nodeId, changeType: 'add' });
    }
  }

  // Find modified nodes (simplified - just checks if node exists in both)
  for (const [nodeId, newNode] of newGraph.nodes) {
    const oldNode = oldGraph.nodes.get(nodeId);
    if (oldNode) {
      // Check for name change (would create different ID, but metadata might differ)
      if (JSON.stringify(oldNode.metadata) !== JSON.stringify(newNode.metadata)) {
        changes.push({ nodeId, changeType: 'modify' });
      }
    }
  }

  return changes;
}
