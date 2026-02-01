/**
 * Effect System for ISL Runtime
 * Manages side effects in a controlled, traceable manner
 */

import {
  EffectDefinition,
  AppliedEffect,
  ExecutionContext,
  EffectHandler,
} from './types';

/**
 * Effect executor - manages effect execution
 */
export class EffectExecutor {
  private handlers: Map<string, EffectHandler>;
  private middleware: EffectMiddleware[] = [];

  constructor(handlers: Map<string, EffectHandler>) {
    this.handlers = handlers;
  }

  /**
   * Add middleware
   */
  use(middleware: EffectMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute a single effect
   */
  async execute(
    effect: EffectDefinition,
    context: ExecutionContext
  ): Promise<AppliedEffect> {
    const handler = this.handlers.get(effect.type);
    if (!handler) {
      return {
        type: effect.type,
        target: effect.target,
        timestamp: Date.now(),
        success: false,
        error: `No handler for effect type: ${effect.type}`,
      };
    }

    try {
      // Run middleware before
      for (const mw of this.middleware) {
        if (mw.before) {
          await mw.before(effect, context);
        }
      }

      // Execute handler
      const result = await handler(effect, context);

      // Run middleware after
      for (const mw of this.middleware) {
        if (mw.after) {
          await mw.after(effect, context, result);
        }
      }

      return result;
    } catch (error) {
      const appliedEffect: AppliedEffect = {
        type: effect.type,
        target: effect.target,
        timestamp: Date.now(),
        success: false,
        error: (error as Error).message,
      };

      // Run error middleware
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(effect, context, error as Error);
        }
      }

      return appliedEffect;
    }
  }

  /**
   * Execute multiple effects
   */
  async executeAll(
    effects: EffectDefinition[],
    context: ExecutionContext
  ): Promise<AppliedEffect[]> {
    const results: AppliedEffect[] = [];

    for (const effect of effects) {
      // Check condition
      if (effect.condition) {
        const shouldApply = await this.evaluateCondition(effect.condition, context);
        if (!shouldApply) continue;
      }

      const result = await this.execute(effect, context);
      results.push(result);

      // Stop on first failure if strict mode
      if (!result.success && context.metadata.tags['effectMode'] === 'strict') {
        break;
      }
    }

    return results;
  }

  /**
   * Execute effects in parallel
   */
  async executeParallel(
    effects: EffectDefinition[],
    context: ExecutionContext
  ): Promise<AppliedEffect[]> {
    return Promise.all(effects.map((effect) => this.execute(effect, context)));
  }

  /**
   * Execute effects in a transaction (all or nothing)
   */
  async executeTransaction(
    effects: EffectDefinition[],
    context: ExecutionContext
  ): Promise<{ success: boolean; effects: AppliedEffect[]; rollback?: AppliedEffect[] }> {
    const applied: AppliedEffect[] = [];
    const compensations: EffectDefinition[] = [];

    try {
      for (const effect of effects) {
        const result = await this.execute(effect, context);
        applied.push(result);

        if (!result.success) {
          // Rollback previous effects
          const rollback = await this.rollback(compensations, context);
          return { success: false, effects: applied, rollback };
        }

        // Track compensation for rollback
        const compensation = this.getCompensation(effect);
        if (compensation) {
          compensations.unshift(compensation);
        }
      }

      return { success: true, effects: applied };
    } catch (error) {
      const rollback = await this.rollback(compensations, context);
      return { success: false, effects: applied, rollback };
    }
  }

  private async rollback(
    compensations: EffectDefinition[],
    context: ExecutionContext
  ): Promise<AppliedEffect[]> {
    const results: AppliedEffect[] = [];
    for (const compensation of compensations) {
      const result = await this.execute(compensation, context);
      results.push(result);
    }
    return results;
  }

  private getCompensation(effect: EffectDefinition): EffectDefinition | undefined {
    switch (effect.type) {
      case 'create':
        return { type: 'delete', target: effect.target };
      case 'update':
        return { type: 'update', target: effect.target, expression: 'rollback' };
      case 'delete':
        return { type: 'create', target: effect.target };
      default:
        return undefined;
    }
  }

  private async evaluateCondition(
    condition: string,
    context: ExecutionContext
  ): Promise<boolean> {
    // Simple condition evaluation
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('ctx', `return ${condition}`);
      return Boolean(fn(context));
    } catch {
      return false;
    }
  }
}

/**
 * Effect middleware interface
 */
export interface EffectMiddleware {
  name: string;
  before?(effect: EffectDefinition, context: ExecutionContext): Promise<void>;
  after?(effect: EffectDefinition, context: ExecutionContext, result: AppliedEffect): Promise<void>;
  onError?(effect: EffectDefinition, context: ExecutionContext, error: Error): Promise<void>;
}

/**
 * Logging middleware
 */
export const LoggingMiddleware: EffectMiddleware = {
  name: 'logging',
  async before(effect, context) {
    console.log(`[Effect] Starting: ${effect.type} on ${effect.target}`);
  },
  async after(effect, context, result) {
    console.log(`[Effect] Completed: ${effect.type} on ${effect.target} - ${result.success}`);
  },
  async onError(effect, context, error) {
    console.error(`[Effect] Error: ${effect.type} on ${effect.target} - ${error.message}`);
  },
};

/**
 * Metrics middleware
 */
export function createMetricsMiddleware(
  onMetric: (name: string, value: number, tags: Record<string, string>) => void
): EffectMiddleware {
  return {
    name: 'metrics',
    async before(effect, context) {
      (context as ExecutionContext & { _effectStart: number })._effectStart = Date.now();
    },
    async after(effect, context, result) {
      const start = (context as ExecutionContext & { _effectStart: number })._effectStart;
      const duration = Date.now() - start;

      onMetric('effect.duration', duration, {
        type: effect.type,
        target: effect.target,
        success: String(result.success),
      });
    },
  };
}

/**
 * Retry middleware
 */
export function createRetryMiddleware(
  maxRetries: number = 3,
  delay: number = 100
): EffectMiddleware {
  const retryState = new Map<string, number>();

  return {
    name: 'retry',
    async onError(effect, context, error) {
      const key = `${context.executionId}:${effect.type}:${effect.target}`;
      const attempts = retryState.get(key) ?? 0;

      if (attempts < maxRetries) {
        retryState.set(key, attempts + 1);
        await new Promise((resolve) => setTimeout(resolve, delay * (attempts + 1)));
        throw error; // Re-throw to trigger retry
      }

      retryState.delete(key);
    },
  };
}

/**
 * Built-in effect types
 */
export const BuiltinEffects = {
  /**
   * Create entity effect
   */
  create: (target: string, data?: Record<string, unknown>): EffectDefinition => ({
    type: 'create',
    target,
    expression: data ? JSON.stringify(data) : undefined,
  }),

  /**
   * Update entity effect
   */
  update: (target: string, updates: Record<string, unknown>): EffectDefinition => ({
    type: 'update',
    target,
    expression: JSON.stringify(updates),
  }),

  /**
   * Delete entity effect
   */
  delete: (target: string): EffectDefinition => ({
    type: 'delete',
    target,
  }),

  /**
   * Emit event effect
   */
  emit: (eventType: string, payload?: Record<string, unknown>): EffectDefinition => ({
    type: 'emit',
    target: eventType,
    expression: payload ? JSON.stringify(payload) : undefined,
  }),

  /**
   * Call behavior effect
   */
  call: (behavior: string, input?: Record<string, unknown>): EffectDefinition => ({
    type: 'call',
    target: behavior,
    expression: input ? JSON.stringify(input) : undefined,
  }),

  /**
   * Conditional effect
   */
  when: (condition: string, effect: EffectDefinition): EffectDefinition => ({
    ...effect,
    condition,
  }),
};

/**
 * Effect builder for fluent API
 */
export class EffectBuilder {
  private effects: EffectDefinition[] = [];

  create(target: string, data?: Record<string, unknown>): this {
    this.effects.push(BuiltinEffects.create(target, data));
    return this;
  }

  update(target: string, updates: Record<string, unknown>): this {
    this.effects.push(BuiltinEffects.update(target, updates));
    return this;
  }

  delete(target: string): this {
    this.effects.push(BuiltinEffects.delete(target));
    return this;
  }

  emit(eventType: string, payload?: Record<string, unknown>): this {
    this.effects.push(BuiltinEffects.emit(eventType, payload));
    return this;
  }

  call(behavior: string, input?: Record<string, unknown>): this {
    this.effects.push(BuiltinEffects.call(behavior, input));
    return this;
  }

  when(condition: string): ConditionalEffectBuilder {
    return new ConditionalEffectBuilder(this, condition);
  }

  build(): EffectDefinition[] {
    return this.effects;
  }

  _addEffect(effect: EffectDefinition): void {
    this.effects.push(effect);
  }
}

/**
 * Conditional effect builder
 */
class ConditionalEffectBuilder {
  constructor(
    private parent: EffectBuilder,
    private condition: string
  ) {}

  create(target: string, data?: Record<string, unknown>): EffectBuilder {
    this.parent._addEffect(BuiltinEffects.when(this.condition, BuiltinEffects.create(target, data)));
    return this.parent;
  }

  update(target: string, updates: Record<string, unknown>): EffectBuilder {
    this.parent._addEffect(BuiltinEffects.when(this.condition, BuiltinEffects.update(target, updates)));
    return this.parent;
  }

  delete(target: string): EffectBuilder {
    this.parent._addEffect(BuiltinEffects.when(this.condition, BuiltinEffects.delete(target)));
    return this.parent;
  }

  emit(eventType: string, payload?: Record<string, unknown>): EffectBuilder {
    this.parent._addEffect(BuiltinEffects.when(this.condition, BuiltinEffects.emit(eventType, payload)));
    return this.parent;
  }
}

/**
 * Create effect builder
 */
export function effects(): EffectBuilder {
  return new EffectBuilder();
}
