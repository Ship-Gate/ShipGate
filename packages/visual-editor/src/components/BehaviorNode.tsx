'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Workflow, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import type { BehaviorNodeData } from '@/types';
import { useEditorStore } from '@/hooks/useEditorStore';
import { cn } from '@/lib/utils';

export const BehaviorNode = memo(function BehaviorNode({
  id,
  data,
  selected,
}: NodeProps<BehaviorNodeData>) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  return (
    <div
      className={cn(
        'min-w-[220px] rounded-lg overflow-hidden',
        'bg-gradient-to-br from-blue-900/50 to-blue-950/50',
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-behavior shadow-lg shadow-behavior/30'
          : 'border-blue-800/50 hover:border-blue-700/70'
      )}
    >
      {/* Header */}
      <div className="bg-behavior/20 px-3 py-2 flex items-center gap-2 border-b border-blue-800/50">
        <Workflow className="w-4 h-4 text-behavior" />
        <span className="font-semibold text-behavior">{data.name}</span>
      </div>

      {/* Description */}
      {data.description && (
        <div className="px-3 py-1 text-xs text-gray-400 border-b border-blue-800/30">
          {data.description}
        </div>
      )}

      {/* Input/Output */}
      <div className="p-2 space-y-2">
        {/* Inputs */}
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            Input
          </div>
          {data.inputs.length === 0 ? (
            <div className="text-xs text-gray-600 italic px-2">None</div>
          ) : (
            <div className="space-y-0.5">
              {data.inputs.map((input) => (
                <div
                  key={input.id}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs"
                >
                  <span className="text-gray-300">{input.name}</span>
                  <span className="text-gray-500">:</span>
                  <span className="text-behavior">{input.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Output */}
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 rotate-180" />
            Output
          </div>
          <div className="px-2 py-0.5 text-xs">
            <span className="text-behavior">{data.outputType}</span>
          </div>
        </div>

        {/* Errors */}
        {data.errors.length > 0 && (
          <div>
            <div className="text-xs text-red-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Errors
            </div>
            <div className="flex flex-wrap gap-1 px-2">
              {data.errors.map((error, i) => (
                <span
                  key={i}
                  className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded"
                >
                  {error}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Conditions */}
      {(data.preconditions.length > 0 || data.postconditions.length > 0) && (
        <div className="border-t border-blue-800/50 p-2 space-y-1">
          {data.preconditions.length > 0 && (
            <div className="text-xs">
              <span className="text-yellow-500">pre:</span>
              <span className="text-gray-400 ml-1">
                {data.preconditions.length} condition(s)
              </span>
            </div>
          )}
          {data.postconditions.length > 0 && (
            <div className="text-xs flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span className="text-gray-400">
                {data.postconditions.length} postcondition(s)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-behavior border-2 border-blue-950"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-behavior border-2 border-blue-950"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-behavior border-2 border-blue-950"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-behavior border-2 border-blue-950"
      />
    </div>
  );
});
