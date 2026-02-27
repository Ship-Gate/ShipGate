/**
 * Tests for queue implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateUUID } from '@isl-lang/stdlib-core';
import { FIFOQueue } from '../src/queue/fifo.js';
import { PriorityQueue } from '../src/queue/priority.js';
import { DelayQueue } from '../src/queue/delay.js';
import { BoundedQueue } from '../src/queue/bounded.js';
import { QueueStatus, JobStatus } from '../src/types.js';
import { QueueFullError, QueuePausedError } from '../src/errors.js';

describe('FIFOQueue', () => {
  let queue: FIFOQueue;

  beforeEach(() => {
    queue = new FIFOQueue();
  });

  it('should enqueue and dequeue jobs in FIFO order', async () => {
    const job1 = createTestJob('job1');
    const job2 = createTestJob('job2');
    
    await queue.enqueue(job1);
    await queue.enqueue(job2);
    
    const dequeued1 = await queue.dequeue();
    const dequeued2 = await queue.dequeue();
    
    expect(dequeued1?.name).toBe('job1');
    expect(dequeued2?.name).toBe('job2');
  });

  it('should report correct size and empty status', async () => {
    expect(await queue.size()).toBe(0);
    expect(await queue.isEmpty()).toBe(true);
    
    await queue.enqueue(createTestJob('job1'));
    
    expect(await queue.size()).toBe(1);
    expect(await queue.isEmpty()).toBe(false);
  });

  it('should pause and resume correctly', async () => {
    await queue.pause();
    expect(await queue.getStatus()).toBe(QueueStatus.PAUSED);
    
    await expect(queue.enqueue(createTestJob('job1'))).rejects.toThrow(QueuePausedError);
    
    await queue.resume();
    expect(await queue.getStatus()).toBe(QueueStatus.ACTIVE);
    
    await expect(queue.enqueue(createTestJob('job1'))).resolves.toBeDefined();
  });

  it('should handle bulk enqueue', async () => {
    const jobs = [createTestJob('job1'), createTestJob('job2'), createTestJob('job3')];
    const jobIds = await queue.enqueueBulk(jobs);
    
    expect(jobIds).toHaveLength(3);
    expect(await queue.size()).toBe(3);
  });
});

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue();
  });

  it('should dequeue jobs by priority (higher first)', async () => {
    const job1 = createTestJob('job1', 1);
    const job2 = createTestJob('job2', 3);
    const job3 = createTestJob('job3', 2);
    
    await queue.enqueue(job1);
    await queue.enqueue(job2);
    await queue.enqueue(job3);
    
    const dequeued1 = await queue.dequeue();
    const dequeued2 = await queue.dequeue();
    const dequeued3 = await queue.dequeue();
    
    expect(dequeued1?.name).toBe('job2'); // priority 3
    expect(dequeued2?.name).toBe('job3'); // priority 2
    expect(dequeued3?.name).toBe('job1'); // priority 1
  });

  it('should maintain FIFO order for same priority', async () => {
    const job1 = createTestJob('job1', 2);
    const job2 = createTestJob('job2', 2);
    const job3 = createTestJob('job3', 2);
    
    await queue.enqueue(job1);
    await queue.enqueue(job2);
    await queue.enqueue(job3);
    
    const dequeued1 = await queue.dequeue();
    const dequeued2 = await queue.dequeue();
    const dequeued3 = await queue.dequeue();
    
    expect(dequeued1?.name).toBe('job1');
    expect(dequeued2?.name).toBe('job2');
    expect(dequeued3?.name).toBe('job3');
  });
});

describe('DelayQueue', () => {
  let queue: DelayQueue;

  beforeEach(() => {
    queue = new DelayQueue({ delayResolution: 100 });
  });

  it('should delay jobs with delay property', async () => {
    const job = createTestJob('job1');
    job.delay = 200;
    
    await queue.enqueue(job);
    expect(await queue.size()).toBe(0); // Not ready yet
    
    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(await queue.size()).toBe(1); // Ready now
  });

  it('should delay jobs with scheduledFor property', async () => {
    const job = createTestJob('job1');
    job.scheduledFor = new Date(Date.now() + 200);
    
    await queue.enqueue(job);
    expect(await queue.size()).toBe(0); // Not ready yet
    
    // Wait for scheduled time
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(await queue.size()).toBe(1); // Ready now
  });

  it('should process ready jobs immediately', async () => {
    const job = createTestJob('job1');
    
    await queue.enqueue(job);
    expect(await queue.size()).toBe(1); // Ready immediately
    
    const dequeued = await queue.dequeue();
    expect(dequeued?.name).toBe('job1');
  });
});

describe('BoundedQueue', () => {
  let queue: BoundedQueue;

  beforeEach(() => {
    queue = new BoundedQueue({ capacity: 2 });
  });

  it('should reject jobs when full with reject strategy', async () => {
    await queue.enqueue(createTestJob('job1'));
    await queue.enqueue(createTestJob('job2'));
    
    await expect(queue.enqueue(createTestJob('job3'))).rejects.toThrow(QueueFullError);
  });

  it('should allow enqueueing after space frees up', async () => {
    await queue.enqueue(createTestJob('job1'));
    await queue.enqueue(createTestJob('job2'));
    
    await expect(queue.enqueue(createTestJob('job3'))).rejects.toThrow(QueueFullError);
    
    await queue.dequeue();
    const jobId = await queue.enqueue(createTestJob('job3'));
    expect(jobId).toBeDefined();
  });

  it('should report capacity correctly', () => {
    const capacity = queue.getCapacity();
    
    expect(capacity.capacity).toBe(2);
    expect(capacity.used).toBe(0);
    expect(capacity.available).toBe(2);
    expect(capacity.utilization).toBe(0);
  });
});

function createTestJob(name: string, priority = 0) {
  return {
    queueId: 'test-queue',
    name,
    data: { test: true },
    priority,
    maxAttempts: 3,
    status: JobStatus.WAITING,
  };
}
