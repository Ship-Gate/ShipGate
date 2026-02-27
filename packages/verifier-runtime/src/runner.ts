// ============================================================================
// Sandboxed Execution Runner - Execute implementations safely
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  Implementation,
  ExecutionResult,
  EntityStore,
  EntityInstance,
  EntityStoreSnapshot,
  VerificationError,
  LogEntry,
} from './types.js';

/**
 * Options for the runner
 */
export interface RunnerOptions {
  timeout?: number;
  captureConsole?: boolean;
  maxMemory?: number;
}

/**
 * Create a sandboxed runner for executing implementations
 */
export function createRunner(options: RunnerOptions = {}): Runner {
  return new Runner(options);
}

/**
 * Runner class - manages execution of implementations
 */
export class Runner {
  private options: Required<RunnerOptions>;

  constructor(options: RunnerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      captureConsole: options.captureConsole ?? true,
      maxMemory: options.maxMemory ?? 128 * 1024 * 1024, // 128MB
    };
  }

  /**
   * Execute a behavior implementation with given input
   */
  async execute(
    implementation: Implementation,
    input: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const logs: LogEntry[] = [];
    const startTime = performance.now();

    // Setup console capture
    const originalConsole = this.setupConsoleCapture(logs);

    try {
      // Setup implementation (if needed)
      if (implementation.setup) {
        await implementation.setup();
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        implementation.execute(input),
        this.options.timeout
      );

      const duration = performance.now() - startTime;

      return {
        success: true,
        result: result.result,
        error: result.error,
        duration,
        logs,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const verifyError = this.toVerificationError(error);

      return {
        success: false,
        error: verifyError,
        duration,
        logs,
      };
    } finally {
      // Restore console
      this.restoreConsole(originalConsole);

      // Teardown implementation (if needed)
      if (implementation.teardown) {
        await implementation.teardown().catch(() => {
          // Ignore teardown errors
        });
      }
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Setup console capture
   */
  private setupConsoleCapture(logs: LogEntry[]): typeof console {
    if (!this.options.captureConsole) {
      return console;
    }

    const originalConsole = { ...console };
    const captureLog = (level: LogEntry['level']) => {
      return (...args: unknown[]) => {
        logs.push({
          level,
          message: args.map(String).join(' '),
          timestamp: Date.now(),
          data: args.length > 1 ? { args } : undefined,
        });
      };
    };

    console.log = captureLog('info');
    console.info = captureLog('info');
    console.warn = captureLog('warn');
    console.error = captureLog('error');
    console.debug = captureLog('debug');

    return originalConsole;
  }

  /**
   * Restore console
   */
  private restoreConsole(original: typeof console): void {
    Object.assign(console, original);
  }

  /**
   * Convert error to VerificationError
   */
  private toVerificationError(error: unknown): VerificationError {
    if (isVerificationError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: 'EXECUTION_ERROR',
        message: error.message,
        retriable: false,
        details: {
          name: error.name,
          stack: error.stack,
        },
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retriable: false,
    };
  }
}

/**
 * Type guard for VerificationError
 */
function isVerificationError(error: unknown): error is VerificationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retriable' in error
  );
}

// ============================================================================
// IN-MEMORY ENTITY STORE
// ============================================================================

/**
 * Create an in-memory entity store for testing
 */
export function createEntityStore(): EntityStore {
  return new InMemoryEntityStore();
}

/**
 * In-memory implementation of EntityStore
 */
export class InMemoryEntityStore implements EntityStore {
  private entities: Map<string, Map<string, EntityInstance>> = new Map();

  getAll(entityName: string): EntityInstance[] {
    const store = this.entities.get(entityName);
    return store ? Array.from(store.values()) : [];
  }

  exists(entityName: string, criteria?: Record<string, unknown>): boolean {
    const store = this.entities.get(entityName);
    if (!store) return false;
    if (!criteria) return store.size > 0;
    return this.findByCriteria(store, criteria) !== undefined;
  }

  lookup(
    entityName: string,
    criteria: Record<string, unknown>
  ): EntityInstance | undefined {
    const store = this.entities.get(entityName);
    if (!store) return undefined;
    return this.findByCriteria(store, criteria);
  }

  count(entityName: string, criteria?: Record<string, unknown>): number {
    const store = this.entities.get(entityName);
    if (!store) return 0;
    if (!criteria) return store.size;
    return this.filterByCriteria(store, criteria).length;
  }

  create(entityName: string, data: Record<string, unknown>): EntityInstance {
    if (!this.entities.has(entityName)) {
      this.entities.set(entityName, new Map());
    }

    const store = this.entities.get(entityName)!;
    const id = (data['id'] as string) ?? this.generateId();

    const instance: EntityInstance = {
      __entity__: entityName,
      __id__: id,
      ...data,
      id,
    };

    store.set(id, instance);
    return instance;
  }

  update(
    entityName: string,
    id: string,
    data: Record<string, unknown>
  ): void {
    const store = this.entities.get(entityName);
    if (!store) {
      throw new Error(`Entity type not found: ${entityName}`);
    }

    const instance = store.get(id);
    if (!instance) {
      throw new Error(`Entity instance not found: ${entityName}#${id}`);
    }

    Object.assign(instance, data);
  }

  delete(entityName: string, id: string): void {
    const store = this.entities.get(entityName);
    if (store) {
      store.delete(id);
    }
  }

  snapshot(): EntityStoreSnapshot {
    const snapshot: EntityStoreSnapshot = {
      entities: new Map(),
      timestamp: Date.now(),
    };

    for (const [entityName, store] of this.entities) {
      const entitySnapshot = new Map<string, EntityInstance>();
      for (const [id, instance] of store) {
        entitySnapshot.set(id, { ...instance });
      }
      snapshot.entities.set(entityName, entitySnapshot);
    }

    return snapshot;
  }

  restore(snapshot: EntityStoreSnapshot): void {
    this.entities.clear();

    for (const [entityName, store] of snapshot.entities) {
      const entityStore = new Map<string, EntityInstance>();
      for (const [id, instance] of store) {
        entityStore.set(id, { ...instance });
      }
      this.entities.set(entityName, entityStore);
    }
  }

  private findByCriteria(
    store: Map<string, EntityInstance>,
    criteria: Record<string, unknown>
  ): EntityInstance | undefined {
    for (const instance of store.values()) {
      if (this.matchesCriteria(instance, criteria)) {
        return instance;
      }
    }
    return undefined;
  }

  private filterByCriteria(
    store: Map<string, EntityInstance>,
    criteria: Record<string, unknown>
  ): EntityInstance[] {
    const results: EntityInstance[] = [];
    for (const instance of store.values()) {
      if (this.matchesCriteria(instance, criteria)) {
        results.push(instance);
      }
    }
    return results;
  }

  private matchesCriteria(
    instance: EntityInstance,
    criteria: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(criteria)) {
      if (instance[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// MOCK IMPLEMENTATION BUILDER
// ============================================================================

/**
 * Build a mock implementation for testing
 */
export function buildMockImplementation(
  handler: (input: Record<string, unknown>) => Promise<unknown> | unknown,
  store?: EntityStore
): Implementation {
  const entityStore = store ?? createEntityStore();

  return {
    async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
      const startTime = performance.now();
      try {
        const result = await handler(input);
        return {
          success: true,
          result,
          duration: performance.now() - startTime,
          logs: [],
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retriable: false,
          },
          duration: performance.now() - startTime,
          logs: [],
        };
      }
    },
    getEntityStore() {
      return entityStore;
    },
  };
}

// ============================================================================
// IMPLEMENTATION LOADER
// ============================================================================

/**
 * Load an implementation from a file path
 * This is a placeholder - in a real implementation, this would use
 * dynamic imports or a sandboxed VM
 */
export async function loadImplementation(
  _implementationPath: string,
  _domain: AST.Domain,
  _behaviorName: string
): Promise<Implementation> {
  // TODO: Implement actual loading logic
  // This would typically:
  // 1. Read the implementation file
  // 2. Parse and validate it
  // 3. Create a sandboxed execution context
  // 4. Return an Implementation interface
  
  throw new Error('Implementation loading not yet implemented. Use buildMockImplementation for testing.');
}
