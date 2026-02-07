/**
 * Domain Adapter Tests
 * 
 * Tests for the DomainDeclaration ↔ Domain adapter.
 * These tests also serve as a contract lock to prevent accidental shape drift.
 */

import { describe, it, expect } from 'vitest';
import {
  domainDeclarationToDomain,
  domainToDomainDeclaration,
  spanToLocation,
  locationToSpan,
  validateForConversion,
} from './domain-adapter.js';
import type { DomainDeclaration, Identifier, StringLiteral } from '../ast/types.js';
import type { SourceSpan } from '../lexer/tokens.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSpan(file = 'test.isl'): SourceSpan {
  return {
    file,
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
  };
}

function createIdentifier(name: string, span = createSpan()): Identifier {
  return {
    kind: 'Identifier',
    name,
    span,
  };
}

function createStringLiteral(value: string, span = createSpan()): StringLiteral {
  return {
    kind: 'StringLiteral',
    value,
    span,
  };
}

function createMinimalDomainDeclaration(): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: createIdentifier('TestDomain'),
    version: createStringLiteral('1.0.0'),
    uses: [],
    imports: [],
    entities: [],
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
    span: createSpan(),
  };
}

function createFullDomainDeclaration(): DomainDeclaration {
  const span = createSpan();
  
  return {
    kind: 'DomainDeclaration',
    name: createIdentifier('AuthDomain'),
    version: createStringLiteral('2.0.0'),
    uses: [
      {
        kind: 'UseStatement',
        module: createIdentifier('stdlib-auth'),
        alias: createIdentifier('auth'),
        span,
      },
    ],
    imports: [
      {
        kind: 'ImportDeclaration',
        names: [createIdentifier('User'), createIdentifier('Session')],
        from: createStringLiteral('./types.isl'),
        span,
      },
    ],
    entities: [
      {
        kind: 'EntityDeclaration',
        name: createIdentifier('User'),
        fields: [
          {
            kind: 'FieldDeclaration',
            name: createIdentifier('id'),
            type: {
              kind: 'SimpleType',
              name: createIdentifier('UUID'),
              span,
            },
            optional: false,
            annotations: [],
            constraints: [],
            span,
          },
          {
            kind: 'FieldDeclaration',
            name: createIdentifier('email'),
            type: {
              kind: 'SimpleType',
              name: createIdentifier('String'),
              span,
            },
            optional: false,
            annotations: [],
            constraints: [],
            span,
          },
        ],
        span,
      },
    ],
    types: [
      {
        kind: 'TypeDeclaration',
        name: createIdentifier('Email'),
        baseType: {
          kind: 'SimpleType',
          name: createIdentifier('String'),
          span,
        },
        constraints: [],
        span,
      },
    ],
    enums: [
      {
        kind: 'EnumDeclaration',
        name: createIdentifier('UserStatus'),
        variants: [
          createIdentifier('Active'),
          createIdentifier('Inactive'),
          createIdentifier('Banned'),
        ],
        span,
      },
    ],
    behaviors: [
      {
        kind: 'BehaviorDeclaration',
        name: createIdentifier('Login'),
        description: createStringLiteral('Authenticate a user'),
        actors: {
          kind: 'ActorsBlock',
          actors: [
            {
              kind: 'ActorDeclaration',
              name: createIdentifier('user'),
              constraints: [],
              span,
            },
          ],
          span,
        },
        input: {
          kind: 'InputBlock',
          fields: [
            {
              kind: 'FieldDeclaration',
              name: createIdentifier('email'),
              type: {
                kind: 'SimpleType',
                name: createIdentifier('String'),
                span,
              },
              optional: false,
              annotations: [],
              constraints: [],
              span,
            },
            {
              kind: 'FieldDeclaration',
              name: createIdentifier('password'),
              type: {
                kind: 'SimpleType',
                name: createIdentifier('String'),
                span,
              },
              optional: false,
              annotations: [],
              constraints: [],
              span,
            },
          ],
          span,
        },
        output: {
          kind: 'OutputBlock',
          success: {
            kind: 'SimpleType',
            name: createIdentifier('Session'),
            span,
          },
          errors: [
            {
              kind: 'ErrorDeclaration',
              name: createIdentifier('InvalidCredentials'),
              when: createStringLiteral('email or password is incorrect'),
              retriable: false,
              span,
            },
            {
              kind: 'ErrorDeclaration',
              name: createIdentifier('AccountLocked'),
              when: createStringLiteral('too many failed attempts'),
              retriable: true,
              retryAfter: {
                kind: 'DurationLiteral',
                value: 300,
                unit: 's',
                span,
              },
              span,
            },
          ],
          span,
        },
        preconditions: {
          kind: 'ConditionBlock',
          conditions: [
            {
              kind: 'Condition',
              implies: false,
              statements: [
                {
                  kind: 'ConditionStatement',
                  expression: {
                    kind: 'BinaryExpression',
                    operator: '!=',
                    left: createIdentifier('email'),
                    right: {
                      kind: 'StringLiteral',
                      value: '',
                      span,
                    },
                    span,
                  },
                  description: createStringLiteral('email must not be empty'),
                  span,
                },
              ],
              span,
            },
          ],
          span,
        },
        postconditions: {
          kind: 'ConditionBlock',
          conditions: [
            {
              kind: 'Condition',
              guard: 'success',
              implies: true,
              statements: [
                {
                  kind: 'ConditionStatement',
                  expression: {
                    kind: 'MemberExpression',
                    object: createIdentifier('result'),
                    property: createIdentifier('valid'),
                    span,
                  },
                  span,
                },
              ],
              span,
            },
          ],
          span,
        },
        temporal: {
          kind: 'TemporalBlock',
          requirements: [
            {
              kind: 'TemporalRequirement',
              type: 'within',
              duration: {
                kind: 'DurationLiteral',
                value: 500,
                unit: 'ms',
                span,
              },
              percentile: '99',
              condition: {
                kind: 'BooleanLiteral',
                value: true,
                span,
              },
              span,
            },
          ],
          span,
        },
        security: {
          kind: 'SecurityBlock',
          requirements: [
            {
              kind: 'SecurityRequirement',
              type: 'rate_limit',
              expression: {
                kind: 'CallExpression',
                callee: createIdentifier('rateLimit'),
                arguments: [
                  {
                    kind: 'NumberLiteral',
                    value: 5,
                    span,
                  },
                  createStringLiteral('per_minute'),
                ],
                span,
              },
              span,
            },
          ],
          span,
        },
        span,
      },
    ],
    invariants: [
      {
        kind: 'InvariantsBlock',
        name: createIdentifier('UserInvariants'),
        description: createStringLiteral('User data integrity rules'),
        scope: 'global',
        invariants: [
          {
            kind: 'InvariantStatement',
            expression: {
              kind: 'BinaryExpression',
              operator: '!=',
              left: {
                kind: 'MemberExpression',
                object: createIdentifier('user'),
                property: createIdentifier('email'),
                span,
              },
              right: {
                kind: 'NullLiteral',
                span,
              },
              span,
            },
            span,
          },
        ],
        span,
      },
    ],
    span,
  };
}

// ============================================================================
// spanToLocation / locationToSpan Tests
// ============================================================================

describe('spanToLocation', () => {
  it('converts SourceSpan to SourceLocation', () => {
    const span: SourceSpan = {
      file: 'test.isl',
      start: { line: 5, column: 10, offset: 100 },
      end: { line: 10, column: 20, offset: 200 },
    };

    const location = spanToLocation(span);

    expect(location).toEqual({
      file: 'test.isl',
      line: 5,
      column: 10,
      endLine: 10,
      endColumn: 20,
    });
  });

  it('handles undefined file', () => {
    const span: SourceSpan = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 5, offset: 4 },
    };

    const location = spanToLocation(span);

    expect(location.file).toBe('<unknown>');
  });
});

describe('locationToSpan', () => {
  it('converts SourceLocation to SourceSpan', () => {
    const location = {
      file: 'test.isl',
      line: 5,
      column: 10,
      endLine: 10,
      endColumn: 20,
    };

    const span = locationToSpan(location);

    expect(span).toEqual({
      file: 'test.isl',
      start: { line: 5, column: 10, offset: 0 },
      end: { line: 10, column: 20, offset: 0 },
    });
  });
});

// ============================================================================
// validateForConversion Tests
// ============================================================================

describe('validateForConversion', () => {
  it('passes for valid DomainDeclaration', () => {
    const decl = createMinimalDomainDeclaration();
    const result = validateForConversion(decl);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for missing domain name', () => {
    const decl = createMinimalDomainDeclaration();
    decl.name = { kind: 'Identifier', name: '', span: createSpan() };

    const result = validateForConversion(decl);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Domain name is required');
  });

  it('fails for missing entity name', () => {
    const decl = createMinimalDomainDeclaration();
    decl.entities = [{
      kind: 'EntityDeclaration',
      name: { kind: 'Identifier', name: '', span: createSpan() },
      fields: [],
      span: createSpan(),
    }];

    const result = validateForConversion(decl);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Entity at index 0');
  });
});

// ============================================================================
// domainDeclarationToDomain Tests
// ============================================================================

describe('domainDeclarationToDomain', () => {
  it('converts minimal DomainDeclaration', () => {
    const decl = createMinimalDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);

    expect(domain.kind).toBe('Domain');
    expect(domain.name.kind).toBe('Identifier');
    expect(domain.name.name).toBe('TestDomain');
    expect(domain.version.value).toBe('1.0.0');
    expect(domain.imports).toHaveLength(0);
    expect(domain.entities).toHaveLength(0);
    expect(domain.behaviors).toHaveLength(0);
  });

  it('converts full DomainDeclaration with all fields', () => {
    const decl = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);

    // Check domain basics
    expect(domain.kind).toBe('Domain');
    expect(domain.name.name).toBe('AuthDomain');
    expect(domain.version.value).toBe('2.0.0');

    // Check imports (uses + explicit imports)
    expect(domain.imports.length).toBeGreaterThan(0);

    // Check entities
    expect(domain.entities).toHaveLength(1);
    expect(domain.entities[0].kind).toBe('Entity');
    expect(domain.entities[0].name.name).toBe('User');
    expect(domain.entities[0].fields).toHaveLength(2);
    expect(domain.entities[0].fields[0].name.name).toBe('id');

    // Check types (includes converted enums)
    expect(domain.types.length).toBeGreaterThan(0);

    // Check behaviors
    expect(domain.behaviors).toHaveLength(1);
    expect(domain.behaviors[0].kind).toBe('Behavior');
    expect(domain.behaviors[0].name.name).toBe('Login');
    expect(domain.behaviors[0].description?.value).toBe('Authenticate a user');
    expect(domain.behaviors[0].input.fields).toHaveLength(2);
    expect(domain.behaviors[0].output.errors).toHaveLength(2);

    // Check invariants
    expect(domain.invariants).toHaveLength(1);
    expect(domain.invariants[0].name.name).toBe('UserInvariants');
  });

  it('handles missing version by defaulting to 0.0.0', () => {
    const decl = createMinimalDomainDeclaration();
    decl.version = undefined;

    const domain = domainDeclarationToDomain(decl);

    expect(domain.version.value).toBe('0.0.0');
  });

  it('converts UseStatement to Import correctly', () => {
    const decl = createMinimalDomainDeclaration();
    decl.uses = [{
      kind: 'UseStatement',
      module: createIdentifier('stdlib-auth'),
      alias: createIdentifier('auth'),
      span: createSpan(),
    }];

    const domain = domainDeclarationToDomain(decl);

    expect(domain.imports).toHaveLength(1);
    expect(domain.imports[0].kind).toBe('Import');
    expect(domain.imports[0].from.value).toBe('stdlib-auth');
    expect(domain.imports[0].items[0].alias?.name).toBe('auth');
  });

  it('preserves source locations', () => {
    const decl = createMinimalDomainDeclaration();
    decl.span = {
      file: 'auth.isl',
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 100, column: 1, offset: 2000 },
    };

    const domain = domainDeclarationToDomain(decl);

    expect(domain.location.file).toBe('auth.isl');
    expect(domain.location.line).toBe(1);
    expect(domain.location.endLine).toBe(100);
  });
});

// ============================================================================
// domainToDomainDeclaration Tests (Round-trip)
// ============================================================================

describe('domainToDomainDeclaration', () => {
  it('round-trips minimal domain', () => {
    const original = createMinimalDomainDeclaration();
    const domain = domainDeclarationToDomain(original);
    const roundTripped = domainToDomainDeclaration(domain);

    expect(roundTripped.kind).toBe('DomainDeclaration');
    expect(roundTripped.name.name).toBe(original.name.name);
  });

  it('preserves domain name through round-trip', () => {
    const original = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(original);
    const roundTripped = domainToDomainDeclaration(domain);

    expect(roundTripped.name.name).toBe('AuthDomain');
  });

  it('preserves entity count through round-trip', () => {
    const original = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(original);
    const roundTripped = domainToDomainDeclaration(domain);

    expect(roundTripped.entities).toHaveLength(original.entities.length);
  });

  it('preserves behavior count through round-trip', () => {
    const original = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(original);
    const roundTripped = domainToDomainDeclaration(domain);

    expect(roundTripped.behaviors).toHaveLength(original.behaviors.length);
  });
});

// ============================================================================
// Contract Lock Tests
// ============================================================================

describe('Contract Lock: Domain type shape', () => {
  it('Domain has all required fields', () => {
    const decl = createMinimalDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);

    // These properties MUST exist (contract lock)
    expect(domain).toHaveProperty('kind');
    expect(domain).toHaveProperty('name');
    expect(domain).toHaveProperty('version');
    expect(domain).toHaveProperty('imports');
    expect(domain).toHaveProperty('types');
    expect(domain).toHaveProperty('entities');
    expect(domain).toHaveProperty('behaviors');
    expect(domain).toHaveProperty('invariants');
    expect(domain).toHaveProperty('policies');
    expect(domain).toHaveProperty('views');
    expect(domain).toHaveProperty('scenarios');
    expect(domain).toHaveProperty('chaos');
    expect(domain).toHaveProperty('location');
  });

  it('Domain.kind is always "Domain"', () => {
    const decl = createMinimalDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);

    expect(domain.kind).toBe('Domain');
  });

  it('Entity has required shape', () => {
    const decl = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);
    const entity = domain.entities[0];

    expect(entity.kind).toBe('Entity');
    expect(entity).toHaveProperty('name');
    expect(entity).toHaveProperty('fields');
    expect(entity).toHaveProperty('invariants');
    expect(entity).toHaveProperty('location');
  });

  it('Behavior has required shape', () => {
    const decl = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);
    const behavior = domain.behaviors[0];

    expect(behavior.kind).toBe('Behavior');
    expect(behavior).toHaveProperty('name');
    expect(behavior).toHaveProperty('input');
    expect(behavior).toHaveProperty('output');
    expect(behavior).toHaveProperty('preconditions');
    expect(behavior).toHaveProperty('postconditions');
    expect(behavior).toHaveProperty('invariants');
    expect(behavior).toHaveProperty('temporal');
    expect(behavior).toHaveProperty('security');
    expect(behavior).toHaveProperty('compliance');
    expect(behavior).toHaveProperty('location');
  });

  it('Field has required shape', () => {
    const decl = createFullDomainDeclaration();
    const domain = domainDeclarationToDomain(decl);
    const field = domain.entities[0].fields[0];

    expect(field.kind).toBe('Field');
    expect(field).toHaveProperty('name');
    expect(field).toHaveProperty('type');
    expect(field).toHaveProperty('optional');
    expect(field).toHaveProperty('annotations');
    expect(field).toHaveProperty('location');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty arrays gracefully', () => {
    const decl: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: createIdentifier('Empty'),
      uses: [],
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [],
      invariants: [],
      span: createSpan(),
    };

    const domain = domainDeclarationToDomain(decl);

    expect(domain.imports).toEqual([]);
    expect(domain.entities).toEqual([]);
    expect(domain.behaviors).toEqual([]);
    expect(domain.types).toEqual([]);
    expect(domain.invariants).toEqual([]);
    expect(domain.policies).toEqual([]);
    expect(domain.views).toEqual([]);
    expect(domain.scenarios).toEqual([]);
    expect(domain.chaos).toEqual([]);
  });

  it('handles deeply nested structures', () => {
    const span = createSpan();
    const decl = createMinimalDomainDeclaration();
    decl.behaviors = [{
      kind: 'BehaviorDeclaration',
      name: createIdentifier('Nested'),
      input: {
        kind: 'InputBlock',
        fields: [{
          kind: 'FieldDeclaration',
          name: createIdentifier('data'),
          type: {
            kind: 'GenericType',
            name: createIdentifier('List'),
            typeArguments: [{
              kind: 'ObjectType',
              fields: [{
                kind: 'FieldDeclaration',
                name: createIdentifier('nested'),
                type: {
                  kind: 'SimpleType',
                  name: createIdentifier('String'),
                  span,
                },
                optional: true,
                annotations: [],
                constraints: [],
                span,
              }],
              span,
            }],
            span,
          },
          optional: false,
          annotations: [],
          constraints: [],
          span,
        }],
        span,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: createIdentifier('Boolean'), span },
        errors: [],
        span,
      },
      span,
    }];

    // Should not throw
    expect(() => domainDeclarationToDomain(decl)).not.toThrow();
  });

  it('handles special characters in names', () => {
    const decl = createMinimalDomainDeclaration();
    decl.name = createIdentifier('Domain_With_Underscores');

    const domain = domainDeclarationToDomain(decl);

    expect(domain.name.name).toBe('Domain_With_Underscores');
  });

  it('handles unicode in string literals', () => {
    const decl = createMinimalDomainDeclaration();
    decl.version = createStringLiteral('1.0.0-αβγ');

    const domain = domainDeclarationToDomain(decl);

    expect(domain.version.value).toBe('1.0.0-αβγ');
  });
});
