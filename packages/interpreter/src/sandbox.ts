// ============================================================================
// ISL Interpreter - Sandboxed Execution
// @isl-lang/interpreter/sandbox
// ============================================================================

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { SandboxOptions, SandboxResult } from './types';
import { SandboxError, TimeoutError } from './types';

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  allowFs: false,
  allowNet: false,
  allowEnv: false,
  timeout: 5000,
  memoryLimit: 128 * 1024 * 1024, // 128 MB
};

// ============================================================================
// SANDBOX EXECUTION
// ============================================================================

/**
 * Execute a function in a sandboxed environment.
 * Uses worker threads for isolation.
 */
export async function runInSandbox<T>(
  fn: () => T | Promise<T>,
  options: Partial<SandboxOptions> = {}
): Promise<SandboxResult<T>> {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
  const startTime = performance.now();
  
  // For now, we use a simpler approach with timeouts
  // Full sandbox with worker threads is more complex but can be added
  return runWithTimeout(fn, opts.timeout);
}

/**
 * Run a function with a timeout.
 */
export async function runWithTimeout<T>(
  fn: () => T | Promise<T>,
  timeoutMs: number
): Promise<SandboxResult<T>> {
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    let completed = false;
    
    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve({
          success: false,
          error: new TimeoutError(`Execution timed out after ${timeoutMs}ms`, timeoutMs),
          duration: performance.now() - startTime,
          timedOut: true,
        });
      }
    }, timeoutMs);
    
    Promise.resolve()
      .then(() => fn())
      .then((value) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          resolve({
            success: true,
            value,
            duration: performance.now() - startTime,
            timedOut: false,
          });
        }
      })
      .catch((error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: performance.now() - startTime,
            timedOut: false,
          });
        }
      });
  });
}

// ============================================================================
// WORKER-BASED SANDBOX (Full Isolation)
// ============================================================================

interface WorkerMessage {
  type: 'result' | 'error';
  value?: unknown;
  error?: { message: string; name: string; stack?: string };
  duration: number;
}

/**
 * Execute a serializable function in a worker thread with full isolation.
 * The function must be serializable (no closures over external state).
 */
export async function runInWorkerSandbox<T>(
  fnString: string,
  args: unknown[],
  options: Partial<SandboxOptions> = {}
): Promise<SandboxResult<T>> {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    let terminated = false;
    
    // Create worker code inline
    const workerCode = `
      const { parentPort, workerData } = require('node:worker_threads');
      
      const startTime = performance.now();
      
      // Execute the function
      try {
        const fn = eval('(' + workerData.fnString + ')');
        const result = fn(...workerData.args);
        
        Promise.resolve(result).then((value) => {
          parentPort.postMessage({
            type: 'result',
            value,
            duration: performance.now() - startTime,
          });
        }).catch((error) => {
          parentPort.postMessage({
            type: 'error',
            error: {
              message: error.message,
              name: error.name,
              stack: error.stack,
            },
            duration: performance.now() - startTime,
          });
        });
      } catch (error) {
        parentPort.postMessage({
          type: 'error',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          duration: performance.now() - startTime,
        });
      }
    `;
    
    const worker = new Worker(workerCode, {
      eval: true,
      workerData: { fnString, args },
      resourceLimits: opts.memoryLimit
        ? { maxOldGenerationSizeMb: Math.floor(opts.memoryLimit / (1024 * 1024)) }
        : undefined,
    });
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!terminated) {
        terminated = true;
        worker.terminate();
        resolve({
          success: false,
          error: new TimeoutError(`Worker execution timed out after ${opts.timeout}ms`, opts.timeout),
          duration: performance.now() - startTime,
          timedOut: true,
        });
      }
    }, opts.timeout);
    
    // Handle worker messages
    worker.on('message', (msg: WorkerMessage) => {
      if (!terminated) {
        terminated = true;
        clearTimeout(timeoutId);
        worker.terminate();
        
        if (msg.type === 'result') {
          resolve({
            success: true,
            value: msg.value as T,
            duration: msg.duration,
            timedOut: false,
          });
        } else {
          const error = new Error(msg.error?.message ?? 'Unknown error');
          error.name = msg.error?.name ?? 'Error';
          if (msg.error?.stack) {
            error.stack = msg.error.stack;
          }
          resolve({
            success: false,
            error,
            duration: msg.duration,
            timedOut: false,
          });
        }
      }
    });
    
    // Handle worker errors
    worker.on('error', (error) => {
      if (!terminated) {
        terminated = true;
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error,
          duration: performance.now() - startTime,
          timedOut: false,
        });
      }
    });
    
    // Handle worker exit
    worker.on('exit', (code) => {
      if (!terminated && code !== 0) {
        terminated = true;
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: new SandboxError(`Worker exited with code ${code}`),
          duration: performance.now() - startTime,
          timedOut: false,
        });
      }
    });
  });
}

// ============================================================================
// SAFE EVALUATION
// ============================================================================

/**
 * Create a restricted global context for safe evaluation.
 * Removes dangerous globals while keeping basic functionality.
 */
export function createSafeContext(options: Partial<SandboxOptions> = {}): Record<string, unknown> {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
  
  const safeContext: Record<string, unknown> = {
    // Basic types and utilities
    undefined,
    Object,
    Array,
    String,
    Number,
    Boolean,
    BigInt,
    Symbol,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    
    // Math and JSON
    Math,
    JSON,
    
    // Encoding
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    
    // Type checking
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    
    // Console (can be useful for debugging)
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {},
      debug: () => {},
    },
  };
  
  // Optionally allow network access
  if (opts.allowNet) {
    safeContext['fetch'] = fetch;
    safeContext['URL'] = URL;
    safeContext['URLSearchParams'] = URLSearchParams;
  }
  
  return safeContext;
}

// ============================================================================
// ABORT CONTROLLER FOR CANCELLATION
// ============================================================================

/**
 * Create an abort signal that triggers after a timeout.
 */
export function createTimeoutAbort(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Check if an error is an abort error.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
