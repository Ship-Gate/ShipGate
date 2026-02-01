/**
 * Compensation Module Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CompensationExecutor,
  CompensationPlanBuilder,
  CompensationStrategy,
  CompensationFailureStrategy,
  createCompensationExecutor,
  createCompensationPlan,
  idempotentCompensation,
  logOnlyCompensation,
  composeCompensations,
  withRetry,
  CompensationContext,
} from '../src';

describe('CompensationExecutor', () => {
  let executor: CompensationExecutor;

  beforeEach(() => {
    executor = createCompensationExecutor({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      defaultRetries: 1,
      defaultTimeout: 5000,
    });
  });

  const createContext = (stepId: string = 'step1'): CompensationContext => ({
    workflowId: 'wf_123',
    stepId,
    context: {},
    input: { key: 'value' },
    attempt: 1,
    originalInput: { key: 'value' },
    originalOutput: { result: 'success' },
  });

  describe('sequential execution', () => {
    it('should execute compensations in order', async () => {
      const order: string[] = [];

      const plan = createCompensationPlan('wf_123')
        .addAction('step1', async () => {
          order.push('step1');
          return { success: true };
        })
        .addAction('step2', async () => {
          order.push('step2');
          return { success: true };
        })
        .addAction('step3', async () => {
          order.push('step3');
          return { success: true };
        })
        .withStrategy(CompensationStrategy.SEQUENTIAL)
        .build();

      const result = await executor.execute(plan, createContext());

      expect(result.success).toBe(true);
      expect(result.completedActions).toBe(3);
      expect(order).toEqual(['step3', 'step2', 'step1']); // Higher priority first
    });

    it('should stop on failure when configured', async () => {
      const executed: string[] = [];

      const plan = createCompensationPlan('wf_123')
        .addAction('step1', async () => {
          executed.push('step1');
          return { success: true };
        }, { priority: 1 })
        .addAction('step2', async () => {
          executed.push('step2_fail');
          return {
            success: false,
            error: {
              code: 'FAILED',
              message: 'Failed',
              attempt: 1,
              recoverable: false,
            },
          };
        }, { priority: 2 })
        .addAction('step3', async () => {
          executed.push('step3');
          return { success: true };
        }, { priority: 3 })
        .withStrategy(CompensationStrategy.SEQUENTIAL)
        .onFailureStrategy(CompensationFailureStrategy.STOP_ON_FAILURE)
        .build();

      const result = await executor.execute(plan, createContext());

      expect(result.success).toBe(false);
      expect(result.failedActions).toHaveLength(1);
      // step3 (priority 3) runs first, then step2 (priority 2) fails, step1 should not run
      expect(executed).toEqual(['step3', 'step2_fail']);
    });

    it('should continue on failure when configured', async () => {
      const executed: string[] = [];

      const plan = createCompensationPlan('wf_123')
        .addAction('step1', async () => {
          executed.push('step1');
          return { success: true };
        }, { priority: 1 })
        .addAction('step2', async () => {
          executed.push('step2_fail');
          return {
            success: false,
            error: {
              code: 'FAILED',
              message: 'Failed',
              attempt: 1,
              recoverable: false,
            },
          };
        }, { priority: 2 })
        .addAction('step3', async () => {
          executed.push('step3');
          return { success: true };
        }, { priority: 3 })
        .withStrategy(CompensationStrategy.SEQUENTIAL)
        .onFailureStrategy(CompensationFailureStrategy.CONTINUE_ON_FAILURE)
        .build();

      const result = await executor.execute(plan, createContext());

      expect(result.success).toBe(false);
      expect(result.completedActions).toBe(2);
      expect(result.failedActions).toHaveLength(1);
      expect(executed).toEqual(['step3', 'step2_fail', 'step1']);
    });
  });

  describe('parallel execution', () => {
    it('should execute compensations in parallel', async () => {
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      const plan = createCompensationPlan('wf_123')
        .addAction('step1', async () => {
          startTimes.step1 = Date.now();
          await new Promise((r) => setTimeout(r, 50));
          endTimes.step1 = Date.now();
          return { success: true };
        })
        .addAction('step2', async () => {
          startTimes.step2 = Date.now();
          await new Promise((r) => setTimeout(r, 50));
          endTimes.step2 = Date.now();
          return { success: true };
        })
        .addAction('step3', async () => {
          startTimes.step3 = Date.now();
          await new Promise((r) => setTimeout(r, 50));
          endTimes.step3 = Date.now();
          return { success: true };
        })
        .withStrategy(CompensationStrategy.PARALLEL)
        .build();

      const result = await executor.execute(plan, createContext());

      expect(result.success).toBe(true);
      expect(result.completedActions).toBe(3);

      // All should start at roughly the same time (within 20ms)
      const times = Object.values(startTimes);
      const maxDiff = Math.max(...times) - Math.min(...times);
      expect(maxDiff).toBeLessThan(20);
    });
  });

  describe('best effort execution', () => {
    it('should continue despite errors', async () => {
      const executed: string[] = [];

      const plan = createCompensationPlan('wf_123')
        .addAction('step1', async () => {
          executed.push('step1');
          return { success: true };
        }, { priority: 1 })
        .addAction('step2', async () => {
          executed.push('step2');
          throw new Error('Unexpected error');
        }, { priority: 2 })
        .addAction('step3', async () => {
          executed.push('step3');
          return { success: true };
        }, { priority: 3 })
        .withStrategy(CompensationStrategy.BEST_EFFORT)
        .build();

      const result = await executor.execute(plan, createContext());

      expect(result.success).toBe(false);
      expect(result.completedActions).toBe(2);
      expect(result.failedActions).toHaveLength(1);
      expect(executed).toHaveLength(3);
    });
  });

  describe('retry behavior', () => {
    it('should retry failed compensations', async () => {
      let attempts = 0;

      const retryExecutor = createCompensationExecutor({
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        defaultRetries: 3,
      });

      const plan = createCompensationPlan('wf_123')
        .addAction('flaky', async () => {
          attempts++;
          if (attempts < 3) {
            return {
              success: false,
              error: {
                code: 'TEMPORARY',
                message: 'Try again',
                attempt: attempts,
                recoverable: true,
              },
            };
          }
          return { success: true };
        })
        .onFailureStrategy(CompensationFailureStrategy.RETRY_THEN_CONTINUE)
        .build();

      const result = await retryExecutor.execute(plan, createContext());

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });
});

describe('Compensation Helpers', () => {
  describe('idempotentCompensation', () => {
    it('should skip if already compensated', async () => {
      let handlerCalled = false;

      const handler = idempotentCompensation(
        async () => {
          handlerCalled = true;
          return { success: true };
        },
        async () => true // Already compensated
      );

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(handlerCalled).toBe(false);
    });

    it('should execute if not already compensated', async () => {
      let handlerCalled = false;

      const handler = idempotentCompensation(
        async () => {
          handlerCalled = true;
          return { success: true };
        },
        async () => false // Not compensated yet
      );

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(handlerCalled).toBe(true);
    });
  });

  describe('logOnlyCompensation', () => {
    it('should log and return success', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const handler = logOnlyCompensation('Test compensation', mockLogger);

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
        originalOutput: { data: 'test' },
      });

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[compensation] Test compensation',
        expect.objectContaining({
          workflowId: 'wf_123',
          stepId: 'step1',
        })
      );
    });
  });

  describe('composeCompensations', () => {
    it('should execute all handlers in sequence', async () => {
      const order: number[] = [];

      const handler = composeCompensations([
        async () => {
          order.push(1);
          return { success: true };
        },
        async () => {
          order.push(2);
          return { success: true };
        },
        async () => {
          order.push(3);
          return { success: true };
        },
      ]);

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should stop on first failure', async () => {
      const order: number[] = [];

      const handler = composeCompensations([
        async () => {
          order.push(1);
          return { success: true };
        },
        async () => {
          order.push(2);
          return {
            success: false,
            error: {
              code: 'FAILED',
              message: 'Failed',
              attempt: 1,
              recoverable: false,
            },
          };
        },
        async () => {
          order.push(3);
          return { success: true };
        },
      ]);

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(order).toEqual([1, 2]); // 3 should not execute
    });
  });

  describe('withRetry', () => {
    it('should retry handler on failure', async () => {
      let attempts = 0;

      const handler = withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            return {
              success: false,
              error: {
                code: 'RETRY',
                message: 'Retry me',
                attempt: attempts,
                recoverable: true,
              },
            };
          }
          return { success: true };
        },
        5,
        10
      );

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should stop retrying if error is not recoverable', async () => {
      let attempts = 0;

      const handler = withRetry(
        async () => {
          attempts++;
          return {
            success: false,
            error: {
              code: 'PERMANENT',
              message: 'Cannot recover',
              attempt: attempts,
              recoverable: false,
            },
          };
        },
        5,
        10
      );

      const result = await handler({
        workflowId: 'wf_123',
        stepId: 'step1',
        context: {},
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(attempts).toBe(1); // Should not retry
    });
  });
});

describe('CompensationPlanBuilder', () => {
  it('should build a compensation plan with actions', () => {
    const plan = createCompensationPlan('wf_123')
      .addAction('step1', async () => ({ success: true }), {
        priority: 10,
        timeout: 5000,
        retries: 3,
      })
      .addAction('step2', async () => ({ success: true }), {
        priority: 20,
      })
      .withStrategy(CompensationStrategy.PARALLEL)
      .onFailureStrategy(CompensationFailureStrategy.CONTINUE_ON_FAILURE)
      .build();

    expect(plan.workflowId).toBe('wf_123');
    expect(plan.actions).toHaveLength(2);
    expect(plan.strategy).toBe(CompensationStrategy.PARALLEL);
    expect(plan.onFailure).toBe(CompensationFailureStrategy.CONTINUE_ON_FAILURE);
    expect(plan.actions[0].priority).toBe(10);
    expect(plan.actions[0].timeout).toBe(5000);
    expect(plan.actions[0].retries).toBe(3);
    expect(plan.actions[1].priority).toBe(20);
  });
});
