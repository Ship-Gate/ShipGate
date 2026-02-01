/**
 * WASM Runtime
 * Host runtime for executing ISL WASM modules
 */

import { CompiledWASM } from './types';

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  /** Memory configuration */
  memory: {
    initial: number;
    maximum: number;
    shared: boolean;
  };
  /** Enable WASI */
  wasi: boolean;
  /** Import overrides */
  imports: Record<string, Record<string, unknown>>;
  /** Timeout for execution (ms) */
  timeout: number;
}

/**
 * Default runtime configuration
 */
const DEFAULT_CONFIG: RuntimeConfig = {
  memory: {
    initial: 16,
    maximum: 256,
    shared: false,
  },
  wasi: false,
  imports: {},
  timeout: 30000,
};

/**
 * ISL WASM Runtime
 */
export class ISLWASMRuntime {
  private config: RuntimeConfig;
  private instance?: WebAssembly.Instance;
  private memory?: WebAssembly.Memory;
  private exports: Record<string, unknown> = {};
  private heapPtr = 65536; // Start after first 64KB

  constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      memory: { ...DEFAULT_CONFIG.memory, ...config.memory },
      imports: { ...DEFAULT_CONFIG.imports, ...config.imports },
    };
  }

  /**
   * Load and instantiate a WASM module
   */
  async load(wasm: Uint8Array | CompiledWASM): Promise<void> {
    const binary = wasm instanceof Uint8Array ? wasm : wasm.wasm;

    // Create memory
    this.memory = new WebAssembly.Memory({
      initial: this.config.memory.initial,
      maximum: this.config.memory.maximum,
      shared: this.config.memory.shared,
    });

    // Build imports
    const imports = this.buildImports();

    // Compile and instantiate
    const module = await WebAssembly.compile(binary);
    this.instance = await WebAssembly.instantiate(module, imports);

    // Extract exports
    this.exports = this.instance.exports as Record<string, unknown>;
  }

  /**
   * Call an exported function
   */
  call<T = unknown>(name: string, ...args: unknown[]): T {
    const fn = this.exports[name];
    if (typeof fn !== 'function') {
      throw new Error(`Export '${name}' is not a function`);
    }
    return fn(...args) as T;
  }

  /**
   * Call with timeout
   */
  async callWithTimeout<T = unknown>(
    name: string,
    timeout: number,
    ...args: unknown[]
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);

      try {
        const result = this.call<T>(name, ...args);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get exported function names
   */
  getExports(): string[] {
    return Object.keys(this.exports).filter(
      (key) => typeof this.exports[key] === 'function'
    );
  }

  /**
   * Read string from memory
   */
  readString(ptr: number, maxLen: number = 1024): string {
    if (!this.memory) throw new Error('Memory not initialized');

    const view = new Uint8Array(this.memory.buffer, ptr, maxLen);
    let end = 0;
    while (end < maxLen && view[end] !== 0) end++;
    return new TextDecoder().decode(view.slice(0, end));
  }

  /**
   * Write string to memory
   */
  writeString(str: string): number {
    if (!this.memory) throw new Error('Memory not initialized');

    const encoder = new TextEncoder();
    const bytes = encoder.encode(str + '\0');
    const ptr = this.allocate(bytes.length);

    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);

    return ptr;
  }

  /**
   * Allocate memory
   */
  allocate(size: number): number {
    if (!this.memory) throw new Error('Memory not initialized');

    // Check if we need to grow memory
    const needed = this.heapPtr + size;
    const available = this.memory.buffer.byteLength;

    if (needed > available) {
      const pagesNeeded = Math.ceil((needed - available) / 65536);
      this.memory.grow(pagesNeeded);
    }

    const ptr = this.heapPtr;
    this.heapPtr += size;
    // Align to 8 bytes
    this.heapPtr = (this.heapPtr + 7) & ~7;

    return ptr;
  }

  /**
   * Read memory as typed array
   */
  readMemory<T extends TypedArray>(
    ptr: number,
    length: number,
    type: TypedArrayConstructor<T>
  ): T {
    if (!this.memory) throw new Error('Memory not initialized');
    return new type(this.memory.buffer, ptr, length);
  }

  /**
   * Write to memory
   */
  writeMemory(ptr: number, data: ArrayBuffer | TypedArray): void {
    if (!this.memory) throw new Error('Memory not initialized');

    const src = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
    const dest = new Uint8Array(this.memory.buffer, ptr, src.length);
    dest.set(src);
  }

  /**
   * Get raw memory buffer
   */
  getMemory(): ArrayBuffer | undefined {
    return this.memory?.buffer;
  }

  /**
   * Build import object
   */
  private buildImports(): WebAssembly.Imports {
    return {
      env: {
        memory: this.memory,
        log: (ptr: number) => {
          const msg = this.readString(ptr);
          console.log('[WASM]', msg);
        },
        trap: (ptr: number) => {
          const msg = this.readString(ptr);
          throw new Error(`WASM trap: ${msg}`);
        },
        now: () => Date.now(),
        random: () => Math.random(),
        ...this.config.imports.env,
      },
      isl: {
        // ISL-specific imports
        check_precondition: (name: number, result: number) => {
          if (!result) {
            const conditionName = this.readString(name);
            throw new Error(`Precondition failed: ${conditionName}`);
          }
        },
        check_postcondition: (name: number, result: number) => {
          if (!result) {
            const conditionName = this.readString(name);
            throw new Error(`Postcondition failed: ${conditionName}`);
          }
        },
        emit_event: (type: number, payload: number) => {
          const eventType = this.readString(type);
          const eventPayload = this.readString(payload);
          console.log('[WASM Event]', eventType, eventPayload);
        },
        ...this.config.imports.isl,
      },
      ...Object.fromEntries(
        Object.entries(this.config.imports).filter(
          ([key]) => key !== 'env' && key !== 'isl'
        )
      ),
    };
  }
}

/**
 * Typed array constructor type
 */
type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

type TypedArrayConstructor<T extends TypedArray> = new (
  buffer: ArrayBuffer,
  byteOffset: number,
  length: number
) => T;

/**
 * Create runtime
 */
export function createRuntime(config?: Partial<RuntimeConfig>): ISLWASMRuntime {
  return new ISLWASMRuntime(config);
}

/**
 * Quick load and run
 */
export async function runWASM<T = unknown>(
  wasm: Uint8Array | CompiledWASM,
  functionName: string,
  args: unknown[] = [],
  config?: Partial<RuntimeConfig>
): Promise<T> {
  const runtime = new ISLWASMRuntime(config);
  await runtime.load(wasm);
  return runtime.call<T>(functionName, ...args);
}
