/**
 * Dependency Graph Visualizer
 * 
 * Generate diagrams in Mermaid, D2, and DOT formats.
 */

import type { DependencyGraph, DependencyNode, DependencyEdge } from './analyzer.js';
import type { Cycle } from './cycles.js';

export type DiagramFormat = 'mermaid' | 'd2' | 'dot';

export interface VisualizationOptions {
  /** Diagram format */
  format: DiagramFormat;
  /** Include only specific node types */
  nodeTypes?: Array<DependencyNode['type']>;
  /** Include only specific domains */
  domains?: string[];
  /** Show edge labels */
  showLabels?: boolean;
  /** Group nodes by domain */
  groupByDomain?: boolean;
  /** Highlight specific nodes */
  highlight?: string[];
  /** Highlight cycles */
  highlightCycles?: Cycle[];
  /** Direction (for supported formats) */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Custom node colors by type */
  colors?: Record<string, string>;
  /** Max nodes to display */
  maxNodes?: number;
}

const DEFAULT_COLORS: Record<string, string> = {
  domain: '#4A90D9',
  entity: '#50C878',
  behavior: '#FFB347',
  type: '#DDA0DD',
  enum: '#87CEEB',
};

/**
 * Generate a Mermaid diagram
 */
export function generateMermaid(
  graph: DependencyGraph,
  options: Partial<VisualizationOptions> = {}
): string {
  const opts = resolveOptions({ ...options, format: 'mermaid' });
  const { nodes, edges } = filterGraph(graph, opts);
  const lines: string[] = [];

  // Header
  const direction = opts.direction ?? 'TB';
  lines.push(`flowchart ${direction}`);
  lines.push('');

  // Subgraphs for domains
  if (opts.groupByDomain) {
    const nodesByDomain = groupByDomain(nodes);

    for (const [domain, domainNodes] of nodesByDomain) {
      lines.push(`  subgraph ${sanitizeId(domain)}["${domain}"]`);
      
      for (const node of domainNodes) {
        lines.push(`    ${renderMermaidNode(node, opts)}`);
      }
      
      lines.push('  end');
      lines.push('');
    }
  } else {
    // Flat node list
    for (const node of nodes) {
      lines.push(`  ${renderMermaidNode(node, opts)}`);
    }
    lines.push('');
  }

  // Edges
  for (const edge of edges) {
    lines.push(`  ${renderMermaidEdge(edge, opts)}`);
  }

  // Highlight cycles
  if (opts.highlightCycles && opts.highlightCycles.length > 0) {
    lines.push('');
    lines.push('  %% Cycle highlighting');
    for (const cycle of opts.highlightCycles) {
      for (const nodeId of cycle.nodes) {
        const safeId = sanitizeId(nodeId);
        lines.push(`  style ${safeId} stroke:#ff0000,stroke-width:3px`);
      }
    }
  }

  // Highlight specific nodes
  if (opts.highlight && opts.highlight.length > 0) {
    lines.push('');
    lines.push('  %% Highlighted nodes');
    for (const nodeId of opts.highlight) {
      const safeId = sanitizeId(nodeId);
      lines.push(`  style ${safeId} fill:#ffff00,stroke:#ff8800,stroke-width:2px`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a D2 diagram
 */
export function generateD2(
  graph: DependencyGraph,
  options: Partial<VisualizationOptions> = {}
): string {
  const opts = resolveOptions({ ...options, format: 'd2' });
  const { nodes, edges } = filterGraph(graph, opts);
  const lines: string[] = [];

  // Direction
  if (opts.direction) {
    const d2Direction = opts.direction === 'LR' ? 'right' : 
                        opts.direction === 'RL' ? 'left' :
                        opts.direction === 'BT' ? 'up' : 'down';
    lines.push(`direction: ${d2Direction}`);
    lines.push('');
  }

  // Group by domain
  if (opts.groupByDomain) {
    const nodesByDomain = groupByDomain(nodes);

    for (const [domain, domainNodes] of nodesByDomain) {
      lines.push(`${sanitizeD2Id(domain)}: ${domain} {`);
      
      for (const node of domainNodes) {
        lines.push(`  ${renderD2Node(node, opts)}`);
      }
      
      lines.push('}');
      lines.push('');
    }
  } else {
    for (const node of nodes) {
      lines.push(renderD2Node(node, opts));
    }
    lines.push('');
  }

  // Edges
  for (const edge of edges) {
    lines.push(renderD2Edge(edge, opts));
  }

  // Styles
  lines.push('');
  lines.push('# Styles');
  
  const colors = opts.colors ?? DEFAULT_COLORS;
  for (const [type, color] of Object.entries(colors)) {
    lines.push(`*.${type}.style.fill: "${color}"`);
  }

  // Highlight cycles
  if (opts.highlightCycles && opts.highlightCycles.length > 0) {
    lines.push('');
    lines.push('# Cycle highlighting');
    for (const cycle of opts.highlightCycles) {
      for (const nodeId of cycle.nodes) {
        lines.push(`${sanitizeD2Id(nodeId)}.style.stroke: "#ff0000"`);
        lines.push(`${sanitizeD2Id(nodeId)}.style.stroke-width: 3`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate a DOT (Graphviz) diagram
 */
export function generateDot(
  graph: DependencyGraph,
  options: Partial<VisualizationOptions> = {}
): string {
  const opts = resolveOptions({ ...options, format: 'dot' });
  const { nodes, edges } = filterGraph(graph, opts);
  const lines: string[] = [];

  // Header
  const direction = opts.direction === 'LR' || opts.direction === 'RL' ? 'LR' : 'TB';
  lines.push('digraph Dependencies {');
  lines.push(`  rankdir=${direction};`);
  lines.push('  node [shape=box, style=filled];');
  lines.push('');

  // Colors
  const colors = opts.colors ?? DEFAULT_COLORS;

  // Group by domain using subgraphs
  if (opts.groupByDomain) {
    const nodesByDomain = groupByDomain(nodes);

    for (const [domain, domainNodes] of nodesByDomain) {
      lines.push(`  subgraph cluster_${sanitizeDotId(domain)} {`);
      lines.push(`    label="${domain}";`);
      lines.push('    style=filled;');
      lines.push('    color=lightgray;');
      lines.push('');
      
      for (const node of domainNodes) {
        const color = colors[node.type] ?? '#ffffff';
        lines.push(`    ${renderDotNode(node, color, opts)}`);
      }
      
      lines.push('  }');
      lines.push('');
    }
  } else {
    for (const node of nodes) {
      const color = colors[node.type] ?? '#ffffff';
      lines.push(`  ${renderDotNode(node, color, opts)}`);
    }
    lines.push('');
  }

  // Edges
  for (const edge of edges) {
    lines.push(`  ${renderDotEdge(edge, opts)}`);
  }

  // Highlight cycles
  if (opts.highlightCycles && opts.highlightCycles.length > 0) {
    lines.push('');
    lines.push('  // Cycle highlighting');
    for (const cycle of opts.highlightCycles) {
      for (const nodeId of cycle.nodes) {
        lines.push(`  "${sanitizeDotId(nodeId)}" [color=red, penwidth=3];`);
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Filter graph based on options
 */
function filterGraph(
  graph: DependencyGraph,
  opts: VisualizationOptions
): { nodes: DependencyNode[]; edges: DependencyEdge[] } {
  let nodes = Array.from(graph.nodes.values());
  let edges = [...graph.edges];

  // Filter by node types
  if (opts.nodeTypes && opts.nodeTypes.length > 0) {
    const types = new Set(opts.nodeTypes);
    nodes = nodes.filter((n) => types.has(n.type));
  }

  // Filter by domains
  if (opts.domains && opts.domains.length > 0) {
    const domains = new Set(opts.domains);
    nodes = nodes.filter((n) => domains.has(n.domain));
  }

  // Limit nodes
  if (opts.maxNodes && nodes.length > opts.maxNodes) {
    nodes = nodes.slice(0, opts.maxNodes);
  }

  // Filter edges to only include visible nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return { nodes, edges };
}

/**
 * Group nodes by domain
 */
function groupByDomain(nodes: DependencyNode[]): Map<string, DependencyNode[]> {
  const groups = new Map<string, DependencyNode[]>();

  for (const node of nodes) {
    if (!groups.has(node.domain)) {
      groups.set(node.domain, []);
    }
    groups.get(node.domain)!.push(node);
  }

  return groups;
}

/**
 * Render a Mermaid node
 */
function renderMermaidNode(node: DependencyNode, _opts: VisualizationOptions): string {
  const id = sanitizeId(node.id);
  const shape = getMermaidShape(node.type);
  const label = node.name;
  
  return `${id}${shape.open}"${label}"${shape.close}`;
}

/**
 * Render a Mermaid edge
 */
function renderMermaidEdge(edge: DependencyEdge, opts: VisualizationOptions): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);
  const arrow = getMermaidArrow(edge.type);
  
  if (opts.showLabels && edge.label) {
    return `${from} ${arrow}|${edge.label}| ${to}`;
  }
  
  return `${from} ${arrow} ${to}`;
}

/**
 * Get Mermaid shape for node type
 */
function getMermaidShape(type: string): { open: string; close: string } {
  switch (type) {
    case 'domain':
      return { open: '[[', close: ']]' };
    case 'entity':
      return { open: '[(', close: ')]' };
    case 'behavior':
      return { open: '{{', close: '}}' };
    case 'type':
      return { open: '([', close: '])' };
    case 'enum':
      return { open: '[/', close: '/]' };
    default:
      return { open: '[', close: ']' };
  }
}

/**
 * Get Mermaid arrow style
 */
function getMermaidArrow(type: string): string {
  switch (type) {
    case 'import':
      return '==>';
    case 'extends':
      return '-..->';
    case 'uses':
      return '-->';
    case 'reference':
    default:
      return '--->';
  }
}

/**
 * Render a D2 node
 */
function renderD2Node(node: DependencyNode, _opts: VisualizationOptions): string {
  const id = sanitizeD2Id(node.id);
  const shape = getD2Shape(node.type);
  return `${id}: ${node.name} { shape: ${shape}; class: ${node.type} }`;
}

/**
 * Render a D2 edge
 */
function renderD2Edge(edge: DependencyEdge, opts: VisualizationOptions): string {
  const from = sanitizeD2Id(edge.from);
  const to = sanitizeD2Id(edge.to);
  const arrow = getD2Arrow(edge.type);
  
  if (opts.showLabels && edge.label) {
    return `${from} ${arrow} ${to}: ${edge.label}`;
  }
  
  return `${from} ${arrow} ${to}`;
}

/**
 * Get D2 shape for node type
 */
function getD2Shape(type: string): string {
  switch (type) {
    case 'domain':
      return 'package';
    case 'entity':
      return 'cylinder';
    case 'behavior':
      return 'hexagon';
    case 'type':
      return 'class';
    case 'enum':
      return 'diamond';
    default:
      return 'rectangle';
  }
}

/**
 * Get D2 arrow style
 */
function getD2Arrow(type: string): string {
  switch (type) {
    case 'import':
      return '<->';
    case 'extends':
      return '->';
    default:
      return '->';
  }
}

/**
 * Render a DOT node
 */
function renderDotNode(
  node: DependencyNode,
  color: string,
  _opts: VisualizationOptions
): string {
  const id = sanitizeDotId(node.id);
  const shape = getDotShape(node.type);
  return `"${id}" [label="${node.name}", shape=${shape}, fillcolor="${color}"];`;
}

/**
 * Render a DOT edge
 */
function renderDotEdge(edge: DependencyEdge, opts: VisualizationOptions): string {
  const from = sanitizeDotId(edge.from);
  const to = sanitizeDotId(edge.to);
  const style = getDotEdgeStyle(edge.type);
  
  if (opts.showLabels && edge.label) {
    return `"${from}" -> "${to}" [${style}, label="${edge.label}"];`;
  }
  
  return `"${from}" -> "${to}" [${style}];`;
}

/**
 * Get DOT shape for node type
 */
function getDotShape(type: string): string {
  switch (type) {
    case 'domain':
      return 'folder';
    case 'entity':
      return 'cylinder';
    case 'behavior':
      return 'hexagon';
    case 'type':
      return 'component';
    case 'enum':
      return 'diamond';
    default:
      return 'box';
  }
}

/**
 * Get DOT edge style
 */
function getDotEdgeStyle(type: string): string {
  switch (type) {
    case 'import':
      return 'style=bold';
    case 'extends':
      return 'style=dashed';
    default:
      return 'style=solid';
  }
}

/**
 * Sanitize ID for Mermaid
 */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Sanitize ID for D2
 */
function sanitizeD2Id(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Sanitize ID for DOT
 */
function sanitizeDotId(id: string): string {
  return id.replace(/"/g, '\\"');
}

/**
 * Resolve options with defaults
 */
function resolveOptions(
  options: Partial<VisualizationOptions>
): VisualizationOptions {
  return {
    format: options.format ?? 'mermaid',
    nodeTypes: options.nodeTypes,
    domains: options.domains,
    showLabels: options.showLabels ?? false,
    groupByDomain: options.groupByDomain ?? true,
    highlight: options.highlight,
    highlightCycles: options.highlightCycles,
    direction: options.direction ?? 'TB',
    colors: options.colors,
    maxNodes: options.maxNodes,
  };
}
