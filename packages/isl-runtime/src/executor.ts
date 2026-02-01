/**
 * Behavior Executor
 * 
 * Executes behaviors with contract enforcement.
 */

import { ContractEnforcer, type ContractViolation } from './contracts.js';
import { StateManager, type StateSnapshot } from './state.js';
import { TemporalMonitor } from './temporal.js';
import type { BehaviorSpec, InvariantSpec, RuntimeConfig, BehaviorHandler, Logger } from './runtime.js';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionContext {
  /** Behavior being executed */
  behavior: string;
  /** Start timestamp */
  startTime: Date;
  /** State snapshot before execution */
  oldState: StateSnapshot;
  /** Input data */
  input: unknown;
  /** Custom metadata */
  metadata: Map<string, unknown>;
  /** Logger */
  logger: Logger;
}

export interface ExecutionResult<T> {
  /** Whether execution succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error (if failed) */
  error?: { code: string; message: string; details?: unknown };
  /** Contract violations */
  violations?: ContractViolation[];
  /** Execution duration in ms */
  duration: number;
  /** Trace ID */
  traceId?: string;
}

// ============================================================================
// Executor
// ============================================================================

export class BehaviorExecutor {
  private contracts: ContractEnforcer;
  private state: StateManager;
  private temporal: TemporalMonitor;
  private config: Required<RuntimeConfig>;

  constructor(
    contracts: ContractEnforcer,
    state: StateManager,
    temporal: TemporalMonitor,
    config: Required<RuntimeConfig>
  ) {
    this.contracts = contracts;
    this.state = state;
    this.temporal = temporal;
    this.config = config;
  }

  /**
   * Execute a behavior with full contract enforcement
   */
  async execute<TInput, TOutput>(
    spec: BehaviorSpec,
    input: TInput,
    handler: BehaviorHandler<TInput, TOutput>,
    invariants: InvariantSpec[]
  ): Promise<ExecutionResult<TOutput>> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();
    
    this.config.logger.debug(`Executing ${spec.name}`, { traceId, input });

    // Capture state snapshot
    const oldState = await this.state.captureSnapshot();

    // Create execution context
    const context: ExecutionContext = {
      behavior: spec.name,
      startTime: new Date(),
      oldState,
      input,
      metadata: new Map(),
      logger: this.config.logger,
    };

    try {
      // Validate input
      const inputViolations = this.contracts.validateInput(spec, input);
      if (inputViolations.length > 0) {
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Input validation failed' },
          violations: inputViolations,
          duration: Date.now() - startTime,
          traceId,
        };
      }

      // Check preconditions
      if (this.config.strictMode) {
        const preViolations = await this.contracts.checkPreconditions(spec, input, context);
        if (preViolations.length > 0) {
          return {
            success: false,
            error: { code: 'PRECONDITION_FAILED', message: 'Precondition check failed' },
            violations: preViolations,
            duration: Date.now() - startTime,
            traceId,
          };
        }
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => handler(input, context),
        this.config.timeout
      );

      // Record temporal event
      if (this.config.temporalMonitoring) {
        this.temporal.recordExecution(spec.name, Date.now() - startTime);
      }

      // Check postconditions
      if (this.config.strictMode) {
        const postViolations = await this.contracts.checkPostconditions(
          spec,
          input,
          result,
          context
        );
        if (postViolations.length > 0) {
          return {
            success: false,
            error: { code: 'POSTCONDITION_FAILED', message: 'Postcondition check failed' },
            violations: postViolations,
            duration: Date.now() - startTime,
            traceId,
          };
        }
      }

      // Check invariants
      const invViolations = await this.contracts.checkInvariants(invariants, context);
      if (invViolations.length > 0) {
        return {
          success: false,
          error: { code: 'INVARIANT_VIOLATED', message: 'Invariant check failed' },
          violations: invViolations,
          duration: Date.now() - startTime,
          traceId,
        };
      }

      this.config.logger.info(`Executed ${spec.name} successfully`, { traceId, duration: Date.now() - startTime });

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        traceId,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.config.logger.error(`Execution failed: ${spec.name}`, { traceId, error: message });

      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message },
        duration: Date.now() - startTime,
        traceId,
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      ),
    ]);
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `isl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
