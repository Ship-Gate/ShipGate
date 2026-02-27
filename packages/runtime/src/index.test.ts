// ============================================================================
// ISL Runtime Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  IslRuntime,
  createRuntime,
  DomainBuilder,
  domain,
  InMemoryStore,
} from './index.js';

describe('IslRuntime', () => {
  it('should create runtime with domain', () => {
    const testDomain = domain('TestDomain', '1.0.0').build();
    const runtime = new IslRuntime(testDomain);

    expect(runtime).toBeDefined();
    expect(runtime.getDomain()).toBe(testDomain);
  });

  it('should create runtime with custom store', () => {
    const testDomain = domain('TestDomain').build();
    const store = new InMemoryStore();
    const runtime = new IslRuntime(testDomain, store);

    expect(runtime.getStore()).toBe(store);
  });

  it('should register behavior handlers', () => {
    const testDomain = domain('TestDomain').build();
    const runtime = new IslRuntime(testDomain);

    const result = runtime.register('greet', async (input, ctx) => {
      return { success: true, value: `Hello!` };
    });

    expect(result).toBe(runtime);
  });

  it('should subscribe to events', () => {
    const testDomain = domain('TestDomain').build();
    const runtime = new IslRuntime(testDomain);

    const unsubscribe = runtime.on('*', () => {});
    expect(typeof unsubscribe).toBe('function');
  });
});

describe('createRuntime', () => {
  it('should create a runtime instance', () => {
    const testDomain = domain('TestDomain').build();
    const runtime = createRuntime(testDomain);

    expect(runtime).toBeInstanceOf(IslRuntime);
  });
});

describe('DomainBuilder', () => {
  it('should create domain with name and version', () => {
    const builder = new DomainBuilder('MyDomain', '2.0.0');
    const result = builder.build();

    expect(result.name).toBe('MyDomain');
    expect(result.version).toBe('2.0.0');
  });

  it('should use default version', () => {
    const builder = new DomainBuilder('MyDomain');
    const result = builder.build();

    expect(result.version).toBe('1.0.0');
  });

  it('should add entities', () => {
    const builder = new DomainBuilder('MyDomain');
    builder.addEntity({
      kind: 'entity',
      name: 'User',
      fields: [],
      invariants: [],
    });
    const result = builder.build();

    expect(result.entities.has('User')).toBe(true);
  });

  it('should add enums', () => {
    const builder = new DomainBuilder('MyDomain');
    builder.addEnum({
      kind: 'enum',
      name: 'Status',
      values: ['ACTIVE', 'INACTIVE'],
    });
    const result = builder.build();

    expect(result.enums.has('Status')).toBe(true);
  });

  it('should add behaviors', () => {
    const builder = new DomainBuilder('MyDomain');
    builder.addBehavior({
      name: 'doSomething',
      input: [],
      output: { success: { name: 'Void' }, errors: [] },
      preconditions: [],
      postconditions: [],
    });
    const result = builder.build();

    expect(result.behaviors.has('doSomething')).toBe(true);
  });

  it('should be chainable', () => {
    const result = new DomainBuilder('MyDomain')
      .addEntity({ kind: 'entity', name: 'User', fields: [], invariants: [] })
      .addEnum({ kind: 'enum', name: 'Status', values: ['A'] })
      .addBehavior({ name: 'test', input: [], output: { success: { name: 'Void' }, errors: [] }, preconditions: [], postconditions: [] })
      .build();

    expect(result.entities.size).toBe(1);
    expect(result.enums.size).toBe(1);
    expect(result.behaviors.size).toBe(1);
  });
});

describe('domain helper', () => {
  it('should create a DomainBuilder', () => {
    const builder = domain('TestDomain');
    expect(builder).toBeInstanceOf(DomainBuilder);
  });

  it('should accept version parameter', () => {
    const result = domain('TestDomain', '3.0.0').build();
    expect(result.version).toBe('3.0.0');
  });
});

describe('InMemoryStore', () => {
  it('should create an empty store', () => {
    const store = new InMemoryStore();
    expect(store).toBeDefined();
  });
});
