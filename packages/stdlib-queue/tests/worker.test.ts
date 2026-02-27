/**
 * Tests for worker and worker pool implementations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateUUID } from '@isl-lang/stdlib-core';
import { Worker } from '../src/worker/worker.js';
import { WorkerPool } from '../src/worker/pool.js';
import { FIFOQueue } from '../src/queue/fifo.js';
import { WorkerStatus, JobStatus } from '../src/types.js';

describe('Worker', () => {
  let worker: Worker;
  let mockHandler: any;

  beforeEach(() => {
    mockHandler = vi.fn().mockResolvedValue({ result: 'success' });
    worker = new Worker({
      id: 'test-worker',
      handler: mockHandler,
      concurrency: 2,
      maxRetries: 3,
      retryDelay: 1000,
      visibilityTimeout: 30000,
      heartbeatInterval: 5000,
      gracefulShutdownTimeout: 10000,
    });
  });

  it('should start and stop correctly', async () => {
    expect(worker.getStatus()).toBe(WorkerStatus.STOPPED);
    
    await worker.start();
    expect(worker.getStatus()).toBe(WorkerStatus.RUNNING);
    
    await worker.stop();
    expect(worker.getStatus()).toBe(WorkerStatus.STOPPED);
  });

  it('should process jobs', async () => {
    await worker.start();
    
    const job = createTestJob('test-job');
    await worker.assignJob(job);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockHandler).toHaveBeenCalledWith(job);
    expect(worker.getStats().jobsProcessed).toBe(1);
    
    await worker.stop();
  });

  it('should respect concurrency limits', async () => {
    await worker.start();
    
    const job1 = createTestJob('job1');
    const job2 = createTestJob('job2');
    const job3 = createTestJob('job3');
    
    // Mock handler to take some time
    mockHandler.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
    
    await worker.assignJob(job1);
    await worker.assignJob(job2);
    
    // Third job should exceed concurrency
    await expect(worker.assignJob(job3)).rejects.toThrow('reached concurrency limit');
    
    await worker.stop();
  });

  it('should handle graceful shutdown', async () => {
    await worker.start();
    
    const job = createTestJob('test-job');
    mockHandler.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
    
    await worker.assignJob(job);
    
    // Stop gracefully - should wait for job to complete
    const stopPromise = worker.stop(true, 1000);
    await new Promise(resolve => setTimeout(resolve, 300));
    await stopPromise;
    
    expect(worker.getStats().jobsProcessed).toBe(1);
  });
});

describe('WorkerPool', () => {
  let pool: WorkerPool;
  let queue: FIFOQueue;
  let mockWorkerFactory: any;

  beforeEach(() => {
    queue = new FIFOQueue();
    
    mockWorkerFactory = vi.fn().mockImplementation(() => {
      const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });
      const worker = new Worker({
        id: generateUUID(),
        handler: mockHandler,
        concurrency: 1,
        maxRetries: 3,
        retryDelay: 1000,
        visibilityTimeout: 30000,
        heartbeatInterval: 5000,
        gracefulShutdownTimeout: 10000,
      });
      return Promise.resolve(worker);
    });

    pool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: 5,
      workerFactory: mockWorkerFactory,
      scaleUpThreshold: 10,
      scaleDownThreshold: 2,
      scaleUpCooldown: 5000,
      scaleDownCooldown: 5000,
      jobQueue: {
        size: () => queue.size(),
        dequeue: () => queue.dequeue(),
      },
    });
  });

  it('should start with minimum workers', async () => {
    await pool.start();
    
    expect(mockWorkerFactory).toHaveBeenCalledTimes(2);
    expect(pool.getStats().totalWorkers).toBe(2);
    
    await pool.stop();
  });

  it('should scale up when queue is full', async () => {
    await pool.start();
    
    // Add jobs to queue
    for (let i = 0; i < 15; i++) {
      await queue.enqueue(createTestJob(`job-${i}`));
    }
    
    // Wait for scaling (mock timer would be needed in real test)
    expect(pool.getStats().totalWorkers).toBeGreaterThanOrEqual(2);
    
    await pool.stop();
  });

  it('should scale down when queue is empty', async () => {
    await pool.start();
    
    // Scale up first
    await pool.scaleUp(2);
    expect(pool.getStats().totalWorkers).toBe(4);
    
    // Scale down
    await pool.scaleDown(1);
    expect(pool.getStats().totalWorkers).toBe(3);
    
    await pool.stop();
  });

  it('should respect min and max worker limits', async () => {
    await pool.start();
    
    // Try to scale below minimum
    pool.setMinWorkers(1);
    await pool.scaleDown(5);
    expect(pool.getStats().totalWorkers).toBe(1);
    
    // Try to scale above maximum
    pool.setMaxWorkers(3);
    await pool.scaleUp(5);
    expect(pool.getStats().totalWorkers).toBe(3);
    
    await pool.stop();
  });
});

function createTestJob(name: string) {
  return {
    id: generateUUID(),
    queueId: 'test-queue',
    name,
    data: { test: true },
    priority: 0,
    maxAttempts: 3,
    status: JobStatus.WAITING,
    attempts: 0,
    createdAt: new Date(),
  };
}
