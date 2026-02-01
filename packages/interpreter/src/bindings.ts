// ============================================================================
// ISL Interpreter - Binding Loaders
// @isl-lang/interpreter/bindings
// ============================================================================

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import type { Value } from '@isl-lang/runtime-interpreter';
import type {
  BindingSource,
  TestData,
  Bindings,
  TargetModule,
  TargetFunction,
} from './types';
import { BindingError, InterpreterError } from './types';

// ============================================================================
// MAIN BINDING LOADER
// ============================================================================

/**
 * Load bindings from a source.
 */
export async function loadBindings(source: BindingSource): Promise<TestData> {
  switch (source.type) {
    case 'json':
      return loadJsonBindings(source.path);
    case 'module':
      return loadModuleBindings(source.path, source.export);
    case 'stdin':
      return loadStdinBindings();
    case 'http':
      return loadHttpBindings(source.url, source.method, source.headers);
    case 'inline':
      return parseTestData(source.data);
    default:
      throw new BindingError(`Unknown binding source type: ${(source as BindingSource).type}`);
  }
}

// ============================================================================
// JSON BINDING LOADER
// ============================================================================

/**
 * Load bindings from a JSON file.
 */
export async function loadJsonBindings(path: string): Promise<TestData> {
  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return parseTestData(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BindingError(`Test data file not found: ${path}`, { path });
    }
    if (error instanceof SyntaxError) {
      throw new BindingError(`Invalid JSON in test data file: ${path}`, { path, error: error.message });
    }
    throw new BindingError(`Failed to load test data from ${path}: ${(error as Error).message}`, { path });
  }
}

// ============================================================================
// MODULE BINDING LOADER
// ============================================================================

/**
 * Load bindings from a JavaScript/TypeScript module.
 */
export async function loadModuleBindings(path: string, exportName?: string): Promise<TestData> {
  try {
    const module = await loadModule(path);
    const data = exportName ? module[exportName] : module.default ?? module;
    
    if (typeof data === 'function') {
      // If it's a function, call it to get the test data
      const result = await data();
      return parseTestData(result);
    }
    
    return parseTestData(data);
  } catch (error) {
    throw new BindingError(`Failed to load bindings from module ${path}: ${(error as Error).message}`, {
      path,
      exportName,
    });
  }
}

// ============================================================================
// STDIN BINDING LOADER
// ============================================================================

/**
 * Load bindings from stdin (piped JSON).
 */
export async function loadStdinBindings(): Promise<TestData> {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parseTestData(parsed));
      } catch (error) {
        reject(new BindingError(`Invalid JSON from stdin: ${(error as Error).message}`));
      }
    });
    
    process.stdin.on('error', (error) => {
      reject(new BindingError(`Failed to read from stdin: ${error.message}`));
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new BindingError('Timeout waiting for stdin input'));
    }, 30000);
  });
}

// ============================================================================
// HTTP BINDING LOADER
// ============================================================================

/**
 * Load bindings from an HTTP endpoint.
 */
export async function loadHttpBindings(
  url: string,
  method: string = 'GET',
  headers?: Record<string, string>
): Promise<TestData> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    });
    
    if (!response.ok) {
      throw new BindingError(`HTTP error ${response.status}: ${response.statusText}`, {
        url,
        status: response.status,
      });
    }
    
    const data = await response.json();
    return parseTestData(data);
  } catch (error) {
    if (error instanceof BindingError) throw error;
    throw new BindingError(`Failed to load bindings from ${url}: ${(error as Error).message}`, { url });
  }
}

// ============================================================================
// MODULE LOADER (ESM/CJS support)
// ============================================================================

/**
 * Load a module with support for both ESM and CJS.
 */
export async function loadModule(path: string): Promise<Record<string, unknown>> {
  const absolutePath = path.startsWith('file://') ? path : pathToFileURL(path).href;
  
  try {
    // Try ESM import first
    return await import(absolutePath);
  } catch {
    // Fall back to require for CJS
    try {
      const require = createRequire(import.meta.url);
      return require(path);
    } catch (cjsError) {
      throw new InterpreterError(
        `Failed to load module ${path}: Module could not be loaded as ESM or CJS`,
        'MODULE_LOAD_ERROR',
        { path }
      );
    }
  }
}

/**
 * Load a target module and extract its functions.
 */
export async function loadTargetModule(path: string): Promise<TargetModule> {
  const module = await loadModule(path);
  const exports = new Map<string, TargetFunction>();
  
  for (const [name, value] of Object.entries(module)) {
    if (typeof value === 'function') {
      exports.set(name, {
        name,
        fn: value as TargetFunction['fn'],
        module: path,
      });
    }
  }
  
  return { path, exports };
}

// ============================================================================
// TEST DATA PARSING
// ============================================================================

/**
 * Parse and validate test data structure.
 */
export function parseTestData(data: unknown): TestData {
  if (!data || typeof data !== 'object') {
    throw new BindingError('Test data must be an object');
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!obj.intent || typeof obj.intent !== 'string') {
    throw new BindingError('Test data must have an "intent" field (string)');
  }
  
  if (!obj.bindings || typeof obj.bindings !== 'object') {
    throw new BindingError('Test data must have a "bindings" field (object)');
  }
  
  const bindings = obj.bindings as Record<string, unknown>;
  
  if (!bindings.pre || typeof bindings.pre !== 'object') {
    throw new BindingError('Test data bindings must have a "pre" field (object)');
  }
  
  return {
    intent: obj.intent,
    bindings: {
      pre: bindings.pre as Record<string, unknown>,
      post: bindings.post as Record<string, unknown> | undefined,
    },
    scenarios: Array.isArray(obj.scenarios)
      ? obj.scenarios.map(parseScenarioData)
      : undefined,
  };
}

function parseScenarioData(data: unknown): TestData['scenarios'] extends (infer T)[] | undefined ? T : never {
  if (!data || typeof data !== 'object') {
    throw new BindingError('Scenario must be an object');
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!obj.name || typeof obj.name !== 'string') {
    throw new BindingError('Scenario must have a "name" field (string)');
  }
  
  return {
    name: obj.name,
    given: obj.given as Record<string, unknown> | undefined,
    when: obj.when as Record<string, unknown> | undefined,
    expected: obj.expected as {
      success?: boolean;
      result?: unknown;
      error?: { code?: string; message?: string };
    } | undefined,
  };
}

// ============================================================================
// VALUE CONVERSION
// ============================================================================

/**
 * Convert a JavaScript value to an ISL runtime Value.
 */
export function toValue(jsValue: unknown): Value {
  if (jsValue === null || jsValue === undefined) {
    return { tag: 'option', value: null };
  }
  
  if (typeof jsValue === 'boolean') {
    return { tag: 'boolean', value: jsValue };
  }
  
  if (typeof jsValue === 'number') {
    if (Number.isInteger(jsValue)) {
      return { tag: 'int', value: BigInt(jsValue) };
    }
    return { tag: 'float', value: jsValue };
  }
  
  if (typeof jsValue === 'bigint') {
    return { tag: 'int', value: jsValue };
  }
  
  if (typeof jsValue === 'string') {
    // Check for UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jsValue)) {
      return { tag: 'uuid', value: jsValue };
    }
    // Check for ISO date format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(jsValue)) {
      return { tag: 'timestamp', value: new Date(jsValue) };
    }
    return { tag: 'string', value: jsValue };
  }
  
  if (jsValue instanceof Date) {
    return { tag: 'timestamp', value: jsValue };
  }
  
  if (jsValue instanceof Uint8Array) {
    return { tag: 'bytes', value: jsValue };
  }
  
  if (Array.isArray(jsValue)) {
    return { tag: 'list', elements: jsValue.map(toValue) };
  }
  
  if (jsValue instanceof Map) {
    const entries = new Map<string, Value>();
    for (const [k, v] of jsValue) {
      entries.set(String(k), toValue(v));
    }
    return { tag: 'map', entries };
  }
  
  if (jsValue instanceof Set) {
    return { tag: 'set', elements: new Set(Array.from(jsValue).map(toValue)) };
  }
  
  if (typeof jsValue === 'object') {
    const fields = new Map<string, Value>();
    for (const [key, val] of Object.entries(jsValue)) {
      fields.set(key, toValue(val));
    }
    return { tag: 'record', type: 'Object', fields };
  }
  
  throw new BindingError(`Cannot convert value of type ${typeof jsValue} to ISL Value`);
}

/**
 * Convert an ISL runtime Value back to a JavaScript value.
 */
export function fromValue(value: Value): unknown {
  switch (value.tag) {
    case 'unit':
      return undefined;
    case 'boolean':
      return value.value;
    case 'int':
      // Convert BigInt to number if safe, otherwise string
      return Number.isSafeInteger(Number(value.value)) ? Number(value.value) : value.value.toString();
    case 'float':
      return value.value;
    case 'decimal':
      return value.value;
    case 'string':
      return value.value;
    case 'bytes':
      return value.value;
    case 'timestamp':
      return value.value;
    case 'duration':
      return { value: value.value, unit: value.unit };
    case 'uuid':
      return value.value;
    case 'list':
      return value.elements.map(fromValue);
    case 'map': {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries) {
        obj[k] = fromValue(v);
      }
      return obj;
    }
    case 'set':
      return new Set(Array.from(value.elements).map(fromValue));
    case 'option':
      return value.value ? fromValue(value.value) : null;
    case 'result':
      return value.success ? { success: true, value: fromValue(value.value) } : { success: false, error: fromValue(value.error ?? value.value) };
    case 'record':
    case 'entity': {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.fields) {
        obj[k] = fromValue(v);
      }
      return obj;
    }
    case 'enum':
      return { type: value.type, variant: value.variant, data: value.data ? fromValue(value.data) : undefined };
    case 'function':
    case 'native':
      return '[function]';
    case 'behavior_result':
      return { behavior: value.behavior, outcome: value.outcome, value: fromValue(value.value) };
    case 'effect':
      return { effect: value.name, operation: value.operation, args: value.args.map(fromValue) };
    case 'continuation':
      return '[continuation]';
    default:
      return value;
  }
}

/**
 * Create bindings from test data.
 */
export function createBindings(testData: TestData): Bindings {
  const pre = new Map<string, Value>();
  const post = new Map<string, Value>();
  
  for (const [key, val] of Object.entries(testData.bindings.pre)) {
    pre.set(key, toValue(val));
  }
  
  if (testData.bindings.post) {
    for (const [key, val] of Object.entries(testData.bindings.post)) {
      post.set(key, toValue(val));
    }
  }
  
  return {
    pre,
    post,
    old: new Map(pre), // Initially, old values are the same as pre values
  };
}
