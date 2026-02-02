/**
 * Concurrent Requests Injector
 * 
 * Simulates concurrent/parallel requests to test race conditions and resource contention.
 */

import type { Timeline } from '../timeline.js';

export interface ConcurrentInjectorConfig {
  /** Number of concurrent requests to send */
  concurrency: number;
  /** Delay between starting each request (ms) */
  staggerDelayMs?: number;
  /** Whether requests should be staggered or fired simultaneously */
  staggered?: boolean;
  /** Maximum wait time for all requests to complete (ms) */
  timeoutMs?: number;
}

export interface ConcurrentResult<T> {
  index: number;
  success: boolean;
  result?: T;
  error?: Error;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ConcurrentInjectorState {
  active: boolean;
  totalBatches: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  racesDetected: number;
  averageResponseTime: number;
}

export interface RaceConditionResult<T> {
  results: ConcurrentResult<T>[];
  raceDetected: boolean;
  raceDetails?: string;
  timeline: {
    firstResponse: number;
    lastResponse: number;
    spread: number;
  };
}

/**
 * Concurrent requests injector for chaos testing
 */
export class ConcurrentInjector {
  private config: Required<ConcurrentInjectorConfig>;
  private state: ConcurrentInjectorState;
  private timeline: Timeline | null = null;
  private responseTimes: number[] = [];

  constructor(config: ConcurrentInjectorConfig) {
    this.config = {
      concurrency: config.concurrency,
      staggerDelayMs: config.staggerDelayMs ?? 0,
      staggered: config.staggered ?? false,
      timeoutMs: config.timeoutMs ?? 30000,
    };
    this.state = {
      active: false,
      totalBatches: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      racesDetected: 0,
      averageResponseTime: 0,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Activate the concurrent injector
   */
  activate(): void {
    if (this.state.active) return;

    this.responseTimes = [];
    this.state = {
      active: true,
      totalBatches: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      racesDetected: 0,
      averageResponseTime: 0,
    };

    this.timeline?.record('injection_start', {
      injector: 'concurrent',
      config: this.config,
    });
  }

  /**
   * Deactivate the concurrent injector
   */
  deactivate(): void {
    if (!this.state.active) return;

    this.state.active = false;
    this.timeline?.record('injection_end', {
      injector: 'concurrent',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): ConcurrentInjectorState {
    return { ...this.state };
  }

  /**
   * Execute a function concurrently multiple times
   */
  async execute<T>(
    operation: (index: number) => Promise<T>,
    operationName?: string
  ): Promise<ConcurrentResult<T>[]> {
    const batchId = this.timeline?.startEvent('behavior_start', {
      injector: 'concurrent',
      operationName,
      concurrency: this.config.concurrency,
    });

    this.state.totalBatches++;
    const startTime = Date.now();
    const results: ConcurrentResult<T>[] = [];

    const executeOne = async (index: number): Promise<ConcurrentResult<T>> => {
      const reqStartTime = Date.now();
      try {
        const result = await operation(index);
        const reqEndTime = Date.now();
        const duration = reqEndTime - reqStartTime;
        this.responseTimes.push(duration);
        this.state.successfulRequests++;
        this.state.totalRequests++;
        
        return {
          index,
          success: true,
          result,
          startTime: reqStartTime - startTime,
          endTime: reqEndTime - startTime,
          duration,
        };
      } catch (error) {
        const reqEndTime = Date.now();
        const duration = reqEndTime - reqStartTime;
        this.responseTimes.push(duration);
        this.state.failedRequests++;
        this.state.totalRequests++;

        return {
          index,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          startTime: reqStartTime - startTime,
          endTime: reqEndTime - startTime,
          duration,
        };
      }
    };

    // Create promises for all concurrent executions
    const promises: Promise<ConcurrentResult<T>>[] = [];

    if (this.config.staggered && this.config.staggerDelayMs > 0) {
      // Staggered execution
      for (let i = 0; i < this.config.concurrency; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.staggerDelayMs));
        }
        promises.push(executeOne(i));
      }
    } else {
      // Simultaneous execution
      for (let i = 0; i < this.config.concurrency; i++) {
        promises.push(executeOne(i));
      }
    }

    // Wait for all with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Concurrent execution timeout after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs
      );
    });

    try {
      const settled = await Promise.race([
        Promise.all(promises),
        timeoutPromise,
      ]);
      results.push(...settled);
    } catch {
      // Timeout or other error - collect whatever results we have
      const partialResults = await Promise.allSettled(promises);
      for (let i = 0; i < partialResults.length; i++) {
        const r = partialResults[i];
        if (r && r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({
            index: i,
            success: false,
            error: new Error('Request did not complete'),
            startTime: 0,
            endTime: Date.now() - startTime,
            duration: Date.now() - startTime,
          });
        }
      }
    }

    // Update average response time
    if (this.responseTimes.length > 0) {
      this.state.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    if (batchId) {
      this.timeline?.endEvent(batchId, {
        resultsCount: results.length,
        successCount: results.filter(r => r.success).length,
      });
    }

    return results;
  }

  /**
   * Execute and detect race conditions
   */
  async executeAndDetectRace<T>(
    operation: (index: number) => Promise<T>,
    isConsistent: (results: T[]) => boolean,
    operationName?: string
  ): Promise<RaceConditionResult<T>> {
    const results = await this.execute(operation, operationName);
    
    const successfulResults = results.filter(r => r.success);
    const actualResults = successfulResults.map(r => r.result as T);
    
    let raceDetected = false;
    let raceDetails: string | undefined;

    if (successfulResults.length >= 2) {
      // Check for consistency
      if (!isConsistent(actualResults)) {
        raceDetected = true;
        raceDetails = 'Inconsistent results detected across concurrent executions';
        this.state.racesDetected++;
        
        this.timeline?.record('error', {
          injector: 'concurrent',
          type: 'race_condition',
          details: raceDetails,
        });
      }
    }

    // Calculate timeline statistics
    const endTimes = results.map(r => r.endTime);

    return {
      results,
      raceDetected,
      raceDetails,
      timeline: {
        firstResponse: Math.min(...endTimes),
        lastResponse: Math.max(...endTimes),
        spread: Math.max(...endTimes) - Math.min(...endTimes),
      },
    };
  }

  /**
   * Test idempotency by executing the same operation multiple times
   */
  async testIdempotency<T>(
    operation: () => Promise<T>,
    equals: (a: T, b: T) => boolean,
    operationName?: string
  ): Promise<{
    isIdempotent: boolean;
    results: ConcurrentResult<T>[];
    deviations: number[];
  }> {
    const results = await this.execute(() => operation(), operationName);
    
    const successfulResults = results.filter(r => r.success);
    const values = successfulResults.map(r => r.result as T);
    
    const deviations: number[] = [];
    let isIdempotent = true;

    if (values.length >= 2) {
      const reference = values[0];
      for (let i = 1; i < values.length; i++) {
        const current = values[i];
        if (reference !== undefined && current !== undefined && !equals(reference, current)) {
          isIdempotent = false;
          deviations.push(i);
        }
      }
    }

    if (!isIdempotent) {
      this.timeline?.record('error', {
        injector: 'concurrent',
        type: 'idempotency_violation',
        deviations,
      });
    }

    return {
      isIdempotent,
      results,
      deviations,
    };
  }
}

/**
 * Create a concurrent injector
 */
export function createConcurrentRequests(concurrency: number): ConcurrentInjector {
  return new ConcurrentInjector({ concurrency });
}

/**
 * Create a staggered concurrent injector
 */
export function createStaggeredRequests(
  concurrency: number,
  staggerDelayMs: number
): ConcurrentInjector {
  return new ConcurrentInjector({
    concurrency,
    staggered: true,
    staggerDelayMs,
  });
}

/**
 * Create a burst concurrent injector for stress testing
 */
export function createBurstRequests(concurrency: number, timeoutMs?: number): ConcurrentInjector {
  return new ConcurrentInjector({
    concurrency,
    staggered: false,
    timeoutMs,
  });
}
