/**
 * Determinism Tests for codegen-types
 *
 * These tests verify that the deterministic generator produces
 * stable, reproducible output across multiple runs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDeterministicTypeScript,
  DeterministicTypeScriptGenerator,
} from '../src/deterministic-generator.js';

import type {
  DomainDeclaration,
  EntityDeclaration,
  EnumDeclaration,
  BehaviorDeclaration,
  TypeExpression,
  FieldDeclaration,
} from '@isl-lang/isl-core';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSpan() {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

function createIdentifier(name: string) {
  return { kind: 'Identifier' as const, name, span: createSpan() };
}

function createStringLiteral(value: string) {
  return { kind: 'StringLiteral' as const, value, span: createSpan() };
}

function createSimpleType(name: string): TypeExpression {
  return { kind: 'SimpleType' as const, name: createIdentifier(name), span: createSpan() };
}

function createField(
  name: string,
  type: TypeExpression,
  options: { optional?: boolean; annotations?: string[] } = {}
): FieldDeclaration {
  return {
    kind: 'FieldDeclaration',
    name: createIdentifier(name),
    type,
    optional: options.optional ?? false,
    annotations: (options.annotations ?? []).map((a) => ({
      kind: 'Annotation' as const,
      name: createIdentifier(a),
      span: createSpan(),
    })),
    constraints: [],
    span: createSpan(),
  };
}

function createUserEntity(): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: createIdentifier('User'),
    fields: [
      createField('id', createSimpleType('UUID'), { annotations: ['immutable', 'unique'] }),
      createField('email', createSimpleType('String'), { annotations: ['unique'] }),
      createField('name', createSimpleType('String')),
      createField('age', createSimpleType('Int'), { optional: true }),
      createField('createdAt', createSimpleType('Timestamp'), { annotations: ['immutable'] }),
    ],
    span: createSpan(),
  };
}

function createStatusEnum(): EnumDeclaration {
  return {
    kind: 'EnumDeclaration',
    name: createIdentifier('UserStatus'),
    variants: [
      createIdentifier('ACTIVE'),
      createIdentifier('INACTIVE'),
      createIdentifier('SUSPENDED'),
    ],
    span: createSpan(),
  };
}

function createLoginBehavior(): BehaviorDeclaration {
  return {
    kind: 'BehaviorDeclaration',
    name: createIdentifier('Login'),
    description: createStringLiteral('Authenticate user'),
    input: {
      kind: 'InputBlock',
      fields: [
        createField('email', createSimpleType('String')),
        createField('password', createSimpleType('String'), { annotations: ['sensitive'] }),
      ],
      span: createSpan(),
    },
    output: {
      kind: 'OutputBlock',
      success: createSimpleType('User'),
      errors: [
        {
          kind: 'ErrorDeclaration',
          name: createIdentifier('INVALID_CREDENTIALS'),
          when: createStringLiteral('Invalid credentials'),
          retriable: true,
          span: createSpan(),
        },
        {
          kind: 'ErrorDeclaration',
          name: createIdentifier('ACCOUNT_LOCKED'),
          when: createStringLiteral('Account locked'),
          retriable: false,
          span: createSpan(),
        },
      ],
      span: createSpan(),
    },
    span: createSpan(),
  };
}

function createTestDomain(): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: createIdentifier('TestDomain'),
    version: createStringLiteral('1.0.0'),
    imports: [],
    entities: [createUserEntity()],
    types: [],
    enums: [createStatusEnum()],
    behaviors: [createLoginBehavior()],
    invariants: [],
    span: createSpan(),
  };
}

// ============================================================================
// Determinism Tests
// ============================================================================

describe('DeterministicTypeScriptGenerator', () => {
  let domain: DomainDeclaration;

  beforeEach(() => {
    domain = createTestDomain();
  });

  describe('output stability', () => {
    it('should produce identical output on multiple runs', () => {
      const results: string[] = [];

      // Run 10 times
      for (let i = 0; i < 10; i++) {
        const output = generateDeterministicTypeScript(domain, {
          sourcePath: 'test.isl',
          generatorVersion: '1.0.0',
        });
        results.push(output);
      }

      // All outputs should be identical
      for (const result of results) {
        expect(result).toBe(results[0]);
      }
    });

    it('should produce identical output regardless of entity order in input', () => {
      // Create domain with entities in different orders
      const domain1 = createTestDomain();
      domain1.entities = [
        createUserEntity(),
        { ...createUserEntity(), name: createIdentifier('Account') },
        { ...createUserEntity(), name: createIdentifier('Session') },
      ];

      const domain2 = createTestDomain();
      domain2.entities = [
        { ...createUserEntity(), name: createIdentifier('Session') },
        createUserEntity(),
        { ...createUserEntity(), name: createIdentifier('Account') },
      ];

      const output1 = generateDeterministicTypeScript(domain1);
      const output2 = generateDeterministicTypeScript(domain2);

      // Output should be identical (entities sorted alphabetically)
      expect(output1).toBe(output2);
    });

    it('should produce identical output regardless of field order in input', () => {
      const entity1: EntityDeclaration = {
        kind: 'EntityDeclaration',
        name: createIdentifier('User'),
        fields: [
          createField('name', createSimpleType('String')),
          createField('email', createSimpleType('String')),
          createField('id', createSimpleType('UUID')),
        ],
        span: createSpan(),
      };

      const entity2: EntityDeclaration = {
        kind: 'EntityDeclaration',
        name: createIdentifier('User'),
        fields: [
          createField('id', createSimpleType('UUID')),
          createField('email', createSimpleType('String')),
          createField('name', createSimpleType('String')),
        ],
        span: createSpan(),
      };

      const domain1 = createTestDomain();
      domain1.entities = [entity1];
      domain1.enums = [];
      domain1.behaviors = [];

      const domain2 = createTestDomain();
      domain2.entities = [entity2];
      domain2.enums = [];
      domain2.behaviors = [];

      const output1 = generateDeterministicTypeScript(domain1);
      const output2 = generateDeterministicTypeScript(domain2);

      expect(output1).toBe(output2);
    });

    it('should produce identical output regardless of enum order', () => {
      const domain1 = createTestDomain();
      domain1.enums = [
        { ...createStatusEnum(), name: createIdentifier('Zebra') },
        { ...createStatusEnum(), name: createIdentifier('Apple') },
        { ...createStatusEnum(), name: createIdentifier('Mango') },
      ];

      const domain2 = createTestDomain();
      domain2.enums = [
        { ...createStatusEnum(), name: createIdentifier('Apple') },
        { ...createStatusEnum(), name: createIdentifier('Mango') },
        { ...createStatusEnum(), name: createIdentifier('Zebra') },
      ];

      const output1 = generateDeterministicTypeScript(domain1);
      const output2 = generateDeterministicTypeScript(domain2);

      expect(output1).toBe(output2);
    });
  });

  describe('no timestamps', () => {
    it('should not include timestamps in output', () => {
      const output = generateDeterministicTypeScript(domain);

      // Should not contain ISO date patterns
      expect(output).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Should not contain "Generated at:"
      expect(output).not.toContain('Generated at:');
    });
  });

  describe('content hash', () => {
    it('should include content hash when enabled', () => {
      const output = generateDeterministicTypeScript(domain, {
        includeHash: true,
      });

      expect(output).toMatch(/Hash: [a-f0-9]{8}/);
    });

    it('should produce same hash for same input', () => {
      const islSource = 'domain Test version "1.0" { entity User { id: UUID } }';

      const output1 = generateDeterministicTypeScript(domain, {}, islSource);
      const output2 = generateDeterministicTypeScript(domain, {}, islSource);

      // Extract hashes
      const hashMatch1 = output1.match(/Hash: ([a-f0-9]+)/);
      const hashMatch2 = output2.match(/Hash: ([a-f0-9]+)/);

      expect(hashMatch1?.[1]).toBe(hashMatch2?.[1]);
    });

    it('should produce different hash for different input', () => {
      const output1 = generateDeterministicTypeScript(domain, {}, 'source1');
      const output2 = generateDeterministicTypeScript(domain, {}, 'source2');

      const hashMatch1 = output1.match(/Hash: ([a-f0-9]+)/);
      const hashMatch2 = output2.match(/Hash: ([a-f0-9]+)/);

      expect(hashMatch1?.[1]).not.toBe(hashMatch2?.[1]);
    });
  });

  describe('sorted output', () => {
    it('should sort error codes alphabetically', () => {
      const output = generateDeterministicTypeScript(domain);

      // Error codes should be alphabetically sorted
      expect(output).toContain("'ACCOUNT_LOCKED' | 'INVALID_CREDENTIALS'");
    });

    it('should sort annotations alphabetically in comments', () => {
      const entity: EntityDeclaration = {
        kind: 'EntityDeclaration',
        name: createIdentifier('Test'),
        fields: [
          createField('field', createSimpleType('String'), {
            annotations: ['unique', 'immutable', 'indexed'],
          }),
        ],
        span: createSpan(),
      };

      const testDomain = createTestDomain();
      testDomain.entities = [entity];
      testDomain.enums = [];
      testDomain.behaviors = [];

      const output = generateDeterministicTypeScript(testDomain);

      // Annotations should be sorted alphabetically
      expect(output).toContain('immutable, indexed, unique');
    });
  });

  describe('regeneration diff', () => {
    it('should produce zero diff on regeneration', () => {
      const output1 = generateDeterministicTypeScript(domain, {
        sourcePath: 'domain/test.isl',
        generatorVersion: '1.0.0',
      });

      const output2 = generateDeterministicTypeScript(domain, {
        sourcePath: 'domain/test.isl',
        generatorVersion: '1.0.0',
      });

      // Line-by-line comparison
      const lines1 = output1.split('\n');
      const lines2 = output2.split('\n');

      expect(lines1.length).toBe(lines2.length);

      for (let i = 0; i < lines1.length; i++) {
        expect(lines1[i]).toBe(lines2[i]);
      }
    });
  });
});

// ============================================================================
// Golden Snapshot Tests
// ============================================================================

describe('Golden Snapshots', () => {
  it('should match expected output structure', () => {
    const domain = createTestDomain();
    const output = generateDeterministicTypeScript(domain, {
      sourcePath: 'test.isl',
      generatorVersion: '1.0.0',
      includeHash: false,
    });

    // Verify structure
    expect(output).toContain('@generated - DO NOT EDIT');
    expect(output).toContain('Source: test.isl');
    expect(output).toContain('@isl-lang/codegen-types@1.0.0');

    // Verify sections appear in correct order
    const utilityTypesIndex = output.indexOf('Utility Types');
    const enumsIndex = output.indexOf('Enums');
    const entitiesIndex = output.indexOf('Entities');
    const behaviorIndex = output.indexOf('Behavior: Login');

    expect(utilityTypesIndex).toBeLessThan(enumsIndex);
    expect(enumsIndex).toBeLessThan(entitiesIndex);
    expect(entitiesIndex).toBeLessThan(behaviorIndex);
  });
});
