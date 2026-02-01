/**
 * ISL Stream Implementation
 * 
 * Core stream class with fluent API for building data pipelines
 */

import type {
  Stream,
  StreamSource,
  StreamOperator,
  StreamSink,
  MapOperator,
  FilterOperator,
  FlatMapOperator,
  ReduceOperator,
  ScanOperator,
  TakeOperator,
  SkipOperator,
  DistinctOperator,
  BufferOperator,
  WindowOperator,
  ThrottleOperator,
  DebounceOperator,
  DelayOperator,
  TapOperator,
} from './types';

/**
 * Stream builder class
 */
export class StreamBuilder<T> {
  private _id: string;
  private _description?: string;
  private _source: StreamSource<T>;
  private _operators: StreamOperator<unknown, unknown>[] = [];
  private _sink?: StreamSink<unknown>;

  constructor(id: string, source: StreamSource<T>) {
    this._id = id;
    this._source = source;
  }

  /**
   * Set description
   */
  description(desc: string): this {
    this._description = desc;
    return this;
  }

  /**
   * Map values
   */
  map<U>(fn: (value: T) => U): StreamBuilder<U> {
    const op: MapOperator<T, U> = { type: 'map', fn };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<U>;
  }

  /**
   * Filter values
   */
  filter(predicate: (value: T) => boolean): StreamBuilder<T> {
    const op: FilterOperator<T> = { type: 'filter', predicate };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * FlatMap values
   */
  flatMap<U>(fn: (value: T) => Iterable<U> | AsyncIterable<U>): StreamBuilder<U> {
    const op: FlatMapOperator<T, U> = { type: 'flatMap', fn };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<U>;
  }

  /**
   * Reduce to single value
   */
  reduce<U>(reducer: (acc: U, value: T) => U, initial: U): StreamBuilder<U> {
    const op: ReduceOperator<T, U> = { type: 'reduce', reducer, initial };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<U>;
  }

  /**
   * Running reduce (scan)
   */
  scan<U>(reducer: (acc: U, value: T) => U, initial: U): StreamBuilder<U> {
    const op: ScanOperator<T, U> = { type: 'scan', reducer, initial };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<U>;
  }

  /**
   * Take first n values
   */
  take(count: number): StreamBuilder<T> {
    const op: TakeOperator<T> = { type: 'take', count };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Skip first n values
   */
  skip(count: number): StreamBuilder<T> {
    const op: SkipOperator<T> = { type: 'skip', count };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Distinct values
   */
  distinct(keyFn?: (value: T) => unknown): StreamBuilder<T> {
    const op: DistinctOperator<T> = { type: 'distinct', keyFn };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Buffer values
   */
  buffer(options: { size?: number; time?: number }): StreamBuilder<T[]> {
    const op: BufferOperator<T> = { type: 'buffer', ...options };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<T[]>;
  }

  /**
   * Window values
   */
  window(options: {
    type: 'tumbling' | 'sliding' | 'session';
    size: number;
    slide?: number;
    gap?: number;
  }): StreamBuilder<T[]> {
    const op: WindowOperator<T> = {
      type: 'window',
      windowType: options.type,
      size: options.size,
      slide: options.slide,
      gap: options.gap,
    };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<T[]>;
  }

  /**
   * Throttle emissions
   */
  throttle(duration: number, options?: { leading?: boolean; trailing?: boolean }): StreamBuilder<T> {
    const op: ThrottleOperator<T> = { type: 'throttle', duration, ...options };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Debounce emissions
   */
  debounce(duration: number): StreamBuilder<T> {
    const op: DebounceOperator<T> = { type: 'debounce', duration };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Delay emissions
   */
  delay(duration: number): StreamBuilder<T> {
    const op: DelayOperator<T> = { type: 'delay', duration };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Side effect without modifying stream
   */
  tap(fn: (value: T) => void): StreamBuilder<T> {
    const op: TapOperator<T> = { type: 'tap', fn };
    this._operators.push(op as StreamOperator<unknown, unknown>);
    return this;
  }

  /**
   * Group by key
   */
  groupBy<K extends string | number>(
    keyFn: (value: T) => K
  ): StreamBuilder<{ key: K; values: T[] }> {
    this._operators.push({
      type: 'groupBy',
      keyFn,
    } as StreamOperator<unknown, unknown>);
    return this as unknown as StreamBuilder<{ key: K; values: T[] }>;
  }

  /**
   * Set sink
   */
  to(sink: StreamSink<T>): Stream<T> {
    this._sink = sink as StreamSink<unknown>;
    return this.build();
  }

  /**
   * Log to console
   */
  toConsole(format?: (value: T) => string): Stream<T> {
    return this.to({ type: 'console', format });
  }

  /**
   * Write to file
   */
  toFile(path: string, options?: { format?: 'json' | 'csv' | 'ndjson'; append?: boolean }): Stream<T> {
    return this.to({ type: 'file', path, ...options });
  }

  /**
   * Send to queue
   */
  toQueue(queueName: string): Stream<T> {
    return this.to({ type: 'queue', queueName });
  }

  /**
   * Publish to topic
   */
  toTopic(topicName: string): Stream<T> {
    return this.to({ type: 'topic', topicName });
  }

  /**
   * Send to HTTP endpoint
   */
  toHttp(endpoint: string, options?: {
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    batch?: { size: number; timeout: number };
  }): Stream<T> {
    return this.to({ type: 'http', endpoint, ...options });
  }

  /**
   * Insert to database
   */
  toDatabase(table: string, options?: { operation?: 'insert' | 'upsert' }): Stream<T> {
    return this.to({ type: 'database', table, ...options });
  }

  /**
   * Callback for each value
   */
  forEach(fn: (value: T) => void | Promise<void>): Stream<T> {
    return this.to({ type: 'callback', fn });
  }

  /**
   * Collect into array
   */
  collect(maxSize?: number): Stream<T> {
    return this.to({ type: 'collect', maxSize });
  }

  /**
   * Build the stream definition
   */
  build(): Stream<T> {
    return {
      id: this._id,
      description: this._description,
      source: this._source,
      operators: this._operators,
      sink: this._sink,
    };
  }
}

/**
 * Create stream from iterable
 */
export function fromIterable<T>(id: string, iterable: Iterable<T>): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'iterable', iterable });
}

/**
 * Create stream from async iterable
 */
export function fromAsyncIterable<T>(id: string, iterable: AsyncIterable<T>): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'asyncIterable', iterable });
}

/**
 * Create stream from array
 */
export function fromArray<T>(id: string, array: T[]): StreamBuilder<T> {
  return fromIterable(id, array);
}

/**
 * Create stream from event emitter
 */
export function fromEvent<T>(id: string, emitter: string, eventName: string): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'event', emitter, eventName });
}

/**
 * Create stream from interval
 */
export function fromInterval<T>(
  id: string,
  interval: number,
  generator?: () => T
): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'interval', interval, generator });
}

/**
 * Create stream from message queue
 */
export function fromQueue<T>(
  id: string,
  queueName: string,
  options?: { prefetch?: number; ack?: 'auto' | 'manual' }
): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'queue', queueName, options });
}

/**
 * Create stream from pub/sub topic
 */
export function fromTopic<T>(id: string, topicName: string, subscription?: string): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'topic', topicName, subscription });
}

/**
 * Create stream from HTTP endpoint
 */
export function fromHttp<T>(
  id: string,
  endpoint: string,
  options?: { method?: 'GET' | 'POST'; pollInterval?: number }
): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'http', endpoint, ...options });
}

/**
 * Create stream from WebSocket
 */
export function fromWebSocket<T>(id: string, url: string, protocols?: string[]): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'websocket', url, protocols });
}

/**
 * Create stream from file
 */
export function fromFile<T>(
  id: string,
  path: string,
  options?: { watch?: boolean; format?: 'json' | 'csv' | 'ndjson' | 'lines' }
): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'file', path, ...options });
}

/**
 * Create stream from database changes
 */
export function fromDatabase<T>(
  id: string,
  table: string,
  operation?: 'insert' | 'update' | 'delete' | 'all'
): StreamBuilder<T> {
  return new StreamBuilder(id, { type: 'database', table, operation });
}

/**
 * Merge multiple streams
 */
export function merge<T>(...streams: Stream<T>[]): Stream<T> {
  return {
    id: `merge-${streams.map(s => s.id).join('-')}`,
    source: streams[0].source,
    operators: [{ type: 'merge', streams } as StreamOperator<unknown, unknown>],
  };
}

/**
 * Concatenate streams
 */
export function concat<T>(...streams: Stream<T>[]): Stream<T> {
  return {
    id: `concat-${streams.map(s => s.id).join('-')}`,
    source: streams[0].source,
    operators: [{ type: 'concat', streams } as StreamOperator<unknown, unknown>],
  };
}

/**
 * Zip streams together
 */
export function zip<T, U>(
  streams: Stream<unknown>[],
  combiner: (...values: unknown[]) => U
): Stream<U> {
  return {
    id: `zip-${streams.map(s => s.id).join('-')}`,
    source: streams[0].source as StreamSource<U>,
    operators: [{ type: 'zip', streams, combiner } as StreamOperator<unknown, unknown>],
  };
}

/**
 * Combine latest from streams
 */
export function combineLatest<T, U>(
  streams: Stream<unknown>[],
  combiner: (...values: unknown[]) => U
): Stream<U> {
  return {
    id: `combineLatest-${streams.map(s => s.id).join('-')}`,
    source: streams[0].source as StreamSource<U>,
    operators: [{ type: 'combineLatest', streams, combiner } as StreamOperator<unknown, unknown>],
  };
}
