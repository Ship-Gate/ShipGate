/**
 * ISL Effect Handlers
 * 
 * Default implementations for common effects
 */

import type {
  EffectRuntime,
  NetworkEffect,
  DatabaseEffect,
  LogEffect,
  TimeEffect,
  RandomEffect,
  EnvEffect,
  FileSystemEffect,
  ShellEffect,
} from './types';
import { registerHandler } from './runtime';

/**
 * Register default handlers for a runtime
 */
export function registerDefaultHandlers(runtime: EffectRuntime): void {
  registerLogHandler(runtime);
  registerTimeHandler(runtime);
  registerRandomHandler(runtime);
  registerEnvHandler(runtime);
}

/**
 * Register log effect handler
 */
export function registerLogHandler(runtime: EffectRuntime): void {
  registerHandler<LogEffect, void>(runtime, 'Log', async (effect) => {
    const prefix = `[${effect.level.toUpperCase()}]`;
    const message = effect.context
      ? `${prefix} ${effect.message} ${JSON.stringify(effect.context)}`
      : `${prefix} ${effect.message}`;

    switch (effect.level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  });
}

/**
 * Register time effect handler
 */
export function registerTimeHandler(runtime: EffectRuntime): void {
  registerHandler<TimeEffect<unknown>, unknown>(runtime, 'Time', async (effect) => {
    switch (effect.operation) {
      case 'now':
        return Date.now();
      case 'delay':
        await new Promise((resolve) => setTimeout(resolve, effect.duration ?? 0));
        return undefined;
      case 'timeout':
        return effect.duration;
      default:
        throw new Error(`Unknown time operation: ${effect.operation}`);
    }
  });
}

/**
 * Register random effect handler
 */
export function registerRandomHandler(runtime: EffectRuntime): void {
  registerHandler<RandomEffect<unknown>, unknown>(runtime, 'Random', async (effect) => {
    switch (effect.type) {
      case 'number': {
        const min = effect.options?.min ?? 0;
        const max = effect.options?.max ?? 1;
        return Math.random() * (max - min) + min;
      }
      case 'uuid':
        return crypto.randomUUID();
      case 'bytes': {
        const length = effect.options?.length ?? 16;
        return crypto.getRandomValues(new Uint8Array(length));
      }
      case 'choice': {
        const choices = effect.options?.choices ?? [];
        if (choices.length === 0) return undefined;
        return choices[Math.floor(Math.random() * choices.length)];
      }
      default:
        throw new Error(`Unknown random type: ${effect.type}`);
    }
  });
}

/**
 * Register environment effect handler
 */
export function registerEnvHandler(runtime: EffectRuntime): void {
  registerHandler<EnvEffect<unknown>, unknown>(runtime, 'Env', async (effect) => {
    const value = process.env[effect.variable];

    if (value === undefined) {
      if (effect.required) {
        throw new Error(`Required environment variable not set: ${effect.variable}`);
      }
      return effect.default;
    }

    return value;
  });
}

/**
 * Register network effect handler (Node.js fetch)
 */
export function registerNetworkHandler(runtime: EffectRuntime): void {
  registerHandler<NetworkEffect<unknown>, unknown>(runtime, 'Network', async (effect) => {
    const response = await fetch(effect.url, {
      method: effect.method,
      headers: effect.headers,
      body: effect.body ? JSON.stringify(effect.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text();
  });
}

/**
 * Register file system effect handler (Node.js)
 */
export function registerFileSystemHandler(
  runtime: EffectRuntime,
  fsModule: {
    readFile: (path: string, encoding: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    unlink: (path: string) => Promise<void>;
    access: (path: string) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
  }
): void {
  registerHandler<FileSystemEffect<unknown>, unknown>(runtime, 'FileSystem', async (effect) => {
    switch (effect.operation) {
      case 'read':
        return fsModule.readFile(effect.path, 'utf-8');
      case 'write':
        await fsModule.writeFile(effect.path, String(effect.content));
        return undefined;
      case 'delete':
        await fsModule.unlink(effect.path);
        return undefined;
      case 'exists':
        try {
          await fsModule.access(effect.path);
          return true;
        } catch {
          return false;
        }
      case 'list':
        return fsModule.readdir(effect.path);
      default:
        throw new Error(`Unknown file system operation: ${effect.operation}`);
    }
  });
}

/**
 * Register shell effect handler (Node.js)
 */
export function registerShellHandler(
  runtime: EffectRuntime,
  execModule: {
    exec: (
      command: string,
      options: { cwd?: string; env?: Record<string, string> }
    ) => Promise<{ stdout: string; stderr: string }>;
  }
): void {
  registerHandler<ShellEffect<unknown>, unknown>(runtime, 'Shell', async (effect) => {
    const command = effect.args
      ? `${effect.command} ${effect.args.join(' ')}`
      : effect.command;

    const result = await execModule.exec(command, {
      cwd: effect.cwd,
      env: effect.env,
    });

    return result.stdout;
  });
}

/**
 * Create a database handler factory
 */
export function createDatabaseHandler<TConnection>(
  connection: TConnection,
  executor: {
    query: (conn: TConnection, sql: string, params?: unknown[]) => Promise<unknown>;
    insert: (conn: TConnection, table: string, params?: unknown[]) => Promise<unknown>;
    update: (conn: TConnection, table: string, params?: unknown[]) => Promise<unknown>;
    delete: (conn: TConnection, table: string, params?: unknown[]) => Promise<unknown>;
    transaction: (conn: TConnection, operations: unknown[]) => Promise<unknown>;
  }
) {
  return async (effect: DatabaseEffect<unknown>): Promise<unknown> => {
    switch (effect.operation) {
      case 'query':
        return executor.query(connection, effect.query ?? '', effect.params);
      case 'insert':
        return executor.insert(connection, effect.table ?? '', effect.params);
      case 'update':
        return executor.update(connection, effect.table ?? '', effect.params);
      case 'delete':
        return executor.delete(connection, effect.table ?? '', effect.params);
      case 'transaction':
        return executor.transaction(connection, effect.params ?? []);
      default:
        throw new Error(`Unknown database operation: ${effect.operation}`);
    }
  };
}
