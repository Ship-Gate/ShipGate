// ============================================================================
// ISL Effect System - Built-in Effects
// Standard library of common effects
// ============================================================================

import type { Effect, EffectHandler } from './types.js';

/**
 * IO Effect - General input/output
 */
export const IOEffect: Effect = {
  kind: 'IO',
  name: 'IO',
  description: 'General input/output operations',
  operations: [
    {
      name: 'print',
      parameters: [{ name: 'message', type: { kind: 'Primitive', name: 'String' } }],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Print a message',
    },
    {
      name: 'read',
      parameters: [],
      returnType: { kind: 'Primitive', name: 'String' },
      resumable: true,
      description: 'Read input',
    },
  ],
};

/**
 * State Effect - Mutable state
 */
export const StateEffect: Effect = {
  kind: 'State',
  name: 'State',
  description: 'Mutable state operations',
  operations: [
    {
      name: 'get',
      parameters: [],
      returnType: { kind: 'Generic', name: 'S', params: [] },
      resumable: true,
      description: 'Get current state',
    },
    {
      name: 'put',
      parameters: [{ name: 'state', type: { kind: 'Generic', name: 'S', params: [] } }],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Set new state',
    },
    {
      name: 'modify',
      parameters: [{ 
        name: 'fn', 
        type: { 
          kind: 'Function', 
          params: [{ kind: 'Generic', name: 'S', params: [] }], 
          returns: { kind: 'Generic', name: 'S', params: [] },
          effects: { effects: [], pure: true }
        } 
      }],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Modify state with a function',
    },
  ],
};

/**
 * Exception Effect - Error handling
 */
export const ExceptionEffect: Effect = {
  kind: 'Exception',
  name: 'Exception',
  description: 'Exception handling operations',
  operations: [
    {
      name: 'throw',
      parameters: [{ name: 'error', type: { kind: 'Generic', name: 'E', params: [] } }],
      returnType: { kind: 'Never' },
      resumable: false,
      description: 'Throw an exception',
    },
    {
      name: 'catch',
      parameters: [
        { 
          name: 'computation', 
          type: { 
            kind: 'Function', 
            params: [], 
            returns: { kind: 'Generic', name: 'T', params: [] },
            effects: { effects: [{ effect: 'Exception' }] }
          } 
        },
        { 
          name: 'handler', 
          type: { 
            kind: 'Function', 
            params: [{ kind: 'Generic', name: 'E', params: [] }], 
            returns: { kind: 'Generic', name: 'T', params: [] },
            effects: { effects: [], pure: true }
          } 
        },
      ],
      returnType: { kind: 'Generic', name: 'T', params: [] },
      resumable: true,
      description: 'Catch and handle exceptions',
    },
  ],
};

/**
 * Async Effect - Asynchronous operations
 */
export const AsyncEffect: Effect = {
  kind: 'Async',
  name: 'Async',
  description: 'Asynchronous operations',
  operations: [
    {
      name: 'await',
      parameters: [{ 
        name: 'promise', 
        type: { kind: 'Generic', name: 'Promise', params: [{ kind: 'Generic', name: 'T', params: [] }] } 
      }],
      returnType: { kind: 'Generic', name: 'T', params: [] },
      resumable: true,
      description: 'Await a promise',
    },
    {
      name: 'spawn',
      parameters: [{ 
        name: 'computation', 
        type: { 
          kind: 'Function', 
          params: [], 
          returns: { kind: 'Generic', name: 'T', params: [] },
          effects: { effects: [{ effect: 'Async' }] }
        } 
      }],
      returnType: { kind: 'Generic', name: 'Fiber', params: [{ kind: 'Generic', name: 'T', params: [] }] },
      resumable: true,
      description: 'Spawn a concurrent computation',
    },
    {
      name: 'race',
      parameters: [{ 
        name: 'computations', 
        type: { 
          kind: 'Generic', 
          name: 'Array', 
          params: [{ kind: 'Generic', name: 'Promise', params: [{ kind: 'Generic', name: 'T', params: [] }] }] 
        } 
      }],
      returnType: { kind: 'Generic', name: 'T', params: [] },
      resumable: true,
      description: 'Race multiple computations',
    },
    {
      name: 'all',
      parameters: [{ 
        name: 'computations', 
        type: { 
          kind: 'Generic', 
          name: 'Array', 
          params: [{ kind: 'Generic', name: 'Promise', params: [{ kind: 'Generic', name: 'T', params: [] }] }] 
        } 
      }],
      returnType: { kind: 'Generic', name: 'Array', params: [{ kind: 'Generic', name: 'T', params: [] }] },
      resumable: true,
      description: 'Await all computations',
    },
    {
      name: 'delay',
      parameters: [{ name: 'ms', type: { kind: 'Primitive', name: 'Int' } }],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Delay execution',
    },
  ],
};

/**
 * Resource Effect - Resource management
 */
export const ResourceEffect: Effect = {
  kind: 'Resource',
  name: 'Resource',
  description: 'Resource acquisition and release',
  operations: [
    {
      name: 'acquire',
      parameters: [{ 
        name: 'acquire', 
        type: { 
          kind: 'Function', 
          params: [], 
          returns: { kind: 'Generic', name: 'R', params: [] },
          effects: { effects: [{ effect: 'IO' }] }
        } 
      }],
      returnType: { kind: 'Generic', name: 'R', params: [] },
      resumable: true,
      description: 'Acquire a resource',
    },
    {
      name: 'release',
      parameters: [
        { name: 'resource', type: { kind: 'Generic', name: 'R', params: [] } },
        { 
          name: 'releaser', 
          type: { 
            kind: 'Function', 
            params: [{ kind: 'Generic', name: 'R', params: [] }], 
            returns: { kind: 'Void' },
            effects: { effects: [{ effect: 'IO' }] }
          } 
        },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Release a resource',
    },
    {
      name: 'bracket',
      parameters: [
        { 
          name: 'acquire', 
          type: { 
            kind: 'Function', 
            params: [], 
            returns: { kind: 'Generic', name: 'R', params: [] },
            effects: { effects: [{ effect: 'IO' }] }
          } 
        },
        { 
          name: 'use', 
          type: { 
            kind: 'Function', 
            params: [{ kind: 'Generic', name: 'R', params: [] }], 
            returns: { kind: 'Generic', name: 'T', params: [] },
            effects: { effects: [] }
          } 
        },
        { 
          name: 'release', 
          type: { 
            kind: 'Function', 
            params: [{ kind: 'Generic', name: 'R', params: [] }], 
            returns: { kind: 'Void' },
            effects: { effects: [{ effect: 'IO' }] }
          } 
        },
      ],
      returnType: { kind: 'Generic', name: 'T', params: [] },
      resumable: true,
      description: 'Bracket pattern for safe resource usage',
    },
  ],
};

/**
 * Random Effect - Non-determinism
 */
export const RandomEffect: Effect = {
  kind: 'Random',
  name: 'Random',
  description: 'Random number generation',
  operations: [
    {
      name: 'random',
      parameters: [],
      returnType: { kind: 'Primitive', name: 'Decimal' },
      resumable: true,
      description: 'Generate random number [0, 1)',
    },
    {
      name: 'randomInt',
      parameters: [
        { name: 'min', type: { kind: 'Primitive', name: 'Int' } },
        { name: 'max', type: { kind: 'Primitive', name: 'Int' } },
      ],
      returnType: { kind: 'Primitive', name: 'Int' },
      resumable: true,
      description: 'Generate random integer in range',
    },
    {
      name: 'randomChoice',
      parameters: [{ 
        name: 'items', 
        type: { kind: 'Generic', name: 'Array', params: [{ kind: 'Generic', name: 'T', params: [] }] } 
      }],
      returnType: { kind: 'Generic', name: 'T', params: [] },
      resumable: true,
      description: 'Choose random item from array',
    },
    {
      name: 'shuffle',
      parameters: [{ 
        name: 'items', 
        type: { kind: 'Generic', name: 'Array', params: [{ kind: 'Generic', name: 'T', params: [] }] } 
      }],
      returnType: { kind: 'Generic', name: 'Array', params: [{ kind: 'Generic', name: 'T', params: [] }] },
      resumable: true,
      description: 'Shuffle array randomly',
    },
  ],
};

/**
 * Time Effect - Time operations
 */
export const TimeEffect: Effect = {
  kind: 'Time',
  name: 'Time',
  description: 'Time-related operations',
  operations: [
    {
      name: 'now',
      parameters: [],
      returnType: { kind: 'Primitive', name: 'Timestamp' },
      resumable: true,
      description: 'Get current timestamp',
    },
    {
      name: 'measure',
      parameters: [{ 
        name: 'computation', 
        type: { 
          kind: 'Function', 
          params: [], 
          returns: { kind: 'Generic', name: 'T', params: [] },
          effects: { effects: [] }
        } 
      }],
      returnType: { 
        kind: 'Generic', 
        name: 'Tuple', 
        params: [
          { kind: 'Generic', name: 'T', params: [] },
          { kind: 'Primitive', name: 'Duration' }
        ] 
      },
      resumable: true,
      description: 'Measure execution time',
    },
  ],
};

/**
 * Logging Effect - Structured logging
 */
export const LoggingEffect: Effect = {
  kind: 'Logging',
  name: 'Logging',
  description: 'Structured logging operations',
  operations: [
    {
      name: 'log',
      parameters: [
        { name: 'level', type: { kind: 'Primitive', name: 'String' } },
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
        { name: 'context', type: { kind: 'Any' }, optional: true },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
      description: 'Log a message',
    },
    {
      name: 'trace',
      parameters: [
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
    },
    {
      name: 'debug',
      parameters: [
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
    },
    {
      name: 'info',
      parameters: [
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
    },
    {
      name: 'warn',
      parameters: [
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
    },
    {
      name: 'error',
      parameters: [
        { name: 'message', type: { kind: 'Primitive', name: 'String' } },
        { name: 'error', type: { kind: 'Any' }, optional: true },
      ],
      returnType: { kind: 'Void' },
      resumable: true,
    },
  ],
};

/**
 * All built-in effects
 */
export const BUILTIN_EFFECTS: Effect[] = [
  IOEffect,
  StateEffect,
  ExceptionEffect,
  AsyncEffect,
  ResourceEffect,
  RandomEffect,
  TimeEffect,
  LoggingEffect,
];

/**
 * Create a state handler with initial value
 */
export function createStateHandler<S>(initial: S): EffectHandler[] {
  let state = initial;

  return [
    {
      effect: 'State',
      operation: 'get',
      implementation: { kind: 'Native', fn: () => state },
    },
    {
      effect: 'State',
      operation: 'put',
      implementation: { kind: 'Native', fn: (newState: unknown) => { state = newState as S; } },
    },
    {
      effect: 'State',
      operation: 'modify',
      implementation: { kind: 'Native', fn: (fn: (s: S) => S) => { state = fn(state); } },
    },
  ];
}

/**
 * Create console IO handler
 */
export function createConsoleHandler(): EffectHandler[] {
  return [
    {
      effect: 'IO',
      operation: 'print',
      implementation: { kind: 'Native', fn: (message: unknown) => console.log(message) },
    },
    {
      effect: 'IO',
      operation: 'read',
      implementation: { kind: 'Native', fn: () => '' }, // Would need readline in real impl
    },
  ];
}

/**
 * Create random handler (using Math.random)
 */
export function createRandomHandler(seed?: number): EffectHandler[] {
  let rng = seed !== undefined ? seededRandom(seed) : Math.random;

  return [
    {
      effect: 'Random',
      operation: 'random',
      implementation: { kind: 'Native', fn: () => rng() },
    },
    {
      effect: 'Random',
      operation: 'randomInt',
      implementation: { 
        kind: 'Native', 
        fn: (min: unknown, max: unknown) => {
          const minN = min as number;
          const maxN = max as number;
          return Math.floor(rng() * (maxN - minN + 1)) + minN;
        }
      },
    },
    {
      effect: 'Random',
      operation: 'randomChoice',
      implementation: { 
        kind: 'Native', 
        fn: (items: unknown) => {
          const arr = items as unknown[];
          return arr[Math.floor(rng() * arr.length)];
        }
      },
    },
    {
      effect: 'Random',
      operation: 'shuffle',
      implementation: { 
        kind: 'Native', 
        fn: (items: unknown) => {
          const arr = [...(items as unknown[])];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [arr[i], arr[j]] = [arr[j]!, arr[i]!];
          }
          return arr;
        }
      },
    },
  ];
}

/**
 * Create seeded random function
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create exception handler
 */
export function createExceptionHandler<E, T>(
  onError: (error: E) => T
): EffectHandler[] {
  return [
    {
      effect: 'Exception',
      operation: 'throw',
      implementation: { 
        kind: 'Native', 
        fn: (error: unknown) => { throw error; }
      },
    },
  ];
}

/**
 * Create logging handler
 */
export function createLoggingHandler(
  sink: (level: string, message: string, context?: unknown) => void
): EffectHandler[] {
  return [
    {
      effect: 'Logging',
      operation: 'log',
      implementation: { 
        kind: 'Native', 
        fn: (level: unknown, message: unknown, context: unknown) => 
          sink(level as string, message as string, context)
      },
    },
    {
      effect: 'Logging',
      operation: 'trace',
      implementation: { kind: 'Native', fn: (msg: unknown) => sink('trace', msg as string) },
    },
    {
      effect: 'Logging',
      operation: 'debug',
      implementation: { kind: 'Native', fn: (msg: unknown) => sink('debug', msg as string) },
    },
    {
      effect: 'Logging',
      operation: 'info',
      implementation: { kind: 'Native', fn: (msg: unknown) => sink('info', msg as string) },
    },
    {
      effect: 'Logging',
      operation: 'warn',
      implementation: { kind: 'Native', fn: (msg: unknown) => sink('warn', msg as string) },
    },
    {
      effect: 'Logging',
      operation: 'error',
      implementation: { kind: 'Native', fn: (msg: unknown, err: unknown) => sink('error', msg as string, err) },
    },
  ];
}
