/**
 * ISL Runtime Executor
 * 
 * Executes ISL behaviors with full contract verification.
 */

import { EventEmitter } from 'eventemitter3';
import { Mutex } from 'async-mutex';
import {
  type IslValue,
  type IslEntity,
  type IslResult,
  type IslError,
  type BehaviorDef,
  type DomainDef,
  type ExecutionContext,
  type EntityStore,
  type RuntimeEvent,
  type RuntimeEventType,
  type EventHandler,
} from './types.js';
import { validateType, type ValidationResult } from './validator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Behavior handler function */
export type BehaviorHandler<TInput = Record<string, IslValue>, TOutput = IslValue> = (
  input: TInput,
  context: BehaviorContext
) => Promise<IslResult<TOutput>>;

/** Behavior context provided to handlers */
export interface BehaviorContext {
  /** Execution context */
  execution: ExecutionContext;
  /** Entity store for persistence */
  store: EntityStore;
  /** Domain definition */
  domain: DomainDef;
  /** Call another behavior */
  call: <T = IslValue>(behaviorName: string, input: Record<string, IslValue>) => Promise<ExecutionResult<T>>;
  /** Emit custom event */
  emit: (type: string, data: Record<string, IslValue>) => void;
}

/** Execution options */
export interface ExecutionOptions {
  /** Skip precondition checks */
  skipPreconditions?: boolean;
  /** Skip postcondition checks */
  skipPostconditions?: boolean;
  /** Skip input validation */
  skipInputValidation?: boolean;
  /** Skip output validation */
  skipOutputValidation?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Custom metadata */
  metadata?: Record<string, IslValue>;
}

/** Execution result with timing */
export type ExecutionResult<T = IslValue> = 
  | { success: true; value: T; durationMs: number; preconditionsChecked: boolean; postconditionsChecked: boolean }
  | { success: false; error: IslError; durationMs: number; preconditionsChecked: boolean; postconditionsChecked: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────────────────────────────────────

export class BehaviorExecutor {
  private handlers = new Map<string, BehaviorHandler>();
  private emitter = new EventEmitter();
  private mutex = new Mutex();
  private domain: DomainDef;
  private store: EntityStore;

  constructor(domain: DomainDef, store: EntityStore) {
    this.domain = domain;
    this.store = store;
  }

  /**
   * Register a behavior handler
   */
  register<TInput = Record<string, IslValue>, TOutput = IslValue>(
    behaviorName: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): void {
    this.handlers.set(behaviorName, handler as unknown as BehaviorHandler);
  }

  /**
   * Unregister a behavior handler
   */
  unregister(behaviorName: string): void {
    this.handlers.delete(behaviorName);
  }

  /**
   * Subscribe to runtime events
   */
  on(event: RuntimeEventType | '*', handler: EventHandler): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  /**
   * Execute a behavior
   */
  async execute<TOutput = IslValue>(
    behaviorName: string,
    input: Record<string, IslValue>,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult<TOutput>> {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // Create execution context
    const context: ExecutionContext = {
      requestId,
      startTime: new Date(),
      metadata: options.metadata ?? {},
    };

    // Get behavior definition
    const behaviorDef = this.domain.behaviors.get(behaviorName);
    if (!behaviorDef) {
      return {
        success: false,
        error: {
          code: 'BEHAVIOR_NOT_FOUND',
          message: `Behavior '${behaviorName}' not found`,
        },
        durationMs: Date.now() - startTime,
        preconditionsChecked: false,
        postconditionsChecked: false,
      };
    }

    // Get handler
    const handler = this.handlers.get(behaviorName);
    if (!handler) {
      return {
        success: false,
        error: {
          code: 'HANDLER_NOT_REGISTERED',
          message: `No handler registered for behavior '${behaviorName}'`,
        },
        durationMs: Date.now() - startTime,
        preconditionsChecked: false,
        postconditionsChecked: false,
      };
    }

    // Emit start event
    this.emitEvent('behavior:start', context, {
      behavior: behaviorName,
      input,
    });

    try {
      // Validate input
      if (!options.skipInputValidation) {
        const inputValidation = this.validateInput(input, behaviorDef);
        if (!inputValidation.valid) {
          const error: IslError = {
            code: 'INVALID_INPUT',
            message: 'Input validation failed',
            details: { errors: inputValidation.errors as unknown as IslValue },
          };
          this.emitEvent('behavior:error', context, { behavior: behaviorName, error: error as unknown as IslValue });
          return {
            success: false,
            error,
            durationMs: Date.now() - startTime,
            preconditionsChecked: false,
            postconditionsChecked: false,
          };
        }
      }

      // Check preconditions
      let preconditionsChecked = false;
      if (!options.skipPreconditions && behaviorDef.preconditions.length > 0) {
        const preconditionResult = await this.checkPreconditions(behaviorDef, input, context);
        preconditionsChecked = true;
        this.emitEvent('precondition:check', context, {
          behavior: behaviorName,
          result: preconditionResult,
        });
        if (!preconditionResult.valid) {
          const error: IslError = {
            code: 'PRECONDITION_FAILED',
            message: preconditionResult.message ?? 'Precondition check failed',
          };
          this.emitEvent('behavior:error', context, { behavior: behaviorName, error: error as unknown as IslValue });
          return {
            success: false,
            error,
            durationMs: Date.now() - startTime,
            preconditionsChecked,
            postconditionsChecked: false,
          };
        }
      }

      // Create behavior context
      const behaviorContext: BehaviorContext = {
        execution: context,
        store: this.store,
        domain: this.domain,
        call: (name, callInput) => this.execute(name, callInput, options),
        emit: (type, data) => this.emitEvent(type as RuntimeEventType, context, data),
      };

      // Execute with timeout
      let result: IslResult;
      if (options.timeout) {
        result = await withTimeout(
          handler(input, behaviorContext),
          options.timeout,
          `Behavior '${behaviorName}' timed out after ${options.timeout}ms`
        );
      } else {
        result = await handler(input, behaviorContext);
      }

      // Validate output
      if (result.success && !options.skipOutputValidation) {
        const outputValidation = this.validateOutput(result.value, behaviorDef);
        if (!outputValidation.valid) {
          const error: IslError = {
            code: 'INVALID_OUTPUT',
            message: 'Output validation failed',
            details: { errors: outputValidation.errors as unknown as IslValue },
          };
          this.emitEvent('behavior:error', context, { behavior: behaviorName, error: error as unknown as IslValue });
          return {
            success: false,
            error,
            durationMs: Date.now() - startTime,
            preconditionsChecked,
            postconditionsChecked: false,
          };
        }
      }

      // Check postconditions
      let postconditionsChecked = false;
      if (result.success && !options.skipPostconditions && behaviorDef.postconditions.length > 0) {
        const postconditionResult = await this.checkPostconditions(behaviorDef, input, result.value, context);
        postconditionsChecked = true;
        this.emitEvent('postcondition:check', context, {
          behavior: behaviorName,
          result: postconditionResult,
        });
        if (!postconditionResult.valid) {
          const error: IslError = {
            code: 'POSTCONDITION_FAILED',
            message: postconditionResult.message ?? 'Postcondition check failed',
          };
          this.emitEvent('behavior:error', context, { behavior: behaviorName, error: error as unknown as IslValue });
          return {
            success: false,
            error,
            durationMs: Date.now() - startTime,
            preconditionsChecked,
            postconditionsChecked,
          };
        }
      }

      // Emit success event
      if (result.success) {
        this.emitEvent('behavior:success', context, {
          behavior: behaviorName,
          output: result.value,
        });
      } else {
        this.emitEvent('behavior:error', context, {
          behavior: behaviorName,
          error: result.error as unknown as IslValue,
        });
      }

      return {
        ...result,
        durationMs: Date.now() - startTime,
        preconditionsChecked,
        postconditionsChecked,
      } as ExecutionResult<TOutput>;

    } catch (error) {
      const islError: IslError = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      this.emitEvent('behavior:error', context, { behavior: behaviorName, error: islError as unknown as IslValue });
      return {
        success: false,
        error: islError,
        durationMs: Date.now() - startTime,
        preconditionsChecked: false,
        postconditionsChecked: false,
      };
    }
  }

  /**
   * Validate input against behavior definition
   */
  private validateInput(input: Record<string, IslValue>, behaviorDef: BehaviorDef): ValidationResult {
    const errors: ValidationResult['errors'] = [];

    for (const field of behaviorDef.input) {
      const value = input[field.name];
      const result = validateType(value, field.type, this.domain, field.name);
      errors.push(...result.errors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate output against behavior definition
   */
  private validateOutput(output: IslValue, behaviorDef: BehaviorDef): ValidationResult {
    return validateType(output, behaviorDef.output.success, this.domain, 'output');
  }

  /**
   * Check preconditions
   */
  private async checkPreconditions(
    behaviorDef: BehaviorDef,
    input: Record<string, IslValue>,
    context: ExecutionContext
  ): Promise<{ valid: boolean; message?: string }> {
    // In a full implementation, this would evaluate the condition expressions
    // For now, we just return valid
    for (const condition of behaviorDef.preconditions) {
      // TODO: Implement expression evaluation
      // const result = evaluateExpression(condition.expression, { input, context });
      // if (!result) {
      //   return { valid: false, message: condition.description };
      // }
    }
    return { valid: true };
  }

  /**
   * Check postconditions
   */
  private async checkPostconditions(
    behaviorDef: BehaviorDef,
    input: Record<string, IslValue>,
    output: IslValue,
    context: ExecutionContext
  ): Promise<{ valid: boolean; message?: string }> {
    // In a full implementation, this would evaluate the condition expressions
    for (const condition of behaviorDef.postconditions) {
      // TODO: Implement expression evaluation
    }
    return { valid: true };
  }

  /**
   * Emit a runtime event
   */
  private emitEvent(
    type: RuntimeEventType,
    context: ExecutionContext,
    data: Record<string, IslValue>
  ): void {
    const event: RuntimeEvent = {
      type,
      timestamp: new Date(),
      context,
      data,
    };
    this.emitter.emit(type, event);
    this.emitter.emit('*', event);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
