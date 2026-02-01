/**
 * Sandbox
 * 
 * Isolated execution environment for testing behaviors.
 */

import { Runtime, type RuntimeConfig, type DomainSpec, type BehaviorHandler } from './runtime.js';
import type { ExecutionResult } from './executor.js';

// ============================================================================
// Types
// ============================================================================

export interface SandboxConfig extends RuntimeConfig {
  /** Auto-reset state between executions */
  autoReset?: boolean;
  /** Record all executions for replay */
  recordExecutions?: boolean;
  /** Inject test fixtures */
  fixtures?: Map<string, unknown>;
}

export interface RecordedExecution {
  domain: string;
  behavior: string;
  input: unknown;
  result: ExecutionResult<unknown>;
  timestamp: Date;
}

// ============================================================================
// Sandbox
// ============================================================================

export class Sandbox {
  private runtime: Runtime;
  private config: SandboxConfig;
  private executions: RecordedExecution[] = [];
  private originalState: Map<string, unknown> = new Map();

  constructor(config: SandboxConfig = {}) {
    this.config = {
      autoReset: true,
      recordExecutions: true,
      fixtures: new Map(),
      ...config,
    };

    this.runtime = new Runtime({
      strictMode: this.config.strictMode ?? true,
      temporalMonitoring: this.config.temporalMonitoring ?? true,
      timeout: this.config.timeout ?? 5000,
      logger: this.config.logger ?? createTestLogger(),
    });
  }

  /**
   * Load a domain for testing
   */
  loadDomain(spec: DomainSpec): this {
    this.runtime.registerDomain(spec);
    return this;
  }

  /**
   * Register a handler for testing
   */
  registerHandler<TInput, TOutput>(
    domain: string,
    behavior: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): this {
    this.runtime.registerHandler(domain, behavior, handler);
    return this;
  }

  /**
   * Set up fixtures
   */
  async setupFixtures(fixtures: Record<string, unknown>): Promise<this> {
    for (const [key, value] of Object.entries(fixtures)) {
      this.config.fixtures?.set(key, value);
    }
    return this;
  }

  /**
   * Execute a behavior in the sandbox
   */
  async execute<TInput, TOutput>(
    domain: string,
    behavior: string,
    input: TInput
  ): Promise<ExecutionResult<TOutput>> {
    const result = await this.runtime.execute<TInput, TOutput>(domain, behavior, input);

    if (this.config.recordExecutions) {
      this.executions.push({
        domain,
        behavior,
        input,
        result,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Execute multiple behaviors in sequence
   */
  async executeSequence<T>(
    executions: Array<{ domain: string; behavior: string; input: unknown }>
  ): Promise<ExecutionResult<unknown>[]> {
    const results: ExecutionResult<unknown>[] = [];

    for (const exec of executions) {
      const result = await this.execute(exec.domain, exec.behavior, exec.input);
      results.push(result);

      // Stop on failure if in strict mode
      if (!result.success && this.config.strictMode) {
        break;
      }
    }

    return results;
  }

  /**
   * Get recorded executions
   */
  getExecutions(): RecordedExecution[] {
    return [...this.executions];
  }

  /**
   * Get last execution
   */
  getLastExecution(): RecordedExecution | null {
    return this.executions[this.executions.length - 1] || null;
  }

  /**
   * Assert last execution succeeded
   */
  assertSuccess(): this {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No executions recorded');
    }
    if (!last.result.success) {
      throw new Error(
        `Expected success but got failure: ${last.result.error?.message}`
      );
    }
    return this;
  }

  /**
   * Assert last execution failed
   */
  assertFailure(expectedCode?: string): this {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No executions recorded');
    }
    if (last.result.success) {
      throw new Error('Expected failure but got success');
    }
    if (expectedCode && last.result.error?.code !== expectedCode) {
      throw new Error(
        `Expected error code '${expectedCode}' but got '${last.result.error?.code}'`
      );
    }
    return this;
  }

  /**
   * Assert execution duration
   */
  assertDuration(maxMs: number): this {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No executions recorded');
    }
    if (last.result.duration > maxMs) {
      throw new Error(
        `Expected duration <= ${maxMs}ms but got ${last.result.duration}ms`
      );
    }
    return this;
  }

  /**
   * Assert no contract violations
   */
  assertNoViolations(): this {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No executions recorded');
    }
    if (last.result.violations && last.result.violations.length > 0) {
      const violations = last.result.violations.map(v => v.message).join(', ');
      throw new Error(`Unexpected violations: ${violations}`);
    }
    return this;
  }

  /**
   * Reset sandbox state
   */
  async reset(): Promise<this> {
    this.executions = [];
    return this;
  }

  /**
   * Get temporal statistics
   */
  getTemporalStats(): { events: unknown[]; violations: unknown[] } {
    return this.runtime.getTemporalData();
  }
}

// ============================================================================
// Helpers
// ============================================================================

function createTestLogger() {
  const logs: Array<{ level: string; message: string; data?: unknown }> = [];
  return {
    debug: (message: string, data?: unknown) => logs.push({ level: 'debug', message, data }),
    info: (message: string, data?: unknown) => logs.push({ level: 'info', message, data }),
    warn: (message: string, data?: unknown) => logs.push({ level: 'warn', message, data }),
    error: (message: string, data?: unknown) => logs.push({ level: 'error', message, data }),
    getLogs: () => logs,
  };
}

/**
 * Create a sandbox for testing
 */
export function createSandbox(config?: SandboxConfig): Sandbox {
  return new Sandbox(config);
}
