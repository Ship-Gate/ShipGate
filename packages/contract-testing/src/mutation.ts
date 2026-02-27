/**
 * Mutation Tester
 * 
 * Tests the quality of contract tests by mutating the implementation.
 */

import type { BehaviorSpec, BehaviorHandler } from './tester.js';
import type { PropertyTest } from './properties.js';
import { ContractRunner } from './runner.js';

// ============================================================================
// Types
// ============================================================================

export interface MutationResult {
  totalMutants: number;
  killed: number;
  survived: number;
  timeout: number;
  score: number;
  mutants: MutantResult[];
}

export interface MutantResult {
  id: string;
  mutation: string;
  location: string;
  status: 'killed' | 'survived' | 'timeout';
  killedBy?: string;
}

export interface Mutation {
  id: string;
  type: MutationType;
  description: string;
  apply: <T>(handler: BehaviorHandler<unknown, T>) => BehaviorHandler<unknown, T>;
}

export type MutationType =
  | 'return_null'
  | 'return_empty'
  | 'throw_error'
  | 'flip_boolean'
  | 'remove_validation'
  | 'change_comparison'
  | 'swap_parameters';

// ============================================================================
// Mutation Tester
// ============================================================================

export class MutationTester {
  private runner: ContractRunner;

  constructor() {
    this.runner = new ContractRunner({ timeout: 2000 });
  }

  /**
   * Run mutation testing
   */
  async test(
    behavior: BehaviorSpec,
    handler: BehaviorHandler<unknown, unknown>,
    tests: PropertyTest[]
  ): Promise<MutationResult> {
    const mutations = this.generateMutations(behavior);
    const results: MutantResult[] = [];

    for (const mutation of mutations) {
      const mutatedHandler = mutation.apply(handler);
      const result = await this.runTestsAgainstMutant(mutation, mutatedHandler, tests);
      results.push(result);
    }

    const killed = results.filter(r => r.status === 'killed').length;
    const survived = results.filter(r => r.status === 'survived').length;
    const timeout = results.filter(r => r.status === 'timeout').length;

    return {
      totalMutants: mutations.length,
      killed,
      survived,
      timeout,
      score: mutations.length > 0 ? (killed / mutations.length) * 100 : 100,
      mutants: results,
    };
  }

  /**
   * Generate mutations for a behavior
   */
  private generateMutations(behavior: BehaviorSpec): Mutation[] {
    return [
      this.createReturnNullMutation(),
      this.createReturnEmptyMutation(),
      this.createThrowErrorMutation(),
      this.createFlipSuccessMutation(),
      this.createRemoveValidationMutation(),
    ];
  }

  /**
   * Run tests against a mutant
   */
  private async runTestsAgainstMutant(
    mutation: Mutation,
    handler: BehaviorHandler<unknown, unknown>,
    tests: PropertyTest[]
  ): Promise<MutantResult> {
    for (const test of tests) {
      try {
        const result = await this.runner.runPropertyTest(test, handler, 10);
        
        if (!result.passed) {
          return {
            id: mutation.id,
            mutation: mutation.description,
            location: 'handler',
            status: 'killed',
            killedBy: test.name,
          };
        }
      } catch (error) {
        if ((error as Error).message.includes('timeout')) {
          return {
            id: mutation.id,
            mutation: mutation.description,
            location: 'handler',
            status: 'timeout',
          };
        }
        return {
          id: mutation.id,
          mutation: mutation.description,
          location: 'handler',
          status: 'killed',
          killedBy: 'exception',
        };
      }
    }

    return {
      id: mutation.id,
      mutation: mutation.description,
      location: 'handler',
      status: 'survived',
    };
  }

  /**
   * Create return null mutation
   */
  private createReturnNullMutation(): Mutation {
    return {
      id: 'return_null',
      type: 'return_null',
      description: 'Replace return value with null',
      apply: <T>(_handler: BehaviorHandler<unknown, T>) => {
        return async () => null as T;
      },
    };
  }

  /**
   * Create return empty mutation
   */
  private createReturnEmptyMutation(): Mutation {
    return {
      id: 'return_empty',
      type: 'return_empty',
      description: 'Replace return value with empty object',
      apply: <T>(_handler: BehaviorHandler<unknown, T>) => {
        return async () => ({}) as T;
      },
    };
  }

  /**
   * Create throw error mutation
   */
  private createThrowErrorMutation(): Mutation {
    return {
      id: 'throw_error',
      type: 'throw_error',
      description: 'Replace handler with error throw',
      apply: <T>(_handler: BehaviorHandler<unknown, T>) => {
        return async () => {
          throw new Error('Mutant error');
        };
      },
    };
  }

  /**
   * Create flip success mutation
   */
  private createFlipSuccessMutation(): Mutation {
    return {
      id: 'flip_success',
      type: 'flip_boolean',
      description: 'Flip success flag in response',
      apply: <T>(handler: BehaviorHandler<unknown, T>) => {
        return async (input: unknown) => {
          const result = await handler(input);
          if (typeof result === 'object' && result !== null && 'success' in result) {
            return { ...result, success: !(result as { success: boolean }).success } as T;
          }
          return result;
        };
      },
    };
  }

  /**
   * Create remove validation mutation
   */
  private createRemoveValidationMutation(): Mutation {
    return {
      id: 'remove_validation',
      type: 'remove_validation',
      description: 'Skip input validation',
      apply: <T>(handler: BehaviorHandler<unknown, T>) => {
        return async (input: unknown) => {
          // Skip validation by passing directly
          return handler(input);
        };
      },
    };
  }
}
