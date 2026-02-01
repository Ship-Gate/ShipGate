/**
 * ISL Streaming Types
 * 
 * Defines stream processing primitives for reactive data flows,
 * event processing, and real-time data pipelines.
 */

/**
 * Stream definition
 */
export interface Stream<T> {
  id: string;
  description?: string;
  source: StreamSource<T>;
  operators: StreamOperator<unknown, unknown>[];
  sink?: StreamSink<unknown>;
}

/**
 * Stream source - where data comes from
 */
export type StreamSource<T> =
  | IterableSource<T>
  | AsyncIterableSource<T>
  | EventSource<T>
  | IntervalSource<T>
  | QueueSource<T>
  | TopicSource<T>
  | HttpSource<T>
  | WebSocketSource<T>
  | FileSource<T>
  | DatabaseSource<T>;

/**
 * Iterable source
 */
export interface IterableSource<T> {
  type: 'iterable';
  iterable: Iterable<T>;
}

/**
 * Async iterable source
 */
export interface AsyncIterableSource<T> {
  type: 'asyncIterable';
  iterable: AsyncIterable<T>;
}

/**
 * Event emitter source
 */
export interface EventSource<T> {
  type: 'event';
  emitter: string;
  eventName: string;
}

/**
 * Interval source - emits at regular intervals
 */
export interface IntervalSource<T> {
  type: 'interval';
  interval: number;
  generator?: () => T;
}

/**
 * Message queue source
 */
export interface QueueSource<T> {
  type: 'queue';
  queueName: string;
  options?: {
    prefetch?: number;
    ack?: 'auto' | 'manual';
  };
}

/**
 * Pub/sub topic source
 */
export interface TopicSource<T> {
  type: 'topic';
  topicName: string;
  subscription?: string;
}

/**
 * HTTP endpoint source
 */
export interface HttpSource<T> {
  type: 'http';
  endpoint: string;
  method?: 'GET' | 'POST';
  pollInterval?: number;
}

/**
 * WebSocket source
 */
export interface WebSocketSource<T> {
  type: 'websocket';
  url: string;
  protocols?: string[];
}

/**
 * File source
 */
export interface FileSource<T> {
  type: 'file';
  path: string;
  watch?: boolean;
  format?: 'json' | 'csv' | 'ndjson' | 'lines';
}

/**
 * Database change stream source
 */
export interface DatabaseSource<T> {
  type: 'database';
  table: string;
  operation?: 'insert' | 'update' | 'delete' | 'all';
}

/**
 * Stream operator - transforms data in the stream
 */
export type StreamOperator<TIn, TOut> =
  | MapOperator<TIn, TOut>
  | FilterOperator<TIn>
  | FlatMapOperator<TIn, TOut>
  | ReduceOperator<TIn, TOut>
  | ScanOperator<TIn, TOut>
  | TakeOperator<TIn>
  | SkipOperator<TIn>
  | DistinctOperator<TIn>
  | BufferOperator<TIn>
  | WindowOperator<TIn>
  | ThrottleOperator<TIn>
  | DebounceOperator<TIn>
  | SampleOperator<TIn>
  | DelayOperator<TIn>
  | TimeoutOperator<TIn>
  | RetryOperator<TIn>
  | CatchOperator<TIn>
  | MergeOperator<TIn>
  | ConcatOperator<TIn>
  | ZipOperator<TIn, TOut>
  | CombineLatestOperator<TIn, TOut>
  | GroupByOperator<TIn, TOut>
  | PartitionOperator<TIn>
  | TapOperator<TIn>;

/**
 * Map operator
 */
export interface MapOperator<TIn, TOut> {
  type: 'map';
  fn: (value: TIn) => TOut;
}

/**
 * Filter operator
 */
export interface FilterOperator<T> {
  type: 'filter';
  predicate: (value: T) => boolean;
}

/**
 * FlatMap operator
 */
export interface FlatMapOperator<TIn, TOut> {
  type: 'flatMap';
  fn: (value: TIn) => Iterable<TOut> | AsyncIterable<TOut>;
}

/**
 * Reduce operator
 */
export interface ReduceOperator<TIn, TOut> {
  type: 'reduce';
  reducer: (acc: TOut, value: TIn) => TOut;
  initial: TOut;
}

/**
 * Scan operator (running reduce)
 */
export interface ScanOperator<TIn, TOut> {
  type: 'scan';
  reducer: (acc: TOut, value: TIn) => TOut;
  initial: TOut;
}

/**
 * Take operator
 */
export interface TakeOperator<T> {
  type: 'take';
  count: number;
}

/**
 * Skip operator
 */
export interface SkipOperator<T> {
  type: 'skip';
  count: number;
}

/**
 * Distinct operator
 */
export interface DistinctOperator<T> {
  type: 'distinct';
  keyFn?: (value: T) => unknown;
}

/**
 * Buffer operator
 */
export interface BufferOperator<T> {
  type: 'buffer';
  size?: number;
  time?: number;
}

/**
 * Window operator
 */
export interface WindowOperator<T> {
  type: 'window';
  windowType: 'tumbling' | 'sliding' | 'session';
  size: number;
  slide?: number;
  gap?: number;
}

/**
 * Throttle operator
 */
export interface ThrottleOperator<T> {
  type: 'throttle';
  duration: number;
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Debounce operator
 */
export interface DebounceOperator<T> {
  type: 'debounce';
  duration: number;
}

/**
 * Sample operator
 */
export interface SampleOperator<T> {
  type: 'sample';
  interval: number;
}

/**
 * Delay operator
 */
export interface DelayOperator<T> {
  type: 'delay';
  duration: number;
}

/**
 * Timeout operator
 */
export interface TimeoutOperator<T> {
  type: 'timeout';
  duration: number;
  fallback?: T;
}

/**
 * Retry operator
 */
export interface RetryOperator<T> {
  type: 'retry';
  count: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
}

/**
 * Catch operator
 */
export interface CatchOperator<T> {
  type: 'catch';
  handler: (error: Error) => T | AsyncIterable<T>;
}

/**
 * Merge operator
 */
export interface MergeOperator<T> {
  type: 'merge';
  streams: Stream<T>[];
}

/**
 * Concat operator
 */
export interface ConcatOperator<T> {
  type: 'concat';
  streams: Stream<T>[];
}

/**
 * Zip operator
 */
export interface ZipOperator<TIn, TOut> {
  type: 'zip';
  streams: Stream<unknown>[];
  combiner: (...values: unknown[]) => TOut;
}

/**
 * CombineLatest operator
 */
export interface CombineLatestOperator<TIn, TOut> {
  type: 'combineLatest';
  streams: Stream<unknown>[];
  combiner: (...values: unknown[]) => TOut;
}

/**
 * GroupBy operator
 */
export interface GroupByOperator<TIn, TOut> {
  type: 'groupBy';
  keyFn: (value: TIn) => string | number;
  valueFn?: (value: TIn) => TOut;
}

/**
 * Partition operator
 */
export interface PartitionOperator<T> {
  type: 'partition';
  predicate: (value: T) => boolean;
}

/**
 * Tap operator (side effect)
 */
export interface TapOperator<T> {
  type: 'tap';
  fn: (value: T) => void;
}

/**
 * Stream sink - where data goes
 */
export type StreamSink<T> =
  | ConsoleSink<T>
  | FileSink<T>
  | QueueSink<T>
  | TopicSink<T>
  | HttpSink<T>
  | WebSocketSink<T>
  | DatabaseSink<T>
  | CallbackSink<T>
  | CollectSink<T>;

/**
 * Console sink
 */
export interface ConsoleSink<T> {
  type: 'console';
  format?: (value: T) => string;
}

/**
 * File sink
 */
export interface FileSink<T> {
  type: 'file';
  path: string;
  format?: 'json' | 'csv' | 'ndjson';
  append?: boolean;
}

/**
 * Queue sink
 */
export interface QueueSink<T> {
  type: 'queue';
  queueName: string;
}

/**
 * Topic sink
 */
export interface TopicSink<T> {
  type: 'topic';
  topicName: string;
}

/**
 * HTTP sink
 */
export interface HttpSink<T> {
  type: 'http';
  endpoint: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  batch?: { size: number; timeout: number };
}

/**
 * WebSocket sink
 */
export interface WebSocketSink<T> {
  type: 'websocket';
  url: string;
}

/**
 * Database sink
 */
export interface DatabaseSink<T> {
  type: 'database';
  table: string;
  operation?: 'insert' | 'upsert';
}

/**
 * Callback sink
 */
export interface CallbackSink<T> {
  type: 'callback';
  fn: (value: T) => void | Promise<void>;
}

/**
 * Collect sink
 */
export interface CollectSink<T> {
  type: 'collect';
  maxSize?: number;
}

/**
 * Stream pipeline specification
 */
export interface StreamPipelineSpec {
  name: string;
  description?: string;
  streams: StreamSpec[];
  connections: ConnectionSpec[];
}

/**
 * Stream specification
 */
export interface StreamSpec {
  id: string;
  source: string;
  operators: OperatorSpec[];
  sink?: string;
}

/**
 * Operator specification
 */
export interface OperatorSpec {
  type: string;
  params: Record<string, unknown>;
}

/**
 * Connection specification
 */
export interface ConnectionSpec {
  from: string;
  to: string;
  transform?: string;
}
