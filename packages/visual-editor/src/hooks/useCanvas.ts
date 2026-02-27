'use client';

import { useCallback } from 'react';
import { useReactFlow, type Connection, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { useEditorStore } from './useEditorStore';
import type { ISLNode, ISLEdge, ISLEdgeData } from '@/types';

export function useCanvas() {
  const { project, fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();
  const { nodes, edges, setNodes, setEdges, addEdge, selectNode, selectEdge, setZoom } = useEditorStore();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes) as ISLNode[]);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges) as ISLEdge[]);
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      // Determine edge type based on node types
      let edgeType: ISLEdgeData['type'] = 'reference';
      let animated = false;
      
      if (sourceNode.data.type === 'behavior' && targetNode.data.type === 'entity') {
        edgeType = 'uses';
      } else if (sourceNode.data.type === 'entity' && targetNode.data.type === 'behavior') {
        edgeType = 'produces';
      } else if (sourceNode.data.type === 'policy' || sourceNode.data.type === 'invariant') {
        edgeType = 'enforces';
      } else if (sourceNode.data.type === 'entity' && targetNode.data.type === 'entity') {
        edgeType = 'lifecycle';
        animated = true;
      }

      const newEdge: ISLEdge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        data: { type: edgeType },
        animated,
        style: { stroke: getEdgeColor(edgeType) },
      };

      addEdge(newEdge);
    },
    [nodes, addEdge]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: ISLNode) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: ISLEdge) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  const handleZoomIn = useCallback(() => {
    zoomIn();
    setZoom(getViewport().zoom);
  }, [zoomIn, getViewport, setZoom]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
    setZoom(getViewport().zoom);
  }, [zoomOut, getViewport, setZoom]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
    setZoom(getViewport().zoom);
  }, [fitView, getViewport, setZoom]);

  const handleCenter = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
    setZoom(1);
  }, [setViewport, setZoom]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleCenter,
    project,
  };
}

function getEdgeColor(type: ISLEdgeData['type']): string {
  switch (type) {
    case 'uses':
      return '#60a5fa';
    case 'produces':
      return '#4ade80';
    case 'consumes':
      return '#f472b6';
    case 'lifecycle':
      return '#fbbf24';
    case 'enforces':
      return '#e94560';
    default:
      return '#94a3b8';
  }
}
