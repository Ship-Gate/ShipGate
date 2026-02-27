/**
 * Tests for backpressure implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateUUID } from '@isl-lang/stdlib-core';
import { BackpressureController } from '../src/backpressure/controller.js';
import { 
  SizeBasedStrategy,
  UtilizationBasedStrategy,
  RateBasedStrategy,
  LatencyBasedStrategy,
  CompositeStrategy,
} from '../src/backpressure/strategies.js';
import { QueueStatus, JobStatus } from '../src/types.js';
import { BackpressureError } from '../src/errors.js';

describe('Backpressure Strategies', () => {
  describe('SizeBasedStrategy', () => {
    let strategy: SizeBasedStrategy;

    beforeEach(() => {
      strategy = new SizeBasedStrategy(10);
    });

    it('should trigger when queue size exceeds threshold', () => {
      const queue = createTestQueue('test', 15);
      expect(strategy.shouldTrigger(queue)).toBe(true);
    });

    it('should not trigger when queue size is below threshold', () => {
      const queue = createTestQueue('test', 5);
      expect(strategy.shouldTrigger(queue)).toBe(false);
    });

    it('should release when size drops below 80% threshold', () => {
      const queue = createTestQueue('test', 7); // 70% of threshold
      expect(strategy.shouldRelease(queue)).toBe(true);
    });
  });

  describe('UtilizationBasedStrategy', () => {
    let strategy: UtilizationBasedStrategy;

    beforeEach(() => {
      strategy = new UtilizationBasedStrategy(80); // 80% threshold
    });

    it('should trigger when utilization exceeds threshold', () => {
      const queue = createTestQueue('test', 10, 9); // 90% utilization
      expect(strategy.shouldTrigger(queue)).toBe(true);
    });

    it('should not trigger when utilization is below threshold', () => {
      const queue = createTestQueue('test', 10, 5); // 50% utilization
      expect(strategy.shouldTrigger(queue)).toBe(false);
    });
  });

  describe('RateBasedStrategy', () => {
    let strategy: RateBasedStrategy;

    beforeEach(() => {
      strategy = new RateBasedStrategy(1.5); // Arrival rate 1.5x processing rate
    });

    it('should trigger when arrival rate exceeds processing rate', () => {
      const queue = createTestQueue('test', 10);
      
      // Simulate high arrival rate
      for (let i = 0; i < 15; i++) {
        strategy.recordArrival(queue.id);
      }
      
      // Simulate lower processing rate
      for (let i = 0; i < 5; i++) {
        strategy.recordProcessing(queue.id);
      }
      
      expect(strategy.shouldTrigger(queue)).toBe(true);
    });
  });

  describe('LatencyBasedStrategy', () => {
    let strategy: LatencyBasedStrategy;

    beforeEach(() => {
      strategy = new LatencyBasedStrategy(1000); // 1 second threshold
    });

    it('should trigger when latency exceeds threshold', () => {
      const queue = createTestQueue('test', 10);
      
      // Record high latencies
      strategy.recordLatency(queue.id, 1500);
      strategy.recordLatency(queue.id, 1200);
      strategy.recordLatency(queue.id, 1100);
      
      expect(strategy.shouldTrigger(queue)).toBe(true);
    });

    it('should not trigger when latency is below threshold', () => {
      const queue = createTestQueue('test', 10);
      
      // Record low latencies
      strategy.recordLatency(queue.id, 500);
      strategy.recordLatency(queue.id, 600);
      strategy.recordLatency(queue.id, 400);
      
      expect(strategy.shouldTrigger(queue)).toBe(false);
    });
  });

  describe('CompositeStrategy', () => {
    let strategy: CompositeStrategy;
    let sizeStrategy: SizeBasedStrategy;
    let utilizationStrategy: UtilizationBasedStrategy;

    beforeEach(() => {
      sizeStrategy = new SizeBasedStrategy(10);
      utilizationStrategy = new UtilizationBasedStrategy(80);
      strategy = new CompositeStrategy([sizeStrategy, utilizationStrategy]);
    });

    it('should trigger if any strategy triggers', () => {
      const queue1 = createTestQueue('test', 15, 5); // Size triggers
      const queue2 = createTestQueue('test', 5, 5); // Utilization triggers (100%)
      
      expect(strategy.shouldTrigger(queue1)).toBe(true);
      expect(strategy.shouldTrigger(queue2)).toBe(true);
    });

    it('should not trigger if no strategy triggers', () => {
      const queue = createTestQueue('test', 5, 2); // Neither triggers
      expect(strategy.shouldTrigger(queue)).toBe(false);
    });
  });
});

describe('BackpressureController', () => {
  let controller: BackpressureController;
  let sizeStrategy: SizeBasedStrategy;

  beforeEach(() => {
    controller = new BackpressureController();
    sizeStrategy = new SizeBasedStrategy(5);
    controller.configure(sizeStrategy, 5);
  });

  it('should apply backpressure when threshold exceeded', async () => {
    const queue = createTestQueue('test', 10);
    
    const result = await controller.check(queue);
    expect(result.shouldApply).toBe(true);
    expect(result.action).toBe('reject');
  });

  it('should not apply backpressure when below threshold', async () => {
    const queue = createTestQueue('test', 3);
    
    const result = await controller.check(queue);
    expect(result.shouldApply).toBe(false);
  });

  it('should track active backpressure states', async () => {
    const queue = createTestQueue('test', 10);
    
    await controller.apply(queue);
    expect(controller.isActive(queue.id)).toBe(true);
    
    await controller.release(queue);
    expect(controller.isActive(queue.id)).toBe(false);
  });

  it('should handle enqueue attempts during backpressure', async () => {
    const queue = createTestQueue('test', 10);
    
    await controller.apply(queue);
    
    await expect(controller.handleEnqueue(queue)).rejects.toThrow(BackpressureError);
    
    const metrics = controller.getMetrics();
    expect(metrics.totalRejected).toBe(1);
  });

  it('should provide accurate metrics', async () => {
    const queue1 = createTestQueue('queue1', 10);
    const queue2 = createTestQueue('queue2', 10);
    
    await controller.apply(queue1);
    await controller.apply(queue2);
    
    // Simulate some rejections
    try { await controller.handleEnqueue(queue1); } catch {}
    try { await controller.handleEnqueue(queue1); } catch {}
    try { await controller.handleEnqueue(queue2); } catch {}
    
    const metrics = controller.getMetrics();
    expect(metrics.activeControllers.size).toBe(2);
    expect(metrics.totalRejected).toBe(3);
  });
});

function createTestQueue(id: string, size: number, processing = 2) {
  return {
    id,
    name: `Queue ${id}`,
    config: {
      maxRetries: 3,
      visibilityTimeout: 30000,
      batchSize: 1,
      fifo: false,
      deadLetterThreshold: 3,
      maxConcurrency: 10,
      completedJobRetention: 86400000,
      failedJobRetention: 604800000,
    },
    status: QueueStatus.ACTIVE,
    size,
    processing,
    delayed: 0,
    failed: 0,
    completed: 0,
    createdAt: new Date(),
  };
}
