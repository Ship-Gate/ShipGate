'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Database, Key, AlertCircle } from 'lucide-react';
import type { EntityNodeData } from '@/types';
import { useEditorStore } from '@/hooks/useEditorStore';
import { cn } from '@/lib/utils';

export const EntityNode = memo(function EntityNode({
  id,
  data,
  selected,
}: NodeProps<EntityNodeData>) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg overflow-hidden',
        'bg-gradient-to-br from-green-900/50 to-green-950/50',
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-entity shadow-lg shadow-entity/30'
          : 'border-green-800/50 hover:border-green-700/70'
      )}
    >
      {/* Header */}
      <div className="bg-entity/20 px-3 py-2 flex items-center gap-2 border-b border-green-800/50">
        <Database className="w-4 h-4 text-entity" />
        <span className="font-semibold text-entity">{data.name}</span>
        {data.lifecycleStates && data.lifecycleStates.length > 0 && (
          <span className="ml-auto text-xs bg-entity/30 px-2 py-0.5 rounded">
            lifecycle
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="p-2 space-y-1">
        {data.fields.length === 0 ? (
          <div className="text-xs text-gray-500 italic px-2 py-1">
            No fields
          </div>
        ) : (
          data.fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-green-950/30 text-sm"
            >
              {field.annotations.includes('@unique') && (
                <Key className="w-3 h-3 text-yellow-500" />
              )}
              <span className="text-gray-300">{field.name}</span>
              <span className="text-gray-500">:</span>
              <span className="text-entity">{field.type}</span>
              {field.optional && (
                <span className="text-gray-500">?</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Invariants */}
      {data.invariants.length > 0 && (
        <div className="border-t border-green-800/50 p-2">
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-1">
            <AlertCircle className="w-3 h-3" />
            <span>Invariants</span>
          </div>
          {data.invariants.map((inv, i) => (
            <div
              key={i}
              className="text-xs text-gray-400 px-2 py-0.5 font-mono"
            >
              {inv}
            </div>
          ))}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-entity border-2 border-green-950"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-entity border-2 border-green-950"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-entity border-2 border-green-950"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-entity border-2 border-green-950"
      />
    </div>
  );
});
