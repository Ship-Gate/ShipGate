// ============================================================================
// Structured Event Hooks
// ============================================================================

import type {
  VerificationEvent,
  VerificationEventType,
  VerificationHookHandler,
  HookConfig,
} from './types';
import { HookError } from './errors';

/**
 * Registered hooks
 */
const hooks: Map<string, { handler: VerificationHookHandler; config: HookConfig }> = new Map();

/**
 * Event buffer for batch processing
 */
const eventBuffer: VerificationEvent[] = [];

/**
 * Maximum buffer size before auto-flush
 */
let maxBufferSize = 1000;

/**
 * Whether buffering is enabled
 */
let bufferingEnabled = false;

/**
 * Register a hook to receive verification events
 * 
 * @param name - Unique name for the hook
 * @param handler - Function to call when events occur
 * @param config - Optional hook configuration
 * @returns Unregister function
 * 
 * @example
 * ```typescript
 * const unregister = registerHook('logger', (event) => {
 *   console.log(`[${event.type}] ${event.label}: ${event.passed ? 'PASS' : 'FAIL'}`);
 * });
 * 
 * // Later...
 * unregister();
 * ```
 */
export function registerHook(
  name: string,
  handler: VerificationHookHandler,
  config: HookConfig = {}
): () => void {
  if (hooks.has(name)) {
    throw new HookError(`Hook '${name}' is already registered`);
  }
  
  hooks.set(name, { handler, config });
  
  return () => {
    hooks.delete(name);
  };
}

/**
 * Unregister a hook by name
 * 
 * @param name - Name of the hook to remove
 * @returns true if hook was removed, false if not found
 */
export function unregisterHook(name: string): boolean {
  return hooks.delete(name);
}

/**
 * Check if any hooks are registered
 * 
 * @returns true if hooks exist
 */
export function hasHooks(): boolean {
  return hooks.size > 0;
}

/**
 * Get list of registered hook names
 * 
 * @returns Array of hook names
 */
export function getHookNames(): string[] {
  return Array.from(hooks.keys());
}

/**
 * Emit a verification event to all registered hooks
 * 
 * @param event - The event to emit
 */
export function emitEvent(event: VerificationEvent): void {
  if (bufferingEnabled) {
    eventBuffer.push(event);
    if (eventBuffer.length >= maxBufferSize) {
      flushEvents();
    }
    return;
  }
  
  dispatchEvent(event);
}

/**
 * Dispatch an event to all matching hooks
 */
function dispatchEvent(event: VerificationEvent): void {
  for (const [name, { handler, config }] of hooks) {
    // Apply filters
    if (config.filter && !config.filter.includes(event.type)) {
      continue;
    }
    
    if (config.failuresOnly && event.passed) {
      continue;
    }
    
    try {
      if (config.async) {
        // Fire and forget
        Promise.resolve(handler(event)).catch((err) => {
          // Silently log async errors
          if (typeof globalThis !== 'undefined' && 'console' in globalThis) {
            // In production, use proper logger
          }
        });
      } else {
        handler(event);
      }
    } catch (err) {
      throw new HookError(`Hook '${name}' threw an error: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err instanceof Error ? err : undefined,
        context: { metadata: { hookName: name, event } },
      });
    }
  }
}

/**
 * Enable event buffering
 * Events will be collected and can be flushed manually or auto-flushed
 * 
 * @param maxSize - Maximum buffer size before auto-flush (default: 1000)
 */
export function enableBuffering(maxSize: number = 1000): void {
  bufferingEnabled = true;
  maxBufferSize = maxSize;
}

/**
 * Disable event buffering
 * Any buffered events will be flushed first
 */
export function disableBuffering(): void {
  flushEvents();
  bufferingEnabled = false;
}

/**
 * Flush all buffered events to hooks
 */
export function flushEvents(): void {
  const events = eventBuffer.splice(0, eventBuffer.length);
  for (const event of events) {
    dispatchEvent(event);
  }
}

/**
 * Get buffered events without flushing
 * 
 * @returns Copy of the event buffer
 */
export function getBufferedEvents(): VerificationEvent[] {
  return [...eventBuffer];
}

/**
 * Clear all buffered events without dispatching
 */
export function clearBuffer(): void {
  eventBuffer.length = 0;
}

/**
 * Clear all registered hooks
 */
export function clearHooks(): void {
  hooks.clear();
}

/**
 * Reset hooks system to initial state (for testing)
 */
export function resetHooks(): void {
  hooks.clear();
  eventBuffer.length = 0;
  bufferingEnabled = false;
  maxBufferSize = 1000;
}

// ============================================================================
// Built-in Hook Factories
// ============================================================================

/**
 * Create a console logging hook
 * 
 * @param options - Logging options
 * @returns Hook handler
 */
export function createConsoleHook(options?: {
  verbose?: boolean;
  prefix?: string;
}): VerificationHookHandler {
  const prefix = options?.prefix ?? '[verify]';
  const verbose = options?.verbose ?? false;
  
  return (event) => {
    const status = event.passed ? 'PASS' : 'FAIL';
    const typeShort = event.type.split(':')[0];
    
    const msg = `${prefix} ${typeShort}:${status} ${event.label}`;
    
    if (verbose) {
      const details = {
        expression: event.expression,
        duration: event.duration,
        context: event.context,
      };
      // Would use proper logger in production
    }
  };
}

/**
 * Create a structured JSON logging hook
 * 
 * @param writer - Function to write JSON lines
 * @returns Hook handler
 */
export function createJsonHook(
  writer: (json: string) => void
): VerificationHookHandler {
  return (event) => {
    writer(JSON.stringify(event));
  };
}

/**
 * Create a metrics collection hook
 * 
 * @returns Hook handler and metrics accessor
 */
export function createMetricsHook(): {
  handler: VerificationHookHandler;
  getMetrics: () => {
    total: number;
    passed: number;
    failed: number;
    byType: Record<string, { passed: number; failed: number }>;
    avgDuration: number;
  };
  reset: () => void;
} {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let totalDuration = 0;
  const byType: Record<string, { passed: number; failed: number }> = {};
  
  const handler: VerificationHookHandler = (event) => {
    // Only count the final pass/fail events
    if (!event.type.endsWith(':pass') && !event.type.endsWith(':fail')) {
      return;
    }
    
    total++;
    totalDuration += event.duration ?? 0;
    
    if (event.passed) {
      passed++;
    } else {
      failed++;
    }
    
    const checkType = event.type.split(':')[0] ?? 'unknown';
    if (!byType[checkType]) {
      byType[checkType] = { passed: 0, failed: 0 };
    }
    const typeStats = byType[checkType];
    if (typeStats) {
      if (event.passed) {
        typeStats.passed++;
      } else {
        typeStats.failed++;
      }
    }
  };
  
  const getMetrics = () => ({
    total,
    passed,
    failed,
    byType: { ...byType },
    avgDuration: total > 0 ? totalDuration / total : 0,
  });
  
  const reset = () => {
    total = 0;
    passed = 0;
    failed = 0;
    totalDuration = 0;
    Object.keys(byType).forEach((key) => delete byType[key]);
  };
  
  return { handler, getMetrics, reset };
}

/**
 * Create a filter hook that only forwards certain events
 * 
 * @param filter - Event types to forward
 * @param next - Next handler in chain
 * @returns Hook handler
 */
export function createFilterHook(
  filter: VerificationEventType[],
  next: VerificationHookHandler
): VerificationHookHandler {
  return (event) => {
    if (filter.includes(event.type)) {
      next(event);
    }
  };
}
