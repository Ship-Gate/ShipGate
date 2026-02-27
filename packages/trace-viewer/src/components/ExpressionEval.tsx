'use client';

import { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type { State, ExpressionResult } from '@/types';

interface ExpressionEvalProps {
  state: State;
}

// Common expression suggestions
const SUGGESTIONS = [
  { expr: 'Object.keys(state)', desc: 'List all keys' },
  { expr: 'state.users?.count', desc: 'User count' },
  { expr: 'JSON.stringify(state, null, 2)', desc: 'Pretty print state' },
];

export function ExpressionEval({ state }: ExpressionEvalProps) {
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<ExpressionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate autocomplete suggestions based on state
  const autocompleteSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    
    function collectPaths(obj: unknown, prefix: string, depth: number) {
      if (depth > 3) return;
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key of Object.keys(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        suggestions.push(path);
        collectPaths((obj as Record<string, unknown>)[key], path, depth + 1);
      }
    }
    
    collectPaths(state, 'state', 0);
    return suggestions;
  }, [state]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!expression.includes('.')) return [];
    
    const lastDot = expression.lastIndexOf('.');
    const prefix = expression.slice(0, lastDot);
    const search = expression.slice(lastDot + 1).toLowerCase();
    
    return autocompleteSuggestions
      .filter(s => s.startsWith(prefix) && s.toLowerCase().includes(search))
      .slice(0, 5);
  }, [expression, autocompleteSuggestions]);

  const evaluateExpression = useCallback(() => {
    if (!expression.trim()) return;

    try {
      // Create evaluation context with state access
      const evalContext = { state };
      
      // Simple expression evaluation
      // Note: In production, use a proper expression parser for safety
      const result = new Function('state', `
        with (arguments[0]) {
          return ${expression};
        }
      `)(evalContext);

      const resultEntry: ExpressionResult = {
        expression,
        result,
        type: getResultType(result),
      };

      setHistory((prev) => [resultEntry, ...prev.slice(0, 9)]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation error');
    }
  }, [expression, state]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      evaluateExpression();
    }
  };

  const applySuggestion = (suggestion: string) => {
    setExpression(suggestion);
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <div className="relative">
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter ISL expression (e.g., state.users.count)"
            className={clsx(
              'w-full px-3 py-2 text-sm font-mono border rounded resize-none',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              error && 'border-red-300'
            )}
            rows={2}
          />
          
          {/* Autocomplete dropdown */}
          {filteredSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => applySuggestion(suggestion)}
                  className="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-blue-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={evaluateExpression}
            disabled={!expression.trim()}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition"
          >
            Evaluate
          </button>
          
          <span className="text-xs text-gray-400">
            Press Enter to evaluate
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Quick suggestions */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500">Quick expressions:</div>
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map(({ expr, desc }) => (
            <button
              key={expr}
              onClick={() => setExpression(expr)}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
              title={desc}
            >
              {expr.slice(0, 20)}...
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>History</span>
            <button
              onClick={() => setHistory([])}
              className="text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-auto">
            {history.map((entry, index) => (
              <div key={index} className="bg-gray-50 rounded p-2 text-sm">
                {/* Expression */}
                <div
                  className="font-mono text-purple-600 cursor-pointer hover:underline"
                  onClick={() => setExpression(entry.expression)}
                >
                  {entry.expression}
                </div>
                
                {/* Result */}
                <div className="mt-1 flex items-start gap-2">
                  <span className="text-gray-400">→</span>
                  <div className="flex-1 min-w-0">
                    <pre className="text-green-600 font-mono text-xs overflow-auto max-h-24">
                      {formatResult(entry.result)}
                    </pre>
                    <span className="text-xs text-gray-400">
                      {entry.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available state paths */}
      <div className="text-xs text-gray-400 pt-2 border-t">
        <details>
          <summary className="cursor-pointer hover:text-gray-600">
            Available paths ({autocompleteSuggestions.length})
          </summary>
          <div className="mt-2 max-h-32 overflow-auto font-mono">
            {autocompleteSuggestions.map((path) => (
              <div
                key={path}
                className="cursor-pointer hover:text-blue-600"
                onClick={() => setExpression(path)}
              >
                {path}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function getResultType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object(${Object.keys(value).length} keys)`;
  return typeof value;
}

function formatResult(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Circular]';
    }
  }
  return String(value);
}
