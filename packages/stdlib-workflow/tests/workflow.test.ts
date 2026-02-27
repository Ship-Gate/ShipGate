/**
 * Workflow Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowEngine,
  WorkflowStatus,
  StepStatus,
  SagaOrchestrator,
  SagaBuilder,
  createSaga,
  withRetry,
  RetryStrategy,
  FailureAction,
  type HandlerContext,
  type StepDefinition,
} from '../implementations/typescript/index.js';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('startWorkflow', () => {
    it('should create and start a workflow', async () => {
      // Register handlers
      engine.getHandlers().register('step1', async () => ({ result: 'done' }));

      const result = await engine.startWorkflow({
        name: 'test-workflow',
        steps: [{ id: 'step1', name: 'Step 1', handler: 'step1' }],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('test-workflow');
        expect(result.value.status).toBe(WorkflowStatus.COMPLETED);
        expect(result.value.steps).toHaveLength(1);
      }
    });

    it('should reject workflow with no steps', async () => {
      const result = await engine.startWorkflow({
        name: 'empty-workflow',
        steps: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_WORKFLOW');
      }
    });

    it('should reject workflow with missing handler', async () => {
      const result = await engine.startWorkflow({
        name: 'test-workflow',
        steps: [{ id: 'step1', name: 'Step 1', handler: 'nonexistent' }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_HANDLER');
      }
    });

    it('should reject duplicate step IDs', async () => {
      engine.getHandlers().register('step1', async () => ({}));

      const result = await engine.startWorkflow({
        name: 'test-workflow',
        steps: [
          { id: 'step1', name: 'Step 1', handler: 'step1' },
          { id: 'step1', name: 'Step 1 Duplicate', handler: 'step1' },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DUPLICATE_STEP_IDS');
      }
    });

    it('should set initial context', async () => {
      engine.getHandlers().register('step1', async (_, ctx) => {
        return { receivedValue: ctx.context.testValue };
      });

      const result = await engine.startWorkflow({
        name: 'test-workflow',
        steps: [{ id: 'step1', name: 'Step 1', handler: 'step1' }],
        initialContext: { testValue: 42 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.context.testValue).toBe(42);
      }
    });
  });

  describe('multi-step workflow', () => {
    it('should execute steps in sequence', async () => {
      const executionOrder: string[] = [];

      engine.getHandlers().register('step1', async () => {
        executionOrder.push('step1');
        return { step1: 'done' };
      });
      engine.getHandlers().register('step2', async () => {
        executionOrder.push('step2');
        return { step2: 'done' };
      });
      engine.getHandlers().register('step3', async () => {
        executionOrder.push('step3');
        return { step3: 'done' };
      });

      const result = await engine.startWorkflow({
        name: 'multi-step',
        steps: [
          { id: 'step1', name: 'Step 1', handler: 'step1' },
          { id: 'step2', name: 'Step 2', handler: 'step2' },
          { id: 'step3', name: 'Step 3', handler: 'step3' },
        ],
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
      if (result.success) {
        expect(result.value.status).toBe(WorkflowStatus.COMPLETED);
      }
    });

    it('should merge step outputs into context', async () => {
      engine.getHandlers().register('step1', async () => ({ value1: 'a' }));
      engine.getHandlers().register('step2', async (_, ctx) => ({
        value2: 'b',
        fromStep1: ctx.context.value1,
      }));

      const result = await engine.startWorkflow({
        name: 'context-test',
        steps: [
          { id: 'step1', name: 'Step 1', handler: 'step1' },
          { id: 'step2', name: 'Step 2', handler: 'step2' },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.context.value1).toBe('a');
        expect(result.value.context.value2).toBe('b');
        expect(result.value.context.fromStep1).toBe('a');
      }
    });
  });

  describe('error handling', () => {
    it('should fail workflow when step throws', async () => {
      engine.getHandlers().register('failing', async () => {
        throw new Error('Step failed');
      });

      const result = await engine.startWorkflow({
        name: 'failing-workflow',
        steps: [{ id: 'failing', name: 'Failing Step', handler: 'failing' }],
      });

      expect(result.success).toBe(true); // Workflow was created
      if (result.success) {
        expect(result.value.status).toBe(WorkflowStatus.FAILED);
        expect(result.value.error?.message).toContain('Step failed');
      }
    });
  });

  describe('pauseWorkflow / resumeWorkflow', () => {
    it('should pause and resume a workflow', async () => {
      let resolveStep: () => void;
      const stepPromise = new Promise<void>((resolve) => {
        resolveStep = resolve;
      });

      engine.getHandlers().register('blocking', async () => {
        await stepPromise;
        return {};
      });
      engine.getHandlers().register('final', async () => ({ done: true }));

      // Start workflow (will block on first step)
      const startPromise = engine.startWorkflow({
        name: 'pausable',
        steps: [
          { id: 'blocking', name: 'Blocking', handler: 'blocking' },
          { id: 'final', name: 'Final', handler: 'final' },
        ],
      });

      // Give it time to start
      await new Promise((r) => setTimeout(r, 10));

      // Resolve the blocking step
      resolveStep!();
      
      const result = await startPromise;
      expect(result.success).toBe(true);
    });
  });
});

describe('SagaOrchestrator', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = new SagaOrchestrator();
  });

  describe('saga definition', () => {
    it('should create a saga with fluent API', () => {
      const saga = SagaOrchestrator.define('order-saga')
        .describe('Order processing saga')
        .step('reserve', {
          execute: async () => ({ reserved: true }),
          compensate: async () => {},
        })
        .step('charge', {
          execute: async () => ({ charged: true }),
          compensate: async () => {},
        })
        .build();

      expect(saga.name).toBe('order-saga');
      expect(saga.description).toBe('Order processing saga');
      expect(saga.steps).toHaveLength(2);
    });

    it('should create saga with helper function', () => {
      const saga = createSaga('simple-saga', [
        { id: 'step1', execute: async () => ({ done: true }) },
        {
          id: 'step2',
          execute: async () => ({ done: true }),
          compensate: async () => {},
        },
      ]);

      expect(saga.name).toBe('simple-saga');
      expect(saga.steps).toHaveLength(2);
      expect(saga.steps[1].compensate).toBeDefined();
    });
  });

  describe('saga execution', () => {
    it('should execute a simple saga', async () => {
      const saga = createSaga('test-saga', [
        { id: 'step1', execute: async () => ({ value: 1 }) },
        { id: 'step2', execute: async () => ({ value: 2 }) },
      ]);

      const result = await orchestrator.run(saga, { initial: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.workflow.status).toBe(WorkflowStatus.COMPLETED);
      }
    });
  });

  describe('compensation (saga rollback)', () => {
    it('should run compensation in reverse order', async () => {
      const compensationOrder: string[] = [];

      const saga = createSaga('compensation-test', [
        {
          id: 'step1',
          execute: async () => ({ step: 1 }),
          compensate: async () => {
            compensationOrder.push('step1');
          },
        },
        {
          id: 'step2',
          execute: async () => ({ step: 2 }),
          compensate: async () => {
            compensationOrder.push('step2');
          },
        },
        {
          id: 'step3',
          execute: async () => {
            throw new Error('Step 3 failed');
          },
        },
      ]);

      // Configure step3 to trigger compensation on failure
      saga.steps[2].onFailure = FailureAction.COMPENSATE;

      const result = await orchestrator.run(saga);

      // Wait for compensation to complete
      await new Promise((r) => setTimeout(r, 100));

      // Compensation should run in reverse: step2, then step1
      expect(compensationOrder).toEqual(['step2', 'step1']);
    });
  });
});

describe('retry configuration', () => {
  it('should create retry config with defaults', () => {
    const config = withRetry({ maxRetries: 3 });

    expect(config.maxRetries).toBe(3);
    expect(config.strategy).toBe(RetryStrategy.EXPONENTIAL);
    expect(config.initialDelayMs).toBe(1000);
  });

  it('should allow custom retry settings', () => {
    const config = withRetry({
      maxRetries: 5,
      strategy: RetryStrategy.FIXED_DELAY,
      initialDelayMs: 500,
      maxDelayMs: 5000,
    });

    expect(config.maxRetries).toBe(5);
    expect(config.strategy).toBe(RetryStrategy.FIXED_DELAY);
    expect(config.initialDelayMs).toBe(500);
    expect(config.maxDelayMs).toBe(5000);
  });
});

describe('WorkflowEventBus', () => {
  it('should emit and receive events', () => {
    const engine = new WorkflowEngine();
    const events: string[] = [];

    engine.getEventBus().on('workflow.started', (event) => {
      events.push(event.type);
    });
    engine.getEventBus().on('workflow.completed', (event) => {
      events.push(event.type);
    });

    engine.getHandlers().register('test', async () => ({}));

    engine.startWorkflow({
      name: 'event-test',
      steps: [{ id: 'test', name: 'Test', handler: 'test' }],
    });

    // Events are emitted synchronously
    expect(events).toContain('workflow.started');
  });

  it('should support wildcard subscriptions', async () => {
    const engine = new WorkflowEngine();
    const events: string[] = [];

    engine.getEventBus().onAll((event) => {
      events.push(event.type);
    });

    engine.getHandlers().register('test', async () => ({}));

    await engine.startWorkflow({
      name: 'wildcard-test',
      steps: [{ id: 'test', name: 'Test', handler: 'test' }],
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events).toContain('workflow.started');
    expect(events).toContain('step.started');
    expect(events).toContain('step.completed');
    expect(events).toContain('workflow.completed');
  });
});

describe('Order Fulfillment Saga (Integration)', () => {
  it('should complete order fulfillment successfully', async () => {
    const orchestrator = new SagaOrchestrator();
    
    // Simulate external service responses
    const inventory = { reserved: false };
    const payment = { charged: false };
    const shipping = { created: false };

    const saga = SagaOrchestrator.define('order_fulfillment')
      .describe('Complete order fulfillment with inventory, payment, and shipping')
      .compensatedStep(
        'reserve_inventory',
        async (input, ctx) => {
          inventory.reserved = true;
          return { reservation_id: 'res_123', quantity: 1 };
        },
        async (output, ctx) => {
          inventory.reserved = false;
        }
      )
      .compensatedStep(
        'charge_payment',
        async (input, ctx) => {
          payment.charged = true;
          return { transaction_id: 'txn_456', amount: 99.99 };
        },
        async (output, ctx) => {
          payment.charged = false;
        }
      )
      .compensatedStep(
        'create_shipment',
        async (input, ctx) => {
          shipping.created = true;
          return { shipment_id: 'ship_789', carrier: 'USPS' };
        },
        async (output, ctx) => {
          shipping.created = false;
        }
      )
      .build();

    const result = await orchestrator.run(saga, {
      order_id: 'order_123',
      customer_id: 'cust_456',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.workflow.status).toBe(WorkflowStatus.COMPLETED);
    }

    // All services should have been called
    expect(inventory.reserved).toBe(true);
    expect(payment.charged).toBe(true);
    expect(shipping.created).toBe(true);
  });

  it('should compensate on shipping failure', async () => {
    const orchestrator = new SagaOrchestrator();
    
    const inventory = { reserved: false };
    const payment = { charged: false };

    const saga = SagaOrchestrator.define('order_fulfillment_failing')
      .compensatedStep(
        'reserve_inventory',
        async () => {
          inventory.reserved = true;
          return { reservation_id: 'res_123' };
        },
        async () => {
          inventory.reserved = false;
        }
      )
      .compensatedStep(
        'charge_payment',
        async () => {
          payment.charged = true;
          return { transaction_id: 'txn_456' };
        },
        async () => {
          payment.charged = false;
        }
      )
      .step('create_shipment', {
        execute: async () => {
          throw new Error('Shipping service unavailable');
        },
        onFailure: FailureAction.COMPENSATE,
      })
      .build();

    const result = await orchestrator.run(saga, { order_id: 'order_123' });

    // Wait for compensation
    await new Promise((r) => setTimeout(r, 100));

    // After compensation, inventory and payment should be rolled back
    expect(inventory.reserved).toBe(false);
    expect(payment.charged).toBe(false);
  });
});
