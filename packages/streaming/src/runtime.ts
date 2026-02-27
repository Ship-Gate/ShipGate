/**
 * ISL Stream Runtime
 * 
 * Executes stream pipelines
 */

import type {
  Stream,
  StreamOperator,
  StreamSink,
  MapOperator,
  FilterOperator,
  TakeOperator,
  SkipOperator,
  TapOperator,
  DistinctOperator,
  BufferOperator,
  ThrottleOperator,
  DebounceOperator,
  DelayOperator,
  ScanOperator,
  ReduceOperator,
} from './types';

/**
 * Stream execution result
 */
export interface StreamResult<T> {
  values: T[];
  errors: Error[];
  stats: StreamStats;
}

/**
 * Stream statistics
 */
export interface StreamStats {
  processed: number;
  filtered: number;
  errors: number;
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Execute a stream and collect results
 */
export async function execute<T>(stream: Stream<T>): Promise<StreamResult<T>> {
  const stats: StreamStats = {
    processed: 0,
    filtered: 0,
    errors: 0,
    startTime: Date.now(),
  };

  const values: T[] = [];
  const errors: Error[] = [];

  try {
    const sourceValues = await getSourceValues(stream);
    let current: unknown[] = sourceValues;

    // Apply operators
    for (const operator of stream.operators) {
      current = await applyOperator(current, operator, stats);
    }

    // Handle sink
    if (stream.sink) {
      await applySink(current, stream.sink);
    }

    values.push(...(current as T[]));
    stats.processed = current.length;
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
    stats.errors++;
  }

  stats.endTime = Date.now();
  stats.duration = stats.endTime - stats.startTime;

  return { values, errors, stats };
}

/**
 * Get values from stream source
 */
async function getSourceValues<T>(stream: Stream<T>): Promise<T[]> {
  const source = stream.source;

  switch (source.type) {
    case 'iterable':
      return Array.from(source.iterable);

    case 'asyncIterable': {
      const values: T[] = [];
      for await (const value of source.iterable) {
        values.push(value);
      }
      return values;
    }

    case 'interval': {
      // For testing, return a few values
      const values: T[] = [];
      for (let i = 0; i < 10; i++) {
        values.push((source.generator?.() ?? i) as T);
      }
      return values;
    }

    default:
      throw new Error(`Source type '${source.type}' requires external handler`);
  }
}

/**
 * Apply an operator to values
 */
async function applyOperator(
  values: unknown[],
  operator: StreamOperator<unknown, unknown>,
  stats: StreamStats
): Promise<unknown[]> {
  switch (operator.type) {
    case 'map': {
      const op = operator as MapOperator<unknown, unknown>;
      return values.map(op.fn);
    }

    case 'filter': {
      const op = operator as FilterOperator<unknown>;
      const result = values.filter(op.predicate);
      stats.filtered += values.length - result.length;
      return result;
    }

    case 'take': {
      const op = operator as TakeOperator<unknown>;
      return values.slice(0, op.count);
    }

    case 'skip': {
      const op = operator as SkipOperator<unknown>;
      return values.slice(op.count);
    }

    case 'tap': {
      const op = operator as TapOperator<unknown>;
      values.forEach(op.fn);
      return values;
    }

    case 'distinct': {
      const op = operator as DistinctOperator<unknown>;
      const seen = new Set<unknown>();
      return values.filter(v => {
        const key = op.keyFn ? op.keyFn(v) : v;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    case 'buffer': {
      const op = operator as BufferOperator<unknown>;
      const size = op.size ?? 10;
      const result: unknown[][] = [];
      for (let i = 0; i < values.length; i += size) {
        result.push(values.slice(i, i + size));
      }
      return result;
    }

    case 'scan': {
      const op = operator as ScanOperator<unknown, unknown>;
      let acc = op.initial;
      return values.map(v => {
        acc = op.reducer(acc, v);
        return acc;
      });
    }

    case 'reduce': {
      const op = operator as ReduceOperator<unknown, unknown>;
      return [values.reduce(op.reducer, op.initial)];
    }

    case 'delay': {
      const op = operator as DelayOperator<unknown>;
      await new Promise(resolve => setTimeout(resolve, op.duration));
      return values;
    }

    default:
      return values;
  }
}

/**
 * Apply sink to values
 */
async function applySink(values: unknown[], sink: StreamSink<unknown>): Promise<void> {
  switch (sink.type) {
    case 'console': {
      for (const value of values) {
        const output = sink.format ? sink.format(value) : String(value);
        console.log(output);
      }
      break;
    }

    case 'callback': {
      for (const value of values) {
        await sink.fn(value);
      }
      break;
    }

    case 'collect':
      // Values are already collected
      break;

    default:
      throw new Error(`Sink type '${sink.type}' requires external handler`);
  }
}

/**
 * Create an async generator from a stream
 */
export async function* toAsyncGenerator<T>(stream: Stream<T>): AsyncGenerator<T> {
  const result = await execute(stream);
  for (const value of result.values) {
    yield value;
  }
}

/**
 * Create an observable-like subscription
 */
export function subscribe<T>(
  stream: Stream<T>,
  handlers: {
    next?: (value: T) => void;
    error?: (error: Error) => void;
    complete?: () => void;
  }
): { unsubscribe: () => void } {
  let cancelled = false;

  (async () => {
    try {
      const result = await execute(stream);

      if (cancelled) return;

      for (const value of result.values) {
        if (cancelled) break;
        handlers.next?.(value);
      }

      for (const error of result.errors) {
        handlers.error?.(error);
      }

      handlers.complete?.();
    } catch (error) {
      handlers.error?.(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return {
    unsubscribe: () => {
      cancelled = true;
    },
  };
}

/**
 * Run stream continuously (for long-running streams)
 */
export function runContinuous<T>(
  stream: Stream<T>,
  handlers: {
    onValue?: (value: T) => void;
    onError?: (error: Error) => void;
    onStats?: (stats: StreamStats) => void;
  }
): { stop: () => void } {
  let running = true;

  const run = async () => {
    while (running) {
      try {
        const result = await execute(stream);

        for (const value of result.values) {
          handlers.onValue?.(value);
        }

        for (const error of result.errors) {
          handlers.onError?.(error);
        }

        handlers.onStats?.(result.stats);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  run();

  return {
    stop: () => {
      running = false;
    },
  };
}
