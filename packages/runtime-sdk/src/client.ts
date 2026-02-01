/**
 * ISL Client
 * 
 * Main client for ISL runtime verification.
 */

import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import type { Violation, VerificationResult, ExecutionContext, VerificationMode } from './types.js';
import { Sampler } from './sampling/sampler.js';

export interface ClientOptions {
  /** Path to ISL spec file or inline spec */
  spec: string;
  /** Verification mode */
  mode?: VerificationMode;
  /** Sampling rate (0-1) */
  sampling?: number;
  /** Timeout for verification in ms */
  timeout?: number;
  /** Callback on violation */
  onViolation?: (violation: Violation) => void | Promise<void>;
  /** Enable debug logging */
  debug?: boolean;
}

export interface BehaviorSpec {
  name: string;
  preconditions: Array<{ expression: string; compiled?: (input: unknown, ctx: ExecutionContext) => boolean | Promise<boolean> }>;
  postconditions: Array<{ expression: string; compiled?: (result: unknown, input: unknown, ctx: ExecutionContext) => boolean | Promise<boolean> }>;
  invariants: Array<{ expression: string; compiled?: (ctx: ExecutionContext) => boolean | Promise<boolean> }>;
}

export class ISLClient {
  private domain: DomainDeclaration | null = null;
  private behaviors = new Map<string, BehaviorSpec>();
  private sampler: Sampler;
  private options: Required<ClientOptions>;

  constructor(options: ClientOptions) {
    this.options = {
      spec: options.spec,
      mode: options.mode ?? 'monitor',
      sampling: options.sampling ?? 1.0,
      timeout: options.timeout ?? 5000,
      onViolation: options.onViolation ?? (() => {}),
      debug: options.debug ?? false,
    };

    this.sampler = new Sampler({ rate: this.options.sampling });
  }

  /**
   * Initialize the client by parsing the spec
   */
  async init(): Promise<void> {
    const result = parseISL(this.options.spec);
    
    if (result.errors.length > 0) {
      throw new Error(`Failed to parse ISL spec: ${result.errors[0]?.message}`);
    }

    this.domain = result.ast;
    
    if (this.domain) {
      for (const behavior of this.domain.behaviors) {
        this.behaviors.set(behavior.name.name, {
          name: behavior.name.name,
          preconditions: behavior.preconditions?.conditions.map((c) => ({
            expression: this.conditionToString(c),
          })) ?? [],
          postconditions: behavior.postconditions?.conditions.map((c) => ({
            expression: this.conditionToString(c),
          })) ?? [],
          invariants: behavior.invariants?.map((inv) => ({
            expression: this.expressionToString(inv.expression),
          })) ?? [],
        });
      }
    }

    if (this.options.debug) {
      console.log(`[ISL] Loaded ${this.behaviors.size} behaviors`);
    }
  }

  /**
   * Verify a behavior execution
   */
  async verify<T>(
    behaviorName: string,
    fn: (ctx: ExecutionContext) => Promise<T>,
    input: unknown,
    ctx: ExecutionContext = {}
  ): Promise<T> {
    const behavior = this.behaviors.get(behaviorName);
    
    if (!behavior) {
      if (this.options.debug) {
        console.warn(`[ISL] Unknown behavior: ${behaviorName}`);
      }
      return fn(ctx);
    }

    // Check if we should sample this request
    if (!this.sampler.shouldSample()) {
      return fn(ctx);
    }

    const startTime = performance.now();
    const violations: Violation[] = [];

    // Check preconditions
    if (this.options.mode !== 'disabled') {
      for (const pre of behavior.preconditions) {
        try {
          const passed = pre.compiled 
            ? await pre.compiled(input, ctx)
            : true; // Skip uncompiled conditions in runtime
          
          if (!passed) {
            const violation: Violation = {
              type: 'precondition',
              domain: this.domain?.name.name ?? 'unknown',
              behavior: behaviorName,
              condition: pre.expression,
              message: `Precondition failed: ${pre.expression}`,
              input,
              timestamp: new Date(),
            };
            violations.push(violation);
            await this.options.onViolation(violation);
          }
        } catch (error) {
          if (this.options.debug) {
            console.error(`[ISL] Precondition error:`, error);
          }
        }
      }
    }

    // In enforce mode, throw on precondition violations
    if (this.options.mode === 'enforce' && violations.length > 0) {
      throw new ISLViolationError(violations);
    }

    // Execute the function
    let result: T;
    try {
      result = await fn(ctx);
    } catch (error) {
      throw error;
    }

    const duration = performance.now() - startTime;

    // Check postconditions
    if (this.options.mode !== 'disabled') {
      for (const post of behavior.postconditions) {
        try {
          const passed = post.compiled
            ? await post.compiled(result, input, ctx)
            : true;
          
          if (!passed) {
            const violation: Violation = {
              type: 'postcondition',
              domain: this.domain?.name.name ?? 'unknown',
              behavior: behaviorName,
              condition: post.expression,
              message: `Postcondition failed: ${post.expression}`,
              input,
              output: result,
              timestamp: new Date(),
              duration,
            };
            violations.push(violation);
            await this.options.onViolation(violation);
          }
        } catch (error) {
          if (this.options.debug) {
            console.error(`[ISL] Postcondition error:`, error);
          }
        }
      }
    }

    // In enforce mode, throw on postcondition violations
    if (this.options.mode === 'enforce' && violations.length > 0) {
      throw new ISLViolationError(violations);
    }

    return result;
  }

  /**
   * Get registered behavior specs
   */
  getBehaviors(): Map<string, BehaviorSpec> {
    return new Map(this.behaviors);
  }

  /**
   * Register a compiled precondition
   */
  registerPrecondition(
    behaviorName: string,
    fn: (input: unknown, ctx: ExecutionContext) => boolean | Promise<boolean>
  ): void {
    const behavior = this.behaviors.get(behaviorName);
    if (behavior) {
      behavior.preconditions.push({
        expression: '[compiled]',
        compiled: fn,
      });
    }
  }

  /**
   * Register a compiled postcondition
   */
  registerPostcondition(
    behaviorName: string,
    fn: (result: unknown, input: unknown, ctx: ExecutionContext) => boolean | Promise<boolean>
  ): void {
    const behavior = this.behaviors.get(behaviorName);
    if (behavior) {
      behavior.postconditions.push({
        expression: '[compiled]',
        compiled: fn,
      });
    }
  }

  /**
   * Convert condition to string for display
   */
  private conditionToString(condition: unknown): string {
    if (!condition || typeof condition !== 'object') return String(condition);
    if ('statements' in condition && Array.isArray((condition as { statements: unknown[] }).statements)) {
      return (condition as { statements: Array<{ expression: unknown }> }).statements
        .map((s) => this.expressionToString(s.expression))
        .join(' && ');
    }
    return JSON.stringify(condition);
  }

  /**
   * Convert expression to string
   */
  private expressionToString(expr: unknown): string {
    if (!expr || typeof expr !== 'object') return String(expr);
    const e = expr as { kind: string; name?: string; value?: unknown };
    if (e.kind === 'Identifier') return e.name ?? '';
    if (e.kind === 'StringLiteral') return `"${e.value}"`;
    if (e.kind === 'NumberLiteral') return String(e.value);
    if (e.kind === 'BooleanLiteral') return String(e.value);
    return JSON.stringify(expr);
  }
}

/**
 * Error thrown when ISL violations occur in enforce mode
 */
export class ISLViolationError extends Error {
  constructor(public violations: Violation[]) {
    const messages = violations.map((v) => v.message).join('; ');
    super(`ISL Violation: ${messages}`);
    this.name = 'ISLViolationError';
  }
}

/**
 * Create a new ISL client
 */
export function createClient(options: ClientOptions): ISLClient {
  return new ISLClient(options);
}
