// ============================================================================
// Runtime Verify - Public API
// ============================================================================

// Core assertions
export {
  require,
  ensure,
  invariant,
  requireAll,
  ensureAll,
  invariantAll,
  resetEventCounter,
} from './assertions';

// Error types
export {
  VerifyError,
  PreconditionError,
  PostconditionError,
  InvariantError,
  HookError,
  EvaluationError,
  ErrorCode,
  type ErrorCodeType,
  isVerifyError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  formatVerifyError,
} from './errors';

// Event hooks
export {
  registerHook,
  unregisterHook,
  hasHooks,
  getHookNames,
  emitEvent,
  enableBuffering,
  disableBuffering,
  flushEvents,
  getBufferedEvents,
  clearBuffer,
  clearHooks,
  resetHooks,
  createConsoleHook,
  createJsonHook,
  createMetricsHook,
  createFilterHook,
} from './hooks';

// Types
export type {
  VerificationEventType,
  VerificationEvent,
  VerificationContext,
  AssertionOptions,
  VerificationResult,
  VerificationError,
  VerificationHookHandler,
  HookConfig,
  SnippetOptions,
  GeneratedSnippet,
} from './types';

// Snippet generators (also available via @isl-lang/runtime-verify/snippets)
export {
  generateRequireSnippet,
  generateEnsureSnippet,
  generateInvariantSnippet,
  generateRequireAllSnippet,
  generateEnsureAllSnippet,
  generateInvariantAllSnippet,
  generateVerifiedFunctionWrapper,
  generateImportSnippet,
  generateModuleHeader,
  verifySnippetDeterminism,
  combineSnippets,
} from './snippets';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Capture the current state for invariant checking
 * This is a helper used by generated code to snapshot state before operations
 * 
 * @param state - State object to capture
 * @returns Deep copy of the state
 */
export function captureState<T>(state?: T): T | undefined {
  if (state === undefined) {
    return undefined;
  }
  
  // Deep clone using JSON for simplicity
  // In production, use a more robust cloning method
  try {
    return JSON.parse(JSON.stringify(state)) as T;
  } catch {
    // If serialization fails, return undefined
    return undefined;
  }
}

/**
 * Compare old and new state for invariant checking
 * 
 * @param oldState - Previous state
 * @param newState - Current state
 * @param path - Optional path to specific property
 * @returns The value at the path in old state, or the full old state
 */
export function old<T>(oldState: T | undefined, path?: string): unknown {
  if (oldState === undefined) {
    return undefined;
  }
  
  if (!path) {
    return oldState;
  }
  
  // Navigate to path
  const parts = path.split('.');
  let current: unknown = oldState;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Create a verification scope that collects all results
 * 
 * @param fn - Function to execute within scope
 * @returns Array of verification results
 */
export async function withVerificationScope<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; events: import('./types').VerificationEvent[] }> {
  const { enableBuffering, disableBuffering, getBufferedEvents, clearBuffer } = await import('./hooks');
  
  // Enable buffering to collect events
  enableBuffering();
  clearBuffer();
  
  try {
    const result = await fn();
    const events = getBufferedEvents();
    return { result, events };
  } finally {
    disableBuffering();
  }
}
