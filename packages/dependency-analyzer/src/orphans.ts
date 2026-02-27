/**
 * Orphan Detection
 * 
 * Find unused domains, entities, behaviors, and types.
 */

import type { DependencyGraph, DependencyNode } from './analyzer.js';

export interface OrphanEntity {
  /** Entity ID */
  id: string;
  /** Entity name */
  name: string;
  /** Domain */
  domain: string;
  /** Reason for being orphaned */
  reason: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

export interface OrphanBehavior {
  /** Behavior ID */
  id: string;
  /** Behavior name */
  name: string;
  /** Domain */
  domain: string;
  /** Reason for being orphaned */
  reason: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

export interface OrphanType {
  /** Type ID */
  id: string;
  /** Type name */
  name: string;
  /** Domain */
  domain: string;
  /** Type kind (type/enum) */
  kind: 'type' | 'enum';
  /** Reason for being orphaned */
  reason: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

export interface OrphanAnalysis {
  /** Orphaned entities */
  entities: OrphanEntity[];
  /** Orphaned behaviors */
  behaviors: OrphanBehavior[];
  /** Orphaned types */
  types: OrphanType[];
  /** Domains with no imports or dependents */
  isolatedDomains: string[];
  /** Summary */
  summary: OrphanSummary;
}

export interface OrphanSummary {
  /** Total orphans found */
  total: number;
  /** By type */
  byType: {
    entities: number;
    behaviors: number;
    types: number;
    domains: number;
  };
  /** By confidence */
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Find all orphaned/unused specifications
 */
export function findOrphans(graph: DependencyGraph): OrphanAnalysis {
  const entities: OrphanEntity[] = [];
  const behaviors: OrphanBehavior[] = [];
  const types: OrphanType[] = [];
  const isolatedDomains: string[] = [];

  // Build reverse dependency map
  const dependents = buildDependentsMap(graph);

  // Find orphaned entities
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'entity') continue;

    const deps = dependents.get(nodeId) ?? [];
    const analysis = analyzeEntityOrphanStatus(node, deps, graph);

    if (analysis.isOrphan) {
      entities.push({
        id: nodeId,
        name: node.name,
        domain: node.domain,
        reason: analysis.reason,
        confidence: analysis.confidence,
      });
    }
  }

  // Find orphaned behaviors
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'behavior') continue;

    const deps = dependents.get(nodeId) ?? [];
    const analysis = analyzeBehaviorOrphanStatus(node, deps, graph);

    if (analysis.isOrphan) {
      behaviors.push({
        id: nodeId,
        name: node.name,
        domain: node.domain,
        reason: analysis.reason,
        confidence: analysis.confidence,
      });
    }
  }

  // Find orphaned types
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'type' && node.type !== 'enum') continue;

    const deps = dependents.get(nodeId) ?? [];
    const analysis = analyzeTypeOrphanStatus(node, deps, graph);

    if (analysis.isOrphan) {
      types.push({
        id: nodeId,
        name: node.name,
        domain: node.domain,
        kind: node.type === 'enum' ? 'enum' : 'type',
        reason: analysis.reason,
        confidence: analysis.confidence,
      });
    }
  }

  // Find isolated domains
  for (const [domainName, summary] of graph.domains) {
    if (summary.imports.length === 0 && summary.importedBy.length === 0) {
      // Check if domain has any external usage
      const hasExternalUsage = checkExternalUsage(domainName, graph);
      if (!hasExternalUsage) {
        isolatedDomains.push(domainName);
      }
    }
  }

  // Calculate summary
  const allOrphans = [...entities, ...behaviors, ...types];
  const summary: OrphanSummary = {
    total: allOrphans.length + isolatedDomains.length,
    byType: {
      entities: entities.length,
      behaviors: behaviors.length,
      types: types.length,
      domains: isolatedDomains.length,
    },
    byConfidence: {
      high: allOrphans.filter((o) => o.confidence === 'high').length,
      medium: allOrphans.filter((o) => o.confidence === 'medium').length,
      low: allOrphans.filter((o) => o.confidence === 'low').length,
    },
  };

  return {
    entities,
    behaviors,
    types,
    isolatedDomains,
    summary,
  };
}

/**
 * Find entities that are never used as output types
 */
export function findUnusedOutputEntities(graph: DependencyGraph): OrphanEntity[] {
  const orphans: OrphanEntity[] = [];
  const usedAsOutput = new Set<string>();

  // Find all entities used as behavior outputs
  for (const edge of graph.edges) {
    if (edge.label?.startsWith('output:')) {
      usedAsOutput.add(edge.to);
    }
  }

  // Find entities not used as output
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'entity') continue;

    if (!usedAsOutput.has(nodeId)) {
      // Check if it's used anywhere else
      const dependents = graph.edges.filter((e) => e.to === nodeId);
      
      if (dependents.length === 0) {
        orphans.push({
          id: nodeId,
          name: node.name,
          domain: node.domain,
          reason: 'Entity is never used as a behavior output',
          confidence: 'high',
        });
      } else {
        orphans.push({
          id: nodeId,
          name: node.name,
          domain: node.domain,
          reason: 'Entity is referenced but never returned from behaviors',
          confidence: 'low',
        });
      }
    }
  }

  return orphans;
}

/**
 * Find behaviors that are never composed
 */
export function findUncomposedBehaviors(graph: DependencyGraph): OrphanBehavior[] {
  const orphans: OrphanBehavior[] = [];

  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'behavior') continue;

    // Check if behavior is referenced by other behaviors (composition)
    const composedIn = graph.edges.filter(
      (e) => e.to === nodeId && e.from.includes(':behavior:')
    );

    if (composedIn.length === 0) {
      orphans.push({
        id: nodeId,
        name: node.name,
        domain: node.domain,
        reason: 'Behavior is not composed into any other behavior',
        confidence: 'low', // Low because behaviors are often entry points
      });
    }
  }

  return orphans;
}

/**
 * Build a map of nodes to their dependents
 */
function buildDependentsMap(graph: DependencyGraph): Map<string, string[]> {
  const dependents = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (!dependents.has(edge.to)) {
      dependents.set(edge.to, []);
    }
    dependents.get(edge.to)!.push(edge.from);
  }

  return dependents;
}

/**
 * Analyze if an entity is orphaned
 */
function analyzeEntityOrphanStatus(
  node: DependencyNode,
  dependents: string[],
  graph: DependencyGraph
): { isOrphan: boolean; reason: string; confidence: 'low' | 'medium' | 'high' } {
  // No dependents at all
  if (dependents.length === 0) {
    return {
      isOrphan: true,
      reason: 'Entity has no references from other entities, behaviors, or types',
      confidence: 'high',
    };
  }

  // Only self-references within same domain
  const externalDeps = dependents.filter((d) => {
    const depNode = graph.nodes.get(d);
    return depNode && depNode.domain !== node.domain;
  });

  if (externalDeps.length === 0 && dependents.length < 2) {
    return {
      isOrphan: true,
      reason: 'Entity is only referenced within its own domain with minimal usage',
      confidence: 'medium',
    };
  }

  return { isOrphan: false, reason: '', confidence: 'low' };
}

/**
 * Analyze if a behavior is orphaned
 */
function analyzeBehaviorOrphanStatus(
  node: DependencyNode,
  _dependents: string[],
  _graph: DependencyGraph
): { isOrphan: boolean; reason: string; confidence: 'low' | 'medium' | 'high' } {
  // Behaviors are often entry points, so having no dependents is normal
  // Check for other indicators of being unused

  const metadata = node.metadata as {
    hasInput?: boolean;
    hasOutput?: boolean;
    hasPreconditions?: boolean;
    hasPostconditions?: boolean;
  } | undefined;

  // Empty behavior (no input, no output)
  if (metadata && !metadata.hasInput && !metadata.hasOutput) {
    return {
      isOrphan: true,
      reason: 'Behavior has no input or output definitions',
      confidence: 'high',
    };
  }

  // Behavior with no conditions (might be placeholder)
  if (metadata && !metadata.hasPreconditions && !metadata.hasPostconditions) {
    return {
      isOrphan: true,
      reason: 'Behavior has no preconditions or postconditions defined',
      confidence: 'medium',
    };
  }

  return { isOrphan: false, reason: '', confidence: 'low' };
}

/**
 * Analyze if a type is orphaned
 */
function analyzeTypeOrphanStatus(
  node: DependencyNode,
  dependents: string[],
  _graph: DependencyGraph
): { isOrphan: boolean; reason: string; confidence: 'low' | 'medium' | 'high' } {
  // No dependents
  if (dependents.length === 0) {
    return {
      isOrphan: true,
      reason: `${node.type === 'enum' ? 'Enum' : 'Type'} is never referenced`,
      confidence: 'high',
    };
  }

  // Only referenced by same entity/type (likely internal)
  const externalDeps = dependents.filter((d) => !d.startsWith(node.domain));
  
  if (externalDeps.length === 0 && dependents.length === 1) {
    return {
      isOrphan: true,
      reason: `${node.type === 'enum' ? 'Enum' : 'Type'} has only one internal reference`,
      confidence: 'low',
    };
  }

  return { isOrphan: false, reason: '', confidence: 'low' };
}

/**
 * Check if a domain has external usage (outside the graph)
 */
function checkExternalUsage(domainName: string, graph: DependencyGraph): boolean {
  // In a real implementation, this would check if the domain
  // is used in code files, APIs, etc.
  // For now, we just check if it has any entities/behaviors
  
  const summary = graph.domains.get(domainName);
  if (!summary) return false;

  // Domains with behaviors are likely used externally
  if (summary.behaviors.length > 0) {
    return true;
  }

  return false;
}

/**
 * Suggest cleanup actions for orphans
 */
export function suggestCleanup(analysis: OrphanAnalysis): string[] {
  const suggestions: string[] = [];

  // High confidence orphans
  const highConfidence = [
    ...analysis.entities.filter((e) => e.confidence === 'high'),
    ...analysis.behaviors.filter((b) => b.confidence === 'high'),
    ...analysis.types.filter((t) => t.confidence === 'high'),
  ];

  if (highConfidence.length > 0) {
    suggestions.push(`Remove ${highConfidence.length} unused specification(s) with high confidence`);
    
    for (const orphan of highConfidence.slice(0, 5)) {
      suggestions.push(`  - Remove ${orphan.name} (${orphan.reason})`);
    }
    
    if (highConfidence.length > 5) {
      suggestions.push(`  - ... and ${highConfidence.length - 5} more`);
    }
  }

  // Isolated domains
  if (analysis.isolatedDomains.length > 0) {
    suggestions.push(`Review ${analysis.isolatedDomains.length} isolated domain(s):`);
    for (const domain of analysis.isolatedDomains) {
      suggestions.push(`  - ${domain}: No imports or dependents`);
    }
  }

  // Medium confidence - suggest review
  const mediumConfidence = [
    ...analysis.entities.filter((e) => e.confidence === 'medium'),
    ...analysis.behaviors.filter((b) => b.confidence === 'medium'),
    ...analysis.types.filter((t) => t.confidence === 'medium'),
  ];

  if (mediumConfidence.length > 0) {
    suggestions.push(`Review ${mediumConfidence.length} potentially unused specification(s)`);
  }

  return suggestions;
}
