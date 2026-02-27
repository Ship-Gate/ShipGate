/**
 * @isl-lang/codegen-core - Sorter Tests
 *
 * Tests for deterministic import and type sorting.
 */

import { describe, it, expect } from 'vitest';
import {
  sortImports,
  sortNamedImports,
  deduplicateImports,
  formatImports,
  classifyImport,
  topologicalSortTypes,
  sortProperties,
} from '../src/sorter.js';
import type { ImportStatement, TypeDeclaration } from '../src/types.js';

// ============================================================================
// Import Sorting Tests
// ============================================================================

describe('sortImports', () => {
  it('should sort imports by group then alphabetically', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: './utils.js', namedImports: [{ name: 'helper' }] },
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: '@isl-lang/runtime', namedImports: [{ name: 'Result' }] },
      { moduleSpecifier: 'lodash', namedImports: [{ name: 'sortBy' }] },
      { moduleSpecifier: '../types.js', namedImports: [{ name: 'User' }] },
      { moduleSpecifier: '@isl-lang/core', namedImports: [{ name: 'Domain' }] },
    ];

    const sorted = sortImports(imports);

    expect(sorted.map((i) => i.moduleSpecifier)).toEqual([
      'lodash',
      'zod',
      '@isl-lang/core',
      '@isl-lang/runtime',
      '../types.js',
      './utils.js',
    ]);
  });

  it('should produce same output for multiple runs', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: 'lodash', namedImports: [{ name: 'sortBy' }] },
      { moduleSpecifier: '@isl-lang/runtime', namedImports: [{ name: 'Result' }] },
    ];

    const result1 = sortImports(imports);
    const result2 = sortImports(imports);
    const result3 = sortImports([...imports].reverse());

    expect(result1).toEqual(result2);
    expect(result1).toEqual(result3);
  });

  it('should sort named imports within each statement', () => {
    const imports: ImportStatement[] = [
      {
        moduleSpecifier: 'zod',
        namedImports: [{ name: 'z' }, { name: 'ZodError' }, { name: 'ZodSchema' }],
      },
    ];

    const sorted = sortImports(imports);

    expect(sorted[0].namedImports?.map((n) => n.name)).toEqual([
      'z',
      'ZodError',
      'ZodSchema',
    ]);
  });

  it('should handle type-only imports', () => {
    const imports: ImportStatement[] = [
      {
        moduleSpecifier: 'zod',
        namedImports: [
          { name: 'z' },
          { name: 'ZodSchema', isTypeOnly: true },
        ],
      },
    ];

    const sorted = sortImports(imports);

    // Type-only imports come first
    expect(sorted[0].namedImports).toEqual([
      { name: 'ZodSchema', isTypeOnly: true },
      { name: 'z' },
    ]);
  });
});

describe('classifyImport', () => {
  it('should classify external packages', () => {
    expect(classifyImport('zod')).toBe('external');
    expect(classifyImport('lodash')).toBe('external');
    expect(classifyImport('@types/node')).toBe('external');
  });

  it('should classify ISL packages', () => {
    expect(classifyImport('@isl-lang/runtime')).toBe('isl');
    expect(classifyImport('@isl-lang/core')).toBe('isl');
  });

  it('should classify sibling imports', () => {
    expect(classifyImport('./types.js')).toBe('sibling');
    expect(classifyImport('./utils/helpers.js')).toBe('sibling');
  });

  it('should classify parent imports', () => {
    expect(classifyImport('../types.js')).toBe('parent');
    expect(classifyImport('../../shared/utils.js')).toBe('parent');
  });
});

describe('deduplicateImports', () => {
  it('should merge imports from same module', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: 'zod', namedImports: [{ name: 'ZodError' }] },
    ];

    const deduped = deduplicateImports(imports);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].namedImports?.map((n) => n.name).sort()).toEqual([
      'ZodError',
      'z',
    ]);
  });

  it('should merge default and named imports', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'lodash', defaultImport: '_' },
      { moduleSpecifier: 'lodash', namedImports: [{ name: 'sortBy' }] },
    ];

    const deduped = deduplicateImports(imports);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].defaultImport).toBe('_');
    expect(deduped[0].namedImports?.[0].name).toBe('sortBy');
  });
});

describe('formatImports', () => {
  it('should format imports with correct syntax', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: './types.js', namedImports: [{ name: 'User' }], isTypeOnly: true },
    ];

    const sorted = sortImports(imports);
    const formatted = formatImports(sorted, { singleQuote: true, semi: true });

    expect(formatted).toContain("import { z } from 'zod';");
    expect(formatted).toContain("import type { User } from './types.js';");
  });

  it('should add blank lines between groups', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: './types.js', namedImports: [{ name: 'User' }] },
    ];

    const sorted = sortImports(imports);
    const formatted = formatImports(sorted, { singleQuote: true, semi: true });

    const lines = formatted.split('\n');
    // Should have blank line between external and sibling
    expect(lines).toContain('');
  });
});

// ============================================================================
// Type Sorting Tests
// ============================================================================

describe('topologicalSortTypes', () => {
  it('should sort types by dependencies', () => {
    const types: TypeDeclaration[] = [
      { name: 'UserResponse', dependencies: ['User', 'Error'], declarationOrder: 2, kind: 'interface' },
      { name: 'User', dependencies: ['UUID'], declarationOrder: 1, kind: 'interface' },
      { name: 'UUID', dependencies: [], declarationOrder: 0, kind: 'alias' },
      { name: 'Error', dependencies: [], declarationOrder: 3, kind: 'interface' },
    ];

    const sorted = topologicalSortTypes(types, { groupByKind: false });

    const names = sorted.map((t) => t.name);
    
    // UUID and Error have no deps, should come first (alphabetically: Error, UUID)
    // User depends on UUID
    // UserResponse depends on User and Error
    expect(names.indexOf('UUID')).toBeLessThan(names.indexOf('User'));
    expect(names.indexOf('Error')).toBeLessThan(names.indexOf('UserResponse'));
    expect(names.indexOf('User')).toBeLessThan(names.indexOf('UserResponse'));
  });

  it('should group by kind when enabled', () => {
    const types: TypeDeclaration[] = [
      { name: 'UserStatus', dependencies: [], declarationOrder: 0, kind: 'enum' },
      { name: 'User', dependencies: ['UserStatus'], declarationOrder: 1, kind: 'interface' },
      { name: 'UUID', dependencies: [], declarationOrder: 2, kind: 'utility' },
    ];

    const sorted = topologicalSortTypes(types, { groupByKind: true });

    const names = sorted.map((t) => t.name);
    
    // Order should be: utility, enum, interface
    expect(names).toEqual(['UUID', 'UserStatus', 'User']);
  });

  it('should produce stable output for equal-priority items', () => {
    const types: TypeDeclaration[] = [
      { name: 'Zebra', dependencies: [], declarationOrder: 2, kind: 'interface' },
      { name: 'Apple', dependencies: [], declarationOrder: 1, kind: 'interface' },
      { name: 'Mango', dependencies: [], declarationOrder: 0, kind: 'interface' },
    ];

    const result1 = topologicalSortTypes(types, { tieBreaker: 'alphabetical' });
    const result2 = topologicalSortTypes([...types].reverse(), { tieBreaker: 'alphabetical' });

    expect(result1.map((t) => t.name)).toEqual(result2.map((t) => t.name));
    expect(result1.map((t) => t.name)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('should use declaration order when specified', () => {
    const types: TypeDeclaration[] = [
      { name: 'Zebra', dependencies: [], declarationOrder: 0, kind: 'interface' },
      { name: 'Apple', dependencies: [], declarationOrder: 1, kind: 'interface' },
      { name: 'Mango', dependencies: [], declarationOrder: 2, kind: 'interface' },
    ];

    const sorted = topologicalSortTypes(types, {
      tieBreaker: 'declaration-order',
      groupByKind: false,
    });

    expect(sorted.map((t) => t.name)).toEqual(['Zebra', 'Apple', 'Mango']);
  });

  it('should handle circular dependencies gracefully', () => {
    const types: TypeDeclaration[] = [
      { name: 'A', dependencies: ['B'], declarationOrder: 0, kind: 'interface' },
      { name: 'B', dependencies: ['A'], declarationOrder: 1, kind: 'interface' },
    ];

    // Should not throw
    const sorted = topologicalSortTypes(types, { groupByKind: false });
    
    expect(sorted).toHaveLength(2);
    expect(sorted.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });
});

// ============================================================================
// Property Sorting Tests
// ============================================================================

describe('sortProperties', () => {
  it('should put id fields first', () => {
    const props = [
      { name: 'email', optional: false },
      { name: 'id', optional: false },
      { name: 'name', optional: false },
    ];

    const sorted = sortProperties(props);

    expect(sorted[0].name).toBe('id');
  });

  it('should put required fields before optional', () => {
    const props = [
      { name: 'nickname', optional: true },
      { name: 'email', optional: false },
      { name: 'bio', optional: true },
    ];

    const sorted = sortProperties(props);

    expect(sorted[0].name).toBe('email');
    expect(sorted.slice(1).every((p) => p.optional)).toBe(true);
  });

  it('should sort alphabetically within groups', () => {
    const props = [
      { name: 'zebra', optional: false },
      { name: 'apple', optional: false },
      { name: 'mango', optional: false },
    ];

    const sorted = sortProperties(props);

    expect(sorted.map((p) => p.name)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should respect custom order', () => {
    const props = [
      { name: 'email', optional: false },
      { name: 'id', optional: false },
      { name: 'created_at', optional: false },
    ];

    const sorted = sortProperties(props, {
      customOrder: ['id', 'created_at', 'email'],
    });

    expect(sorted.map((p) => p.name)).toEqual(['id', 'created_at', 'email']);
  });
});
