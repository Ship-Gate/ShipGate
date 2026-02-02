/**
 * Scheduling Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Scheduler,
  createScheduler,
  isValidCronExpression,
  getNextCronRun,
  parseDuration,
  formatDuration,
  type Job,
  type JobHandler,
} from '../implementations/typescript/index.js';
import {
  WorkflowEngine,
  validateWorkflowSteps,
  topologicalSort,
  detectCycles,
  type WorkflowStepInput,
} from '../implementations/typescript/workflow.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cron Utilities Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Cron Utilities', () => {
  describe('isValidCronExpression', () => {
    it('should validate correct expressions', () => {
      expect(isValidCronExpression('* * * * *')).toBe(true);
      expect(isValidCronExpression('0 9 * * *')).toBe(true);
      expect(isValidCronExpression('*/15 * * * *')).toBe(true);
      expect(isValidCronExpression('0 0 1 * *')).toBe(true);
      expect(isValidCronExpression('0 0 * * 1-5')).toBe(true);
    });

    it('should reject invalid expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false);
      // Note: '* * *' is valid in cron-parser (3-field format)
      expect(isValidCronExpression('')).toBe(false);
      expect(isValidCronExpression('a b c d e')).toBe(false);
    });
  });

  describe('getNextCronRun', () => {
    it('should return next run time', () => {
      const nextRun = getNextCronRun('* * * * *');
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Duration Utilities Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Duration Utilities', () => {
  describe('parseDuration', () => {
    it('should parse milliseconds', () => {
      expect(parseDuration('100ms')).toBe(100);
      expect(parseDuration('1000ms')).toBe(1000);
    });

    it('should parse seconds', () => {
      expect(parseDuration('1s')).toBe(1000);
      expect(parseDuration('30s')).toBe(30000);
    });

    it('should parse minutes', () => {
      expect(parseDuration('1m')).toBe(60000);
      expect(parseDuration('5m')).toBe(300000);
    });

    it('should parse hours', () => {
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('24h')).toBe(86400000);
    });

    it('should parse days', () => {
      expect(parseDuration('1d')).toBe(86400000);
      expect(parseDuration('7d')).toBe(604800000);
    });

    it('should pass through numbers', () => {
      expect(parseDuration(5000)).toBe(5000);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
      expect(formatDuration(30000)).toBe('30.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(300000)).toBe('5.0m');
    });

    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1.0h');
      expect(formatDuration(7200000)).toBe('2.0h');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let testHandler: JobHandler;

  beforeEach(() => {
    testHandler = vi.fn().mockResolvedValue({ result: 'success' });
    scheduler = createScheduler();
    scheduler.registerHandler('test.handler', testHandler);
  });

  describe('scheduleJob', () => {
    it('should schedule a delayed job', async () => {
      const result = await scheduler.scheduleJob({
        name: 'test-job',
        handler: 'test.handler',
        delay: 60000,
        payload: { key: 'value' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.job.status).toBe('SCHEDULED');
        expect(result.job.name).toBe('test-job');
        expect(result.job.handler).toBe('test.handler');
        expect(result.job.payload).toEqual({ key: 'value' });
        expect(result.job.scheduledAt).toBeInstanceOf(Date);
      }
    });

    it('should schedule a job at specific time', async () => {
      const runAt = new Date(Date.now() + 3600000);
      const result = await scheduler.scheduleJob({
        name: 'future-job',
        handler: 'test.handler',
        runAt,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.job.scheduledAt?.getTime()).toBe(runAt.getTime());
      }
    });

    it('should schedule a cron job', async () => {
      const result = await scheduler.scheduleJob({
        name: 'cron-job',
        handler: 'test.handler',
        cron: '0 9 * * *',
        timezone: 'UTC',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.job.cron).toBe('0 9 * * *');
        expect(result.job.timezone).toBe('UTC');
      }
    });

    it('should reject duplicate unique_key', async () => {
      await scheduler.scheduleJob({
        name: 'first-job',
        handler: 'test.handler',
        delay: 60000,
        uniqueKey: 'unique-123',
      });

      const result = await scheduler.scheduleJob({
        name: 'second-job',
        handler: 'test.handler',
        delay: 60000,
        uniqueKey: 'unique-123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DUPLICATE_JOB');
      }
    });

    it('should reject unknown handler', async () => {
      const result = await scheduler.scheduleJob({
        name: 'bad-handler',
        handler: 'unknown.handler',
        delay: 60000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('HANDLER_NOT_FOUND');
      }
    });

    it('should reject invalid cron', async () => {
      const result = await scheduler.scheduleJob({
        name: 'bad-cron',
        handler: 'test.handler',
        cron: 'invalid',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_CRON');
      }
    });

    it('should reject missing schedule', async () => {
      const result = await scheduler.scheduleJob({
        name: 'no-schedule',
        handler: 'test.handler',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_SCHEDULE');
      }
    });
  });

  describe('cancelJob', () => {
    it('should cancel a scheduled job', async () => {
      const scheduleResult = await scheduler.scheduleJob({
        name: 'to-cancel',
        handler: 'test.handler',
        delay: 60000,
      });

      expect(scheduleResult.success).toBe(true);
      if (!scheduleResult.success) return;

      const cancelResult = await scheduler.cancelJob({
        jobId: scheduleResult.job.id,
        reason: 'No longer needed',
      });

      expect(cancelResult.success).toBe(true);
      if (cancelResult.success) {
        expect(cancelResult.job.status).toBe('CANCELLED');
        expect(cancelResult.job.lastError).toBe('No longer needed');
      }
    });

    it('should reject cancelling non-existent job', async () => {
      const result = await scheduler.cancelJob({
        jobId: 'non-existent',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('JOB_NOT_FOUND');
      }
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      // First, schedule and simulate failure
      const scheduleResult = await scheduler.scheduleJob({
        name: 'will-fail',
        handler: 'test.handler',
        delay: 1000, // Use non-zero delay
        maxAttempts: 3,
      });

      expect(scheduleResult.success).toBe(true);
      if (!scheduleResult.success) return;

      // Manually set job to failed state for testing
      const job = scheduler.getJob(scheduleResult.job.id);
      if (job) {
        job.status = 'FAILED';
        job.attempts = 1;
        job.lastError = 'Test error';
      }

      const retryResult = await scheduler.retryJob({
        jobId: scheduleResult.job.id,
      });

      expect(retryResult.success).toBe(true);
      if (retryResult.success) {
        expect(retryResult.job.status).toBe('RETRYING');
        // Note: attempts are incremented when job executes, not when retry is called
        expect(retryResult.job.attempts).toBe(1);
      }
    });
  });

  describe('listJobs', () => {
    it('should list jobs with filters', async () => {
      await scheduler.scheduleJob({
        name: 'job-1',
        handler: 'test.handler',
        delay: 60000,
        tags: ['important'],
      });

      await scheduler.scheduleJob({
        name: 'job-2',
        handler: 'test.handler',
        delay: 60000,
        tags: ['other'],
      });

      const allJobs = scheduler.listJobs();
      expect(allJobs.length).toBe(2);

      const importantJobs = scheduler.listJobs({ tags: ['important'] });
      expect(importantJobs.length).toBe(1);
      expect(importantJobs[0].name).toBe('job-1');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Workflow Utilities', () => {
  describe('detectCycles', () => {
    it('should detect no cycles in valid DAG', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'a', handler: 'test' },
        { name: 'b', handler: 'test', dependsOn: ['a'] },
        { name: 'c', handler: 'test', dependsOn: ['a', 'b'] },
      ];

      expect(detectCycles(steps)).toBeNull();
    });

    it('should detect simple cycle', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'a', handler: 'test', dependsOn: ['b'] },
        { name: 'b', handler: 'test', dependsOn: ['a'] },
      ];

      const cycle = detectCycles(steps);
      expect(cycle).not.toBeNull();
    });

    it('should detect complex cycle', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'a', handler: 'test', dependsOn: ['c'] },
        { name: 'b', handler: 'test', dependsOn: ['a'] },
        { name: 'c', handler: 'test', dependsOn: ['b'] },
      ];

      const cycle = detectCycles(steps);
      expect(cycle).not.toBeNull();
    });
  });

  describe('topologicalSort', () => {
    it('should sort steps in dependency order', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'c', handler: 'test', dependsOn: ['a', 'b'] },
        { name: 'a', handler: 'test' },
        { name: 'b', handler: 'test', dependsOn: ['a'] },
      ];

      const sorted = topologicalSort(steps);
      const names = sorted.map(s => s.name);

      expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
      expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
      expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'));
    });
  });

  describe('validateWorkflowSteps', () => {
    const handlers = new Map<string, JobHandler>([
      ['test', async () => ({})],
    ]);

    it('should validate correct workflow', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'step-1', handler: 'test' },
        { name: 'step-2', handler: 'test', dependsOn: ['step-1'] },
      ];

      const result = validateWorkflowSteps(steps, handlers);
      expect(result.valid).toBe(true);
    });

    it('should reject empty steps', () => {
      const result = validateWorkflowSteps([], handlers);
      expect(result.valid).toBe(false);
    });

    it('should reject duplicate step names', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'same', handler: 'test' },
        { name: 'same', handler: 'test' },
      ];

      const result = validateWorkflowSteps(steps, handlers);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.data?.duplicate).toBe('same');
      }
    });

    it('should reject missing dependencies', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'step-1', handler: 'test', dependsOn: ['non-existent'] },
      ];

      const result = validateWorkflowSteps(steps, handlers);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.data?.missing).toBe('non-existent');
      }
    });

    it('should reject unknown handlers', () => {
      const steps: WorkflowStepInput[] = [
        { name: 'step-1', handler: 'unknown' },
      ];

      const result = validateWorkflowSteps(steps, handlers);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.data?.handler).toBe('unknown');
      }
    });
  });
});

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let handlers: Map<string, JobHandler>;

  beforeEach(() => {
    handlers = new Map([
      ['test.a', vi.fn().mockResolvedValue({ result: 'a' })],
      ['test.b', vi.fn().mockResolvedValue({ result: 'b' })],
      ['test.c', vi.fn().mockResolvedValue({ result: 'c' })],
    ]);

    engine = new WorkflowEngine({ handlers });
  });

  describe('runWorkflow', () => {
    it('should run a simple workflow', async () => {
      const result = await engine.runWorkflow({
        name: 'test-workflow',
        steps: [
          { name: 'step-1', handler: 'test.a' },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.workflow.name).toBe('test-workflow');
        expect(result.workflow.steps.length).toBe(1);
      }
    });

    it('should run sequential workflow', async () => {
      const result = await engine.runWorkflow({
        name: 'sequential',
        steps: [
          { name: 'first', handler: 'test.a' },
          { name: 'second', handler: 'test.b', dependsOn: ['first'] },
          { name: 'third', handler: 'test.c', dependsOn: ['second'] },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should reject cyclic dependencies', async () => {
      const result = await engine.runWorkflow({
        name: 'cyclic',
        steps: [
          { name: 'a', handler: 'test.a', dependsOn: ['c'] },
          { name: 'b', handler: 'test.b', dependsOn: ['a'] },
          { name: 'c', handler: 'test.c', dependsOn: ['b'] },
        ],
      });

      expect(result.success).toBe(false);
    });
  });
});
