// ============================================================================
// Property Test Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import {
  generateArbitrary,
  generateTypeArbitrary,
  generateEntityArbitrary,
  generateInputArbitrary,
} from '../src/arbitraries';
import {
  generateEntityInvariantProperties,
  generatePostconditionProperties,
} from '../src/properties';
import { generateShrinker } from '../src/shrinking';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// Test Fixtures
// ============================================================================

function loc(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestDomain', location: loc() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: loc() },
  imports: [],
  types: [],
  entities: [],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(),
});

const createEmailType = (): AST.TypeDeclaration => ({
  kind: 'TypeDeclaration',
  name: { kind: 'Identifier', name: 'Email', location: loc() },
  definition: {
    kind: 'ConstrainedType',
    base: { kind: 'PrimitiveType', name: 'String', location: loc() },
    constraints: [
      {
        kind: 'Constraint',
        name: 'format',
        value: { kind: 'RegexLiteral', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', flags: '', location: loc() },
        location: loc(),
      },
      {
        kind: 'Constraint',
        name: 'max_length',
        value: { kind: 'NumberLiteral', value: 254, isFloat: false, location: loc() },
        location: loc(),
      },
    ],
    location: loc(),
  },
  annotations: [],
  location: loc(),
});

const createMoneyType = (): AST.TypeDeclaration => ({
  kind: 'TypeDeclaration',
  name: { kind: 'Identifier', name: 'Money', location: loc() },
  definition: {
    kind: 'ConstrainedType',
    base: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
    constraints: [
      {
        kind: 'Constraint',
        name: 'min',
        value: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
        location: loc(),
      },
      {
        kind: 'Constraint',
        name: 'max',
        value: { kind: 'NumberLiteral', value: 10000, isFloat: false, location: loc() },
        location: loc(),
      },
    ],
    location: loc(),
  },
  annotations: [],
  location: loc(),
});

const createUserEntity = (): AST.Entity => ({
  kind: 'Entity',
  name: { kind: 'Identifier', name: 'User', location: loc() },
  fields: [
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'id', location: loc() },
      type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'email', location: loc() },
      type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Email', location: loc() }], location: loc() }, location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'balance', location: loc() },
      type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'status', location: loc() },
      type: { kind: 'PrimitiveType', name: 'String', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
  ],
  invariants: [
    {
      kind: 'BinaryExpr',
      operator: '>=',
      left: { kind: 'MemberExpr', object: { kind: 'Identifier', name: 'entity', location: loc() }, property: { kind: 'Identifier', name: 'balance', location: loc() }, location: loc() },
      right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
      location: loc(),
    } as AST.BinaryExpr,
  ],
  location: loc(),
});

const createBehavior = (): AST.Behavior => ({
  kind: 'Behavior',
  name: { kind: 'Identifier', name: 'CreateUser', location: loc() },
  input: {
    kind: 'InputSpec',
    fields: [
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'email', location: loc() },
        type: { kind: 'PrimitiveType', name: 'String', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'username', location: loc() },
        type: { kind: 'PrimitiveType', name: 'String', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
    ],
    location: loc(),
  },
  output: {
    kind: 'OutputSpec',
    success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'User', location: loc() }], location: loc() }, location: loc() },
    errors: [
      {
        kind: 'ErrorSpec',
        name: { kind: 'Identifier', name: 'DUPLICATE_EMAIL', location: loc() },
        retriable: false,
        location: loc(),
      },
    ],
    location: loc(),
  },
  preconditions: [],
  postconditions: [
    {
      kind: 'PostconditionBlock',
      condition: 'success',
      predicates: [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: { kind: 'MemberExpr', object: { kind: 'ResultExpr', location: loc() }, property: { kind: 'Identifier', name: 'email', location: loc() }, location: loc() },
          right: { kind: 'MemberExpr', object: { kind: 'Identifier', name: 'input', location: loc() }, property: { kind: 'Identifier', name: 'email', location: loc() }, location: loc() },
          location: loc(),
        } as AST.BinaryExpr,
      ],
      location: loc(),
    },
  ],
  invariants: [],
  temporal: [],
  security: [],
  compliance: [],
  location: loc(),
});

const createEnumType = (): AST.TypeDeclaration => ({
  kind: 'TypeDeclaration',
  name: { kind: 'Identifier', name: 'Status', location: loc() },
  definition: {
    kind: 'EnumType',
    variants: [
      { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'PENDING', location: loc() }, location: loc() },
      { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'ACTIVE', location: loc() }, location: loc() },
      { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'SUSPENDED', location: loc() }, location: loc() },
    ],
    location: loc(),
  },
  annotations: [],
  location: loc(),
});

// ============================================================================
// Generator Tests
// ============================================================================

describe('Property Test Generator', () => {
  describe('generate()', () => {
    it('should generate files for a domain', () => {
      const domain = createMinimalDomain();
      domain.types = [createEmailType(), createMoneyType()];
      domain.entities = [createUserEntity()];
      domain.behaviors = [createBehavior()];

      const files = generate(domain);

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path.includes('.property.test.ts'))).toBe(true);
      expect(files.some((f) => f.path === 'arbitraries.ts')).toBe(true);
    });

    it('should generate per-behavior test files', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior()];

      const files = generate(domain);

      expect(files.some((f) => f.path === 'CreateUser.property.test.ts')).toBe(true);
    });

    it('should generate entity invariant test files', () => {
      const domain = createMinimalDomain();
      domain.entities = [createUserEntity()];

      const files = generate(domain, { includeEntityTests: true });

      expect(files.some((f) => f.path === 'User.invariants.test.ts')).toBe(true);
    });

    it('should respect iterations option', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior()];

      const files = generate(domain, { iterations: 500 });
      const testFile = files.find((f) => f.path.includes('CreateUser.property.test.ts'));

      expect(testFile?.content).toContain('numRuns: 500');
    });
  });
});

// ============================================================================
// Arbitrary Generator Tests
// ============================================================================

describe('Arbitrary Generator', () => {
  describe('generateTypeArbitrary()', () => {
    it('should generate arbitrary for primitive String', () => {
      const type: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'String', location: loc() };
      const result = generateTypeArbitrary(type);
      expect(result).toBe('fc.string()');
    });

    it('should generate arbitrary for primitive Int', () => {
      const type: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'Int', location: loc() };
      const result = generateTypeArbitrary(type);
      expect(result).toBe('fc.integer()');
    });

    it('should generate arbitrary for primitive UUID', () => {
      const type: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'UUID', location: loc() };
      const result = generateTypeArbitrary(type);
      expect(result).toBe('fc.uuid()');
    });

    it('should generate arbitrary for primitive Boolean', () => {
      const type: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'Boolean', location: loc() };
      const result = generateTypeArbitrary(type);
      expect(result).toBe('fc.boolean()');
    });
  });

  describe('generateArbitrary() for constrained types', () => {
    it('should generate arbitrary with min/max constraints', () => {
      const moneyType = createMoneyType();
      const result = generateArbitrary(moneyType);

      expect(result.name).toBe('arbMoney');
      expect(result.code).toContain('min: 0');
      expect(result.code).toContain('max: 10000');
    });

    it('should generate arbitrary with pattern constraint', () => {
      const emailType = createEmailType();
      const result = generateArbitrary(emailType);

      expect(result.name).toBe('arbEmail');
      expect(result.code).toContain('filter');
    });
  });

  describe('generateArbitrary() for enum types', () => {
    it('should generate constantFrom for enums', () => {
      const enumType = createEnumType();
      const result = generateArbitrary(enumType);

      expect(result.name).toBe('arbStatus');
      expect(result.code).toContain('fc.constantFrom');
      expect(result.code).toContain("'PENDING'");
      expect(result.code).toContain("'ACTIVE'");
      expect(result.code).toContain("'SUSPENDED'");
    });
  });

  describe('generateEntityArbitrary()', () => {
    it('should generate record arbitrary for entity', () => {
      const entity = createUserEntity();
      const result = generateEntityArbitrary(entity);

      expect(result.name).toBe('arbUser');
      expect(result.code).toContain('fc.record');
      expect(result.code).toContain('id:');
      expect(result.code).toContain('email:');
      expect(result.code).toContain('balance:');
    });

    it('should add filter for entity invariants', () => {
      const entity = createUserEntity();
      const result = generateEntityArbitrary(entity);

      expect(result.code).toContain('.filter');
      expect(result.code).toContain('balance');
      expect(result.code).toContain('>=');
    });
  });

  describe('generateInputArbitrary()', () => {
    it('should generate arbitrary for behavior input', () => {
      const behavior = createBehavior();
      const result = generateInputArbitrary(behavior);

      expect(result.name).toBe('arbCreateUserInput');
      expect(result.code).toContain('fc.record');
      expect(result.code).toContain('email:');
      expect(result.code).toContain('username:');
    });
  });
});

// ============================================================================
// Property Generator Tests
// ============================================================================

describe('Property Generator', () => {
  describe('generateEntityInvariantProperties()', () => {
    it('should generate properties for entity invariants', () => {
      const entity = createUserEntity();
      const properties = generateEntityInvariantProperties(entity);

      expect(properties.length).toBe(1);
      expect(properties[0].name).toContain('User invariant');
      expect(properties[0].arbitraries).toContain('arbUser');
      expect(properties[0].async).toBe(false);
    });
  });

  describe('generatePostconditionProperties()', () => {
    it('should generate properties for success postconditions', () => {
      const behavior = createBehavior();
      const properties = generatePostconditionProperties(behavior);

      expect(properties.length).toBeGreaterThan(0);
      expect(properties[0].name).toContain('CreateUser success postcondition');
      expect(properties[0].async).toBe(true);
    });
  });
});

// ============================================================================
// Shrinker Generator Tests
// ============================================================================

describe('Shrinker Generator', () => {
  describe('generateShrinker()', () => {
    it('should generate shrinker for constrained types', () => {
      const moneyType = createMoneyType();
      const shrinker = generateShrinker(moneyType);

      expect(shrinker).not.toBeNull();
      expect(shrinker?.name).toBe('shrinkMoney');
      expect(shrinker?.code).toContain('shrinkMoney');
    });

    it('should return null for primitive types without constraints', () => {
      const simpleType: AST.TypeDeclaration = {
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: 'Simple', location: loc() },
        definition: { kind: 'PrimitiveType', name: 'String', location: loc() },
        annotations: [],
        location: loc(),
      };
      const shrinker = generateShrinker(simpleType);

      expect(shrinker).toBeNull();
    });
  });
});
