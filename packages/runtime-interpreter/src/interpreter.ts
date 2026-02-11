// ============================================================================
// ISL Runtime Interpreter - Main Interpreter
// @isl-lang/runtime-interpreter/interpreter
// ============================================================================

import type {
  Value,
  Domain,
  Environment,
  ExecutionContext,
  BehaviorDefinition,
  TraceEntry,
  ContractMode,
  EntityStore,
} from './types.js';
import { evaluate } from './evaluator.js';
import { createEnvironment, extendEnvironment } from './environment.js';
import { InterpreterError, ContractViolationError } from './types.js';

// ============================================================================
// INTERPRETER
// ============================================================================

/**
 * ISL Runtime Interpreter.
 */
export class Interpreter {
  private domain: Domain;
  private rootEnv: Environment;
  private entityStore: InMemoryEntityStore;
  private events: ExecutionContext['events'];
  private trace: TraceEntry[];
  private contractMode: ContractMode;

  constructor(domain: Domain, options: InterpreterOptions = {}) {
    this.domain = domain;
    this.entityStore = new InMemoryEntityStore();
    this.events = [];
    this.trace = [];
    this.contractMode = options.contractMode ?? 'check';
    this.rootEnv = this.initializeEnvironment(options);
  }

  /**
   * Initialize the root environment with domain definitions.
   */
  private initializeEnvironment(options: InterpreterOptions): Environment {
    const env = createEnvironment();
    
    // Register built-in types
    registerBuiltinTypes(env);
    
    // Register domain types
    for (const [name, typeDef] of this.domain.types) {
      env.types.set(name, typeDef);
    }
    
    // Register custom effect handlers
    if (options.effectHandlers) {
      for (const handler of options.effectHandlers) {
        env.effects.set(handler.effect, handler);
      }
    }
    
    return env;
  }

  /**
   * Execute a behavior.
   */
  async executeBehavior(
    behaviorName: string,
    input: Record<string, Value>
  ): Promise<BehaviorResult> {
    const behavior = this.domain.behaviors.get(behaviorName);
    if (!behavior) {
      throw new InterpreterError(`Unknown behavior: ${behaviorName}`);
    }

    const ctx = this.createContext();
    this.traceCall(behaviorName, input);

    try {
      // Create behavior environment with input bindings
      const env = extendEnvironment(this.rootEnv);
      for (const param of behavior.input) {
        const value = input[param.name];
        if (value === undefined && !isOptionalType(param.type)) {
          throw new InterpreterError(`Missing required input: ${param.name}`);
        }
        env.bindings.set(param.name, value ?? { tag: 'option', value: null });
      }

      // Check preconditions
      if (this.contractMode !== 'skip') {
        await this.checkPreconditions(behavior, env, ctx);
      }

      // Capture old values for postconditions
      const oldValues = await this.captureOldValues(behavior, env, ctx);

      // Execute behavior
      let result: Value;
      if (behavior.implementation) {
        result = await evaluate(behavior.implementation, env, ctx);
      } else {
        throw new InterpreterError(`Behavior ${behaviorName} has no implementation`);
      }

      // Check postconditions
      if (this.contractMode !== 'skip') {
        await this.checkPostconditions(behavior, result, oldValues, env, ctx);
      }

      // Check global invariants
      if (this.contractMode !== 'skip') {
        await this.checkGlobalInvariants(ctx);
      }

      this.traceReturn(behaviorName, result);
      
      return {
        success: true,
        value: result,
      };
    } catch (error) {
      if (error instanceof ContractViolationError) {
        this.traceError(behaviorName, error);
        return {
          success: false,
          error: {
            tag: 'contract_violation',
            kind: error.contractKind,
            expression: error.contractExpr,
          },
        };
      }
      
      const err = error instanceof Error ? error : new Error(String(error));
      this.traceError(behaviorName, err);
      
      // Check if it's a known error type from the behavior
      for (const errorDef of behavior.output.errors) {
        if (err.message.includes(errorDef.name)) {
          return {
            success: false,
            error: {
              tag: 'behavior_error',
              name: errorDef.name,
              message: err.message,
            },
          };
        }
      }
      
      throw error;
    }
  }

  /**
   * Create an entity instance.
   */
  async createEntity(
    entityType: string,
    data: Record<string, Value>
  ): Promise<Value> {
    const entityDef = this.domain.entities.get(entityType);
    if (!entityDef) {
      throw new InterpreterError(`Unknown entity type: ${entityType}`);
    }

    // Generate ID if not provided
    const id = (data['id'] as any)?.value ?? crypto.randomUUID();
    
    // Validate and construct entity
    const fields = new Map<string, Value>();
    
    for (const fieldDef of entityDef.fields) {
      let value = data[fieldDef.name];
      
      if (value === undefined) {
        if (fieldDef.default) {
          value = await evaluate(fieldDef.default, this.rootEnv, this.createContext());
        } else if (!fieldDef.annotations.includes('optional')) {
          throw new InterpreterError(`Missing required field: ${fieldDef.name}`);
        } else {
          value = { tag: 'option', value: null };
        }
      }
      
      fields.set(fieldDef.name, value);
    }

    const entity: Value = {
      tag: 'entity',
      type: entityType,
      id,
      fields,
      version: 1,
    };

    // Check entity invariants
    if (this.contractMode !== 'skip') {
      const env = extendEnvironment(this.rootEnv);
      env.bindings.set('this', entity);
      
      for (const invariant of entityDef.invariants) {
        const result = await evaluate(invariant, env, this.createContext());
        if (result.tag !== 'boolean' || !result.value) {
          throw new ContractViolationError(
            'invariant',
            expressionToString(invariant),
            undefined
          );
        }
      }
    }

    // Store entity
    this.entityStore.set(entityType, id, entity);
    
    // Emit event
    this.events.push({
      timestamp: new Date(),
      type: `${entityType}.created`,
      data: entity,
      source: 'interpreter',
    });

    return entity;
  }

  /**
   * Query entities.
   */
  queryEntities(
    entityType: string,
    predicate?: (entity: Value) => boolean
  ): Value[] {
    return this.entityStore.query(entityType, predicate ?? (() => true));
  }

  /**
   * Get execution trace.
   */
  getTrace(): TraceEntry[] {
    return [...this.trace];
  }

  /**
   * Get emitted events.
   */
  getEvents(): ExecutionContext['events'] {
    return [...this.events];
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private createContext(): ExecutionContext {
    return {
      domain: this.domain,
      environment: this.rootEnv,
      stack: [],
      entities: this.entityStore,
      events: this.events,
      trace: this.trace,
      contractMode: this.contractMode,
    };
  }

  private async checkPreconditions(
    behavior: BehaviorDefinition,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const precond of behavior.preconditions) {
      const result = await evaluate(precond, env, ctx);
      if (result.tag !== 'boolean' || !result.value) {
        throw new ContractViolationError(
          'precondition',
          expressionToString(precond),
          undefined
        );
      }
    }
  }

  private async captureOldValues(
    behavior: BehaviorDefinition,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<Map<string, Value>> {
    const oldValues = new Map<string, Value>();
    
    // Capture values referenced in postconditions with old()
    for (const postcond of behavior.postconditions) {
      const oldRefs = findOldReferences(postcond);
      for (const ref of oldRefs) {
        if (!oldValues.has(ref)) {
          const value = await evaluate({ tag: 'identifier', name: ref }, env, ctx);
          oldValues.set(ref, value);
        }
      }
    }
    
    return oldValues;
  }

  private async checkPostconditions(
    behavior: BehaviorDefinition,
    result: Value,
    oldValues: Map<string, Value>,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const postcondEnv = extendEnvironment(env);
    postcondEnv.bindings.set('result', result);
    
    // Add old values
    for (const [name, value] of oldValues) {
      postcondEnv.bindings.set(`old_${name}`, value);
    }
    
    for (const postcond of behavior.postconditions) {
      const checkResult = await evaluate(
        substituteOldRefs(postcond),
        postcondEnv,
        ctx
      );
      if (checkResult.tag !== 'boolean' || !checkResult.value) {
        throw new ContractViolationError(
          'postcondition',
          expressionToString(postcond),
          undefined
        );
      }
    }
  }

  private async checkGlobalInvariants(ctx: ExecutionContext): Promise<void> {
    for (const [name, invariant] of this.domain.invariants) {
      for (const expr of invariant.always) {
        const result = await evaluate(expr, this.rootEnv, ctx);
        if (result.tag !== 'boolean' || !result.value) {
          throw new ContractViolationError(
            'invariant',
            `${name}: ${expressionToString(expr)}`,
            undefined
          );
        }
      }
    }
  }

  private traceCall(name: string, input: Record<string, Value>): void {
    this.trace.push({
      timestamp: new Date(),
      kind: 'call',
      data: { behavior: name, input },
    });
  }

  private traceReturn(name: string, result: Value): void {
    this.trace.push({
      timestamp: new Date(),
      kind: 'return',
      data: { behavior: name, result },
    });
  }

  private traceError(name: string, error: Error): void {
    this.trace.push({
      timestamp: new Date(),
      kind: 'error',
      data: { behavior: name, error: error.message },
    });
  }
}

// ============================================================================
// INTERPRETER OPTIONS
// ============================================================================

export interface InterpreterOptions {
  contractMode?: ContractMode;
  effectHandlers?: Array<{
    effect: string;
    operations: Map<string, (args: Value[], env: Environment) => Value | Promise<Value>>;
  }>;
  entityStore?: EntityStore;
  trace?: boolean;
}

export interface BehaviorResult {
  success: boolean;
  value?: Value;
  error?: {
    tag: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// IN-MEMORY ENTITY STORE
// ============================================================================

class InMemoryEntityStore implements EntityStore {
  private entities = new Map<string, Map<string, Value>>();

  get(type: string, id: string): Value | undefined {
    return this.entities.get(type)?.get(id);
  }

  set(type: string, id: string, value: Value): void {
    if (!this.entities.has(type)) {
      this.entities.set(type, new Map());
    }
    this.entities.get(type)!.set(id, value);
  }

  delete(type: string, id: string): boolean {
    return this.entities.get(type)?.delete(id) ?? false;
  }

  query(type: string, predicate: (v: Value) => boolean): Value[] {
    const typeEntities = this.entities.get(type);
    if (!typeEntities) return [];
    return Array.from(typeEntities.values()).filter(predicate);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function registerBuiltinTypes(env: Environment): void {
  // Register primitive types
  const primitives = ['Unit', 'Boolean', 'Int', 'Float', 'Decimal', 'String', 'Bytes', 'Timestamp', 'Duration', 'UUID'];
  for (const name of primitives) {
    env.types.set(name, {
      name,
      kind: 'alias',
      definition: { tag: 'primitive', name },
    });
  }
}

function isOptionalType(type: any): boolean {
  if (!type) return true;
  return type.tag === 'generic' && type.name === 'Option';
}

function expressionToString(expr: any): string {
  // Simplified expression stringification
  if (expr.tag === 'identifier') return expr.name;
  if (expr.tag === 'literal') return JSON.stringify(expr.value);
  if (expr.tag === 'binary') {
    return `${expressionToString(expr.left)} ${expr.op} ${expressionToString(expr.right)}`;
  }
  return '[expression]';
}

function findOldReferences(expr: any): string[] {
  const refs: string[] = [];
  
  function walk(e: any): void {
    if (!e) return;
    if (e.tag === 'old' && e.expression.tag === 'identifier') {
      refs.push(e.expression.name);
    }
    // Walk children
    for (const key of Object.keys(e)) {
      const val = e[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          val.forEach(walk);
        } else {
          walk(val);
        }
      }
    }
  }
  
  walk(expr);
  return refs;
}

function substituteOldRefs(expr: any): any {
  if (!expr || typeof expr !== 'object') return expr;
  
  if (expr.tag === 'old' && expr.expression.tag === 'identifier') {
    return { tag: 'identifier', name: `old_${expr.expression.name}` };
  }
  
  const result: any = {};
  for (const key of Object.keys(expr)) {
    const val = expr[key];
    if (Array.isArray(val)) {
      result[key] = val.map(substituteOldRefs);
    } else if (val && typeof val === 'object') {
      result[key] = substituteOldRefs(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}
