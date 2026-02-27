/**
 * Visitor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EntityVisitorBase,
  BehaviorVisitorBase,
  TypeVisitorBase,
  CompositeVisitor,
  composeVisitors,
  createEntityVisitor,
  createBehaviorVisitor,
  type GeneratorContext,
  type EntityDeclaration,
  type BehaviorDeclaration,
  type TypeDeclaration,
  type EnumDeclaration,
} from '../src/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function mockSpan() {
  return { start: 0, end: 0, line: 1, column: 1 };
}

function createMockContext(): GeneratorContext {
  return {
    domain: {
      kind: 'DomainDeclaration',
      name: { kind: 'Identifier', name: 'Test', span: mockSpan() },
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [],
      invariants: [],
      span: mockSpan(),
    } as any,
    options: {},
    data: {},
    helpers: {},
  };
}

function createMockEntity(): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: { kind: 'Identifier', name: 'User', span: mockSpan() },
    fields: [
      {
        kind: 'FieldDeclaration',
        name: { kind: 'Identifier', name: 'id', span: mockSpan() },
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'UUID', span: mockSpan() }, span: mockSpan() },
        optional: false,
        annotations: [{ kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', span: mockSpan() }, span: mockSpan() }],
        constraints: [],
        span: mockSpan(),
      },
      {
        kind: 'FieldDeclaration',
        name: { kind: 'Identifier', name: 'email', span: mockSpan() },
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Email', span: mockSpan() }, span: mockSpan() },
        optional: true,
        annotations: [],
        constraints: [],
        span: mockSpan(),
      },
    ],
    span: mockSpan(),
  } as EntityDeclaration;
}

// ============================================================================
// Entity Visitor Tests
// ============================================================================

describe('EntityVisitorBase', () => {
  class TestEntityVisitor extends EntityVisitorBase {
    visitEntity(entity: EntityDeclaration, ctx: GeneratorContext) {
      return [{
        path: `${entity.name.name}.ts`,
        content: `// Entity: ${entity.name.name}`,
      }];
    }
  }

  it('should detect annotations', () => {
    const visitor = new TestEntityVisitor();
    const entity = createMockEntity();

    // Access protected method via cast
    const hasImmutable = (visitor as any).hasAnnotation(entity.fields[0], 'immutable');
    expect(hasImmutable).toBe(true);

    const hasComputed = (visitor as any).hasAnnotation(entity.fields[0], 'computed');
    expect(hasComputed).toBe(false);
  });

  it('should get required and optional fields', () => {
    const visitor = new TestEntityVisitor();
    const entity = createMockEntity();

    const required = (visitor as any).getRequiredFields(entity);
    const optional = (visitor as any).getOptionalFields(entity);

    expect(required.length).toBe(1);
    expect(required[0].name.name).toBe('id');
    expect(optional.length).toBe(1);
    expect(optional[0].name.name).toBe('email');
  });

  it('should convert case styles', () => {
    const visitor = new TestEntityVisitor();
    const entity = createMockEntity();

    expect((visitor as any).toFileName(entity, 'kebab')).toBe('user');
    expect((visitor as any).toFileName(entity, 'snake')).toBe('user');
    expect((visitor as any).toFileName(entity, 'pascal')).toBe('User');
  });
});

// ============================================================================
// Behavior Visitor Tests
// ============================================================================

describe('BehaviorVisitorBase', () => {
  class TestBehaviorVisitor extends BehaviorVisitorBase {
    visitBehavior(behavior: BehaviorDeclaration, ctx: GeneratorContext) {
      return [{
        path: `${behavior.name.name}.ts`,
        content: `// Behavior: ${behavior.name.name}`,
      }];
    }
  }

  it('should detect input/output presence', () => {
    const visitor = new TestBehaviorVisitor();
    const behavior = {
      kind: 'BehaviorDeclaration',
      name: { kind: 'Identifier', name: 'CreateUser', span: mockSpan() },
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
        errors: [],
        span: mockSpan(),
      },
      span: mockSpan(),
    } as BehaviorDeclaration;

    expect((visitor as any).hasInput(behavior)).toBe(true);
    expect((visitor as any).hasOutput(behavior)).toBe(true);
    expect((visitor as any).getInputFields(behavior).length).toBe(1);
  });

  it('should get error codes', () => {
    const visitor = new TestBehaviorVisitor();
    const behavior = {
      kind: 'BehaviorDeclaration',
      name: { kind: 'Identifier', name: 'CreateUser', span: mockSpan() },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'User', span: mockSpan() }, span: mockSpan() },
        errors: [
          { kind: 'ErrorDeclaration', name: { kind: 'Identifier', name: 'NotFound', span: mockSpan() }, retriable: false, span: mockSpan() },
          { kind: 'ErrorDeclaration', name: { kind: 'Identifier', name: 'InvalidInput', span: mockSpan() }, retriable: true, span: mockSpan() },
        ],
        span: mockSpan(),
      },
      span: mockSpan(),
    } as BehaviorDeclaration;

    const errorCodes = (visitor as any).getErrorCodes(behavior);
    expect(errorCodes).toContain('NotFound');
    expect(errorCodes).toContain('InvalidInput');

    const retriable = (visitor as any).getRetriableErrors(behavior);
    expect(retriable.length).toBe(1);
    expect(retriable[0].name.name).toBe('InvalidInput');
  });
});

// ============================================================================
// Composite Visitor Tests
// ============================================================================

describe('CompositeVisitor', () => {
  it('should delegate to multiple visitors', () => {
    const calls: string[] = [];

    const entityVisitor1 = createEntityVisitor({
      visitEntity: (entity) => {
        calls.push(`v1:${entity.name.name}`);
        return [{ path: 'v1.ts', content: '' }];
      },
    });

    const entityVisitor2 = createEntityVisitor({
      visitEntity: (entity) => {
        calls.push(`v2:${entity.name.name}`);
        return [{ path: 'v2.ts', content: '' }];
      },
    });

    const composite = composeVisitors({
      entities: [entityVisitor1, entityVisitor2],
    });

    const result = composite.visitEntity(createMockEntity(), createMockContext());

    expect(calls).toContain('v1:User');
    expect(calls).toContain('v2:User');
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(2);
  });

  it('should collect results from all visitors', () => {
    const composite = new CompositeVisitor();

    composite.addEntityVisitor(createEntityVisitor({
      visitEntity: () => [
        { path: 'file1.ts', content: '' },
        { path: 'file2.ts', content: '' },
      ],
    }));

    composite.addEntityVisitor(createEntityVisitor({
      visitEntity: () => [
        { path: 'file3.ts', content: '' },
      ],
    }));

    const result = composite.visitEntity(createMockEntity(), createMockContext());
    expect((result as any[]).length).toBe(3);
  });
});
