/**
 * Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Generator,
  createGenerator,
  type GeneratedFile,
  type DomainDeclaration,
  type EntityDeclaration,
  type BehaviorDeclaration,
} from '../src/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockDomain(): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: { kind: 'Identifier', name: 'TestDomain', span: mockSpan() },
    imports: [],
    entities: [
      createMockEntity('User'),
      createMockEntity('Order'),
    ],
    types: [],
    enums: [
      {
        kind: 'EnumDeclaration',
        name: { kind: 'Identifier', name: 'Status', span: mockSpan() },
        variants: [
          { kind: 'Identifier', name: 'Active', span: mockSpan() },
          { kind: 'Identifier', name: 'Inactive', span: mockSpan() },
        ],
        span: mockSpan(),
      },
    ],
    behaviors: [
      createMockBehavior('CreateUser'),
      createMockBehavior('UpdateUser'),
    ],
    invariants: [],
    span: mockSpan(),
  } as DomainDeclaration;
}

function createMockEntity(name: string): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: { kind: 'Identifier', name, span: mockSpan() },
    fields: [
      {
        kind: 'FieldDeclaration',
        name: { kind: 'Identifier', name: 'id', span: mockSpan() },
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'UUID', span: mockSpan() }, span: mockSpan() },
        optional: false,
        annotations: [],
        constraints: [],
        span: mockSpan(),
      },
      {
        kind: 'FieldDeclaration',
        name: { kind: 'Identifier', name: 'name', span: mockSpan() },
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String', span: mockSpan() }, span: mockSpan() },
        optional: false,
        annotations: [],
        constraints: [],
        span: mockSpan(),
      },
    ],
    span: mockSpan(),
  } as EntityDeclaration;
}

function createMockBehavior(name: string): BehaviorDeclaration {
  return {
    kind: 'BehaviorDeclaration',
    name: { kind: 'Identifier', name, span: mockSpan() },
    description: { kind: 'StringLiteral', value: `${name} behavior`, span: mockSpan() },
    input: {
      kind: 'InputBlock',
      fields: [
        {
          kind: 'FieldDeclaration',
          name: { kind: 'Identifier', name: 'data', span: mockSpan() },
          type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String', span: mockSpan() }, span: mockSpan() },
          optional: false,
          annotations: [],
          constraints: [],
          span: mockSpan(),
        },
      ],
      span: mockSpan(),
    },
    output: {
      kind: 'OutputBlock',
      success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'User', span: mockSpan() }, span: mockSpan() },
      errors: [
        {
          kind: 'ErrorDeclaration',
          name: { kind: 'Identifier', name: 'NotFound', span: mockSpan() },
          retriable: false,
          span: mockSpan(),
        },
      ],
      span: mockSpan(),
    },
    span: mockSpan(),
  } as BehaviorDeclaration;
}

function mockSpan() {
  return { start: 0, end: 0, line: 1, column: 1 };
}

// ============================================================================
// Generator Tests
// ============================================================================

describe('Generator', () => {
  describe('basic generation', () => {
    it('should generate files from domain', async () => {
      class TestGenerator extends Generator {
        readonly name = 'test-generator';

        protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
          return [{
            path: `${entity.name.name}.ts`,
            content: `// Entity: ${entity.name.name}`,
          }];
        }
      }

      const generator = new TestGenerator();
      const result = await generator.generate(createMockDomain());

      expect(result.generator).toBe('test-generator');
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path === 'User.ts')).toBe(true);
      expect(result.files.some(f => f.path === 'Order.ts')).toBe(true);
    });

    it('should process behaviors', async () => {
      class TestGenerator extends Generator {
        readonly name = 'test-generator';

        protected visitBehavior(behavior: BehaviorDeclaration): GeneratedFile[] {
          return [{
            path: `${behavior.name.name}.handler.ts`,
            content: `// Handler: ${behavior.name.name}`,
          }];
        }
      }

      const generator = new TestGenerator();
      const result = await generator.generate(createMockDomain());

      expect(result.files.some(f => f.path === 'CreateUser.handler.ts')).toBe(true);
      expect(result.files.some(f => f.path === 'UpdateUser.handler.ts')).toBe(true);
    });

    it('should include metadata', async () => {
      class TestGenerator extends Generator {
        readonly name = 'test-generator';
        version = '2.0.0';
        targetLanguages = ['typescript'];
      }

      const generator = new TestGenerator();
      const result = await generator.generate(createMockDomain());

      expect(result.metadata.generatorName).toBe('test-generator');
      expect(result.metadata.generatorVersion).toBe('2.0.0');
      expect(result.metadata.targetLanguages).toContain('typescript');
    });
  });

  describe('createGenerator factory', () => {
    it('should create generator from config', async () => {
      const generator = createGenerator({
        name: 'factory-generator',
        version: '1.0.0',
        templates: {
          entity: '// Entity: {{entity.name.name}}',
        },
        visitEntity: (entity, ctx) => [{
          path: `${entity.name.name}.ts`,
          content: `// Entity: ${entity.name.name}`,
        }],
      });

      expect(generator.name).toBe('factory-generator');

      const result = await generator.generate(createMockDomain());
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should support custom helpers', async () => {
      const generator = createGenerator({
        name: 'helper-generator',
        helpers: {
          shout: (s: unknown) => String(s).toUpperCase(),
        },
        visitEntity: (entity) => [{
          path: `${entity.name.name}.ts`,
          content: `// ${entity.name.name}`,
        }],
      });

      const result = await generator.generate(createMockDomain());
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle hooks', () => {
    it('should call beforeEntities and afterEntities', async () => {
      const calls: string[] = [];

      class TestGenerator extends Generator {
        readonly name = 'lifecycle-generator';

        protected beforeEntities(): GeneratedFile[] {
          calls.push('beforeEntities');
          return [{ path: 'before.ts', content: '// before' }];
        }

        protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
          calls.push(`entity:${entity.name.name}`);
          return [];
        }

        protected afterEntities(): GeneratedFile[] {
          calls.push('afterEntities');
          return [{ path: 'after.ts', content: '// after' }];
        }
      }

      const generator = new TestGenerator();
      const result = await generator.generate(createMockDomain());

      expect(calls).toContain('beforeEntities');
      expect(calls).toContain('entity:User');
      expect(calls).toContain('entity:Order');
      expect(calls).toContain('afterEntities');
      expect(calls.indexOf('beforeEntities')).toBeLessThan(calls.indexOf('entity:User'));
      expect(calls.indexOf('afterEntities')).toBeGreaterThan(calls.indexOf('entity:Order'));
    });

    it('should call finalize at the end', async () => {
      let finalized = false;

      class TestGenerator extends Generator {
        readonly name = 'finalize-generator';

        protected finalize(): GeneratedFile[] {
          finalized = true;
          return [{ path: 'manifest.json', content: '{}' }];
        }
      }

      const generator = new TestGenerator();
      await generator.generate(createMockDomain());

      expect(finalized).toBe(true);
    });
  });

  describe('warnings', () => {
    it('should collect warnings', async () => {
      class TestGenerator extends Generator {
        readonly name = 'warning-generator';

        protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
          if (entity.name.name === 'User') {
            this.warn('User entity has no email field', 'User');
          }
          return [];
        }
      }

      const generator = new TestGenerator();
      const result = await generator.generate(createMockDomain());

      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].message).toContain('email');
      expect(result.warnings[0].severity).toBe('warning');
    });
  });
});
