'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Shield } from 'lucide-react';
import type { InvariantNodeData } from '@/types';
import { useEditorStore } from '@/hooks/useEditorStore';
import { cn } from '@/lib/utils';

export const InvariantNode = memo(function InvariantNode({
  id,
  data,
  selected,
}: NodeProps<InvariantNodeData>) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg overflow-hidden',
        'bg-gradient-to-br from-red-900/50 to-red-950/50',
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-highlight shadow-lg shadow-highlight/30'
          : 'border-red-800/50 hover:border-red-700/70'
      )}
    >
      {/* Header */}
      <div className="bg-highlight/20 px-3 py-2 flex items-center gap-2 border-b border-red-800/50">
        <Shield className="w-4 h-4 text-highlight" />
        <span className="font-semibold text-highlight">{data.name}</span>
        <span className="ml-auto text-xs bg-red-900/50 px-2 py-0.5 rounded">
          {data.scope}
        </span>
      </div>

      {/* Predicates */}
      <div className="p-3">
        {data.predicates.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No predicates</div>
        ) : (
          <div className="space-y-1">
            {data.predicates.map((pred, i) => (
              <div
                key={i}
                className="text-xs font-mono text-gray-300 bg-red-950/50 px-2 py-1 rounded"
              >
                {pred}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-highlight border-2 border-red-950"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-highlight border-2 border-red-950"
      />
    </div>
  );
});
