'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Scale } from 'lucide-react';
import type { PolicyNodeData } from '@/types';
import { useEditorStore } from '@/hooks/useEditorStore';
import { cn } from '@/lib/utils';

export const PolicyNode = memo(function PolicyNode({
  id,
  data,
  selected,
}: NodeProps<PolicyNodeData>) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg overflow-hidden',
        'bg-gradient-to-br from-yellow-900/50 to-yellow-950/50',
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-yellow-500 shadow-lg shadow-yellow-500/30'
          : 'border-yellow-800/50 hover:border-yellow-700/70'
      )}
    >
      {/* Header */}
      <div className="bg-yellow-500/20 px-3 py-2 flex items-center gap-2 border-b border-yellow-800/50">
        <Scale className="w-4 h-4 text-yellow-500" />
        <span className="font-semibold text-yellow-500">{data.name}</span>
      </div>

      {/* Applies To */}
      <div className="p-3">
        <div className="text-xs text-gray-500 mb-1">Applies to</div>
        <div className="flex flex-wrap gap-1">
          {data.appliesTo.map((target, i) => (
            <span
              key={i}
              className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded"
            >
              {target}
            </span>
          ))}
        </div>

        {/* Rules */}
        {data.rules.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">Rules</div>
            {data.rules.map((rule, i) => (
              <div
                key={i}
                className="text-xs font-mono text-gray-300 bg-yellow-950/50 px-2 py-1 rounded mt-1"
              >
                {rule}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-yellow-500 border-2 border-yellow-950"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-yellow-500 border-2 border-yellow-950"
      />
    </div>
  );
});
