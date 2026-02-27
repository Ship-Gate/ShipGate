// ============================================================================
// Visual Editor Types
// ============================================================================

import type { Node, Edge } from 'reactflow';

// ============================================================================
// Node Types
// ============================================================================

export type ISLNodeType = 'entity' | 'behavior' | 'type' | 'invariant' | 'policy';

export interface ISLField {
  id: string;
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}

export interface EntityNodeData {
  type: 'entity';
  name: string;
  fields: ISLField[];
  invariants: string[];
  lifecycleStates?: string[];
}

export interface BehaviorNodeData {
  type: 'behavior';
  name: string;
  description?: string;
  inputs: ISLField[];
  outputType: string;
  errors: string[];
  preconditions: string[];
  postconditions: string[];
}

export interface TypeNodeData {
  type: 'type';
  name: string;
  definition: string;
  constraints: string[];
}

export interface InvariantNodeData {
  type: 'invariant';
  name: string;
  scope: 'global' | 'transaction';
  predicates: string[];
}

export interface PolicyNodeData {
  type: 'policy';
  name: string;
  appliesTo: string[];
  rules: string[];
}

export type ISLNodeData =
  | EntityNodeData
  | BehaviorNodeData
  | TypeNodeData
  | InvariantNodeData
  | PolicyNodeData;

export type ISLNode = Node<ISLNodeData>;

// ============================================================================
// Edge Types
// ============================================================================

export type ISLEdgeType =
  | 'reference'      // Type reference
  | 'uses'           // Behavior uses entity
  | 'produces'       // Behavior produces output
  | 'consumes'       // Behavior consumes input
  | 'lifecycle'      // Lifecycle transition
  | 'enforces';      // Policy/invariant enforcement

export interface ISLEdgeData {
  type: ISLEdgeType;
  label?: string;
}

export type ISLEdge = Edge<ISLEdgeData>;

// ============================================================================
// Editor State
// ============================================================================

export interface EditorState {
  nodes: ISLNode[];
  edges: ISLEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  domainName: string;
  domainVersion: string;
  zoom: number;
  isDirty: boolean;
}

export interface EditorActions {
  setNodes: (nodes: ISLNode[]) => void;
  setEdges: (edges: ISLEdge[]) => void;
  addNode: (node: ISLNode) => void;
  updateNode: (id: string, data: Partial<ISLNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: ISLEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setDomainInfo: (name: string, version: string) => void;
  setZoom: (zoom: number) => void;
  setDirty: (dirty: boolean) => void;
  resetEditor: () => void;
}

// ============================================================================
// Tool Palette
// ============================================================================

export interface ToolItem {
  id: string;
  type: ISLNodeType;
  label: string;
  icon: string;
  description: string;
}

// ============================================================================
// Layout
// ============================================================================

export interface LayoutOptions {
  direction: 'TB' | 'LR';
  nodeSpacing: number;
  levelSpacing: number;
}

// ============================================================================
// Serialization
// ============================================================================

export interface SerializationResult {
  success: boolean;
  code?: string;
  errors?: string[];
}

export interface ParseResult {
  success: boolean;
  nodes?: ISLNode[];
  edges?: ISLEdge[];
  domainName?: string;
  domainVersion?: string;
  errors?: string[];
}
