/**
 * Verification Helper
 * 
 * Simple function wrapper for ISL verification.
 */

import type { ExecutionContext, Violation } from './types.js';

export interface VerifyOptions {
  /** Domain name */
  domain?: string;
  /** Callback on violation */
  onViolation?: (violation: Violation) => void | Promise<void>;
}

/**
 * Wrap a function with ISL verification
 */
export function verify<TInput, TOutput>(
  behaviorName: string,
  fn: (input: TInput, ctx?: ExecutionContext) => Promise<TOutput>,
  options: VerifyOptions = {}
): (input: TInput, ctx?: ExecutionContext) => Promise<TOutput> {
  // Store preconditions and postconditions added via chaining
  const preconditions: Array<(input: TInput, ctx: ExecutionContext) => boolean | Promise<boolean>> = [];
  const postconditions: Array<(result: TOutput, input: TInput, ctx: ExecutionContext) => boolean | Promise<boolean>> = [];

  const wrappedFn = async (input: TInput, ctx: ExecutionContext = {}): Promise<TOutput> => {
    const startTime = performance.now();
    const violations: Violation[] = [];

    // Check preconditions
    for (let i = 0; i < preconditions.length; i++) {
      try {
        const passed = await preconditions[i]!(input, ctx);
        if (!passed) {
          const violation: Violation = {
            type: 'precondition',
            domain: options.domain ?? 'unknown',
            behavior: behaviorName,
            condition: `precondition[${i}]`,
            message: `Precondition ${i} failed`,
            input,
            timestamp: new Date(),
          };
          violations.push(violation);
          if (options.onViolation) {
            await options.onViolation(violation);
          }
        }
      } catch (error) {
        const violation: Violation = {
          type: 'precondition',
          domain: options.domain ?? 'unknown',
          behavior: behaviorName,
          condition: `precondition[${i}]`,
          message: `Precondition ${i} threw: ${error}`,
          input,
          timestamp: new Date(),
        };
        violations.push(violation);
        if (options.onViolation) {
          await options.onViolation(violation);
        }
      }
    }

    // Execute the function
    const result = await fn(input, ctx);
    const duration = performance.now() - startTime;

    // Check postconditions
    for (let i = 0; i < postconditions.length; i++) {
      try {
        const passed = await postconditions[i]!(result, input, ctx);
        if (!passed) {
          const violation: Violation = {
            type: 'postcondition',
            domain: options.domain ?? 'unknown',
            behavior: behaviorName,
            condition: `postcondition[${i}]`,
            message: `Postcondition ${i} failed`,
            input,
            output: result,
            timestamp: new Date(),
            duration,
          };
          violations.push(violation);
          if (options.onViolation) {
            await options.onViolation(violation);
          }
        }
      } catch (error) {
        const violation: Violation = {
          type: 'postcondition',
          domain: options.domain ?? 'unknown',
          behavior: behaviorName,
          condition: `postcondition[${i}]`,
          message: `Postcondition ${i} threw: ${error}`,
          input,
          output: result,
          timestamp: new Date(),
          duration,
        };
        violations.push(violation);
        if (options.onViolation) {
          await options.onViolation(violation);
        }
      }
    }

    return result;
  };

  // Add chainable methods
  const chainable = wrappedFn as typeof wrappedFn & {
    pre: (fn: (input: TInput, ctx: ExecutionContext) => boolean | Promise<boolean>) => typeof chainable;
    post: (fn: (result: TOutput, input: TInput, ctx: ExecutionContext) => boolean | Promise<boolean>) => typeof chainable;
  };

  chainable.pre = (checkFn) => {
    preconditions.push(checkFn);
    return chainable;
  };

  chainable.post = (checkFn) => {
    postconditions.push(checkFn);
    return chainable;
  };

  return chainable;
}
