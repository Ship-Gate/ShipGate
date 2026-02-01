/**
 * Behavior Executor
 * 
 * Executes ISL behaviors with precondition/postcondition checking.
 */

import type {
  BehaviorDefinition,
  BehaviorImplementation,
  BehaviorResult,
  ExecutionContext,
  SimulatorState,
} from './types.js';
import { StateManager, generateId } from './state.js';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded Random Number Generator
// ─────────────────────────────────────────────────────────────────────────────

class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  reset(seed: number): void {
    this.seed = seed;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────────────────────────────────────

export class BehaviorExecutor {
  private behaviors: Map<string, BehaviorDefinition>;
  private implementations: Map<string, BehaviorImplementation>;
  private stateManager: StateManager;
  private random: SeededRandom;
  private strict: boolean;

  constructor(
    behaviors: BehaviorDefinition[],
    stateManager: StateManager,
    implementations?: Record<string, BehaviorImplementation>,
    options?: { strict?: boolean; seed?: number }
  ) {
    this.behaviors = new Map(behaviors.map(b => [b.name, b]));
    this.implementations = new Map(Object.entries(implementations || {}));
    this.stateManager = stateManager;
    this.random = new SeededRandom(options?.seed);
    this.strict = options?.strict ?? false;
  }

  /**
   * Execute a behavior
   */
  async execute(
    behaviorName: string,
    input: Record<string, unknown>
  ): Promise<BehaviorResult> {
    const behavior = this.behaviors.get(behaviorName);
    if (!behavior) {
      return {
        success: false,
        error: {
          code: 'BEHAVIOR_NOT_FOUND',
          message: `Unknown behavior: ${behaviorName}`,
        },
      };
    }

    // Check preconditions
    const preconditionResult = this.checkPreconditions(behavior, input);
    if (!preconditionResult.valid) {
      return {
        success: false,
        error: {
          code: 'PRECONDITION_FAILED',
          message: preconditionResult.message,
          retriable: true,
        },
      };
    }

    // Get implementation
    const impl = this.implementations.get(behaviorName);
    if (!impl) {
      if (this.strict) {
        return {
          success: false,
          error: {
            code: 'NOT_IMPLEMENTED',
            message: `Behavior not implemented: ${behaviorName}`,
          },
        };
      }
      // Use auto-generated implementation
      return this.executeAutoImpl(behavior, input);
    }

    // Create execution context
    const context = this.createContext();

    // Execute implementation
    try {
      const result = await impl(input, context);

      // Check postconditions
      if (result.success) {
        const postconditionResult = this.checkPostconditions(
          behavior,
          input,
          result,
          'success'
        );
        if (!postconditionResult.valid) {
          console.warn(`Postcondition warning: ${postconditionResult.message}`);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Create execution context for behavior implementations
   */
  private createContext(): ExecutionContext {
    return {
      state: this.stateManager.getState() as SimulatorState,
      getEntity: <T>(type: string, id: string) => 
        this.stateManager.getEntity<T>(type, id),
      findEntities: <T>(type: string, predicate: (entity: T) => boolean) =>
        this.stateManager.findEntities<T>(type, predicate),
      createEntity: <T extends Record<string, unknown>>(type: string, data: T) =>
        this.stateManager.createEntity<T>(type, data),
      updateEntity: <T extends Record<string, unknown>>(type: string, id: string, data: Partial<T>) =>
        this.stateManager.updateEntity<T>(type, id, data),
      deleteEntity: (type: string, id: string) =>
        this.stateManager.deleteEntity(type, id),
      generateId: () => generateId(),
      now: () => new Date(),
      random: () => this.random.next(),
    };
  }

  /**
   * Auto-generate implementation based on behavior definition
   */
  private async executeAutoImpl(
    behavior: BehaviorDefinition,
    input: Record<string, unknown>
  ): Promise<BehaviorResult> {
    // Simple auto-implementation that creates entities based on behavior name
    const behaviorName = behavior.name.toLowerCase();
    const context = this.createContext();

    // Handle common CRUD patterns
    if (behaviorName.startsWith('create')) {
      const entityType = behaviorName.replace('create', '');
      const capitalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      
      try {
        const entity = context.createEntity(capitalizedType, {
          ...input,
          id: context.generateId(),
        });
        return { success: true, data: entity };
      } catch {
        // Entity type might not exist
        return { success: true, data: { id: context.generateId(), ...input } };
      }
    }

    if (behaviorName.startsWith('get') || behaviorName.startsWith('find')) {
      const entityType = behaviorName.replace(/^(get|find)/, '');
      const capitalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      
      if (input.id) {
        const entity = context.getEntity(capitalizedType, input.id as string);
        if (entity) {
          return { success: true, data: entity };
        }
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: `${capitalizedType} not found` },
        };
      }
      
      const entities = context.findEntities(capitalizedType, () => true);
      return { success: true, data: entities };
    }

    if (behaviorName.startsWith('update')) {
      const entityType = behaviorName.replace('update', '');
      const capitalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      
      if (!input.id) {
        return {
          success: false,
          error: { code: 'MISSING_ID', message: 'ID required for update' },
        };
      }

      try {
        const entity = context.updateEntity(capitalizedType, input.id as string, input);
        return { success: true, data: entity };
      } catch {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: `${capitalizedType} not found` },
        };
      }
    }

    if (behaviorName.startsWith('delete') || behaviorName.startsWith('remove')) {
      const entityType = behaviorName.replace(/^(delete|remove)/, '');
      const capitalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      
      if (!input.id) {
        return {
          success: false,
          error: { code: 'MISSING_ID', message: 'ID required for delete' },
        };
      }

      const deleted = context.deleteEntity(capitalizedType, input.id as string);
      if (deleted) {
        return { success: true, data: true };
      }
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: `${capitalizedType} not found` },
      };
    }

    // Default: just return success with input echoed
    return { success: true, data: { id: context.generateId(), ...input } };
  }

  /**
   * Check preconditions
   */
  private checkPreconditions(
    behavior: BehaviorDefinition,
    input: Record<string, unknown>
  ): { valid: boolean; message: string } {
    for (const precondition of behavior.preconditions) {
      const result = this.evaluateSimplePredicate(precondition, { input });
      if (!result.valid) {
        return { valid: false, message: `Precondition failed: ${precondition}` };
      }
    }
    return { valid: true, message: '' };
  }

  /**
   * Check postconditions
   */
  private checkPostconditions(
    behavior: BehaviorDefinition,
    input: Record<string, unknown>,
    result: BehaviorResult,
    outcome: string
  ): { valid: boolean; message: string } {
    const relevantPostconditions = behavior.postconditions.filter(
      p => p.outcome === outcome || p.outcome === '*'
    );

    for (const postcondition of relevantPostconditions) {
      for (const predicate of postcondition.predicates) {
        const evalResult = this.evaluateSimplePredicate(predicate, {
          input,
          result: result.data,
        });
        if (!evalResult.valid) {
          return { valid: false, message: `Postcondition failed: ${predicate}` };
        }
      }
    }
    return { valid: true, message: '' };
  }

  /**
   * Evaluate simple predicates (basic implementation)
   */
  private evaluateSimplePredicate(
    predicate: string,
    context: Record<string, unknown>
  ): { valid: boolean; message: string } {
    // Basic predicate evaluation
    // This is a simplified implementation - full implementation would need expression parser
    
    // Handle length checks: input.field.length >= N
    const lengthMatch = predicate.match(/(\w+)\.(\w+)\.length\s*(>=|>|<=|<|==)\s*(\d+)/);
    if (lengthMatch) {
      const [, obj, field, op, numStr] = lengthMatch;
      const value = (context[obj] as Record<string, unknown>)?.[field];
      const num = parseInt(numStr, 10);
      
      if (typeof value === 'string' || Array.isArray(value)) {
        const len = value.length;
        let valid = false;
        switch (op) {
          case '>=': valid = len >= num; break;
          case '>': valid = len > num; break;
          case '<=': valid = len <= num; break;
          case '<': valid = len < num; break;
          case '==': valid = len === num; break;
        }
        return { valid, message: valid ? '' : `${obj}.${field}.length ${op} ${num} failed` };
      }
    }

    // Handle comparison: input.field > N
    const compMatch = predicate.match(/(\w+)\.?(\w*)\s*(>=|>|<=|<|==|!=)\s*(\d+)/);
    if (compMatch) {
      const [, obj, field, op, numStr] = compMatch;
      const value = field 
        ? (context[obj] as Record<string, unknown>)?.[field]
        : context[obj];
      const num = parseInt(numStr, 10);
      
      if (typeof value === 'number') {
        let valid = false;
        switch (op) {
          case '>=': valid = value >= num; break;
          case '>': valid = value > num; break;
          case '<=': valid = value <= num; break;
          case '<': valid = value < num; break;
          case '==': valid = value === num; break;
          case '!=': valid = value !== num; break;
        }
        return { valid, message: valid ? '' : `${predicate} failed` };
      }
    }

    // Default: assume valid for complex predicates we can't evaluate
    return { valid: true, message: '' };
  }

  /**
   * Register a behavior implementation
   */
  registerImplementation(name: string, impl: BehaviorImplementation): void {
    this.implementations.set(name, impl);
  }

  /**
   * Get available behaviors
   */
  getAvailableBehaviors(): string[] {
    return Array.from(this.behaviors.keys());
  }

  /**
   * Get behavior definition
   */
  getBehavior(name: string): BehaviorDefinition | undefined {
    return this.behaviors.get(name);
  }
}
