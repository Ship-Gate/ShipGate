/**
 * ISL Universal Runtime Engine
 * The core execution engine for running ISL specifications
 */

import {
  ExecutionContext,
  ExecutionResult,
  BehaviorDefinition,
  RuntimeConfig,
  RuntimeEvent,
  RuntimeEventType,
  RuntimePlugin,
  EffectHandler,
  Validator,
  StateSnapshot,
  EntityState,
  Actor,
  VerificationResult,
  ConditionResult,
  AppliedEffect,
  ExecutionError,
} from './types';
import { ISLSandbox } from './sandbox';
import { StateManager } from './state';
import { EffectExecutor } from './effects';

/**
 * Default runtime configuration
 */
const DEFAULT_CONFIG: RuntimeConfig = {
  sandbox: true,
  defaultTimeout: 30000,
  maxExecutionDepth: 10,
  persistState: true,
  enableLogging: true,
  enableMetrics: true,
  distributed: false,
  verificationMode: 'strict',
  hotReload: true,
};

/**
 * Universal Runtime Engine
 */
export class UniversalRuntime {
  private config: RuntimeConfig;
  private behaviors: Map<string, BehaviorDefinition> = new Map();
  private plugins: Map<string, RuntimePlugin> = new Map();
  private effectHandlers: Map<string, EffectHandler> = new Map();
  private validators: Map<string, Validator> = new Map();
  private eventHandlers: Map<RuntimeEventType, Set<(event: RuntimeEvent) => void>> = new Map();
  private stateManager: StateManager;
  private sandbox: ISLSandbox;
  private effectExecutor: EffectExecutor;
  private executionDepth = 0;

  constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateManager = new StateManager();
    this.sandbox = new ISLSandbox();
    this.effectExecutor = new EffectExecutor(this.effectHandlers);
    this.registerBuiltinEffects();
    this.registerBuiltinValidators();
  }

  /**
   * Initialize the runtime
   */
  async initialize(): Promise<void> {
    await this.sandbox.initialize();
    
    for (const plugin of this.plugins.values()) {
      await plugin.initialize(this.createRuntimeAPI());
    }

    this.emit('behavior:loaded', { count: this.behaviors.size });
  }

  /**
   * Shutdown the runtime
   */
  async shutdown(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.destroy();
    }
    await this.sandbox.destroy();
  }

  /**
   * Register a behavior definition
   */
  registerBehavior(behavior: BehaviorDefinition): void {
    const key = `${behavior.domain}.${behavior.name}`;
    const existing = this.behaviors.has(key);
    this.behaviors.set(key, behavior);

    if (existing && this.config.hotReload) {
      this.emit('behavior:reloaded', { domain: behavior.domain, behavior: behavior.name });
    } else {
      this.emit('behavior:loaded', { domain: behavior.domain, behavior: behavior.name });
    }
  }

  /**
   * Register multiple behaviors
   */
  registerBehaviors(behaviors: BehaviorDefinition[]): void {
    for (const behavior of behaviors) {
      this.registerBehavior(behavior);
    }
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: RuntimePlugin): Promise<void> {
    this.plugins.set(plugin.name, plugin);
    await plugin.initialize(this.createRuntimeAPI());
  }

  /**
   * Execute a behavior
   */
  async execute<T = unknown>(
    domain: string,
    behavior: string,
    input: Record<string, unknown>,
    actor: Actor
  ): Promise<ExecutionResult<T>> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    // Check execution depth
    if (this.executionDepth >= this.config.maxExecutionDepth) {
      return this.createErrorResult(executionId, startTime, {
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Maximum execution depth of ${this.config.maxExecutionDepth} exceeded`,
        type: 'runtime',
        retryable: false,
      });
    }

    // Get behavior definition
    const behaviorDef = this.behaviors.get(`${domain}.${behavior}`);
    if (!behaviorDef) {
      return this.createErrorResult(executionId, startTime, {
        code: 'BEHAVIOR_NOT_FOUND',
        message: `Behavior ${domain}.${behavior} not found`,
        type: 'runtime',
        retryable: false,
      });
    }

    // Create execution context
    const context = this.createExecutionContext(executionId, domain, behavior, input, actor);

    this.emit('execution:started', { executionId, domain, behavior, actor: actor.id });

    try {
      this.executionDepth++;

      // Validate input
      const inputValidation = this.validateInput(input, behaviorDef);
      if (!inputValidation.valid) {
        return this.createErrorResult(executionId, startTime, {
          code: 'INVALID_INPUT',
          message: inputValidation.message ?? 'Invalid input',
          type: 'runtime',
          details: inputValidation.details,
          retryable: false,
        });
      }

      // Check preconditions
      const preconditionResults = await this.evaluateConditions(
        behaviorDef.preconditions,
        context,
        'precondition'
      );

      if (this.config.verificationMode === 'strict') {
        const failedPreconditions = preconditionResults.filter((r) => !r.passed);
        if (failedPreconditions.length > 0) {
          return this.createErrorResult(executionId, startTime, {
            code: 'PRECONDITION_FAILED',
            message: failedPreconditions.map((p) => p.message ?? p.name).join(', '),
            type: 'precondition',
            details: { failed: failedPreconditions },
            retryable: false,
          });
        }
      }

      // Execute behavior logic
      const { output } = await this.executeBehaviorLogic(behaviorDef, context);

      // Apply effects
      const appliedEffects = await this.applyEffects(behaviorDef.effects, context);

      // Get state changes
      const stateChanges = this.stateManager.getChangesSince(context.state.version);

      // Check postconditions
      const postconditionResults = await this.evaluateConditions(
        behaviorDef.postconditions,
        { ...context, output },
        'postcondition'
      );

      // Check invariants
      const invariantResults = await this.evaluateConditions(
        behaviorDef.invariants,
        { ...context, output },
        'invariant'
      );

      // Verify postconditions in strict mode
      if (this.config.verificationMode === 'strict') {
        const failedPostconditions = postconditionResults.filter((r) => !r.passed);
        if (failedPostconditions.length > 0) {
          // Rollback state changes
          await this.stateManager.rollback(context.state.version);
          
          return this.createErrorResult(executionId, startTime, {
            code: 'POSTCONDITION_FAILED',
            message: failedPostconditions.map((p) => p.message ?? p.name).join(', '),
            type: 'postcondition',
            details: { failed: failedPostconditions },
            retryable: true,
          });
        }
      }

      // Build verification result
      const verificationResult: VerificationResult = {
        verdict: this.calculateVerdict(preconditionResults, postconditionResults, invariantResults),
        score: this.calculateScore(preconditionResults, postconditionResults, invariantResults),
        preconditions: preconditionResults,
        postconditions: postconditionResults,
        invariants: invariantResults,
      };

      const result: ExecutionResult<T> = {
        success: true,
        executionId,
        output: output as T,
        effects: appliedEffects,
        duration: Date.now() - startTime,
        verificationResult,
        stateChanges,
      };

      this.emit('execution:completed', {
        executionId,
        domain,
        behavior,
        duration: result.duration,
        verdict: verificationResult.verdict,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      
      this.emit('execution:failed', {
        executionId,
        domain,
        behavior,
        error: err.message,
      });

      return this.createErrorResult(executionId, startTime, {
        code: 'RUNTIME_ERROR',
        message: err.message,
        type: 'runtime',
        stack: err.stack,
        retryable: true,
      });
    } finally {
      this.executionDepth--;
    }
  }

  /**
   * Execute with retry
   */
  async executeWithRetry<T = unknown>(
    domain: string,
    behavior: string,
    input: Record<string, unknown>,
    actor: Actor
  ): Promise<ExecutionResult<T>> {
    const behaviorDef = this.behaviors.get(`${domain}.${behavior}`);
    const retryPolicy = behaviorDef?.retryPolicy ?? {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
    };

    let lastResult: ExecutionResult<T> | undefined;
    let delay = retryPolicy.initialDelay;

    for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
      lastResult = await this.execute<T>(domain, behavior, input, actor);

      if (lastResult.success || !lastResult.error?.retryable) {
        return lastResult;
      }

      if (attempt < retryPolicy.maxAttempts - 1) {
        await this.sleep(delay);
        delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelay);
      }
    }

    return lastResult!;
  }

  /**
   * Subscribe to runtime events
   */
  subscribe(event: RuntimeEventType, handler: (event: RuntimeEvent) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Get current state
   */
  getState(): StateSnapshot {
    return this.stateManager.getSnapshot();
  }

  /**
   * Get entity by ID
   */
  getEntity(type: string, id: string): EntityState | undefined {
    return this.stateManager.getEntity(type, id);
  }

  /**
   * Query entities
   */
  queryEntities(type: string, predicate?: (entity: EntityState) => boolean): EntityState[] {
    return this.stateManager.queryEntities(type, predicate);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private createExecutionContext(
    executionId: string,
    domain: string,
    behavior: string,
    input: Record<string, unknown>,
    actor: Actor
  ): ExecutionContext {
    return {
      executionId,
      domain,
      behavior,
      actor,
      input,
      state: this.stateManager.getSnapshot(),
      metadata: {
        startTime: Date.now(),
        timeout: this.config.defaultTimeout,
        retryCount: 0,
        maxRetries: 3,
        tags: {},
      },
      traceId: this.generateTraceId(),
    };
  }

  private async evaluateConditions(
    conditions: BehaviorDefinition['preconditions'],
    context: ExecutionContext & { output?: unknown },
    type: 'precondition' | 'postcondition' | 'invariant'
  ): Promise<ConditionResult[]> {
    const results: ConditionResult[] = [];

    for (const condition of conditions) {
      try {
        const passed = await this.sandbox.evaluate(condition.expression, {
          input: context.input,
          output: context.output,
          state: context.state,
          actor: context.actor,
        });

        results.push({
          name: condition.name,
          passed: Boolean(passed),
          expression: condition.expression,
          message: passed ? undefined : condition.message,
        });

        this.emit('condition:evaluated', {
          executionId: context.executionId,
          type,
          name: condition.name,
          passed,
        });
      } catch (error) {
        results.push({
          name: condition.name,
          passed: false,
          expression: condition.expression,
          message: `Error evaluating condition: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  private async executeBehaviorLogic(
    _behavior: BehaviorDefinition,
    context: ExecutionContext
  ): Promise<{ output: unknown; effects: AppliedEffect[] }> {
    // In a real implementation, this would execute the behavior's logic
    // For now, we simulate execution
    const output = { ...context.input };
    const effects: AppliedEffect[] = [];

    return { output, effects };
  }

  private async applyEffects(
    effects: BehaviorDefinition['effects'],
    context: ExecutionContext
  ): Promise<AppliedEffect[]> {
    return this.effectExecutor.executeAll(effects, context);
  }

  private validateInput(
    input: Record<string, unknown>,
    behavior: BehaviorDefinition
  ): { valid: boolean; message?: string; details?: Record<string, unknown> } {
    const errors: string[] = [];

    for (const param of behavior.input) {
      const value = input[param.name];

      if (param.required && value === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (value !== undefined && param.constraints) {
        for (const constraint of param.constraints) {
          const validator = this.validators.get(constraint.type);
          if (validator) {
            const result = validator(value, constraint);
            if (!result.valid) {
              errors.push(result.message ?? `Invalid ${param.name}`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.join('; '),
      details: { errors },
    };
  }

  private calculateVerdict(
    preconditions: ConditionResult[],
    postconditions: ConditionResult[],
    invariants: ConditionResult[]
  ): 'pass' | 'fail' | 'error' {
    const allPassed = [
      ...preconditions,
      ...postconditions,
      ...invariants,
    ].every((r) => r.passed);

    return allPassed ? 'pass' : 'fail';
  }

  private calculateScore(
    preconditions: ConditionResult[],
    postconditions: ConditionResult[],
    invariants: ConditionResult[]
  ): number {
    const all = [...preconditions, ...postconditions, ...invariants];
    if (all.length === 0) return 100;

    const passed = all.filter((r) => r.passed).length;
    return Math.round((passed / all.length) * 100);
  }

  private createErrorResult<T>(
    executionId: string,
    startTime: number,
    error: ExecutionError
  ): ExecutionResult<T> {
    return {
      success: false,
      executionId,
      error,
      effects: [],
      duration: Date.now() - startTime,
      verificationResult: {
        verdict: 'error',
        score: 0,
        preconditions: [],
        postconditions: [],
        invariants: [],
      },
      stateChanges: [],
    };
  }

  private emit(type: RuntimeEventType, data: Record<string, unknown>): void {
    const event: RuntimeEvent = {
      type,
      executionId: (data.executionId as string) ?? 'system',
      timestamp: Date.now(),
      data,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  private createRuntimeAPI() {
    return {
      execute: this.execute.bind(this),
      getState: this.getState.bind(this),
      setState: (state: StateSnapshot) => this.stateManager.setState(state),
      subscribe: this.subscribe.bind(this),
      registerEffect: (type: string, handler: EffectHandler) => {
        this.effectHandlers.set(type, handler);
      },
      registerValidator: (type: string, validator: Validator) => {
        this.validators.set(type, validator);
      },
    };
  }

  private registerBuiltinEffects(): void {
    this.effectHandlers.set('create', async (effect, _context) => {
      const entity = this.stateManager.createEntity(effect.target, {});
      return {
        type: 'create',
        target: effect.target,
        timestamp: Date.now(),
        data: entity,
        success: true,
      };
    });

    this.effectHandlers.set('update', async (effect, _context) => {
      return {
        type: 'update',
        target: effect.target,
        timestamp: Date.now(),
        success: true,
      };
    });

    this.effectHandlers.set('delete', async (effect, _context) => {
      return {
        type: 'delete',
        target: effect.target,
        timestamp: Date.now(),
        success: true,
      };
    });
  }

  private registerBuiltinValidators(): void {
    this.validators.set('min', (value, constraint) => ({
      valid: typeof value === 'number' && value >= (constraint.value as number),
      message: constraint.message ?? `Value must be at least ${constraint.value}`,
    }));

    this.validators.set('max', (value, constraint) => ({
      valid: typeof value === 'number' && value <= (constraint.value as number),
      message: constraint.message ?? `Value must be at most ${constraint.value}`,
    }));

    this.validators.set('pattern', (value, constraint) => ({
      valid:
        typeof value === 'string' &&
        new RegExp(constraint.value as string).test(value),
      message: constraint.message ?? `Value does not match pattern`,
    }));

    this.validators.set('length', (value, constraint) => {
      const len = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
      const expected = constraint.value as { min?: number; max?: number };
      const valid =
        (expected.min === undefined || len >= expected.min) &&
        (expected.max === undefined || len <= expected.max);
      return { valid, message: constraint.message ?? `Invalid length` };
    });
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new runtime instance
 */
export function createRuntime(config?: Partial<RuntimeConfig>): UniversalRuntime {
  return new UniversalRuntime(config);
}
