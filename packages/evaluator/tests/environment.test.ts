// ============================================================================
// Environment Tests - Scope and EntityStore
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  Scope, 
  InMemoryEntityStore, 
  SnapshotEntityStore,
  createScope,
  createEntityStore,
  createSnapshotStore,
} from '../src/environment.js';

describe('Scope', () => {
  describe('Basic Operations', () => {
    it('should define and get variables', () => {
      const scope = new Scope();
      
      scope.define('x', 10);
      scope.define('name', 'test');
      scope.define('active', true);
      
      expect(scope.get('x')).toBe(10);
      expect(scope.get('name')).toBe('test');
      expect(scope.get('active')).toBe(true);
    });

    it('should check if variable exists', () => {
      const scope = new Scope();
      
      scope.define('x', 10);
      
      expect(scope.has('x')).toBe(true);
      expect(scope.has('y')).toBe(false);
    });

    it('should return undefined for non-existent variables', () => {
      const scope = new Scope();
      
      expect(scope.get('nonexistent')).toBeUndefined();
    });

    it('should set mutable variables', () => {
      const scope = new Scope();
      
      scope.define('x', 10, true); // mutable
      expect(scope.get('x')).toBe(10);
      
      scope.set('x', 20);
      expect(scope.get('x')).toBe(20);
    });

    it('should throw when setting immutable variables', () => {
      const scope = new Scope();
      
      scope.define('x', 10, false); // immutable
      
      expect(() => scope.set('x', 20)).toThrow(/immutable/);
    });

    it('should handle null and undefined values', () => {
      const scope = new Scope();
      
      scope.define('nullVal', null);
      scope.define('undefinedVal', undefined);
      
      expect(scope.get('nullVal')).toBeNull();
      expect(scope.get('undefinedVal')).toBeUndefined();
      expect(scope.has('nullVal')).toBe(true);
      expect(scope.has('undefinedVal')).toBe(true);
    });
  });

  describe('Scope Chain', () => {
    it('should create child scopes', () => {
      const parent = new Scope();
      parent.define('x', 10);
      
      const child = parent.child();
      
      expect(child.get('x')).toBe(10);
    });

    it('should shadow parent variables', () => {
      const parent = new Scope();
      parent.define('x', 10);
      
      const child = parent.child();
      child.define('x', 20);
      
      expect(child.get('x')).toBe(20);
      expect(parent.get('x')).toBe(10);
    });

    it('should check parent scope for existence', () => {
      const parent = new Scope();
      parent.define('x', 10);
      
      const child = parent.child();
      
      expect(child.has('x')).toBe(true);
    });

    it('should support multiple levels of nesting', () => {
      const level0 = new Scope();
      level0.define('a', 1);
      
      const level1 = level0.child();
      level1.define('b', 2);
      
      const level2 = level1.child();
      level2.define('c', 3);
      
      expect(level2.get('a')).toBe(1);
      expect(level2.get('b')).toBe(2);
      expect(level2.get('c')).toBe(3);
    });
  });

  describe('Bindings', () => {
    it('should return all bindings', () => {
      const scope = new Scope();
      
      scope.define('x', 10);
      scope.define('y', 20);
      
      const bindings = scope.bindings();
      
      expect(bindings.size).toBe(2);
      expect(bindings.get('x')?.value).toBe(10);
      expect(bindings.get('y')?.value).toBe(20);
    });

    it('should not include parent bindings', () => {
      const parent = new Scope();
      parent.define('x', 10);
      
      const child = parent.child();
      child.define('y', 20);
      
      const bindings = child.bindings();
      
      expect(bindings.size).toBe(1);
      expect(bindings.has('y')).toBe(true);
      expect(bindings.has('x')).toBe(false);
    });
  });
});

describe('InMemoryEntityStore', () => {
  let store: InMemoryEntityStore;

  beforeEach(() => {
    store = new InMemoryEntityStore();
  });

  describe('Create', () => {
    it('should create entities', () => {
      const user = store.create('User', { name: 'Alice', email: 'alice@example.com' });
      
      expect(user.__entity__).toBe('User');
      expect(user.__id__).toBeDefined();
      expect(user.name).toBe('Alice');
      expect(user.email).toBe('alice@example.com');
    });

    it('should generate unique IDs', () => {
      const user1 = store.create('User', { name: 'Alice' });
      const user2 = store.create('User', { name: 'Bob' });
      
      expect(user1.__id__).not.toBe(user2.__id__);
    });

    it('should use provided ID', () => {
      const user = store.create('User', { id: 'custom-id', name: 'Alice' });
      
      expect(user.__id__).toBe('custom-id');
    });
  });

  describe('Exists', () => {
    it('should check entity existence', () => {
      expect(store.exists('User')).toBe(false);
      
      store.create('User', { name: 'Alice' });
      
      expect(store.exists('User')).toBe(true);
    });

    it('should check existence with criteria', () => {
      store.create('User', { name: 'Alice' });
      store.create('User', { name: 'Bob' });
      
      expect(store.exists('User', { name: 'Alice' })).toBe(true);
      expect(store.exists('User', { name: 'Charlie' })).toBe(false);
    });
  });

  describe('Lookup', () => {
    it('should lookup entity by criteria', () => {
      store.create('User', { name: 'Alice', email: 'alice@example.com' });
      store.create('User', { name: 'Bob', email: 'bob@example.com' });
      
      const alice = store.lookup('User', { name: 'Alice' });
      
      expect(alice?.name).toBe('Alice');
      expect(alice?.email).toBe('alice@example.com');
    });

    it('should return undefined when not found', () => {
      const result = store.lookup('User', { name: 'NonExistent' });
      
      expect(result).toBeUndefined();
    });
  });

  describe('Count', () => {
    it('should count all entities', () => {
      expect(store.count('User')).toBe(0);
      
      store.create('User', { name: 'Alice' });
      store.create('User', { name: 'Bob' });
      
      expect(store.count('User')).toBe(2);
    });

    it('should count entities matching criteria', () => {
      store.create('User', { name: 'Alice', role: 'admin' });
      store.create('User', { name: 'Bob', role: 'user' });
      store.create('User', { name: 'Charlie', role: 'admin' });
      
      expect(store.count('User', { role: 'admin' })).toBe(2);
      expect(store.count('User', { role: 'user' })).toBe(1);
    });
  });

  describe('GetAll', () => {
    it('should get all entities', () => {
      store.create('User', { name: 'Alice' });
      store.create('User', { name: 'Bob' });
      
      const users = store.getAll('User');
      
      expect(users.length).toBe(2);
    });

    it('should return empty array for non-existent entity type', () => {
      const users = store.getAll('NonExistent');
      
      expect(users).toEqual([]);
    });
  });

  describe('Update', () => {
    it('should update entity fields', () => {
      const user = store.create('User', { name: 'Alice' });
      
      store.update('User', user.__id__, { name: 'Alicia' });
      
      const updated = store.lookup('User', { __id__: user.__id__ });
      expect(updated?.name).toBe('Alicia');
    });
  });

  describe('Delete', () => {
    it('should delete entity', () => {
      const user = store.create('User', { name: 'Alice' });
      
      expect(store.count('User')).toBe(1);
      
      store.delete('User', user.__id__);
      
      expect(store.count('User')).toBe(0);
    });
  });

  describe('Snapshot', () => {
    it('should take snapshot', () => {
      store.create('User', { name: 'Alice' });
      store.create('User', { name: 'Bob' });
      
      const snapshot = store.snapshot();
      
      expect(snapshot.entities.get('User')?.size).toBe(2);
      expect(snapshot.timestamp).toBeDefined();
    });

    it('should restore from snapshot', () => {
      store.create('User', { name: 'Alice' });
      
      const snapshot = store.snapshot();
      
      store.create('User', { name: 'Bob' });
      store.create('User', { name: 'Charlie' });
      
      expect(store.count('User')).toBe(3);
      
      store.restore(snapshot);
      
      expect(store.count('User')).toBe(1);
    });
  });
});

describe('SnapshotEntityStore', () => {
  it('should be read-only', () => {
    const baseStore = new InMemoryEntityStore();
    baseStore.create('User', { name: 'Alice' });
    
    const snapshot = baseStore.snapshot();
    const snapshotStore = new SnapshotEntityStore(snapshot);
    
    expect(() => snapshotStore.create('User', { name: 'Bob' }))
      .toThrow(/read-only/);
    expect(() => snapshotStore.update('User', '1', { name: 'Updated' }))
      .toThrow(/read-only/);
    expect(() => snapshotStore.delete('User', '1'))
      .toThrow(/read-only/);
  });

  it('should allow read operations', () => {
    const baseStore = new InMemoryEntityStore();
    baseStore.create('User', { name: 'Alice' });
    baseStore.create('User', { name: 'Bob' });
    
    const snapshot = baseStore.snapshot();
    const snapshotStore = new SnapshotEntityStore(snapshot);
    
    expect(snapshotStore.count('User')).toBe(2);
    expect(snapshotStore.exists('User', { name: 'Alice' })).toBe(true);
    expect(snapshotStore.getAll('User').length).toBe(2);
  });
});

describe('Factory Functions', () => {
  it('should create scope with createScope', () => {
    const scope = createScope();
    
    scope.define('x', 10);
    expect(scope.get('x')).toBe(10);
  });

  it('should create entity store with createEntityStore', () => {
    const store = createEntityStore();
    
    store.create('User', { name: 'Alice' });
    expect(store.count('User')).toBe(1);
  });

  it('should create snapshot store with createSnapshotStore', () => {
    const store = createEntityStore();
    store.create('User', { name: 'Alice' });
    
    const snapshot = store.snapshot();
    const snapshotStore = createSnapshotStore(snapshot);
    
    expect(snapshotStore.count('User')).toBe(1);
  });
});
