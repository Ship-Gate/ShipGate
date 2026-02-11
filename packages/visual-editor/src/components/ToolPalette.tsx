'use client';

import { Database, Workflow, Type, Shield, Scale, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useDragDrop } from '@/hooks/useDragDrop';
import type { ISLNodeType, ToolItem } from '@/types';

const tools: ToolItem[] = [
  {
    id: 'entity',
    type: 'entity',
    label: 'Entity',
    icon: 'database',
    description: 'Data model with fields and invariants',
  },
  {
    id: 'behavior',
    type: 'behavior',
    label: 'Behavior',
    icon: 'workflow',
    description: 'Operation with pre/postconditions',
  },
  {
    id: 'type',
    type: 'type',
    label: 'Type',
    icon: 'type',
    description: 'Custom type definition',
  },
  {
    id: 'invariant',
    type: 'invariant',
    label: 'Invariant',
    icon: 'shield',
    description: 'Global constraint',
  },
  {
    id: 'policy',
    type: 'policy',
    label: 'Policy',
    icon: 'scale',
    description: 'Business rule',
  },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  database: Database,
  workflow: Workflow,
  type: Type,
  shield: Shield,
  scale: Scale,
};

export function ToolPalette() {
  const { onDragStart } = useDragDrop();
  const [expandedSections, setExpandedSections] = useState<string[]>(['components']);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  return (
    <aside className="w-64 bg-panel border-r border-accent flex flex-col">
      {/* Components Section */}
      <div className="border-b border-accent">
        <button
          onClick={() => toggleSection('components')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
        >
          <span className="font-semibold text-sm uppercase tracking-wider">
            Components
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedSections.includes('components') ? '' : '-rotate-90'
            }`}
          />
        </button>
        
        {expandedSections.includes('components') && (
          <div className="p-2 space-y-1">
            {tools.map((tool) => (
              <ToolItem
                key={tool.id}
                tool={tool}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Templates Section */}
      <div className="border-b border-accent">
        <button
          onClick={() => toggleSection('templates')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
        >
          <span className="font-semibold text-sm uppercase tracking-wider">
            Templates
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedSections.includes('templates') ? '' : '-rotate-90'
            }`}
          />
        </button>
        
        {expandedSections.includes('templates') && (
          <div className="p-4 text-sm text-gray-400">
            Coming soon: Pre-built patterns
          </div>
        )}
      </div>

      {/* Help */}
      <div className="mt-auto p-4 border-t border-accent">
        <div className="text-xs text-gray-500">
          <p className="mb-2">
            <strong>Tip:</strong> Drag components onto the canvas
          </p>
          <p>Connect nodes by dragging from handles</p>
        </div>
      </div>
    </aside>
  );
}

function ToolItem({
  tool,
  onDragStart,
}: {
  tool: ToolItem;
  onDragStart: (e: React.DragEvent, type: ISLNodeType) => void;
}) {
  const Icon = iconMap[tool.icon] ?? Database;
  const colorClass = getColorClass(tool.type);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, tool.type)}
      className={`
        flex items-center gap-3 p-3 rounded-lg cursor-grab
        bg-accent/30 hover:bg-accent/50 border border-transparent
        hover:border-${colorClass}/50 transition-all
        active:cursor-grabbing
      `}
    >
      <div className={`p-2 rounded-lg bg-${colorClass}/20`}>
        <Icon className={`w-5 h-5 text-${colorClass}`} />
      </div>
      <div>
        <div className="font-medium text-sm">{tool.label}</div>
        <div className="text-xs text-gray-500">{tool.description}</div>
      </div>
    </div>
  );
}

function getColorClass(type: ISLNodeType): string {
  switch (type) {
    case 'entity':
      return 'entity';
    case 'behavior':
      return 'behavior';
    case 'type':
      return 'type';
    case 'invariant':
      return 'highlight';
    case 'policy':
      return 'highlight';
    default:
      return 'gray-400';
  }
}
