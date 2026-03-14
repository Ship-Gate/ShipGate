import crypto from 'node:crypto';
import type {
  TrafficSample,
  VerifierConfig,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from './types.js';

/**
 * Reservoir-sampled traffic capture middleware.
 *
 * Samples a configurable fraction of live HTTP requests, wraps the
 * response methods to capture outgoing bodies, and buffers samples
 * for periodic flush to consumers.
 */
export class TrafficSampler {
  private readonly config: VerifierConfig;
  private buffer: TrafficSample[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private totalSeen = 0;
  private listeners: Array<(samples: TrafficSample[]) => void> = [];

  constructor(config: VerifierConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Start the periodic flush timer. */
  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
    // Allow the Node process to exit even if the timer is running
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  /** Stop sampling and flush remaining buffer. */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /** Register a listener invoked on every flush with the batch of samples. */
  onFlush(listener: (samples: TrafficSample[]) => void): void {
    this.listeners.push(listener);
  }

  /** Return and clear the current buffer. */
  flush(): TrafficSample[] {
    const batch = this.buffer;
    this.buffer = [];
    for (const listener of this.listeners) {
      try {
        listener(batch);
      } catch {
        // Swallow listener errors to avoid breaking the middleware pipeline
      }
    }
    return batch;
  }

  /** How many samples are currently buffered. */
  get bufferedCount(): number {
    return this.buffer.length;
  }

  /** Total requests observed (regardless of sampling). */
  get totalObserved(): number {
    return this.totalSeen;
  }

  // -----------------------------------------------------------------------
  // Express-compatible middleware
  // -----------------------------------------------------------------------

  /**
   * Returns Express-style middleware that transparently captures
   * request/response data for sampled requests.
   *
   * Reservoir sampling is used: the first `maxBufferSize` requests are
   * always kept; thereafter each new request replaces a random existing
   * entry with probability `maxBufferSize / totalSeen`, providing a
   * uniform random sample without unbounded memory growth.
   *
   * When the sample rate is < 1, a fast coin-flip check filters the
   * majority of traffic before reservoir logic kicks in.
   */
  createMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      this.totalSeen++;

      // Fast probabilistic gate — skip most traffic cheaply
      if (Math.random() > this.config.sampleRate) {
        next();
        return;
      }

      const requestId = crypto.randomUUID();
      const startTime = performance.now();
      let capturedResponseBody: unknown;

      // Wrap res.json to capture the outgoing body
      const originalJson = res.json.bind(res);
      res.json = (body: unknown): void => {
        capturedResponseBody = body;
        originalJson(body);
      };

      // Wrap res.send to capture non-JSON responses
      const originalSend = res.send.bind(res);
      res.send = (body: unknown): void => {
        if (capturedResponseBody === undefined) {
          capturedResponseBody = body;
        }
        originalSend(body);
      };

      // Capture timing + build sample when the response finishes
      res.on('finish', () => {
        const latencyMs = performance.now() - startTime;

        const sample: TrafficSample = {
          requestId,
          timestamp: Date.now(),
          route: req.path ?? req.url,
          method: req.method,
          statusCode: res.statusCode,
          requestBody: req.body,
          responseBody: capturedResponseBody,
          latencyMs,
          headers: flattenHeaders(req.headers),
        };

        this.addToReservoir(sample);
      });

      next();
    };
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Reservoir sampling (Algorithm R):
   * - While buffer is under capacity, push directly.
   * - Once full, each new item replaces a random existing item with
   *   probability `maxBufferSize / totalSeen`.
   */
  private addToReservoir(sample: TrafficSample): void {
    if (this.buffer.length < this.config.maxBufferSize) {
      this.buffer.push(sample);
      return;
    }

    const replacementIndex = Math.floor(Math.random() * this.totalSeen);
    if (replacementIndex < this.config.maxBufferSize) {
      this.buffer[replacementIndex] = sample;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenHeaders(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    flat[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return flat;
}
