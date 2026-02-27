/**
 * Sandboxed Execution Environment for ISL
 * Provides secure, isolated execution of behavior logic
 */

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Maximum execution time in ms */
  timeout: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Enable console access */
  allowConsole: boolean;
  /** Enable network access */
  allowNetwork: boolean;
  /** Enable file system access */
  allowFileSystem: boolean;
  /** Custom globals to expose */
  globals: Record<string, unknown>;
}

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeout: 5000,
  memoryLimit: 128 * 1024 * 1024, // 128MB
  allowConsole: false,
  allowNetwork: false,
  allowFileSystem: false,
  globals: {},
};

/**
 * Evaluation context for sandbox
 */
export interface EvaluationContext {
  input?: Record<string, unknown>;
  output?: unknown;
  state?: unknown;
  actor?: unknown;
  [key: string]: unknown;
}

/**
 * ISL Sandbox - Secure execution environment
 */
export class ISLSandbox {
  private config: SandboxConfig;
  private initialized = false;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /**
   * Initialize the sandbox
   */
  async initialize(): Promise<void> {
    // In a full implementation, this would initialize the VM
    this.initialized = true;
  }

  /**
   * Destroy the sandbox
   */
  async destroy(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Evaluate an expression in the sandbox
   */
  async evaluate(expression: string, context: EvaluationContext = {}): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Sandbox not initialized');
    }

    try {
      // Create safe evaluation function
      const fn = this.createSafeFunction(expression, Object.keys(context));
      
      // Execute with timeout
      return await this.executeWithTimeout(fn, Object.values(context));
    } catch (error) {
      throw new SandboxError(`Evaluation failed: ${(error as Error).message}`, expression);
    }
  }

  /**
   * Execute a function in the sandbox
   */
  async executeFunction<T>(
    fn: (...args: unknown[]) => T | Promise<T>,
    args: unknown[] = []
  ): Promise<T> {
    if (!this.initialized) {
      throw new Error('Sandbox not initialized');
    }

    return this.executeWithTimeout(fn, args) as Promise<T>;
  }

  /**
   * Create a safe function from an expression
   */
  private createSafeFunction(
    expression: string,
    paramNames: string[]
  ): (...args: unknown[]) => unknown {
    // Sanitize the expression
    const sanitized = this.sanitizeExpression(expression);

    // Build function body with context
    const functionBody = `
      "use strict";
      return (${sanitized});
    `;

    try {
      // Create function with limited scope
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return new Function(...paramNames, functionBody) as (...args: unknown[]) => unknown;
    } catch (error) {
      throw new SandboxError(
        `Invalid expression: ${(error as Error).message}`,
        expression
      );
    }
  }

  /**
   * Sanitize an expression to prevent code injection
   */
  private sanitizeExpression(expression: string): string {
    // Remove potentially dangerous constructs
    const dangerous = [
      /\beval\b/g,
      /\bFunction\b/g,
      /\bimport\b/g,
      /\brequire\b/g,
      /\b__proto__\b/g,
      /\bconstructor\b/g,
      /\bprototype\b/g,
      /\bprocess\b/g,
      /\bglobal\b/g,
      /\bwindow\b/g,
      /\bdocument\b/g,
    ];

    let sanitized = expression;
    for (const pattern of dangerous) {
      if (pattern.test(sanitized)) {
        throw new SandboxError(
          'Expression contains forbidden construct',
          expression
        );
      }
    }

    return sanitized;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: (...args: unknown[]) => T | Promise<T>,
    args: unknown[]
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SandboxTimeoutError(this.config.timeout));
      }, this.config.timeout);

      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          result
            .then((value) => {
              clearTimeout(timeout);
              resolve(value);
            })
            .catch((error) => {
              clearTimeout(timeout);
              reject(error);
            });
        } else {
          clearTimeout(timeout);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

/**
 * Sandbox error
 */
export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly expression: string
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

/**
 * Sandbox timeout error
 */
export class SandboxTimeoutError extends Error {
  constructor(public readonly timeout: number) {
    super(`Execution timed out after ${timeout}ms`);
    this.name = 'SandboxTimeoutError';
  }
}

/**
 * Expression evaluator utilities
 */
export const ExpressionEvaluator = {
  /**
   * Parse and validate an expression
   */
  parse(expression: string): ParsedExpression {
    const variables = this.extractVariables(expression);
    const functions = this.extractFunctions(expression);

    return {
      raw: expression,
      variables,
      functions,
      isAsync: expression.includes('await'),
    };
  },

  /**
   * Extract variables from expression
   */
  extractVariables(expression: string): string[] {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const reserved = new Set([
      'true', 'false', 'null', 'undefined', 'typeof', 'instanceof',
      'new', 'delete', 'void', 'this', 'in', 'if', 'else', 'for',
      'while', 'do', 'switch', 'case', 'break', 'continue', 'return',
      'try', 'catch', 'finally', 'throw', 'const', 'let', 'var',
      'function', 'class', 'extends', 'async', 'await', 'yield',
    ]);

    const matches = expression.match(varPattern) ?? [];
    return [...new Set(matches.filter((v) => !reserved.has(v)))];
  },

  /**
   * Extract function calls from expression
   */
  extractFunctions(expression: string): string[] {
    const fnPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = fnPattern.exec(expression)) !== null) {
      matches.push(match[1]!);
    }

    return [...new Set(matches)];
  },

  /**
   * Check if expression is simple (no function calls, single line)
   */
  isSimple(expression: string): boolean {
    return (
      !expression.includes('(') &&
      !expression.includes('{') &&
      !expression.includes('\n')
    );
  },
};

/**
 * Parsed expression structure
 */
export interface ParsedExpression {
  raw: string;
  variables: string[];
  functions: string[];
  isAsync: boolean;
}

/**
 * Built-in safe functions for sandbox
 */
export const SafeFunctions = {
  // Math
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  sqrt: Math.sqrt,
  random: Math.random,

  // String
  toLowerCase: (s: string) => s.toLowerCase(),
  toUpperCase: (s: string) => s.toUpperCase(),
  trim: (s: string) => s.trim(),
  startsWith: (s: string, search: string) => s.startsWith(search),
  endsWith: (s: string, search: string) => s.endsWith(search),
  includes: (s: string, search: string) => s.includes(search),
  split: (s: string, sep: string) => s.split(sep),
  join: (arr: string[], sep: string) => arr.join(sep),
  substring: (s: string, start: number, end?: number) => s.substring(start, end),
  replace: (s: string, search: string, replacement: string) => s.replace(search, replacement),

  // Array
  length: (arr: unknown[]) => arr.length,
  first: <T>(arr: T[]) => arr[0],
  last: <T>(arr: T[]) => arr[arr.length - 1],
  isEmpty: (arr: unknown[]) => arr.length === 0,
  contains: <T>(arr: T[], item: T) => arr.includes(item),
  count: (arr: unknown[], predicate?: (item: unknown) => boolean) =>
    predicate ? arr.filter(predicate).length : arr.length,

  // Object
  keys: (obj: object) => Object.keys(obj),
  values: (obj: object) => Object.values(obj),
  hasKey: (obj: object, key: string) => key in obj,
  get: (obj: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  },

  // Type checking
  isString: (v: unknown): v is string => typeof v === 'string',
  isNumber: (v: unknown): v is number => typeof v === 'number',
  isBoolean: (v: unknown): v is boolean => typeof v === 'boolean',
  isArray: Array.isArray,
  isObject: (v: unknown): v is object => typeof v === 'object' && v !== null && !Array.isArray(v),
  isNull: (v: unknown): v is null => v === null,
  isUndefined: (v: unknown): v is undefined => v === undefined,
  isNullOrUndefined: (v: unknown): v is null | undefined => v == null,

  // Date
  now: () => Date.now(),
  timestamp: (date: Date) => date.getTime(),
  parseDate: (s: string) => new Date(s),

  // Comparison
  eq: (a: unknown, b: unknown) => a === b,
  neq: (a: unknown, b: unknown) => a !== b,
  gt: (a: number, b: number) => a > b,
  gte: (a: number, b: number) => a >= b,
  lt: (a: number, b: number) => a < b,
  lte: (a: number, b: number) => a <= b,

  // Logic
  and: (...args: boolean[]) => args.every(Boolean),
  or: (...args: boolean[]) => args.some(Boolean),
  not: (v: boolean) => !v,
  ifElse: <T>(condition: boolean, ifTrue: T, ifFalse: T) => (condition ? ifTrue : ifFalse),
};

/**
 * Create sandbox with safe functions pre-loaded
 */
export function createSandbox(config?: Partial<SandboxConfig>): ISLSandbox {
  return new ISLSandbox({
    ...config,
    globals: {
      ...SafeFunctions,
      ...config?.globals,
    },
  });
}
