/**
 * Pipeline robustness tests
 *
 * Tests PipelineOrchestrator, TokenTracker, ProgressReporter, PipelineResult
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PipelineOrchestrator,
  TokenTracker,
  NoopProgressReporter,
  JsonProgressReporter,
  CliProgressReporter,
  isTransientError,
  isNonRetryableError,
  TimeoutError,
  DEFAULT_STAGE_TIMEOUTS,
  type PipelineResult,
  type VibeStageId,
} from '../src/pipeline/index.js';

describe('TokenTracker', () => {
  it('tracks cumulative usage', () => {
    const tracker = new TokenTracker({ maxTokens: 100_000 });
    tracker.add('nl-to-isl' as VibeStageId, 100, 200);
    tracker.add('codegen' as VibeStageId, 500, 1000);
    expect(tracker.total).toBe(1800);
    expect(tracker.usagePct).toBeCloseTo(0.018);
  });

  it('warns at 80% threshold', () => {
    const tracker = new TokenTracker({ maxTokens: 1000, warnThreshold: 0.8 });
    tracker.add('nl-to-isl' as VibeStageId, 400, 400);
    expect(tracker.getStatus()).toBe('warn');
    expect(tracker.checkBudget()).toContain('80');
  });

  it('skips optional stages at 95%', () => {
    const tracker = new TokenTracker({ maxTokens: 1000, skipOptionalThreshold: 0.95 });
    tracker.add('nl-to-isl' as VibeStageId, 500, 460);
    expect(tracker.getStatus()).toBe('skip_optional');
    expect(tracker.shouldSkipOptionalStages()).toBe(true);
  });

  it('returns usage by stage', () => {
    const tracker = new TokenTracker();
    tracker.add('nl-to-isl' as VibeStageId, 100, 50);
    const byStage = tracker.getUsageByStage();
    expect(byStage['nl-to-isl']).toEqual({ input: 100, output: 50, total: 150 });
  });
});

describe('ProgressReporter', () => {
  it('NoopProgressReporter does nothing', () => {
    const reporter = new NoopProgressReporter();
    expect(() => {
      reporter.stageStart({ type: 'stage_start', stage: 'nl-to-isl', timestamp: Date.now() });
      reporter.stageComplete({
        type: 'stage_complete',
        stage: 'nl-to-isl',
        duration: 100,
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });

  it('JsonProgressReporter outputs JSON lines', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const reporter = new JsonProgressReporter();
    reporter.stageStart({ type: 'stage_start', stage: 'codegen', timestamp: 12345 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"vibe:progress"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"codegen"'),
    );
    logSpy.mockRestore();
  });
});

describe('PipelineOrchestrator', () => {
  it('executes stage with timeout', async () => {
    const orchestrator = new PipelineOrchestrator(new NoopProgressReporter(), {
      stageTimeouts: { 'nl-to-isl': 50 } as Record<VibeStageId, number>,
    });
    await expect(
      orchestrator.executeStage(
        'nl-to-isl',
        () => new Promise((r) => setTimeout(() => r({ tokens: { input: 0, output: 0 } }), 200)),
      ),
    ).rejects.toThrow(TimeoutError);
  });

  it('executes stage successfully and tracks tokens', async () => {
    const orchestrator = new PipelineOrchestrator(new NoopProgressReporter());
    const result = await orchestrator.executeStage('nl-to-isl', async () => ({
      isl: 'domain X {}',
      confidence: 0.9,
      tokens: { input: 100, output: 200 },
    }));
    expect(result.isl).toBe('domain X {}');
    expect(orchestrator.tokenTracker.total).toBe(300);
  });

  it('retries on transient errors', async () => {
    let attempts = 0;
    const orchestrator = new PipelineOrchestrator(new NoopProgressReporter(), {
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });
    const result = await orchestrator.executeStage('nl-to-isl', async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Rate limit 429');
      }
      return { tokens: { input: 0, output: 0 } };
    });
    expect(attempts).toBe(2);
    expect(result).toBeDefined();
  });

  it('fails immediately on non-retryable errors', async () => {
    const orchestrator = new PipelineOrchestrator(new NoopProgressReporter());
    await expect(
      orchestrator.executeStage('nl-to-isl', async () => {
        throw new Error('Invalid request 400');
      }),
    ).rejects.toThrow('400');
  });
});

describe('isTransientError / isNonRetryableError', () => {
  it('isTransientError returns true for 429, 503, network', () => {
    expect(isTransientError(new Error('Rate limit 429'))).toBe(true);
    expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
  });

  it('isTransientError returns false for 400, 401', () => {
    expect(isTransientError(new Error('400 Bad Request'))).toBe(false);
    expect(isTransientError(new Error('401 Unauthorized'))).toBe(false);
  });

  it('isNonRetryableError returns true for 400, 401, parse', () => {
    expect(isNonRetryableError(new Error('400 Bad Request'))).toBe(true);
    expect(isNonRetryableError(new Error('401 Unauthorized'))).toBe(true);
    expect(isNonRetryableError(new Error('Parse error'))).toBe(true);
  });
});

describe('DEFAULT_STAGE_TIMEOUTS', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_STAGE_TIMEOUTS['nl-to-isl']).toBe(30_000);
    expect(DEFAULT_STAGE_TIMEOUTS['codegen']).toBe(120_000);
    expect(DEFAULT_STAGE_TIMEOUTS['verify']).toBe(60_000);
    expect(DEFAULT_STAGE_TIMEOUTS['heal']).toBe(90_000);
  });
});
