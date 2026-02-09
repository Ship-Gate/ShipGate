// ============================================================================
// Go Code Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generate,
  mapType,
  toGoName,
  toSnakeCase,
  toScreamingSnakeCase,
  generateEntityStruct,
  generateEnum,
  generateValidationTag,
} from '../src/index.js';
import type { Domain, Entity, Field, PrimitiveType, EnumType, ConstrainedType } from '../src/ast-types.js';

// Helper to create a minimal location
const loc = () => ({ file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 });

// Helper to create identifier
const id = (name: string) => ({ kind: 'Identifier' as const, name, location: loc() });

// Helper to create string literal
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, location: loc() });

// Helper to create number literal
const num = (value: number, isFloat = false) => ({ kind: 'NumberLiteral' as const, value, isFloat, location: loc() });

describe('Type Mapping', () => {
  it('should map String to string', () => {
    const typeDef: PrimitiveType = { kind: 'PrimitiveType', name: 'String', location: loc() };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('string');
  });

  it('should map Int to int64', () => {
    const typeDef: PrimitiveType = { kind: 'PrimitiveType', name: 'Int', location: loc() };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('int64');
  });

  it('should map UUID to uuid.UUID with import', () => {
    const typeDef: PrimitiveType = { kind: 'PrimitiveType', name: 'UUID', location: loc() };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('uuid.UUID');
    expect(result.imports.external.has('github.com/google/uuid')).toBe(true);
  });

  it('should map Timestamp to time.Time with import', () => {
    const typeDef: PrimitiveType = { kind: 'PrimitiveType', name: 'Timestamp', location: loc() };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('time.Time');
    expect(result.imports.standard.has('time')).toBe(true);
  });

  it('should map Decimal to decimal.Decimal with import', () => {
    const typeDef: PrimitiveType = { kind: 'PrimitiveType', name: 'Decimal', location: loc() };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('decimal.Decimal');
    expect(result.imports.external.has('github.com/shopspring/decimal')).toBe(true);
  });

  it('should map List<T> to []T', () => {
    const typeDef = {
      kind: 'ListType' as const,
      element: { kind: 'PrimitiveType' as const, name: 'String' as const, location: loc() },
      location: loc(),
    };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('[]string');
  });

  it('should map Map<K,V> to map[K]V', () => {
    const typeDef = {
      kind: 'MapType' as const,
      key: { kind: 'PrimitiveType' as const, name: 'String' as const, location: loc() },
      value: { kind: 'PrimitiveType' as const, name: 'Int' as const, location: loc() },
      location: loc(),
    };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('map[string]int64');
  });

  it('should map Optional<T> to *T', () => {
    const typeDef = {
      kind: 'OptionalType' as const,
      inner: { kind: 'PrimitiveType' as const, name: 'String' as const, location: loc() },
      location: loc(),
    };
    const result = mapType(typeDef);
    expect(result.typeName).toBe('*string');
    expect(result.isPointer).toBe(true);
  });
});

describe('Name Conversions', () => {
  it('should convert to PascalCase for Go names', () => {
    expect(toGoName('user_name')).toBe('UserName');
    expect(toGoName('user-name')).toBe('UserName');
    expect(toGoName('userName')).toBe('UserName');
    expect(toGoName('User')).toBe('User');
  });

  it('should convert to snake_case', () => {
    expect(toSnakeCase('userName')).toBe('user_name');
    expect(toSnakeCase('UserName')).toBe('user_name');
    expect(toSnakeCase('ID')).toBe('i_d');
  });

  it('should convert to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnakeCase('status')).toBe('STATUS');
    expect(toScreamingSnakeCase('userStatus')).toBe('USER_STATUS');
  });
});

describe('Entity Struct Generation', () => {
  it('should generate basic struct', () => {
    const entity: Entity = {
      kind: 'Entity',
      name: id('User'),
      fields: [
        {
          kind: 'Field',
          name: id('id'),
          type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('name'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
      ],
      invariants: [],
      location: loc(),
    };

    const result = generateEntityStruct(entity);

    expect(result.name).toBe('User');
    expect(result.code).toContain('type User struct');
    expect(result.code).toContain('Id uuid.UUID');
    expect(result.code).toContain('Name string');
    expect(result.code).toContain('json:"id"');
    expect(result.code).toContain('json:"name"');
  });

  it('should generate struct with optional fields', () => {
    const entity: Entity = {
      kind: 'Entity',
      name: id('User'),
      fields: [
        {
          kind: 'Field',
          name: id('nickname'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: true,
          annotations: [],
          location: loc(),
        },
      ],
      invariants: [],
      location: loc(),
    };

    const result = generateEntityStruct(entity);

    expect(result.code).toContain('Nickname *string');
    expect(result.code).toContain('json:"nickname,omitempty"');
  });

  it('should generate struct with validation tags', () => {
    const entity: Entity = {
      kind: 'Entity',
      name: id('User'),
      fields: [
        {
          kind: 'Field',
          name: id('email'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: false,
          annotations: [{ kind: 'Annotation', name: id('email'), location: loc() }],
          location: loc(),
        },
      ],
      invariants: [],
      location: loc(),
    };

    const result = generateEntityStruct(entity);

    expect(result.code).toContain('validate:"required,email"');
  });
});

describe('Enum Generation', () => {
  it('should generate enum type with constants', () => {
    const enumType: EnumType = {
      kind: 'EnumType',
      variants: [
        { kind: 'EnumVariant', name: id('ACTIVE'), location: loc() },
        { kind: 'EnumVariant', name: id('INACTIVE'), location: loc() },
        { kind: 'EnumVariant', name: id('SUSPENDED'), location: loc() },
      ],
      location: loc(),
    };

    const result = generateEnum('UserStatus', enumType);

    expect(result.name).toBe('UserStatus');
    expect(result.code).toContain('type UserStatus string');
    expect(result.code).toContain('UserStatusACTIVE UserStatus = "ACTIVE"');
    expect(result.code).toContain('UserStatusINACTIVE UserStatus = "INACTIVE"');
    expect(result.code).toContain('UserStatusSUSPENDED UserStatus = "SUSPENDED"');
    expect(result.code).toContain('func UserStatusValues()');
    expect(result.code).toContain('func (e UserStatus) IsValid() bool');
  });
});

describe('Validation Tag Generation', () => {
  it('should generate required for non-optional fields', () => {
    const field: Field = {
      kind: 'Field',
      name: id('name'),
      type: { kind: 'PrimitiveType', name: 'String', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    };

    const tag = generateValidationTag(field);

    expect(tag).toBe('validate:"required"');
  });

  it('should not add required for optional fields', () => {
    const field: Field = {
      kind: 'Field',
      name: id('name'),
      type: { kind: 'PrimitiveType', name: 'String', location: loc() },
      optional: true,
      annotations: [],
      location: loc(),
    };

    const tag = generateValidationTag(field);

    expect(tag).toBeNull();
  });

  it('should generate min/max for constrained types', () => {
    const constrainedType: ConstrainedType = {
      kind: 'ConstrainedType',
      base: { kind: 'PrimitiveType', name: 'String', location: loc() },
      constraints: [
        { kind: 'Constraint', name: 'min_length', value: num(3), location: loc() },
        { kind: 'Constraint', name: 'max_length', value: num(100), location: loc() },
      ],
      location: loc(),
    };

    const field: Field = {
      kind: 'Field',
      name: id('username'),
      type: constrainedType,
      optional: false,
      annotations: [],
      location: loc(),
    };

    const tag = generateValidationTag(field);

    expect(tag).toContain('required');
    expect(tag).toContain('min=3');
    expect(tag).toContain('max=100');
  });
});

describe('Full Domain Generation', () => {
  it('should generate all files for a minimal domain', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Auth'),
      version: str('1.0.0'),
      imports: [],
      types: [
        {
          kind: 'TypeDeclaration',
          name: id('UserStatus'),
          definition: {
            kind: 'EnumType',
            variants: [
              { kind: 'EnumVariant', name: id('ACTIVE'), location: loc() },
              { kind: 'EnumVariant', name: id('INACTIVE'), location: loc() },
            ],
            location: loc(),
          },
          annotations: [],
          location: loc(),
        },
      ],
      entities: [
        {
          kind: 'Entity',
          name: id('User'),
          fields: [
            {
              kind: 'Field',
              name: id('id'),
              type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
              optional: false,
              annotations: [
                { kind: 'Annotation', name: id('immutable'), location: loc() },
                { kind: 'Annotation', name: id('unique'), location: loc() },
              ],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('email'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [{ kind: 'Annotation', name: id('email'), location: loc() }],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('status'),
              type: {
                kind: 'ReferenceType',
                name: { kind: 'QualifiedName', parts: [id('UserStatus')], location: loc() },
                location: loc(),
              },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        },
      ],
      behaviors: [
        {
          kind: 'Behavior',
          name: id('CreateUser'),
          description: str('Create a new user'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('email'),
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
            success: {
              kind: 'ReferenceType',
              name: { kind: 'QualifiedName', parts: [id('User')], location: loc() },
              location: loc(),
            },
            errors: [
              {
                kind: 'ErrorSpec',
                name: id('DUPLICATE_EMAIL'),
                when: str('Email already exists'),
                retriable: false,
                location: loc(),
              },
            ],
            location: loc(),
          },
          preconditions: [],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        },
      ],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    // Should generate multiple files
    expect(files.length).toBeGreaterThan(0);

    // Check types.go
    const typesFile = files.find(f => f.path.includes('types.go'));
    expect(typesFile).toBeDefined();
    expect(typesFile?.content).toContain('type UserStatus string');
    expect(typesFile?.content).toContain('UserStatusACTIVE');

    // Check models.go
    const modelsFile = files.find(f => f.path.includes('models.go'));
    expect(modelsFile).toBeDefined();
    expect(modelsFile?.content).toContain('type User struct');
    expect(modelsFile?.content).toContain('Id uuid.UUID');
    expect(modelsFile?.content).toContain('Email string');

    // Check interfaces.go
    const interfacesFile = files.find(f => f.path.includes('interfaces.go'));
    expect(interfacesFile).toBeDefined();
    expect(interfacesFile?.content).toContain('type AuthService interface');
    expect(interfacesFile?.content).toContain('CreateUser(ctx context.Context');
    expect(interfacesFile?.content).toContain('type CreateUserInput struct');
    expect(interfacesFile?.content).toContain('type CreateUserOutput struct');
  });

  it('should include proper imports', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Test'),
      version: str('1.0.0'),
      imports: [],
      types: [],
      entities: [
        {
          kind: 'Entity',
          name: id('Item'),
          fields: [
            {
              kind: 'Field',
              name: id('id'),
              type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('created_at'),
              type: { kind: 'PrimitiveType', name: 'Timestamp', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('amount'),
              type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        },
      ],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/test' });
    const modelsFile = files.find(f => f.path.includes('models.go'));

    expect(modelsFile?.content).toContain('"time"');
    expect(modelsFile?.content).toContain('"github.com/google/uuid"');
    expect(modelsFile?.content).toContain('"github.com/shopspring/decimal"');
  });

  it('should generate code without errors', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Empty'),
      version: str('1.0.0'),
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
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/empty' });

    // Empty domain should still work
    expect(Array.isArray(files)).toBe(true);
  });
});

describe('Generated Code Quality', () => {
  it('should include DO NOT EDIT comment', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Test'),
      version: str('1.0.0'),
      imports: [],
      types: [],
      entities: [
        {
          kind: 'Entity',
          name: id('Item'),
          fields: [
            {
              kind: 'Field',
              name: id('id'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        },
      ],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/test' });

    for (const file of files) {
      if (file.path.endsWith('.go')) {
        expect(file.content).toContain('DO NOT EDIT');
      }
    }
  });

  it('should have proper package declaration', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('MyDomain'),
      version: str('1.0.0'),
      imports: [],
      types: [],
      entities: [
        {
          kind: 'Entity',
          name: id('Item'),
          fields: [
            {
              kind: 'Field',
              name: id('id'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        },
      ],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/test' });

    for (const file of files) {
      if (file.path.endsWith('.go')) {
        expect(file.content).toMatch(/^\/\/.*\n/);
        expect(file.content).toMatch(/package \w+/);
      }
    }
  });
});
