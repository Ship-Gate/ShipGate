'use client';

import { create } from 'zustand';
import type { ISLNode, ISLEdge, ISLNodeData, EditorState, EditorActions } from '@/types';

const initialState: EditorState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  domainName: 'MyDomain',
  domainVersion: '1.0.0',
  zoom: 1,
  isDirty: false,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } as ISLNodeData }
          : node
      ),
      isDirty: true,
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
      isDirty: true,
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
      selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
      isDirty: true,
    })),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  setDomainInfo: (name, version) =>
    set({ domainName: name, domainVersion: version, isDirty: true }),

  setZoom: (zoom) => set({ zoom }),

  setDirty: (isDirty) => set({ isDirty }),

  resetEditor: () => set(initialState),
}));

// Selectors
export const useSelectedNode = () => {
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  return nodes.find((node) => node.id === selectedNodeId);
};

export const useSelectedEdge = () => {
  const edges = useEditorStore((state) => state.edges);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  return edges.find((edge) => edge.id === selectedEdgeId);
};
