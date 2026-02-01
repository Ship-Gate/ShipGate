'use client';

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useCanvas } from '@/hooks/useCanvas';
import { useDragDrop } from '@/hooks/useDragDrop';
import { EntityNode } from './EntityNode';
import { BehaviorNode } from './BehaviorNode';
import { TypeNode } from './TypeNode';
import { InvariantNode } from './InvariantNode';
import { PolicyNode } from './PolicyNode';

const nodeTypes = {
  entityNode: EntityNode,
  behaviorNode: BehaviorNode,
  typeNode: TypeNode,
  invariantNode: InvariantNode,
  policyNode: PolicyNode,
};

export function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
  } = useCanvas();

  const { onDragOver, onDrop } = useDragDrop();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      nodeTypes={nodeTypes}
      fitView
      snapToGrid
      snapGrid={[16, 16]}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: false,
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color="#2d3748"
      />
      <Controls
        showZoom
        showFitView
        showInteractive={false}
        className="bg-panel border border-accent"
      />
      <MiniMap
        nodeColor={(node) => getNodeColor(node.data?.type)}
        maskColor="rgba(22, 33, 62, 0.8)"
        className="bg-panel border border-accent"
      />
    </ReactFlow>
  );
}

function getNodeColor(type?: string): string {
  switch (type) {
    case 'entity':
      return '#4ade80';
    case 'behavior':
      return '#60a5fa';
    case 'type':
      return '#f472b6';
    case 'invariant':
      return '#e94560';
    case 'policy':
      return '#fbbf24';
    default:
      return '#94a3b8';
  }
}
