/**
 * ISL Effect Builders
 * 
 * Fluent API for constructing effects declaratively
 */

import type {
  Effect,
  ReadEffect,
  WriteEffect,
  IOEffect,
  NetworkEffect,
  DatabaseEffect,
  MessageEffect,
  LogEffect,
  TimeEffect,
  RandomEffect,
  EnvEffect,
  FileSystemEffect,
  ShellEffect,
  SequenceEffect,
  ParallelEffect,
  ConditionalEffect,
  RetryEffect,
  TimeoutEffect,
  CacheEffect,
  RetryPolicy,
} from './types.js';

/**
 * Create a read effect
 */
export function read<T>(source: string, key?: string): ReadEffect<T> {
  return {
    _tag: 'Read',
    source,
    key,
  };
}

/**
 * Create a write effect
 */
export function write<T>(target: string, value: T, key?: string): WriteEffect<T> {
  return {
    _tag: 'Write',
    target,
    key,
    value,
  };
}

/**
 * Create an IO effect
 */
export function io<T>(operation: string, params?: Record<string, unknown>): IOEffect<T> {
  return {
    _tag: 'IO',
    operation,
    params,
  };
}

/**
 * Create a network effect
 */
export function http<T>(
  method: NetworkEffect<T>['method'],
  url: string,
  options?: {
    headers?: Record<string, string>;
    body?: unknown;
  }
): NetworkEffect<T> {
  return {
    _tag: 'Network',
    method,
    url,
    headers: options?.headers,
    body: options?.body,
  };
}

/**
 * HTTP method shortcuts
 */
export const get = <T>(url: string, headers?: Record<string, string>) =>
  http<T>('GET', url, { headers });

export const post = <T>(url: string, body?: unknown, headers?: Record<string, string>) =>
  http<T>('POST', url, { headers, body });

export const put = <T>(url: string, body?: unknown, headers?: Record<string, string>) =>
  http<T>('PUT', url, { headers, body });

export const del = <T>(url: string, headers?: Record<string, string>) =>
  http<T>('DELETE', url, { headers });

export const patch = <T>(url: string, body?: unknown, headers?: Record<string, string>) =>
  http<T>('PATCH', url, { headers, body });

/**
 * Create a database effect
 */
export function database<T>(
  operation: DatabaseEffect<T>['operation'],
  options?: {
    table?: string;
    query?: string;
    params?: unknown[];
  }
): DatabaseEffect<T> {
  return {
    _tag: 'Database',
    operation,
    table: options?.table,
    query: options?.query,
    params: options?.params,
  };
}

/**
 * Database shortcuts
 */
export const query = <T>(sql: string, params?: unknown[]) =>
  database<T>('query', { query: sql, params });

export const insert = <T>(table: string, params?: unknown[]) =>
  database<T>('insert', { table, params });

export const update = <T>(table: string, params?: unknown[]) =>
  database<T>('update', { table, params });

export const deleteFrom = <T>(table: string, params?: unknown[]) =>
  database<T>('delete', { table, params });

export const transaction = <T>(operations: DatabaseEffect<unknown>[]) =>
  database<T>('transaction', { params: operations as unknown[] });

/**
 * Create a message effect
 */
export function message<T>(
  channel: string,
  payload: unknown,
  topic?: string
): MessageEffect<T> {
  return {
    _tag: 'Message',
    channel,
    topic,
    payload,
  };
}

/**
 * Create a log effect
 */
export function log(
  level: LogEffect['level'],
  msg: string,
  context?: Record<string, unknown>
): LogEffect {
  return {
    _tag: 'Log',
    level,
    message: msg,
    context,
  };
}

/**
 * Log level shortcuts
 */
export const debug = (msg: string, context?: Record<string, unknown>) =>
  log('debug', msg, context);

export const info = (msg: string, context?: Record<string, unknown>) =>
  log('info', msg, context);

export const warn = (msg: string, context?: Record<string, unknown>) =>
  log('warn', msg, context);

export const error = (msg: string, context?: Record<string, unknown>) =>
  log('error', msg, context);

/**
 * Create a time effect
 */
export function time<T>(
  operation: TimeEffect<T>['operation'],
  duration?: number
): TimeEffect<T> {
  return {
    _tag: 'Time',
    operation,
    duration,
  };
}

/**
 * Time shortcuts
 */
export const now = () => time<number>('now');
export const delay = (ms: number) => time<void>('delay', ms);
export const timeout = <T>(ms: number) => time<T>('timeout', ms);

/**
 * Create a random effect
 */
export function random<T>(
  type: RandomEffect<T>['type'],
  options?: RandomEffect<T>['options']
): RandomEffect<T> {
  return {
    _tag: 'Random',
    type,
    options,
  };
}

/**
 * Random shortcuts
 */
export const randomNumber = (min?: number, max?: number) =>
  random<number>('number', { min, max });

export const uuid = () => random<string>('uuid');

export const randomBytes = (length: number) =>
  random<Uint8Array>('bytes', { length });

export const randomChoice = <T>(choices: T[]) =>
  random<T>('choice', { choices });

/**
 * Create an environment effect
 */
export function env<T>(
  variable: string,
  options?: { required?: boolean; default?: T }
): EnvEffect<T> {
  return {
    _tag: 'Env',
    variable,
    required: options?.required,
    default: options?.default,
  };
}

/**
 * Create a file system effect
 */
export function fs<T>(
  operation: FileSystemEffect<T>['operation'],
  path: string,
  content?: unknown
): FileSystemEffect<T> {
  return {
    _tag: 'FileSystem',
    operation,
    path,
    content,
  };
}

/**
 * File system shortcuts
 */
export const readFile = (path: string) => fs<string>('read', path);
export const writeFile = (path: string, content: string) => fs<void>('write', path, content);
export const deleteFile = (path: string) => fs<void>('delete', path);
export const fileExists = (path: string) => fs<boolean>('exists', path);
export const listFiles = (path: string) => fs<string[]>('list', path);

/**
 * Create a shell effect
 */
export function shell<T>(
  command: string,
  options?: {
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
): ShellEffect<T> {
  return {
    _tag: 'Shell',
    command,
    args: options?.args,
    cwd: options?.cwd,
    env: options?.env,
  };
}

/**
 * Create a sequence effect
 */
export function sequence<T>(...effects: Effect<unknown>[]): SequenceEffect<T> {
  return {
    _tag: 'Sequence',
    effects,
  };
}

/**
 * Create a parallel effect
 */
export function parallel<T>(...effects: Effect<unknown>[]): ParallelEffect<T> {
  return {
    _tag: 'Parallel',
    effects,
  };
}

/**
 * Create a conditional effect
 */
export function when<T>(
  condition: Effect<boolean>,
  onTrue: Effect<T>,
  onFalse?: Effect<T>
): ConditionalEffect<T> {
  return {
    _tag: 'Conditional',
    condition,
    onTrue,
    onFalse,
  };
}

/**
 * Create a retry effect
 */
export function retry<T>(
  effect: Effect<T>,
  policy: RetryPolicy
): RetryEffect<T> {
  return {
    _tag: 'Retry',
    effect,
    policy,
  };
}

/**
 * Create a timeout effect
 */
export function withTimeout<T>(
  effect: Effect<T>,
  duration: number,
  fallback?: T
): TimeoutEffect<T> {
  return {
    _tag: 'Timeout',
    effect,
    duration,
    fallback,
  };
}

/**
 * Create a cache effect
 */
export function cached<T>(
  key: string,
  effect: Effect<T>,
  ttl?: number
): CacheEffect<T> {
  return {
    _tag: 'Cache',
    key,
    effect,
    ttl,
  };
}

/**
 * Effect combinators
 */
export const Effects = {
  // Basic effects
  read,
  write,
  io,
  
  // Network
  http,
  get,
  post,
  put,
  del,
  patch,
  
  // Database
  database,
  query,
  insert,
  update,
  deleteFrom,
  transaction,
  
  // Messaging
  message,
  
  // Logging
  log,
  debug,
  info,
  warn,
  error,
  
  // Time
  time,
  now,
  delay,
  timeout,
  
  // Random
  random,
  randomNumber,
  uuid,
  randomBytes,
  randomChoice,
  
  // Environment
  env,
  
  // File System
  fs,
  readFile,
  writeFile,
  deleteFile,
  fileExists,
  listFiles,
  
  // Shell
  shell,
  
  // Composition
  sequence,
  parallel,
  when,
  retry,
  withTimeout,
  cached,
};
