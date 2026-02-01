/**
 * ISL Runtime
 * 
 * Main runtime class for executing ISL behaviors.
 */

import { BehaviorExecutor, type ExecutionContext, type ExecutionResult } from './executor.js';
import { ContractEnforcer } from './contracts.js';
import { StateManager } from './state.js';
import { TemporalMonitor } from './temporal.js';

// ============================================================================
// Types
// ============================================================================

export interface RuntimeConfig {
  /** Enable strict contract enforcement */
  strictMode?: boolean;
  /** Enable temporal monitoring */
  temporalMonitoring?: boolean;
  /** Maximum execution time in ms */
  timeout?: number;
  /** Custom logger */
  logger?: Logger;
  /** State persistence adapter */
  stateAdapter?: StateAdapter;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export interface StateAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface DomainSpec {
  name: string;
  version: string;
  entities: EntitySpec[];
  types: TypeSpec[];
  behaviors: BehaviorSpec[];
  invariants: InvariantSpec[];
}

export interface EntitySpec {
  name: string;
  fields: FieldSpec[];
  invariants: string[];
}

export interface FieldSpec {
  name: string;
  type: string;
  optional: boolean;
  constraints: ConstraintSpec[];
}

export interface ConstraintSpec {
  name: string;
  value: unknown;
}

export interface TypeSpec {
  name: string;
  baseType: string;
  constraints: ConstraintSpec[];
}

export interface BehaviorSpec {
  name: string;
  input: FieldSpec[];
  output: { success: string; errors: ErrorSpec[] };
  preconditions: string[];
  postconditions: PostconditionSpec[];
}

export interface ErrorSpec {
  name: string;
  retriable: boolean;
}

export interface PostconditionSpec {
  guard: string;
  predicates: string[];
}

export interface InvariantSpec {
  name: string;
  scope: 'global' | 'transaction';
  predicates: string[];
}

export interface BehaviorHandler<TInput, TOutput> {
  (input: TInput, context: ExecutionContext): Promise<TOutput>;
}

// ============================================================================
// Runtime
// ============================================================================

export class Runtime {
  private config: Required<RuntimeConfig>;
  private domains: Map<string, DomainSpec> = new Map();
  private handlers: Map<string, BehaviorHandler<unknown, unknown>> = new Map();
  private executor: BehaviorExecutor;
  private contracts: ContractEnforcer;
  private state: StateManager;
  private temporal: TemporalMonitor;

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      strictMode: config.strictMode ?? true,
      temporalMonitoring: config.temporalMonitoring ?? true,
      timeout: config.timeout ?? 30000,
      logger: config.logger ?? console,
      stateAdapter: config.stateAdapter ?? createInMemoryAdapter(),
    };

    this.state = new StateManager(this.config.stateAdapter);
    this.contracts = new ContractEnforcer(this.state, this.config.logger);
    this.temporal = new TemporalMonitor(this.config.logger);
    this.executor = new BehaviorExecutor(this.contracts, this.state, this.temporal, this.config);
  }

  /**
   * Register a domain specification
   */
  registerDomain(spec: DomainSpec): void {
    this.domains.set(spec.name, spec);
    this.contracts.registerDomain(spec);
    this.config.logger.info(`Registered domain: ${spec.name} v${spec.version}`);
  }

  /**
   * Register a behavior handler
   */
  registerHandler<TInput, TOutput>(
    domain: string,
    behavior: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): void {
    const key = `${domain}.${behavior}`;
    this.handlers.set(key, handler as BehaviorHandler<unknown, unknown>);
    this.config.logger.info(`Registered handler: ${key}`);
  }

  /**
   * Execute a behavior
   */
  async execute<TInput, TOutput>(
    domain: string,
    behavior: string,
    input: TInput
  ): Promise<ExecutionResult<TOutput>> {
    const key = `${domain}.${behavior}`;
    const domainSpec = this.domains.get(domain);
    const handler = this.handlers.get(key);

    if (!domainSpec) {
      return {
        success: false,
        error: { code: 'DOMAIN_NOT_FOUND', message: `Domain '${domain}' not registered` },
        duration: 0,
      };
    }

    if (!handler) {
      return {
        success: false,
        error: { code: 'HANDLER_NOT_FOUND', message: `No handler for '${key}'` },
        duration: 0,
      };
    }

    const behaviorSpec = domainSpec.behaviors.find(b => b.name === behavior);
    if (!behaviorSpec) {
      return {
        success: false,
        error: { code: 'BEHAVIOR_NOT_FOUND', message: `Behavior '${behavior}' not in domain` },
        duration: 0,
      };
    }

    return this.executor.execute(
      behaviorSpec,
      input,
      handler,
      domainSpec.invariants
    );
  }

  /**
   * Get current state snapshot
   */
  async getState(): Promise<Map<string, unknown>> {
    return this.state.getSnapshot();
  }

  /**
   * Get temporal monitoring data
   */
  getTemporalData(): { events: unknown[]; violations: unknown[] } {
    return {
      events: this.temporal.getEvents(),
      violations: this.temporal.getViolations(),
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRuntime(config?: RuntimeConfig): Runtime {
  return new Runtime(config);
}

function createInMemoryAdapter(): StateAdapter {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}
