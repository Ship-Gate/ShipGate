'use client';

import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useEditorStore } from './useEditorStore';
import type { ISLNodeType, ISLNode, EntityNodeData, BehaviorNodeData, TypeNodeData, InvariantNodeData, PolicyNodeData } from '@/types';

let nodeId = 0;
const getId = () => `node_${nodeId++}`;

export function useDragDrop() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useEditorStore((state) => state.addNode);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/islnodetype') as ISLNodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = createNode(type, position);
      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: ISLNodeType) => {
      event.dataTransfer.setData('application/islnodetype', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  return {
    onDragOver,
    onDrop,
    onDragStart,
  };
}

function createNode(type: ISLNodeType, position: { x: number; y: number }): ISLNode {
  const id = getId();

  switch (type) {
    case 'entity':
      return {
        id,
        type: 'entityNode',
        position,
        data: {
          type: 'entity',
          name: 'NewEntity',
          fields: [
            { id: 'f1', name: 'id', type: 'UUID', optional: false, annotations: ['@unique'] },
          ],
          invariants: [],
        } satisfies EntityNodeData,
      };

    case 'behavior':
      return {
        id,
        type: 'behaviorNode',
        position,
        data: {
          type: 'behavior',
          name: 'NewBehavior',
          description: '',
          inputs: [],
          outputType: 'Boolean',
          errors: [],
          preconditions: [],
          postconditions: [],
        } satisfies BehaviorNodeData,
      };

    case 'type':
      return {
        id,
        type: 'typeNode',
        position,
        data: {
          type: 'type',
          name: 'NewType',
          definition: 'String',
          constraints: [],
        } satisfies TypeNodeData,
      };

    case 'invariant':
      return {
        id,
        type: 'invariantNode',
        position,
        data: {
          type: 'invariant',
          name: 'NewInvariant',
          scope: 'global',
          predicates: [],
        } satisfies InvariantNodeData,
      };

    case 'policy':
      return {
        id,
        type: 'policyNode',
        position,
        data: {
          type: 'policy',
          name: 'NewPolicy',
          appliesTo: ['all'],
          rules: [],
        } satisfies PolicyNodeData,
      };

    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}
