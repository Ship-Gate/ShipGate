'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Type } from 'lucide-react';
import type { TypeNodeData } from '@/types';
import { useEditorStore } from '@/hooks/useEditorStore';
import { cn } from '@/lib/utils';

export const TypeNode = memo(function TypeNode({
  id,
  data,
  selected,
}: NodeProps<TypeNodeData>) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  return (
    <div
      className={cn(
        'min-w-[160px] rounded-lg overflow-hidden',
        'bg-gradient-to-br from-pink-900/50 to-pink-950/50',
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-type shadow-lg shadow-type/30'
          : 'border-pink-800/50 hover:border-pink-700/70'
      )}
    >
      {/* Header */}
      <div className="bg-type/20 px-3 py-2 flex items-center gap-2 border-b border-pink-800/50">
        <Type className="w-4 h-4 text-type" />
        <span className="font-semibold text-type">{data.name}</span>
      </div>

      {/* Definition */}
      <div className="p-3">
        <div className="text-xs text-gray-500 mb-1">Base type</div>
        <div className="font-mono text-sm text-gray-300">{data.definition}</div>

        {/* Constraints */}
        {data.constraints.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">Constraints</div>
            {data.constraints.map((constraint, i) => (
              <div
                key={i}
                className="text-xs font-mono text-pink-300 bg-pink-950/50 px-2 py-1 rounded mt-1"
              >
                {constraint}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-type border-2 border-pink-950"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-type border-2 border-pink-950"
      />
    </div>
  );
});
