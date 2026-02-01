/**
 * Saga Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SagaOrchestrator,
  createSagaOrchestrator,
  createTransactionalStep,
  WorkflowStatus,
} from '../src';

describe('SagaOrchestrator', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = createSagaOrchestrator({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });
  });

  describe('saga definition', () => {
    it('should define a saga with builder pattern', () => {
      const saga = orchestrator
        .define('order_fulfillment')
        .step(
          'reserve_inventory',
          'Reserve Inventory',
          async () => ({ success: true, output: { reserved: true } }),
          async () => ({ success: true })
        )
        .timeout(5000)
        .step(
          'charge_payment',
          'Charge Payment',
          async () => ({ success: true, output: { charged: true } }),
          async () => ({ success: true })
        )
        .retries(3)
        .step(
          'ship_order',
          'Ship Order',
          async () => ({ success: true, output: { shipped: true } })
        )
        .build();

      expect(saga.name).toBe('order_fulfillment');
      expect(saga.steps).toHaveLength(3);
      expect(saga.steps[0].id).toBe('reserve_inventory');
      expect(saga.steps[1].id).toBe('charge_payment');
      expect(saga.steps[2].id).toBe('ship_order');
    });
  });

  describe('saga execution', () => {
    it('should execute a successful saga', async () => {
      const executionOrder: string[] = [];

      orchestrator
        .define('success_saga')
        .step('step1', 'Step 1', async () => {
          executionOrder.push('step1');
          return { success: true, output: { step1: 'done' } };
        })
        .step('step2', 'Step 2', async () => {
          executionOrder.push('step2');
          return { success: true, output: { step2: 'done' } };
        })
        .build();

      // Get saga ID from the registered sagas
      const result = await orchestrator.execute(
        Array.from(orchestrator['sagas'].keys())[0],
        { initial: 'context' }
      );

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.result?.step1).toBe('done');
      expect(result.result?.step2).toBe('done');
    });

    it('should compensate on failure', async () => {
      const actions: string[] = [];

      const saga = orchestrator
        .define('failing_saga')
        .step(
          'step1',
          'Step 1',
          async () => {
            actions.push('execute_step1');
            return { success: true };
          },
          async () => {
            actions.push('compensate_step1');
            return { success: true };
          }
        )
        .step(
          'step2',
          'Step 2',
          async () => {
            actions.push('execute_step2');
            return { success: true };
          },
          async () => {
            actions.push('compensate_step2');
            return { success: true };
          }
        )
        .step('step3', 'Step 3', async () => {
          actions.push('execute_step3_fail');
          return {
            success: false,
            error: {
              code: 'STEP3_FAILED',
              message: 'Step 3 failed',
              attempt: 1,
              recoverable: false,
            },
          };
        })
        .build();

      const result = await orchestrator.execute(saga.id, {});

      expect(result.success).toBe(false);
      expect(result.compensated).toBe(true);

      // Verify execution and compensation order
      expect(actions).toContain('execute_step1');
      expect(actions).toContain('execute_step2');
      expect(actions).toContain('execute_step3_fail');
      expect(actions).toContain('compensate_step2');
      expect(actions).toContain('compensate_step1');

      // Compensations should happen in reverse
      const compStep2Index = actions.indexOf('compensate_step2');
      const compStep1Index = actions.indexOf('compensate_step1');
      expect(compStep2Index).toBeLessThan(compStep1Index);
    });

    it('should pass context through steps', async () => {
      const receivedContexts: Record<string, unknown>[] = [];

      const saga = orchestrator
        .define('context_saga')
        .step('step1', 'Step 1', async (ctx) => {
          receivedContexts.push({ ...ctx.context });
          return { success: true, output: { fromStep1: 'value1' } };
        })
        .step('step2', 'Step 2', async (ctx) => {
          receivedContexts.push({ ...ctx.context });
          return { success: true, output: { fromStep2: 'value2' } };
        })
        .build();

      await orchestrator.execute(saga.id, { initial: 'data' });

      expect(receivedContexts[0]).toEqual({ initial: 'data' });
      expect(receivedContexts[1]).toEqual({
        initial: 'data',
        fromStep1: 'value1',
      });
    });

    it('should handle async execution', async () => {
      const saga = orchestrator
        .define('async_saga')
        .step('step1', 'Step 1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { success: true };
        })
        .build();

      const result = await orchestrator.executeAsync(saga.id, {});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(WorkflowStatus.RUNNING);

        // Wait for completion
        await new Promise((resolve) => setTimeout(resolve, 200));

        const status = orchestrator.getStatus(result.data.id);
        expect(status?.status).toBe(WorkflowStatus.COMPLETED);
      }
    });
  });

  describe('saga abort', () => {
    it('should abort a running saga', async () => {
      const saga = orchestrator
        .define('abortable_saga')
        .step(
          'step1',
          'Step 1',
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return { success: true };
          },
          async () => ({ success: true })
        )
        .step('step2', 'Step 2', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { success: true };
        })
        .build();

      const execResult = await orchestrator.executeAsync(saga.id, {});
      expect(execResult.success).toBe(true);

      if (execResult.success) {
        // Wait a bit then abort
        await new Promise((resolve) => setTimeout(resolve, 50));

        const abortResult = await orchestrator.abort(
          execResult.data.id,
          'User cancelled'
        );

        expect(abortResult.success).toBe(true);
      }
    });
  });

  describe('transactional step helper', () => {
    it('should create transactional steps', async () => {
      const step = createTransactionalStep('payment', 'Process Payment', {
        execute: async (ctx) => {
          return { paymentId: 'pay_123', amount: ctx.context.amount };
        },
        compensate: async (ctx) => {
          // Refund logic
        },
        timeout: 5000,
        retries: 3,
      });

      expect(step.id).toBe('payment');
      expect(step.name).toBe('Process Payment');
      expect(step.timeout).toBe(5000);
      expect(step.retries).toBe(3);
      expect(step.execute).toBeDefined();
      expect(step.compensate).toBeDefined();
    });
  });
});

describe('Order Fulfillment Saga Example', () => {
  it('should execute complete order fulfillment saga', async () => {
    const orchestrator = createSagaOrchestrator({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    const executedSteps: string[] = [];
    const compensatedSteps: string[] = [];

    const saga = orchestrator
      .define('order_fulfillment')
      .step(
        'reserve_inventory',
        'Reserve Inventory',
        async (ctx) => {
          executedSteps.push('reserve_inventory');
          return {
            success: true,
            output: {
              reservation_id: 'res_123',
              order_id: ctx.context.order_id,
            },
          };
        },
        async () => {
          compensatedSteps.push('release_inventory');
          return { success: true };
        }
      )
      .step(
        'charge_payment',
        'Charge Payment',
        async (ctx) => {
          executedSteps.push('charge_payment');
          return {
            success: true,
            output: {
              payment_id: 'pay_123',
              amount: ctx.context.amount,
            },
          };
        },
        async () => {
          compensatedSteps.push('refund_payment');
          return { success: true };
        }
      )
      .step(
        'ship_order',
        'Ship Order',
        async (ctx) => {
          executedSteps.push('ship_order');
          return {
            success: true,
            output: {
              shipment_id: 'ship_123',
              tracking_number: 'TRACK123',
            },
          };
        },
        async () => {
          compensatedSteps.push('cancel_shipment');
          return { success: true };
        }
      )
      .build();

    const result = await orchestrator.execute(saga.id, {
      order_id: 'order_123',
      customer_id: 'cust_456',
      amount: 99.99,
      items: [{ product_id: 'prod_1', quantity: 2 }],
    });

    expect(result.success).toBe(true);
    expect(executedSteps).toEqual([
      'reserve_inventory',
      'charge_payment',
      'ship_order',
    ]);
    expect(compensatedSteps).toHaveLength(0);
    expect(result.result?.shipment_id).toBe('ship_123');
  });

  it('should compensate when shipping fails', async () => {
    const orchestrator = createSagaOrchestrator({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    const compensatedSteps: string[] = [];

    const saga = orchestrator
      .define('failing_order')
      .step(
        'reserve_inventory',
        'Reserve Inventory',
        async () => ({ success: true, output: { reserved: true } }),
        async () => {
          compensatedSteps.push('release_inventory');
          return { success: true };
        }
      )
      .step(
        'charge_payment',
        'Charge Payment',
        async () => ({ success: true, output: { charged: true } }),
        async () => {
          compensatedSteps.push('refund_payment');
          return { success: true };
        }
      )
      .step('ship_order', 'Ship Order', async () => ({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: 'Product out of stock at warehouse',
          attempt: 1,
          recoverable: false,
        },
      }))
      .build();

    const result = await orchestrator.execute(saga.id, {});

    expect(result.success).toBe(false);
    expect(result.compensated).toBe(true);
    expect(compensatedSteps).toContain('refund_payment');
    expect(compensatedSteps).toContain('release_inventory');

    // Verify compensation order (reverse of execution)
    expect(compensatedSteps.indexOf('refund_payment')).toBeLessThan(
      compensatedSteps.indexOf('release_inventory')
    );
  });
});
