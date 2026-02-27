/**
 * Workflow Engine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowEngine,
  createWorkflowEngine,
  WorkflowStatus,
  StepStatus,
  StepDefinition,
  RetryStrategy,
  FailureAction,
  StepExecutionContext,
} from '../src';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = createWorkflowEngine({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });
  });

  describe('handler registration', () => {
    it('should register a step handler', () => {
      const handler = vi.fn();
      engine.registerHandler('test_handler', handler);
      expect(engine.hasHandler('test_handler')).toBe(true);
    });

    it('should register a compensation handler', () => {
      const handler = vi.fn();
      engine.registerCompensationHandler('test_compensate', handler);
      // Compensation handlers are stored separately
      expect(engine.hasHandler('test_compensate')).toBe(false);
    });
  });

  describe('workflow creation', () => {
    it('should create a pending workflow', async () => {
      engine.registerHandler('step1', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step1' },
      ];

      const result = await engine.create('test_workflow', steps);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(WorkflowStatus.PENDING);
        expect(result.data.name).toBe('test_workflow');
        expect(result.data.steps).toHaveLength(1);
      }
    });

    it('should fail with empty steps', async () => {
      const result = await engine.create('empty_workflow', []);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_WORKFLOW');
      }
    });

    it('should fail with duplicate step IDs', async () => {
      engine.registerHandler('handler', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'handler' },
        { id: 'step1', name: 'Step 1 Duplicate', handler: 'handler' },
      ];

      const result = await engine.create('duplicate_workflow', steps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_WORKFLOW');
        expect(result.error.message).toContain('Duplicate');
      }
    });
  });

  describe('workflow execution', () => {
    it('should execute a single step workflow', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        output: { result: 'done' },
      });
      engine.registerHandler('handler', handler);

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'handler' },
      ];

      const result = await engine.start('simple_workflow', steps, {
        initialContext: { input: 'test' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Workflow completes asynchronously, check that it started
        expect(result.data.name).toBe('simple_workflow');
      }

      expect(handler).toHaveBeenCalled();
    });

    it('should execute multi-step workflow in order', async () => {
      const executionOrder: string[] = [];

      engine.registerHandler('step1', async () => {
        executionOrder.push('step1');
        return { success: true, output: { step1: true } };
      });

      engine.registerHandler('step2', async () => {
        executionOrder.push('step2');
        return { success: true, output: { step2: true } };
      });

      engine.registerHandler('step3', async () => {
        executionOrder.push('step3');
        return { success: true, output: { step3: true } };
      });

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step1' },
        { id: 'step2', name: 'Step 2', handler: 'step2' },
        { id: 'step3', name: 'Step 3', handler: 'step3' },
      ];

      await engine.start('multi_step', steps);

      // Allow async execution to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
    });

    it('should pass context between steps', async () => {
      const contexts: Record<string, unknown>[] = [];

      engine.registerHandler('step1', async (ctx) => {
        contexts.push({ ...ctx.context });
        return { success: true, output: { fromStep1: 'value1' } };
      });

      engine.registerHandler('step2', async (ctx) => {
        contexts.push({ ...ctx.context });
        return { success: true, output: { fromStep2: 'value2' } };
      });

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step1' },
        { id: 'step2', name: 'Step 2', handler: 'step2' },
      ];

      await engine.start('context_workflow', steps, {
        initialContext: { initial: 'data' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(contexts[0]).toEqual({ initial: 'data' });
      expect(contexts[1]).toEqual({
        initial: 'data',
        fromStep1: 'value1',
      });
    });

    it('should skip conditional steps when condition is false', async () => {
      const executedSteps: string[] = [];

      engine.registerHandler('always', async () => {
        executedSteps.push('always');
        return { success: true };
      });

      engine.registerHandler('conditional', async () => {
        executedSteps.push('conditional');
        return { success: true };
      });

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Always', handler: 'always' },
        {
          id: 'step2',
          name: 'Conditional',
          handler: 'conditional',
          condition: 'ctx.shouldRun === true',
        },
        { id: 'step3', name: 'Also Always', handler: 'always' },
      ];

      await engine.start('conditional_workflow', steps, {
        initialContext: { shouldRun: false },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executedSteps).toEqual(['always', 'always']);
    });
  });

  describe('retry behavior', () => {
    it('should retry failed steps', async () => {
      let attempts = 0;

      engine.registerHandler('flaky', async () => {
        attempts++;
        if (attempts < 3) {
          return {
            success: false,
            error: {
              code: 'TEMPORARY_ERROR',
              message: 'Try again',
              attempt: attempts,
              recoverable: true,
            },
          };
        }
        return { success: true };
      });

      const steps: StepDefinition[] = [
        {
          id: 'step1',
          name: 'Flaky Step',
          handler: 'flaky',
          retry: {
            strategy: RetryStrategy.FIXED_DELAY,
            maxRetries: 5,
            initialDelayMs: 10,
          },
        },
      ];

      await engine.start('retry_workflow', steps);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(attempts).toBe(3);
    });

    it('should fail workflow after max retries exceeded', async () => {
      engine.registerHandler('always_fail', async () => ({
        success: false,
        error: {
          code: 'PERMANENT_ERROR',
          message: 'Always fails',
          attempt: 1,
          recoverable: true,
        },
      }));

      const steps: StepDefinition[] = [
        {
          id: 'step1',
          name: 'Always Fail',
          handler: 'always_fail',
          retry: {
            strategy: RetryStrategy.FIXED_DELAY,
            maxRetries: 2,
            initialDelayMs: 10,
          },
          onFailure: FailureAction.FAIL_WORKFLOW,
        },
      ];

      const result = await engine.start('fail_workflow', steps);

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (result.success) {
        const workflow = engine.get(result.data.id);
        expect(workflow?.status).toBe(WorkflowStatus.FAILED);
      }
    });
  });

  describe('pause and resume', () => {
    it('should pause a running workflow', async () => {
      let stepCompleted = false;

      engine.registerHandler('slow_step', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        stepCompleted = true;
        return { success: true };
      });

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Slow Step', handler: 'slow_step' },
        { id: 'step2', name: 'Next Step', handler: 'slow_step' },
      ];

      const result = await engine.start('pausable_workflow', steps);

      if (result.success) {
        const pauseResult = await engine.pause(result.data.id, 'Testing pause');
        expect(pauseResult.success).toBe(true);
        if (pauseResult.success) {
          expect(pauseResult.data.status).toBe(WorkflowStatus.PAUSED);
        }
      }
    });

    it('should resume a paused workflow', async () => {
      engine.registerHandler('step', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step' },
      ];

      const createResult = await engine.create('resume_workflow', steps);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const resumeResult = await engine.resume(createResult.data.id);
        expect(resumeResult.success).toBe(true);
        if (resumeResult.success) {
          expect(resumeResult.data.status).toBe(WorkflowStatus.RUNNING);
        }
      }
    });
  });

  describe('cancellation', () => {
    it('should cancel a pending workflow', async () => {
      engine.registerHandler('step', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step' },
      ];

      const createResult = await engine.create('cancel_workflow', steps);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const cancelResult = await engine.cancel(createResult.data.id, {
          reason: 'User requested',
          skipCompensation: true,
        });

        expect(cancelResult.success).toBe(true);
        if (cancelResult.success) {
          expect(cancelResult.data.status).toBe(WorkflowStatus.CANCELLED);
        }
      }
    });
  });

  describe('query methods', () => {
    it('should list workflows with filters', async () => {
      engine.registerHandler('step', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step' },
      ];

      await engine.create('workflow_1', steps);
      await engine.create('workflow_2', steps);
      await engine.start('workflow_3', steps);

      const allWorkflows = engine.list();
      expect(allWorkflows.total).toBe(3);

      const pendingWorkflows = engine.list({ status: WorkflowStatus.PENDING });
      expect(pendingWorkflows.total).toBe(2);
    });

    it('should get workflow status with progress', async () => {
      engine.registerHandler('step', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step' },
        { id: 'step2', name: 'Step 2', handler: 'step' },
        { id: 'step3', name: 'Step 3', handler: 'step' },
      ];

      const result = await engine.start('progress_workflow', steps);
      expect(result.success).toBe(true);

      if (result.success) {
        const status = engine.getStatus(result.data.id);
        expect(status.success).toBe(true);

        if (status.success) {
          expect(status.data.progress.totalSteps).toBe(3);
        }
      }
    });
  });

  describe('event emission', () => {
    it('should emit workflow events', async () => {
      const events: string[] = [];

      const eventEngine = createWorkflowEngine({
        onEvent: (event) => {
          events.push(event.type);
        },
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      });

      eventEngine.registerHandler('step', async () => ({ success: true }));

      const steps: StepDefinition[] = [
        { id: 'step1', name: 'Step 1', handler: 'step' },
      ];

      await eventEngine.start('event_workflow', steps);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events).toContain('WORKFLOW_STARTED');
      expect(events).toContain('WORKFLOW_COMPLETED');
    });
  });
});

describe('Compensation', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = createWorkflowEngine({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });
  });

  it('should trigger compensation on failure', async () => {
    const compensated: string[] = [];

    engine.registerHandler('step1', async () => ({
      success: true,
      output: { step1: 'done' },
    }));

    engine.registerCompensationHandler('step1_compensate', async () => {
      compensated.push('step1');
      return { success: true };
    });

    engine.registerHandler('step2', async () => ({
      success: false,
      error: {
        code: 'STEP2_FAILED',
        message: 'Step 2 failed',
        attempt: 1,
        recoverable: false,
      },
    }));

    const steps: StepDefinition[] = [
      {
        id: 'step1',
        name: 'Step 1',
        handler: 'step1',
        compensationHandler: 'step1_compensate',
      },
      {
        id: 'step2',
        name: 'Step 2',
        handler: 'step2',
        onFailure: FailureAction.COMPENSATE,
      },
    ];

    await engine.start('compensation_workflow', steps);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(compensated).toContain('step1');
  });

  it('should compensate in reverse order', async () => {
    const compensationOrder: string[] = [];

    engine.registerHandler('step1', async () => ({ success: true }));
    engine.registerHandler('step2', async () => ({ success: true }));
    engine.registerHandler('step3', async () => ({
      success: false,
      error: {
        code: 'FAILED',
        message: 'Failed',
        attempt: 1,
        recoverable: false,
      },
    }));

    engine.registerCompensationHandler('compensate1', async () => {
      compensationOrder.push('step1');
      return { success: true };
    });

    engine.registerCompensationHandler('compensate2', async () => {
      compensationOrder.push('step2');
      return { success: true };
    });

    const steps: StepDefinition[] = [
      {
        id: 'step1',
        name: 'Step 1',
        handler: 'step1',
        compensationHandler: 'compensate1',
      },
      {
        id: 'step2',
        name: 'Step 2',
        handler: 'step2',
        compensationHandler: 'compensate2',
      },
      {
        id: 'step3',
        name: 'Step 3',
        handler: 'step3',
        onFailure: FailureAction.COMPENSATE,
      },
    ];

    await engine.start('reverse_compensation', steps);

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should compensate in reverse order: step2, then step1
    expect(compensationOrder).toEqual(['step2', 'step1']);
  });

  it('should mark workflow as compensated after all compensations', async () => {
    engine.registerHandler('step1', async () => ({ success: true }));
    engine.registerCompensationHandler('compensate1', async () => ({
      success: true,
    }));

    const steps: StepDefinition[] = [
      {
        id: 'step1',
        name: 'Step 1',
        handler: 'step1',
        compensationHandler: 'compensate1',
      },
    ];

    const result = await engine.start('compensate_test', steps);
    expect(result.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (result.success) {
      const compensateResult = await engine.compensate(
        result.data.id,
        'Manual compensation'
      );

      expect(compensateResult.success).toBe(true);
      if (compensateResult.success) {
        expect(compensateResult.data.status).toBe(WorkflowStatus.COMPENSATED);
      }
    }
  });
});
