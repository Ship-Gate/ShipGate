/**
 * Claim graph integration for mock detector
 * 
 * Integrates mock findings into the claim graph system with confidence scoring.
 */

import type { MockFinding, MockClaim } from './types.js';
import { findingToClaim, createMockClaim } from './claims.js';
import type { Claim } from '@isl-lang/claims-verifier';

/**
 * Node in the claim graph
 */
export interface ClaimGraphNode {
  /** Node ID */
  id: string;
  /** Claim associated with this node */
  claim: Claim;
  /** Mock finding that generated this claim */
  finding: MockFinding;
  /** Confidence level */
  confidence: number;
  /** Dependencies (other claim IDs this depends on) */
  dependencies: string[];
}

/**
 * Edge in the claim graph
 */
export interface ClaimGraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Relationship type */
  type: 'depends_on' | 'contradicts' | 'supports';
  /** Confidence in this relationship */
  confidence: number;
}

/**
 * Claim graph structure
 */
export interface ClaimGraph {
  /** Nodes in the graph */
  nodes: ClaimGraphNode[];
  /** Edges in the graph */
  edges: ClaimGraphEdge[];
  /** Metadata */
  metadata: {
    /** Total findings */
    totalFindings: number;
    /** Average confidence */
    averageConfidence: number;
    /** Generated at */
    generatedAt: Date;
  };
}

/**
 * Build a claim graph from mock findings
 */
export function buildClaimGraph(findings: MockFinding[]): ClaimGraph {
  const nodes: ClaimGraphNode[] = [];
  const edges: ClaimGraphEdge[] = [];

  // Create nodes from findings
  for (const finding of findings) {
    const claim = findingToClaim(finding);
    const mockClaim = createMockClaim(finding);

    const node: ClaimGraphNode = {
      id: finding.id,
      claim,
      finding,
      confidence: finding.confidence,
      dependencies: [],
    };

    nodes.push(node);

    // Create edges based on relationships
    // For example, if two findings are in the same file, they might be related
    for (const otherFinding of findings) {
      if (otherFinding.id === finding.id) continue;

      // Same file = potential dependency
      if (otherFinding.location.file === finding.location.file) {
        const edge: ClaimGraphEdge = {
          from: finding.id,
          to: otherFinding.id,
          type: 'depends_on',
          confidence: 0.5,
        };
        edges.push(edge);
        node.dependencies.push(otherFinding.id);
      }

      // Same type = supports relationship
      if (otherFinding.type === finding.type) {
        const edge: ClaimGraphEdge = {
          from: finding.id,
          to: otherFinding.id,
          type: 'supports',
          confidence: 0.6,
        };
        edges.push(edge);
      }
    }
  }

  // Calculate metadata
  const averageConfidence =
    nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length
      : 0;

  return {
    nodes,
    edges,
    metadata: {
      totalFindings: findings.length,
      averageConfidence,
      generatedAt: new Date(),
    },
  };
}

/**
 * Add mock findings to an existing claim graph
 */
export function addToClaimGraph(
  graph: ClaimGraph,
  findings: MockFinding[]
): ClaimGraph {
  const newNodes: ClaimGraphNode[] = [];
  const newEdges: ClaimGraphEdge[] = [];

  // Create nodes for new findings
  for (const finding of findings) {
    // Check if node already exists
    if (graph.nodes.some(n => n.id === finding.id)) {
      continue;
    }

    const claim = findingToClaim(finding);
    const node: ClaimGraphNode = {
      id: finding.id,
      claim,
      finding,
      confidence: finding.confidence,
      dependencies: [],
    };

    newNodes.push(node);

    // Create edges to existing nodes
    for (const existingNode of graph.nodes) {
      // Same file relationship
      if (existingNode.finding.location.file === finding.location.file) {
        const edge: ClaimGraphEdge = {
          from: finding.id,
          to: existingNode.id,
          type: 'depends_on',
          confidence: 0.5,
        };
        newEdges.push(edge);
        node.dependencies.push(existingNode.id);
      }
    }
  }

  // Merge with existing graph
  return {
    nodes: [...graph.nodes, ...newNodes],
    edges: [...graph.edges, ...newEdges],
    metadata: {
      totalFindings: graph.nodes.length + newNodes.length,
      averageConfidence:
        [...graph.nodes, ...newNodes].reduce(
          (sum, n) => sum + n.confidence,
          0
        ) / (graph.nodes.length + newNodes.length),
      generatedAt: new Date(),
    },
  };
}

/**
 * Get claim graph summary
 */
export function getClaimGraphSummary(graph: ClaimGraph): {
  totalNodes: number;
  totalEdges: number;
  averageConfidence: number;
  findingsByType: Record<string, number>;
} {
  const findingsByType: Record<string, number> = {};

  for (const node of graph.nodes) {
    findingsByType[node.finding.type] =
      (findingsByType[node.finding.type] || 0) + 1;
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    averageConfidence: graph.metadata.averageConfidence,
    findingsByType,
  };
}
