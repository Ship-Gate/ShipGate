// ============================================================================
// ISL Expression Evaluator - Helper Functions
// ============================================================================

import type { EvaluationContext, ExpressionAdapter } from './types.js';
import { DefaultAdapter } from './types.js';

/**
 * Create an evaluation context with default settings
 */
export function createContext(
  options: {
    variables?: Map<string, unknown>;
    input?: Record<string, unknown>;
    result?: unknown;
    oldState?: Record<string, unknown>;
    adapter?: ExpressionAdapter;
    strict?: boolean;
    maxDepth?: number;
  } = {}
): EvaluationContext {
  return {
    variables: options.variables ?? new Map(),
    input: options.input,
    result: options.result,
    oldState: options.oldState,
    adapter: options.adapter ?? new DefaultAdapter(),
    strict: options.strict ?? false,
    maxDepth: options.maxDepth ?? 1000,
  };
}

/**
 * Create a custom adapter from a partial implementation
 * Unimplemented methods fall back to DefaultAdapter
 */
export function createAdapter(
  overrides: Partial<ExpressionAdapter>
): ExpressionAdapter {
  const defaultAdapter = new DefaultAdapter();
  return {
    is_valid: overrides.is_valid ?? defaultAdapter.is_valid.bind(defaultAdapter),
    length: overrides.length ?? defaultAdapter.length.bind(defaultAdapter),
    exists: overrides.exists ?? defaultAdapter.exists.bind(defaultAdapter),
    lookup: overrides.lookup ?? defaultAdapter.lookup.bind(defaultAdapter),
    getProperty: overrides.getProperty ?? defaultAdapter.getProperty.bind(defaultAdapter),
    regex: overrides.regex ?? defaultAdapter.regex.bind(defaultAdapter),
  };
}
