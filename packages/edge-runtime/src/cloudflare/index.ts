// ============================================================================
// Cloudflare Workers Integration
// ============================================================================

import { ISLEdgeRuntime, createEdgeRuntime, defineBehavior } from '../runtime';
import type {
  EdgeRuntimeOptions,
  EdgeBehaviorDefinition,
  EdgeRequestContext,
  EdgeKVStore,
  CloudflareProperties,
} from '../types';

/**
 * Cloudflare-specific runtime options
 */
export interface CloudflareRuntimeOptions extends Partial<EdgeRuntimeOptions> {
  /** KV namespace binding */
  kvNamespace?: KVNamespace;

  /** Durable Object namespace bindings */
  durableObjects?: Record<string, DurableObjectNamespace>;

  /** R2 bucket binding */
  r2Bucket?: R2Bucket;

  /** D1 database binding */
  d1Database?: D1Database;

  /** Queue bindings */
  queues?: Record<string, Queue>;

  /** AI binding */
  ai?: unknown;
}

/**
 * Cloudflare KV types
 */
interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>;
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expiration?: number; expirationTtl?: number; metadata?: Record<string, unknown> }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string }>; cursor?: string; list_complete: boolean }>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
  delete(key: string): Promise<void>;
}

interface R2Object {
  key: string;
  body: ReadableStream;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(colName?: string): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1ExecResult>;
}

interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1ExecResult {
  success: boolean;
  meta: Record<string, unknown>;
}

interface Queue {
  send(message: unknown): Promise<void>;
  sendBatch(messages: unknown[]): Promise<void>;
}

/**
 * Create Cloudflare Workers ISL runtime
 */
export function createCloudflareRuntime(
  options: CloudflareRuntimeOptions = {}
): ISLEdgeRuntime {
  const kvStore = options.kvNamespace
    ? createKVStoreAdapter(options.kvNamespace)
    : undefined;

  return createEdgeRuntime({
    platform: 'cloudflare',
    kvStore,
    ...options,
  });
}

/**
 * Create KV store adapter from Cloudflare KV namespace
 */
function createKVStoreAdapter(namespace: KVNamespace): EdgeKVStore {
  return {
    async get(key: string): Promise<string | null> {
      return namespace.get(key);
    },
    async put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number }): Promise<void> {
      await namespace.put(key, value, options);
    },
    async delete(key: string): Promise<void> {
      await namespace.delete(key);
    },
    async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
      const result = await namespace.list(options);
      return {
        keys: result.keys.map((k) => ({ name: k.name })),
        cursor: result.cursor,
        list_complete: result.list_complete,
      };
    },
  };
}

/**
 * Cloudflare Worker handler
 */
export interface CloudflareWorkerEnv {
  ISL_KV?: KVNamespace;
  [key: string]: unknown;
}

/**
 * Create Cloudflare Worker fetch handler
 */
export function createWorkerHandler(
  behaviors: EdgeBehaviorDefinition[],
  options: CloudflareRuntimeOptions = {}
): ExportedHandler<CloudflareWorkerEnv> {
  let runtime: ISLEdgeRuntime | null = null;

  return {
    async fetch(request: Request, env: CloudflareWorkerEnv, ctx: ExecutionContext): Promise<Response> {
      // Initialize runtime with env bindings on first request
      if (!runtime) {
        runtime = createCloudflareRuntime({
          ...options,
          kvNamespace: env.ISL_KV,
        });
        runtime.registerBehaviors(behaviors);
      }

      // Add Cloudflare-specific context
      const cfProps = (request as unknown as { cf?: CloudflareProperties }).cf;

      return runtime.handleRequest(request);
    },
  };
}

/**
 * Execution context type
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Exported handler type
 */
interface ExportedHandler<Env = unknown> {
  fetch?(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  scheduled?(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
  queue?(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void>;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface MessageBatch {
  messages: Message[];
  queue: string;
}

interface Message {
  id: string;
  body: unknown;
  timestamp: Date;
}

/**
 * ISL Durable Object base class
 */
export abstract class ISLDurableObject {
  protected state: DurableObjectState;
  protected env: CloudflareWorkerEnv;
  protected runtime: ISLEdgeRuntime;
  protected behaviors: Map<string, EdgeBehaviorDefinition> = new Map();

  constructor(state: DurableObjectState, env: CloudflareWorkerEnv) {
    this.state = state;
    this.env = env;
    this.runtime = createCloudflareRuntime({
      kvNamespace: env.ISL_KV,
    });
    this.initBehaviors();
    this.runtime.registerBehaviors(Array.from(this.behaviors.values()));
  }

  /**
   * Override to register behaviors
   */
  protected abstract initBehaviors(): void;

  /**
   * Register a behavior
   */
  protected registerBehavior(definition: EdgeBehaviorDefinition): void {
    this.behaviors.set(`${definition.domain}.${definition.behavior}`, definition);
  }

  /**
   * Handle fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    return this.runtime.handleRequest(request);
  }

  /**
   * Get persistent storage
   */
  protected async get<T>(key: string): Promise<T | undefined> {
    return this.state.storage.get<T>(key);
  }

  /**
   * Set persistent storage
   */
  protected async set<T>(key: string, value: T): Promise<void> {
    return this.state.storage.put(key, value);
  }

  /**
   * Delete from persistent storage
   */
  protected async delete(key: string): Promise<boolean> {
    return this.state.storage.delete(key);
  }

  /**
   * Set alarm
   */
  protected async setAlarm(time: Date | number): Promise<void> {
    return this.state.storage.setAlarm(time);
  }

  /**
   * Override to handle alarms
   */
  async alarm(): Promise<void> {
    // Override in subclass
  }
}

interface DurableObjectState {
  storage: DurableObjectStorage;
  id: DurableObjectId;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  get<T>(keys: string[]): Promise<Map<string, T>>;
  put<T>(key: string, value: T): Promise<void>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T>(options?: { prefix?: string; limit?: number }): Promise<Map<string, T>>;
  setAlarm(time: Date | number): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

// Re-export
export { createEdgeRuntime, defineBehavior, ISLEdgeRuntime };
export type { EdgeBehaviorDefinition, EdgeRequestContext };
