'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import type { State } from '@/types';

interface StateInspectorProps {
  state: State;
  previousState?: State | null;
}

export function StateInspector({ state, previousState }: StateInspectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));

  // Calculate changed paths
  const changedPaths = useMemo(() => {
    if (!previousState) return new Set<string>();
    
    const changed = new Set<string>();
    
    function findChanges(prev: unknown, curr: unknown, path: string) {
      if (prev === curr) return;
      
      changed.add(path);
      
      if (typeof prev === 'object' && typeof curr === 'object' && 
          prev !== null && curr !== null) {
        const prevObj = prev as Record<string, unknown>;
        const currObj = curr as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);
        
        for (const key of allKeys) {
          findChanges(prevObj[key], currObj[key], path ? `${path}.${key}` : key);
        }
      }
    }
    
    findChanges(previousState, state, '');
    return changed;
  }, [state, previousState]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const paths = new Set<string>(['']);
    
    function collectPaths(obj: unknown, path: string) {
      if (typeof obj === 'object' && obj !== null) {
        paths.add(path);
        for (const key of Object.keys(obj)) {
          collectPaths((obj as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
        }
      }
    }
    
    collectPaths(state, '');
    setExpandedPaths(paths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['']));
  };

  return (
    <div className="space-y-3">
      {/* Search and controls */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search state..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={expandAll}
          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          Expand
        </button>
        <button
          onClick={collapseAll}
          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          Collapse
        </button>
      </div>

      {/* State tree */}
      <div className="font-mono text-sm">
        <StateNode
          name="state"
          value={state}
          path=""
          expandedPaths={expandedPaths}
          changedPaths={changedPaths}
          searchQuery={searchQuery}
          onToggle={toggleExpand}
          depth={0}
        />
      </div>

      {/* Changes summary */}
      {changedPaths.size > 0 && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <div className="font-medium text-yellow-700 mb-1">
            {changedPaths.size} value(s) changed
          </div>
          <div className="text-yellow-600 max-h-20 overflow-auto">
            {Array.from(changedPaths).slice(0, 5).map((path) => (
              <div key={path || 'root'} className="font-mono">
                {path || '(root)'}
              </div>
            ))}
            {changedPaths.size > 5 && (
              <div className="text-yellow-500">...and {changedPaths.size - 5} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StateNodeProps {
  name: string;
  value: unknown;
  path: string;
  expandedPaths: Set<string>;
  changedPaths: Set<string>;
  searchQuery: string;
  onToggle: (path: string) => void;
  depth: number;
}

function StateNode({
  name,
  value,
  path,
  expandedPaths,
  changedPaths,
  searchQuery,
  onToggle,
  depth,
}: StateNodeProps) {
  const isExpanded = expandedPaths.has(path);
  const isChanged = changedPaths.has(path);
  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);

  // Filter by search
  const matchesSearch = !searchQuery || 
    name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(value).toLowerCase().includes(searchQuery.toLowerCase());

  if (!matchesSearch && !isExpanded) return null;

  const entries = isObject ? Object.entries(value as Record<string, unknown>) : [];
  const preview = isArray 
    ? `Array(${(value as unknown[]).length})`
    : isObject 
      ? `{${entries.slice(0, 3).map(([k]) => k).join(', ')}${entries.length > 3 ? '...' : ''}}`
      : String(value);

  return (
    <div className={clsx('pl-4', depth > 0 && 'border-l border-gray-200')}>
      <div
        className={clsx(
          'flex items-start gap-1 py-0.5 rounded px-1 -ml-1',
          isChanged && 'bg-yellow-100',
          isObject && 'cursor-pointer hover:bg-gray-100'
        )}
        onClick={() => isObject && onToggle(path)}
      >
        {/* Expand/collapse icon */}
        {isObject && (
          <span className="text-gray-400 select-none w-4">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!isObject && <span className="w-4" />}

        {/* Key name */}
        <span className="text-purple-600">{name}</span>
        <span className="text-gray-400">:</span>

        {/* Value preview */}
        {!isExpanded && (
          <span className={clsx(
            isObject ? 'text-gray-500' : 'text-green-600',
            isChanged && 'font-medium'
          )}>
            {isObject ? preview : formatValue(value)}
          </span>
        )}

        {/* Type badge */}
        <span className="text-xs text-gray-400 ml-auto">
          {getTypeBadge(value)}
        </span>
      </div>

      {/* Children */}
      {isExpanded && isObject && (
        <div className="mt-0.5">
          {entries.map(([key, val]) => (
            <StateNode
              key={key}
              name={key}
              value={val}
              path={path ? `${path}.${key}` : key}
              expandedPaths={expandedPaths}
              changedPaths={changedPaths}
              searchQuery={searchQuery}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
          {entries.length === 0 && (
            <div className="pl-4 text-gray-400 text-xs italic">empty</div>
          )}
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return String(value);
}

function getTypeBadge(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array[${value.length}]`;
  return typeof value;
}
