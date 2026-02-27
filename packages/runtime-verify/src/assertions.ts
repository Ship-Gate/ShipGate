// ============================================================================
// Runtime Assertions - require(), ensure(), invariant()
// ============================================================================

import type { AssertionOptions, VerificationContext, VerificationResult } from './types';
import {
  PreconditionError,
  PostconditionError,
  InvariantError,
  ErrorCode,
  type ErrorCodeType,
} from './errors';
import { emitEvent, hasHooks } from './hooks';

/**
 * Counter for generating unique event IDs
 */
let eventCounter = 0;

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

/**
 * Assert a precondition (require)
 * Throws PreconditionError if condition is false
 * 
 * @param condition - The condition to check
 * @param message - Error message if condition fails
 * @param options - Additional options
 * @returns The verification result
 * 
 * @example
 * ```typescript
 * require(amount > 0, 'Amount must be positive');
 * require(user != null, 'User is required', { label: 'user_validation' });
 * ```
 */
export function require(
  condition: boolean,
  message: string,
  options?: AssertionOptions
): VerificationResult {
  const startTime = performance.now();
  const label = options?.label ?? 'precondition';
  const expression = message;
  const context = options?.context ?? {};
  const throwOnFail = options?.throwOnFail ?? true;
  const errorCode = (options?.errorCode ?? ErrorCode.PRECONDITION_FAILED) as ErrorCodeType;
  
  const eventId = generateEventId();
  const passed = Boolean(condition);
  const duration = performance.now() - startTime;
  
  // Emit check event
  if (hasHooks()) {
    emitEvent({
      type: 'precondition:check',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
    
    // Emit pass/fail event
    emitEvent({
      type: passed ? 'precondition:pass' : 'precondition:fail',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
  }
  
  const result: VerificationResult = {
    passed,
    type: 'precondition',
    label,
    expression,
    duration,
  };
  
  if (!passed) {
    const error = new PreconditionError(message, {
      code: errorCode,
      context,
      expression,
    });
    
    result.error = {
      code: error.code,
      message: error.message,
      retriable: error.retriable,
      details: { context },
    };
    
    if (throwOnFail) {
      throw error;
    }
  }
  
  return result;
}

/**
 * Assert a postcondition (ensure)
 * Throws PostconditionError if condition is false
 * 
 * @param condition - The condition to check
 * @param message - Error message if condition fails
 * @param options - Additional options
 * @returns The verification result
 * 
 * @example
 * ```typescript
 * ensure(result != null, 'Result must not be null');
 * ensure(result.id.length > 0, 'Result must have an ID', { context: { result } });
 * ```
 */
export function ensure(
  condition: boolean,
  message: string,
  options?: AssertionOptions
): VerificationResult {
  const startTime = performance.now();
  const label = options?.label ?? 'postcondition';
  const expression = message;
  const context = options?.context ?? {};
  const throwOnFail = options?.throwOnFail ?? true;
  const errorCode = (options?.errorCode ?? ErrorCode.POSTCONDITION_FAILED) as ErrorCodeType;
  
  const eventId = generateEventId();
  const passed = Boolean(condition);
  const duration = performance.now() - startTime;
  
  // Emit check event
  if (hasHooks()) {
    emitEvent({
      type: 'postcondition:check',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
    
    // Emit pass/fail event
    emitEvent({
      type: passed ? 'postcondition:pass' : 'postcondition:fail',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
  }
  
  const result: VerificationResult = {
    passed,
    type: 'postcondition',
    label,
    expression,
    duration,
  };
  
  if (!passed) {
    const error = new PostconditionError(message, {
      code: errorCode,
      context,
      expression,
    });
    
    result.error = {
      code: error.code,
      message: error.message,
      retriable: error.retriable,
      details: { context },
    };
    
    if (throwOnFail) {
      throw error;
    }
  }
  
  return result;
}

/**
 * Assert an invariant
 * Throws InvariantError if condition is false
 * 
 * @param condition - The condition to check
 * @param message - Error message if condition fails
 * @param options - Additional options
 * @returns The verification result
 * 
 * @example
 * ```typescript
 * invariant(state.balance >= 0, 'Balance must never be negative');
 * invariant(list.length === set.size, 'List and set must have same size');
 * ```
 */
export function invariant(
  condition: boolean,
  message: string,
  options?: AssertionOptions
): VerificationResult {
  const startTime = performance.now();
  const label = options?.label ?? 'invariant';
  const expression = message;
  const context = options?.context ?? {};
  const throwOnFail = options?.throwOnFail ?? true;
  const errorCode = (options?.errorCode ?? ErrorCode.INVARIANT_FAILED) as ErrorCodeType;
  
  const eventId = generateEventId();
  const passed = Boolean(condition);
  const duration = performance.now() - startTime;
  
  // Emit check event
  if (hasHooks()) {
    emitEvent({
      type: 'invariant:check',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
    
    // Emit pass/fail event
    emitEvent({
      type: passed ? 'invariant:pass' : 'invariant:fail',
      timestamp: Date.now(),
      eventId,
      label,
      expression,
      passed,
      context,
      duration,
    });
  }
  
  const result: VerificationResult = {
    passed,
    type: 'invariant',
    label,
    expression,
    duration,
  };
  
  if (!passed) {
    const error = new InvariantError(message, {
      code: errorCode,
      context,
      expression,
    });
    
    result.error = {
      code: error.code,
      message: error.message,
      retriable: error.retriable,
      details: { context },
    };
    
    if (throwOnFail) {
      throw error;
    }
  }
  
  return result;
}

/**
 * Run multiple precondition checks at once
 * 
 * @param checks - Array of [condition, message, options?] tuples
 * @returns Array of verification results
 * 
 * @example
 * ```typescript
 * requireAll([
 *   [amount > 0, 'Amount must be positive'],
 *   [user != null, 'User is required'],
 *   [user.role === 'admin', 'User must be admin'],
 * ]);
 * ```
 */
export function requireAll(
  checks: Array<[boolean, string, AssertionOptions?]>
): VerificationResult[] {
  const results: VerificationResult[] = [];
  const failures: PreconditionError[] = [];
  
  for (const [condition, message, options] of checks) {
    const result = require(condition, message, {
      ...options,
      throwOnFail: false,
    });
    results.push(result);
    
    if (!result.passed && result.error) {
      failures.push(
        new PreconditionError(message, {
          context: options?.context,
          expression: message,
        })
      );
    }
  }
  
  // Throw combined error if any failed
  if (failures.length > 0) {
    const messages = failures.map((e) => e.message).join('; ');
    throw new PreconditionError(`Multiple precondition failures: ${messages}`, {
      context: {
        metadata: {
          failureCount: failures.length,
          failures: failures.map((e) => e.toJSON()),
        },
      },
    });
  }
  
  return results;
}

/**
 * Run multiple postcondition checks at once
 * 
 * @param checks - Array of [condition, message, options?] tuples
 * @returns Array of verification results
 */
export function ensureAll(
  checks: Array<[boolean, string, AssertionOptions?]>
): VerificationResult[] {
  const results: VerificationResult[] = [];
  const failures: PostconditionError[] = [];
  
  for (const [condition, message, options] of checks) {
    const result = ensure(condition, message, {
      ...options,
      throwOnFail: false,
    });
    results.push(result);
    
    if (!result.passed && result.error) {
      failures.push(
        new PostconditionError(message, {
          context: options?.context,
          expression: message,
        })
      );
    }
  }
  
  // Throw combined error if any failed
  if (failures.length > 0) {
    const messages = failures.map((e) => e.message).join('; ');
    throw new PostconditionError(`Multiple postcondition failures: ${messages}`, {
      context: {
        metadata: {
          failureCount: failures.length,
          failures: failures.map((e) => e.toJSON()),
        },
      },
    });
  }
  
  return results;
}

/**
 * Run multiple invariant checks at once
 * 
 * @param checks - Array of [condition, message, options?] tuples
 * @returns Array of verification results
 */
export function invariantAll(
  checks: Array<[boolean, string, AssertionOptions?]>
): VerificationResult[] {
  const results: VerificationResult[] = [];
  const failures: InvariantError[] = [];
  
  for (const [condition, message, options] of checks) {
    const result = invariant(condition, message, {
      ...options,
      throwOnFail: false,
    });
    results.push(result);
    
    if (!result.passed && result.error) {
      failures.push(
        new InvariantError(message, {
          context: options?.context,
          expression: message,
        })
      );
    }
  }
  
  // Throw combined error if any failed
  if (failures.length > 0) {
    const messages = failures.map((e) => e.message).join('; ');
    throw new InvariantError(`Multiple invariant failures: ${messages}`, {
      context: {
        metadata: {
          failureCount: failures.length,
          failures: failures.map((e) => e.toJSON()),
        },
      },
    });
  }
  
  return results;
}

/**
 * Reset the event counter (for testing)
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}
