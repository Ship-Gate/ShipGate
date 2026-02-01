// ============================================================================
// TryIt Component - Interactive API testing
// ============================================================================

'use client';

import React, { useState, useCallback } from 'react';

export interface TryItProps {
  /** Behavior name */
  behavior: string;
  
  /** API endpoint (optional for mock mode) */
  endpoint?: string;
  
  /** Default input values */
  defaultInput: Record<string, unknown>;
  
  /** Input schema for validation */
  schema?: Record<string, unknown>;
  
  /** Expected output for comparison */
  expectedOutput?: Record<string, unknown>;
  
  /** Mock mode - don't call real API */
  mockMode?: boolean;
  
  /** Custom execute handler */
  onExecute?: (input: Record<string, unknown>) => Promise<unknown>;
  
  /** Theme colors */
  theme?: {
    primary?: string;
    success?: string;
    error?: string;
  };
}

export function TryIt({
  behavior,
  endpoint,
  defaultInput,
  schema,
  expectedOutput,
  mockMode = false,
  onExecute,
  theme = {},
}: TryItProps) {
  const [input, setInput] = useState(JSON.stringify(defaultInput, null, 2));
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateInput = useCallback((inputStr: string): boolean => {
    try {
      const parsed = JSON.parse(inputStr);
      const errors: string[] = [];

      if (schema) {
        // Basic schema validation
        const required = (schema.required as string[]) ?? [];
        for (const field of required) {
          if (!(field in parsed)) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      setValidationErrors(errors);
      return errors.length === 0;
    } catch {
      setValidationErrors(['Invalid JSON']);
      return false;
    }
  }, [schema]);

  const handleExecute = async () => {
    if (!validateInput(input)) {
      return;
    }

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const parsed = JSON.parse(input);
      let result: unknown;

      if (onExecute) {
        result = await onExecute(parsed);
      } else if (endpoint && !mockMode) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        result = await response.json();
      } else {
        // Mock response
        await new Promise((resolve) => setTimeout(resolve, 500));
        result = {
          success: true,
          data: {
            ...parsed,
            id: `mock-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
        };
      }

      setOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput(JSON.stringify(defaultInput, null, 2));
    setOutput(null);
    setError(null);
    setValidationErrors([]);
  };

  return (
    <div className="tryit-container border rounded-lg overflow-hidden my-6">
      {/* Header */}
      <div className="tryit-header bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
        <div>
          <h4 className="font-semibold text-gray-800">Try {behavior}</h4>
          {mockMode && (
            <span className="text-xs text-gray-500">Mock Mode</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: theme.primary }}
          >
            {loading ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="tryit-content grid grid-cols-2 divide-x">
        {/* Input */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Input</label>
            {validationErrors.length > 0 && (
              <span className="text-xs text-red-600">
                {validationErrors.length} error(s)
              </span>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              validateInput(e.target.value);
            }}
            className="w-full h-64 font-mono text-sm p-3 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            spellCheck={false}
          />
          {validationErrors.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {validationErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
        </div>

        {/* Output */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Output
          </label>
          <div
            className={`w-full h-64 font-mono text-sm p-3 border rounded overflow-auto ${
              error ? 'bg-red-50 border-red-200' : 'bg-gray-50'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Executing...
              </div>
            ) : error ? (
              <div className="text-red-600">
                <div className="font-semibold mb-1">Error</div>
                <div>{error}</div>
              </div>
            ) : output ? (
              <pre className="whitespace-pre-wrap">{output}</pre>
            ) : (
              <div className="text-gray-400 h-full flex items-center justify-center">
                Click Execute to see output
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expected Output Comparison */}
      {output && expectedOutput && (
        <div className="tryit-comparison border-t p-4 bg-gray-50">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Expected vs Actual
          </div>
          <div className="text-xs">
            {compareOutputs(JSON.parse(output), expectedOutput) ? (
              <span className="text-green-600" style={{ color: theme.success }}>
                ✓ Output matches expected
              </span>
            ) : (
              <span className="text-yellow-600" style={{ color: theme.error }}>
                ⚠ Output differs from expected
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function compareOutputs(actual: unknown, expected: unknown): boolean {
  // Simple deep comparison
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export default TryIt;
