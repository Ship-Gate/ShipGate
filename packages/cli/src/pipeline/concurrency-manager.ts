/**
 * ConcurrencyManager — Manages concurrent AI calls for parallel codegen
 *
 * - Configurable max concurrent AI calls (default: 3, respects API rate limits)
 * - Queue system: if max concurrency reached, queue next call
 * - Per-call token tracking fed back to the pipeline token budget
 * - If one stream fails, others continue — partial results are still useful
 */

export interface ConcurrencyManagerOptions {
  /** Max concurrent AI calls. Default: 3 */
  maxConcurrent?: number;
  /** Callback when tokens are used (for pipeline budget) */
  onTokens?: (input: number, output: number, streamId?: string) => void;
}

interface QueuedTask {
  run: () => Promise<void>;
}

export interface StreamResult<T> {
  streamId: string;
  success: boolean;
  result?: T;
  error?: Error;
  tokens?: { input: number; output: number };
}

/**
 * Manages a pool of concurrent AI calls with queuing.
 * Failed calls don't block others — partial results are returned.
 */
export class ConcurrencyManager {
  private readonly maxConcurrent: number;
  private readonly onTokens?: (input: number, output: number, streamId?: string) => void;
  private activeCount = 0;
  private readonly queue: QueuedTask[] = [];
  private readonly results: StreamResult<unknown>[] = [];

  constructor(options: ConcurrencyManagerOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.onTokens = options.onTokens;
  }

  /**
   * Run an AI call through the concurrency pool.
   * If max concurrency reached, waits in queue.
   * On failure, returns partial result; other streams continue.
   */
  async run<T>(
    streamId: string,
    fn: () => Promise<{ result: T; tokens?: { input: number; output: number } }>,
  ): Promise<StreamResult<T>> {
    return new Promise<StreamResult<T>>((resolve) => {
      const execute = async (): Promise<void> => {
        this.activeCount++;
        try {
          const { result, tokens } = await fn();
          if (tokens && this.onTokens) {
            this.onTokens(tokens.input, tokens.output, streamId);
          }
          this.results.push({
            streamId,
            success: true,
            result,
            tokens,
          });
          resolve({ streamId, success: true, result, tokens });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.results.push({
            streamId,
            success: false,
            error,
          });
          resolve({ streamId, success: false, error });
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      const task: QueuedTask = { run: execute };
      if (this.activeCount < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(task);
      }
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const task = this.queue.shift()!;
      task.run();
    }
  }

  /**
   * Run multiple streams in parallel, up to maxConcurrent at a time.
   * Returns when all complete. Partial results on individual failures.
   */
  async runAll<T>(
    streams: Array<{
      id: string;
      fn: () => Promise<{ result: T; tokens?: { input: number; output: number } }>;
    }>,
  ): Promise<StreamResult<T>[]> {
    const promises = streams.map((s) => this.run(s.id, s.fn));
    return Promise.all(promises);
  }

  /** Get all results (success + failure) from completed runs */
  getResults(): StreamResult<unknown>[] {
    return [...this.results];
  }

  /** Clear results for reuse */
  clearResults(): void {
    this.results.length = 0;
  }

  /** Current number of active + queued calls */
  get pendingCount(): number {
    return this.activeCount + this.queue.length;
  }
}
