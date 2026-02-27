/**
 * @isl-lang/codegen-core - Golden Snapshot Tests
 *
 * These tests verify that code generation produces deterministic,
 * stable output that matches our golden snapshots.
 *
 * If these tests fail after a codegen change:
 * 1. Review the diff carefully
 * 2. If intentional, update snapshots: pnpm test:snapshot
 * 3. Document the change in CHANGELOG
 */

import { describe, it, expect } from 'vitest';
import {
  sortImports,
  formatImports,
  topologicalSortTypes,
  sortProperties,
  createPrinter,
  generateHeader,
  hashContent,
} from '../src/index.js';
import type { ImportStatement, TypeDeclaration } from '../src/types.js';

// ============================================================================
// Golden Snapshot Test Utilities
// ============================================================================

/**
 * Compare output with snapshot, accounting for whitespace normalization
 */
function assertMatchesSnapshot(actual: string, expected: string): void {
  // Normalize line endings and trailing whitespace
  const normalizeOutput = (s: string) =>
    s
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();

  expect(normalizeOutput(actual)).toBe(normalizeOutput(expected));
}

// ============================================================================
// Import Sorting Golden Tests
// ============================================================================

describe('Import Sorting - Golden Tests', () => {
  it('should match snapshot for complex import set', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: './validation.js', namedImports: [{ name: 'validateUser' }] },
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }, { name: 'ZodError' }, { name: 'ZodSchema' }] },
      { moduleSpecifier: '@isl-lang/runtime', namedImports: [{ name: 'Result' }, { name: 'Effect' }] },
      { moduleSpecifier: '../types/user.js', namedImports: [{ name: 'User', isTypeOnly: true }] },
      { moduleSpecifier: 'lodash', namedImports: [{ name: 'sortBy' }, { name: 'groupBy' }] },
      { moduleSpecifier: '@isl-lang/core', namedImports: [{ name: 'Domain' }, { name: 'Entity' }] },
      { moduleSpecifier: './types.js', namedImports: [{ name: 'Config' }], isTypeOnly: true },
    ];

    const sorted = sortImports(imports);
    const formatted = formatImports(sorted, { singleQuote: true, semi: true });

    const expectedSnapshot = `import { groupBy, sortBy } from 'lodash';
import { z, ZodError, ZodSchema } from 'zod';

import { Domain, Entity } from '@isl-lang/core';
import { Effect, Result } from '@isl-lang/runtime';

import { type User } from '../types/user.js';

import type { Config } from './types.js';
import { validateUser } from './validation.js';`;

    assertMatchesSnapshot(formatted, expectedSnapshot);
  });

  it('should produce stable output regardless of input order', () => {
    const imports: ImportStatement[] = [
      { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
      { moduleSpecifier: 'lodash', namedImports: [{ name: 'sortBy' }] },
      { moduleSpecifier: '@isl-lang/core', namedImports: [{ name: 'Domain' }] },
    ];

    // Try multiple orderings
    const orderings = [
      imports,
      [...imports].reverse(),
      [imports[1], imports[0], imports[2]],
      [imports[2], imports[1], imports[0]],
    ];

    const results = orderings.map((ordering) =>
      formatImports(sortImports(ordering), { singleQuote: true, semi: true })
    );

    // All should produce identical output
    for (const result of results) {
      expect(result).toBe(results[0]);
    }
  });
});

// ============================================================================
// Type Sorting Golden Tests
// ============================================================================

describe('Type Sorting - Golden Tests', () => {
  it('should match snapshot for auth domain types', () => {
    const types: TypeDeclaration[] = [
      { name: 'LoginResult', dependencies: ['User', 'LoginError'], declarationOrder: 5, kind: 'interface' },
      { name: 'User', dependencies: ['UUID', 'UserStatus'], declarationOrder: 2, kind: 'interface' },
      { name: 'UUID', dependencies: [], declarationOrder: 0, kind: 'utility' },
      { name: 'UserStatus', dependencies: [], declarationOrder: 1, kind: 'enum' },
      { name: 'LoginError', dependencies: [], declarationOrder: 4, kind: 'interface' },
      { name: 'LoginInput', dependencies: [], declarationOrder: 3, kind: 'interface' },
    ];

    const sorted = topologicalSortTypes(types, {
      groupByKind: true,
      tieBreaker: 'alphabetical',
    });

    const expectedOrder = [
      'UUID',           // utility
      'UserStatus',     // enum
      'LoginError',     // interface, no deps
      'LoginInput',     // interface, no deps
      'User',           // interface, depends on UUID, UserStatus
      'LoginResult',    // interface, depends on User, LoginError
    ];

    expect(sorted.map((t) => t.name)).toEqual(expectedOrder);
  });
});

// ============================================================================
// Code Printer Golden Tests
// ============================================================================

describe('Code Printer - Golden Tests', () => {
  it('should match snapshot for interface generation', () => {
    const printer = createPrinter();

    printer.writeLine('/** Entity: User */');
    printer.writeLine('export interface User {');
    printer.indent();
    printer.writeLine('readonly id: UUID;');
    printer.writeLine('email: string;');
    printer.writeLine('name: string;');
    printer.writeLine('status: UserStatus;');
    printer.writeLine('readonly createdAt: Timestamp;');
    printer.writeLine('updatedAt?: Timestamp;');
    printer.dedent();
    printer.writeLine('}');

    const expected = `/** Entity: User */
export interface User {
  readonly id: UUID;
  email: string;
  name: string;
  status: UserStatus;
  readonly createdAt: Timestamp;
  updatedAt?: Timestamp;
}
`;

    expect(printer.toString()).toBe(expected);
  });

  it('should match snapshot for nested blocks', () => {
    const printer = createPrinter();

    printer.writeBlock('export const SchemaRegistry = {', '} as const;', () => {
      printer.writeLine('User: UserSchema,');
      printer.writeLine('UserStatus: UserStatusSchema,');
    });
    printer.blankLine();
    printer.writeBlock('export function validate<K extends keyof typeof SchemaRegistry>(', '): z.infer<(typeof SchemaRegistry)[K]> {', () => {
      printer.writeLine('schemaName: K,');
      printer.writeLine('data: unknown');
    });
    printer.indent();
    printer.writeLine('return SchemaRegistry[schemaName].parse(data);');
    printer.dedent();
    printer.writeLine('}');

    const output = printer.toString();

    expect(output).toContain('export const SchemaRegistry = {');
    expect(output).toContain('  User: UserSchema,');
    expect(output).toContain('} as const;');
  });
});

// ============================================================================
// Header Generation Golden Tests
// ============================================================================

describe('Header Generation - Golden Tests', () => {
  it('should match snapshot for standard header', () => {
    const header = generateHeader({
      generator: '@isl-lang/codegen-types',
      version: '1.0.0',
      sourcePath: 'examples/auth.isl',
      includeHash: true,
      metadata: { hash: 'a1b2c3d4' },
    });

    const expected = `/**
 * @generated - DO NOT EDIT
 * Source: examples/auth.isl
 * Generator: @isl-lang/codegen-types@1.0.0
 * Hash: a1b2c3d4
 */`;

    assertMatchesSnapshot(header, expected);
  });
});

// ============================================================================
// Content Hash Golden Tests
// ============================================================================

describe('Content Hash - Golden Tests', () => {
  it('should produce expected hash for test content', () => {
    // These hashes should remain stable across runs
    const testCases = [
      { input: 'export interface User {}', expectedHash: expect.any(String) },
      { input: 'domain Auth version "1.0"', expectedHash: expect.any(String) },
    ];

    for (const { input } of testCases) {
      const hash1 = hashContent(input);
      const hash2 = hashContent(input);

      // Same input = same hash
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
    }
  });
});

// ============================================================================
// Full Pipeline Golden Tests
// ============================================================================

describe('Full Generation Pipeline - Golden Tests', () => {
  it('should produce deterministic full output', () => {
    // Simulate a complete generation pipeline
    const generateOutput = () => {
      const printer = createPrinter();

      // Header
      printer.writeLine(generateHeader({
        generator: '@isl-lang/codegen-test',
        version: '1.0.0',
        sourcePath: 'test.isl',
      }));
      printer.blankLine();

      // Imports
      const imports: ImportStatement[] = [
        { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
        { moduleSpecifier: './types.js', namedImports: [{ name: 'User' }], isTypeOnly: true },
      ];
      printer.writeLine(formatImports(sortImports(imports), { singleQuote: true, semi: true }));
      printer.blankLine();

      // Types
      const properties = [
        { name: 'email', optional: false },
        { name: 'id', optional: false },
        { name: 'name', optional: true },
      ];
      const sortedProps = sortProperties(properties);

      printer.writeBlock('export interface User {', '}', () => {
        for (const prop of sortedProps) {
          printer.writeLine(`${prop.name}${prop.optional ? '?' : ''}: string;`);
        }
      });

      return printer.toString();
    };

    // Run multiple times
    const results = Array(5).fill(null).map(() => generateOutput());

    // All should be identical
    for (const result of results) {
      expect(result).toBe(results[0]);
    }

    // Verify structure
    expect(results[0]).toContain('@generated');
    expect(results[0]).toContain("import { z } from 'zod';");
    expect(results[0]).toContain('export interface User {');
    expect(results[0]).toContain('  id: string;'); // id should be first due to sorting
  });
});
