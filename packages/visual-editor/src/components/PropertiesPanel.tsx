'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useSelectedNode, useEditorStore } from '@/hooks/useEditorStore';
import type { ISLField, EntityNodeData, BehaviorNodeData, TypeNodeData } from '@/types';

export function PropertiesPanel() {
  const selectedNode = useSelectedNode();
  const updateNode = useEditorStore((state) => state.updateNode);
  const removeNode = useEditorStore((state) => state.removeNode);

  if (!selectedNode) {
    return (
      <div className="flex-1 p-4 border-b border-accent">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Properties
        </h2>
        <div className="text-sm text-gray-500 text-center py-8">
          Select a node to edit its properties
        </div>
      </div>
    );
  }

  const { data } = selectedNode;

  return (
    <div className="flex-1 p-4 border-b border-accent overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Properties
        </h2>
        <button
          onClick={() => removeNode(selectedNode.id)}
          className="p-1.5 hover:bg-red-900/30 rounded text-red-400 transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Name</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-sm focus:outline-none focus:border-highlight"
        />
      </div>

      {/* Type-specific properties */}
      {data.type === 'entity' && (
        <EntityProperties
          data={data}
          onUpdate={(updates) => updateNode(selectedNode.id, updates)}
        />
      )}

      {data.type === 'behavior' && (
        <BehaviorProperties
          data={data}
          onUpdate={(updates) => updateNode(selectedNode.id, updates)}
        />
      )}

      {data.type === 'type' && (
        <TypeProperties
          data={data}
          onUpdate={(updates) => updateNode(selectedNode.id, updates)}
        />
      )}
    </div>
  );
}

function EntityProperties({
  data,
  onUpdate,
}: {
  data: EntityNodeData;
  onUpdate: (updates: Partial<EntityNodeData>) => void;
}) {
  const addField = () => {
    const newField: ISLField = {
      id: `f${Date.now()}`,
      name: 'newField',
      type: 'String',
      optional: false,
      annotations: [],
    };
    onUpdate({ fields: [...data.fields, newField] });
  };

  const updateField = (id: string, updates: Partial<ISLField>) => {
    onUpdate({
      fields: data.fields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    });
  };

  const removeField = (id: string) => {
    onUpdate({ fields: data.fields.filter((f) => f.id !== id) });
  };

  return (
    <>
      {/* Fields */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Fields</label>
          <button
            onClick={addField}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {data.fields.map((field) => (
            <div
              key={field.id}
              className="bg-accent/30 rounded p-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) =>
                    updateField(field.id, { name: e.target.value })
                  }
                  className="flex-1 bg-accent/50 border border-accent rounded px-2 py-1 text-xs focus:outline-none focus:border-highlight"
                  placeholder="Field name"
                />
                <button
                  onClick={() => removeField(field.id)}
                  className="p-1 hover:bg-red-900/30 rounded text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateField(field.id, { type: e.target.value })
                  }
                  className="flex-1 bg-accent/50 border border-accent rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="String">String</option>
                  <option value="Int">Int</option>
                  <option value="Boolean">Boolean</option>
                  <option value="UUID">UUID</option>
                  <option value="Timestamp">Timestamp</option>
                  <option value="Decimal">Decimal</option>
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={field.optional}
                    onChange={(e) =>
                      updateField(field.id, { optional: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  Optional
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invariants */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Invariants (one per line)
        </label>
        <textarea
          value={data.invariants.join('\n')}
          onChange={(e) =>
            onUpdate({
              invariants: e.target.value.split('\n').filter((s) => s.trim()),
            })
          }
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-xs font-mono h-20 resize-none focus:outline-none focus:border-highlight"
          placeholder="e.g., balance >= 0"
        />
      </div>
    </>
  );
}

function BehaviorProperties({
  data,
  onUpdate,
}: {
  data: BehaviorNodeData;
  onUpdate: (updates: Partial<BehaviorNodeData>) => void;
}) {
  const addInput = () => {
    const newInput: ISLField = {
      id: `i${Date.now()}`,
      name: 'input',
      type: 'String',
      optional: false,
      annotations: [],
    };
    onUpdate({ inputs: [...data.inputs, newInput] });
  };

  return (
    <>
      {/* Description */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={data.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-sm focus:outline-none focus:border-highlight"
          placeholder="What does this behavior do?"
        />
      </div>

      {/* Inputs */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Inputs</label>
          <button
            onClick={addInput}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {data.inputs.map((input) => (
            <div key={input.id} className="flex items-center gap-2">
              <input
                type="text"
                value={input.name}
                onChange={(e) =>
                  onUpdate({
                    inputs: data.inputs.map((i) =>
                      i.id === input.id ? { ...i, name: e.target.value } : i
                    ),
                  })
                }
                className="flex-1 bg-accent/50 border border-accent rounded px-2 py-1 text-xs focus:outline-none"
              />
              <select
                value={input.type}
                onChange={(e) =>
                  onUpdate({
                    inputs: data.inputs.map((i) =>
                      i.id === input.id ? { ...i, type: e.target.value } : i
                    ),
                  })
                }
                className="bg-accent/50 border border-accent rounded px-2 py-1 text-xs"
              >
                <option value="String">String</option>
                <option value="Int">Int</option>
                <option value="Boolean">Boolean</option>
                <option value="UUID">UUID</option>
              </select>
              <button
                onClick={() =>
                  onUpdate({
                    inputs: data.inputs.filter((i) => i.id !== input.id),
                  })
                }
                className="p-1 hover:bg-red-900/30 rounded text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Output Type */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Output Type</label>
        <select
          value={data.outputType}
          onChange={(e) => onUpdate({ outputType: e.target.value })}
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-sm focus:outline-none"
        >
          <option value="Boolean">Boolean</option>
          <option value="String">String</option>
          <option value="Int">Int</option>
          <option value="UUID">UUID</option>
          <option value="void">void</option>
        </select>
      </div>

      {/* Preconditions */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Preconditions</label>
        <textarea
          value={data.preconditions.join('\n')}
          onChange={(e) =>
            onUpdate({
              preconditions: e.target.value.split('\n').filter((s) => s.trim()),
            })
          }
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-xs font-mono h-16 resize-none focus:outline-none focus:border-highlight"
          placeholder="e.g., input.amount > 0"
        />
      </div>

      {/* Postconditions */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Postconditions
        </label>
        <textarea
          value={data.postconditions.join('\n')}
          onChange={(e) =>
            onUpdate({
              postconditions: e.target.value.split('\n').filter((s) => s.trim()),
            })
          }
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-xs font-mono h-16 resize-none focus:outline-none focus:border-highlight"
          placeholder="e.g., result == true"
        />
      </div>
    </>
  );
}

function TypeProperties({
  data,
  onUpdate,
}: {
  data: TypeNodeData;
  onUpdate: (updates: Partial<TypeNodeData>) => void;
}) {
  return (
    <>
      {/* Base Type */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Base Type</label>
        <select
          value={data.definition}
          onChange={(e) => onUpdate({ definition: e.target.value })}
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-sm focus:outline-none"
        >
          <option value="String">String</option>
          <option value="Int">Int</option>
          <option value="Decimal">Decimal</option>
          <option value="Boolean">Boolean</option>
        </select>
      </div>

      {/* Constraints */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Constraints (one per line)
        </label>
        <textarea
          value={data.constraints.join('\n')}
          onChange={(e) =>
            onUpdate({
              constraints: e.target.value.split('\n').filter((s) => s.trim()),
            })
          }
          className="w-full bg-accent/50 border border-accent rounded px-3 py-2 text-xs font-mono h-20 resize-none focus:outline-none focus:border-highlight"
          placeholder='e.g., format: "email"'
        />
      </div>
    </>
  );
}
