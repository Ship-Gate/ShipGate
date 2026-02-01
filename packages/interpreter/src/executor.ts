// ============================================================================
// ISL Interpreter - Function Executor
// @isl-lang/interpreter/executor
// ============================================================================

import type { Value, Environment, ExecutionContext } from '@isl-lang/runtime-interpreter';
import type {
  TargetFunction,
  TargetModule,
  Bindings,
  SandboxOptions,
  SandboxResult,
  VerificationOptions,
} from './types';
import { InterpreterError, TimeoutError } from './types';
import { toValue, fromValue, loadTargetModule } from './bindings';
import { runInSandbox, runWithTimeout } from './sandbox';

// ============================================================================
// STATE CAPTURE
// ============================================================================

export interface CapturedState {
  /** The captured values at this point in time */
  values: Map<string, Value>;
  
  /** Timestamp of capture */
  timestamp: Date;
  
  /** Any side effects observed */
  sideEffects: SideEffect[];
}

export interface SideEffect {
  type: 'console' | 'network' | 'file' | 'database' | 'event';
  operation: string;
  args: unknown[];
  timestamp: Date;
}

/**
 * Capture the current state from bindings.
 */
export function captureState(bindings: Bindings): CapturedState {
  return {
    values: new Map(bindings.pre),
    timestamp: new Date(),
    sideEffects: [],
  };
}

/**
 * Deep clone a map of values.
 */
export function cloneValues(values: Map<string, Value>): Map<string, Value> {
  const cloned = new Map<string, Value>();
  for (const [key, value] of values) {
    cloned.set(key, cloneValue(value));
  }
  return cloned;
}

/**
 * Deep clone a value.
 */
export function cloneValue(value: Value): Value {
  switch (value.tag) {
    case 'unit':
    case 'boolean':
    case 'int':
    case 'float':
    case 'decimal':
    case 'string':
    case 'uuid':
      return { ...value };
      
    case 'bytes':
      return { tag: 'bytes', value: new Uint8Array(value.value) };
      
    case 'timestamp':
      return { tag: 'timestamp', value: new Date(value.value) };
      
    case 'duration':
      return { ...value };
      
    case 'list':
      return { tag: 'list', elements: value.elements.map(cloneValue) };
      
    case 'map': {
      const entries = new Map<string, Value>();
      for (const [k, v] of value.entries) {
        entries.set(k, cloneValue(v));
      }
      return { tag: 'map', entries };
    }
    
    case 'set': {
      const elements = new Set<Value>();
      for (const v of value.elements) {
        elements.add(cloneValue(v));
      }
      return { tag: 'set', elements };
    }
    
    case 'option':
      return { tag: 'option', value: value.value ? cloneValue(value.value) : null };
      
    case 'result':
      return {
        tag: 'result',
        success: value.success,
        value: cloneValue(value.value),
        error: value.error ? cloneValue(value.error) : undefined,
      };
      
    case 'record': {
      const fields = new Map<string, Value>();
      for (const [k, v] of value.fields) {
        fields.set(k, cloneValue(v));
      }
      return { tag: 'record', type: value.type, fields };
    }
    
    case 'entity': {
      const fields = new Map<string, Value>();
      for (const [k, v] of value.fields) {
        fields.set(k, cloneValue(v));
      }
      return { tag: 'entity', type: value.type, id: value.id, fields, version: value.version };
    }
    
    case 'enum':
      return {
        tag: 'enum',
        type: value.type,
        variant: value.variant,
        data: value.data ? cloneValue(value.data) : undefined,
      };
      
    case 'function':
    case 'native':
    case 'behavior_result':
    case 'effect':
    case 'continuation':
      // These are not easily clonable, return as-is
      return value;
      
    default:
      return value;
  }
}

// ============================================================================
// FUNCTION EXECUTION
// ============================================================================

export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  
  /** Return value (if success) */
  result?: Value;
  
  /** Error (if failure) */
  error?: Error;
  
  /** State before execution */
  preState: CapturedState;
  
  /** State after execution */
  postState: CapturedState;
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Whether execution timed out */
  timedOut: boolean;
}

/**
 * Execute a target function with state capture.
 */
export async function executeFunction(
  targetFn: TargetFunction,
  args: unknown[],
  bindings: Bindings,
  options: VerificationOptions
): Promise<ExecutionResult> {
  const startTime = performance.now();
  
  // Capture pre-state
  const preState = captureState(bindings);
  bindings.old = cloneValues(bindings.pre);
  
  // Execute function with timeout
  const sandboxResult = await runWithTimeout(
    () => targetFn.fn(...args),
    options.timeout
  );
  
  // Capture post-state
  const postState: CapturedState = {
    values: new Map(bindings.post),
    timestamp: new Date(),
    sideEffects: [],
  };
  
  if (sandboxResult.success) {
    const resultValue = toValue(sandboxResult.value);
    bindings.result = resultValue;
    
    return {
      success: true,
      result: resultValue,
      preState,
      postState,
      duration: sandboxResult.duration,
      timedOut: false,
    };
  } else {
    return {
      success: false,
      error: sandboxResult.error,
      preState,
      postState,
      duration: sandboxResult.duration,
      timedOut: sandboxResult.timedOut,
    };
  }
}

/**
 * Execute a behavior dynamically by loading the target module and calling the function.
 */
export async function executeBehavior(
  behaviorName: string,
  targetPath: string,
  bindings: Bindings,
  options: VerificationOptions
): Promise<ExecutionResult> {
  // Load target module
  const targetModule = await loadTargetModule(targetPath);
  
  // Find the function matching the behavior name
  // Try exact match first, then camelCase conversion
  let targetFn = targetModule.exports.get(behaviorName);
  if (!targetFn) {
    // Try camelCase: TransferFunds -> transferFunds
    const camelName = behaviorName.charAt(0).toLowerCase() + behaviorName.slice(1);
    targetFn = targetModule.exports.get(camelName);
  }
  if (!targetFn) {
    // Try snake_case: TransferFunds -> transfer_funds
    const snakeName = behaviorName.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1);
    targetFn = targetModule.exports.get(snakeName);
  }
  
  if (!targetFn) {
    throw new InterpreterError(
      `Function "${behaviorName}" not found in module ${targetPath}. ` +
      `Available exports: ${Array.from(targetModule.exports.keys()).join(', ')}`,
      'FUNCTION_NOT_FOUND',
      { behaviorName, targetPath }
    );
  }
  
  // Extract arguments from pre-state bindings
  const args = Array.from(bindings.pre.values()).map(fromValue);
  
  return executeFunction(targetFn, args, bindings, options);
}

// ============================================================================
// STATE COMPARISON
// ============================================================================

/**
 * Compare two states and return differences.
 */
export function compareStates(
  pre: CapturedState,
  post: CapturedState
): StateComparison {
  const added = new Map<string, Value>();
  const removed = new Map<string, Value>();
  const changed = new Map<string, { before: Value; after: Value }>();
  const unchanged = new Map<string, Value>();
  
  // Check for removed and changed values
  for (const [key, preValue] of pre.values) {
    const postValue = post.values.get(key);
    if (postValue === undefined) {
      removed.set(key, preValue);
    } else if (!valuesEqual(preValue, postValue)) {
      changed.set(key, { before: preValue, after: postValue });
    } else {
      unchanged.set(key, preValue);
    }
  }
  
  // Check for added values
  for (const [key, postValue] of post.values) {
    if (!pre.values.has(key)) {
      added.set(key, postValue);
    }
  }
  
  return { added, removed, changed, unchanged };
}

export interface StateComparison {
  added: Map<string, Value>;
  removed: Map<string, Value>;
  changed: Map<string, { before: Value; after: Value }>;
  unchanged: Map<string, Value>;
}

/**
 * Check if two values are equal.
 */
export function valuesEqual(a: Value, b: Value): boolean {
  if (a.tag !== b.tag) return false;
  
  switch (a.tag) {
    case 'unit':
      return true;
    case 'boolean':
      return a.value === (b as typeof a).value;
    case 'int':
      return a.value === (b as typeof a).value;
    case 'float':
      return a.value === (b as typeof a).value;
    case 'decimal':
      return a.value === (b as typeof a).value;
    case 'string':
      return a.value === (b as typeof a).value;
    case 'uuid':
      return a.value === (b as typeof a).value;
    case 'timestamp':
      return a.value.getTime() === (b as typeof a).value.getTime();
    case 'duration':
      return a.value === (b as typeof a).value && a.unit === (b as typeof a).unit;
    case 'bytes':
      return arraysEqual(a.value, (b as typeof a).value);
    case 'list': {
      const bList = b as typeof a;
      if (a.elements.length !== bList.elements.length) return false;
      return a.elements.every((e, i) => valuesEqual(e, bList.elements[i]!));
    }
    case 'map': {
      const bMap = b as typeof a;
      if (a.entries.size !== bMap.entries.size) return false;
      for (const [k, v] of a.entries) {
        const bv = bMap.entries.get(k);
        if (!bv || !valuesEqual(v, bv)) return false;
      }
      return true;
    }
    case 'set': {
      const bSet = b as typeof a;
      if (a.elements.size !== bSet.elements.size) return false;
      for (const v of a.elements) {
        let found = false;
        for (const bv of bSet.elements) {
          if (valuesEqual(v, bv)) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return true;
    }
    case 'option':
      if (a.value === null) return (b as typeof a).value === null;
      if ((b as typeof a).value === null) return false;
      return valuesEqual(a.value, (b as typeof a).value!);
    case 'result':
      if (a.success !== (b as typeof a).success) return false;
      return valuesEqual(a.value, (b as typeof a).value);
    case 'record':
    case 'entity': {
      const bRec = b as typeof a;
      if (a.type !== bRec.type) return false;
      if (a.fields.size !== bRec.fields.size) return false;
      for (const [k, v] of a.fields) {
        const bv = bRec.fields.get(k);
        if (!bv || !valuesEqual(v, bv)) return false;
      }
      return true;
    }
    case 'enum':
      return (
        a.type === (b as typeof a).type &&
        a.variant === (b as typeof a).variant &&
        (a.data === undefined
          ? (b as typeof a).data === undefined
          : (b as typeof a).data !== undefined && valuesEqual(a.data, (b as typeof a).data!))
      );
    default:
      return false;
  }
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// WRAPPED FUNCTION EXECUTION (with ISL assertions)
// ============================================================================

export interface WrappedFunction {
  name: string;
  originalFn: TargetFunction['fn'];
  preconditions: ((args: unknown[]) => boolean)[];
  postconditions: ((args: unknown[], result: unknown, oldState: unknown) => boolean)[];
  invariants: ((state: unknown) => boolean)[];
}

/**
 * Wrap a function with ISL assertions.
 */
export function wrapWithAssertions(
  fn: TargetFunction,
  preconditions: WrappedFunction['preconditions'],
  postconditions: WrappedFunction['postconditions'],
  invariants: WrappedFunction['invariants']
): TargetFunction['fn'] {
  return async (...args: unknown[]) => {
    // Check preconditions
    for (const pre of preconditions) {
      if (!pre(args)) {
        throw new InterpreterError('Precondition violation', 'PRECONDITION_VIOLATION', { args });
      }
    }
    
    // Capture old state (simplified - just args for now)
    const oldState = JSON.parse(JSON.stringify(args));
    
    // Call original function
    const result = await fn.fn(...args);
    
    // Check postconditions
    for (const post of postconditions) {
      if (!post(args, result, oldState)) {
        throw new InterpreterError('Postcondition violation', 'POSTCONDITION_VIOLATION', {
          args,
          result,
          oldState,
        });
      }
    }
    
    // Check invariants
    for (const inv of invariants) {
      if (!inv({ args, result })) {
        throw new InterpreterError('Invariant violation', 'INVARIANT_VIOLATION', { args, result });
      }
    }
    
    return result;
  };
}
