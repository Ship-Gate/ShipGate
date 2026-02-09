// ============================================================================
// ISL Effect System Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  effectAlgebra,
  createScope,
  createContext,
  IOEffect,
  StateEffect,
  ExceptionEffect,
  AsyncEffect,
  ResourceEffect,
  RandomEffect,
  TimeEffect,
  LoggingEffect,
  BUILTIN_EFFECTS,
  createStateHandler,
  createConsoleHandler,
  createRandomHandler,
  createExceptionHandler,
  createLoggingHandler,
} from './index.js';

describe('effectAlgebra', () => {
  it('should be defined', () => {
    expect(effectAlgebra).toBeDefined();
  });
});

describe('createScope', () => {
  it('should create a new scope', () => {
    const scope = createScope();
    expect(scope).toBeDefined();
    expect(scope.id).toBeDefined();
  });

  it('should create a child scope with parent', () => {
    const parent = createScope();
    const child = createScope(parent);
    expect(child.parent).toBe(parent);
  });
});

describe('createContext', () => {
  it('should create a new context', () => {
    const ctx = createContext();
    expect(ctx).toBeDefined();
  });
});

describe('Built-in Effects', () => {
  it('should have IOEffect defined', () => {
    expect(IOEffect).toBeDefined();
    expect(IOEffect.name).toBe('IO');
  });

  it('should have StateEffect defined', () => {
    expect(StateEffect).toBeDefined();
    expect(StateEffect.name).toBe('State');
  });

  it('should have ExceptionEffect defined', () => {
    expect(ExceptionEffect).toBeDefined();
    expect(ExceptionEffect.name).toBe('Exception');
  });

  it('should have AsyncEffect defined', () => {
    expect(AsyncEffect).toBeDefined();
    expect(AsyncEffect.name).toBe('Async');
  });

  it('should have ResourceEffect defined', () => {
    expect(ResourceEffect).toBeDefined();
    expect(ResourceEffect.name).toBe('Resource');
  });

  it('should have RandomEffect defined', () => {
    expect(RandomEffect).toBeDefined();
    expect(RandomEffect.name).toBe('Random');
  });

  it('should have TimeEffect defined', () => {
    expect(TimeEffect).toBeDefined();
    expect(TimeEffect.name).toBe('Time');
  });

  it('should have LoggingEffect defined', () => {
    expect(LoggingEffect).toBeDefined();
    expect(LoggingEffect.name).toBe('Logging');
  });

  it('should have all builtin effects in BUILTIN_EFFECTS', () => {
    expect(BUILTIN_EFFECTS).toBeDefined();
    expect(Array.isArray(BUILTIN_EFFECTS)).toBe(true);
    expect(BUILTIN_EFFECTS.length).toBeGreaterThan(0);
  });
});

describe('Effect Handlers', () => {
  it('should create state handler', () => {
    const handler = createStateHandler({ count: 0 });
    expect(handler).toBeDefined();
  });

  it('should create console handler', () => {
    const handler = createConsoleHandler();
    expect(handler).toBeDefined();
  });

  it('should create random handler', () => {
    const handler = createRandomHandler();
    expect(handler).toBeDefined();
  });

  it('should create exception handler', () => {
    const handler = createExceptionHandler((e) => console.error(e));
    expect(handler).toBeDefined();
  });

  it('should create logging handler', () => {
    const handler = createLoggingHandler((level, msg) => console.log(`[${level}] ${msg}`));
    expect(handler).toBeDefined();
  });
});
