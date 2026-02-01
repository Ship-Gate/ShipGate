/**
 * Test Fixtures - Broken ASTs
 *
 * Contains intentionally malformed ASTs for testing the repair engine.
 */

import type { Domain, SourceLocation } from '@isl-lang/parser';
import type { DeepPartial } from '../types.js';

const defaultLocation: SourceLocation = {
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

/**
 * Completely empty AST - missing all required fields
 */
export const emptyAst: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
};

/**
 * AST with missing name and version
 */
export const missingNameAndVersion: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  imports: [],
  types: [],
  entities: [],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with entity missing required fields
 */
export const entityMissingFields: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      // Missing name
      fields: [
        {
          kind: 'Field',
          location: defaultLocation,
          // Missing name, type, optional, annotations
        },
      ],
      // Missing invariants
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with behavior missing input/output specs
 */
export const behaviorMissingSpecs: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [],
  behaviors: [
    {
      kind: 'Behavior',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'DoSomething', location: defaultLocation },
      // Missing input, output, preconditions, postconditions, etc.
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with invalid type names (JavaScript/TypeScript style)
 */
export const invalidTypeNames: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'User', location: defaultLocation },
      fields: [
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'name', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'string' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'age', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'number' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'active', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'boolean' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
      ],
      invariants: [],
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with invalid operators in expressions
 */
export const invalidOperators: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'User', location: defaultLocation },
      fields: [],
      invariants: [
        {
          kind: 'BinaryExpr',
          location: defaultLocation,
          operator: '===' as never, // Should be ==
          left: { kind: 'Identifier', name: 'age', location: defaultLocation },
          right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: defaultLocation },
        },
        {
          kind: 'BinaryExpr',
          location: defaultLocation,
          operator: '&&' as never, // Should be 'and'
          left: {
            kind: 'BinaryExpr',
            location: defaultLocation,
            operator: '>',
            left: { kind: 'Identifier', name: 'age', location: defaultLocation },
            right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: defaultLocation },
          },
          right: {
            kind: 'BinaryExpr',
            location: defaultLocation,
            operator: '<',
            left: { kind: 'Identifier', name: 'age', location: defaultLocation },
            right: { kind: 'NumberLiteral', value: 150, isFloat: false, location: defaultLocation },
          },
        },
      ],
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with duplicate entity fields
 */
export const duplicateFields: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'User', location: defaultLocation },
      fields: [
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'email', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'String', location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'name', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'String', location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'email', location: defaultLocation }, // Duplicate!
          type: { kind: 'PrimitiveType', name: 'String', location: defaultLocation },
          optional: true,
          annotations: [],
        },
      ],
      invariants: [],
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with unsorted entities and behaviors (for ordering normalization)
 */
export const unsortedDomain: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Zebra', location: defaultLocation },
      definition: { kind: 'PrimitiveType', name: 'String', location: defaultLocation },
      annotations: [],
    },
    {
      kind: 'TypeDeclaration',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Alpha', location: defaultLocation },
      definition: { kind: 'PrimitiveType', name: 'Int', location: defaultLocation },
      annotations: [],
    },
  ],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Zebra', location: defaultLocation },
      fields: [],
      invariants: [],
    },
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Apple', location: defaultLocation },
      fields: [],
      invariants: [],
    },
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Mango', location: defaultLocation },
      fields: [],
      invariants: [],
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'ZAction', location: defaultLocation },
      input: { kind: 'InputSpec', fields: [], location: defaultLocation },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'Boolean', location: defaultLocation },
        errors: [],
        location: defaultLocation,
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
    },
    {
      kind: 'Behavior',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'AAction', location: defaultLocation },
      input: { kind: 'InputSpec', fields: [], location: defaultLocation },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'Boolean', location: defaultLocation },
        errors: [],
        location: defaultLocation,
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with SQL-style type names
 */
export const sqlTypeNames: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Record', location: defaultLocation },
      fields: [
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'description', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'VARCHAR' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'count', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'INTEGER' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'price', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'FLOAT' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'createdAt', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'DATETIME' as never, location: defaultLocation },
          optional: false,
          annotations: [],
        },
      ],
      invariants: [],
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * AST with invalid quantifiers
 */
export const invalidQuantifiers: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
  version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Container', location: defaultLocation },
      fields: [],
      invariants: [
        {
          kind: 'QuantifierExpr',
          location: defaultLocation,
          quantifier: 'every' as never, // Should be 'all'
          variable: { kind: 'Identifier', name: 'item', location: defaultLocation },
          collection: { kind: 'Identifier', name: 'items', location: defaultLocation },
          predicate: {
            kind: 'BinaryExpr',
            location: defaultLocation,
            operator: '>',
            left: { kind: 'Identifier', name: 'item', location: defaultLocation },
            right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: defaultLocation },
          },
        },
        {
          kind: 'QuantifierExpr',
          location: defaultLocation,
          quantifier: 'exists' as never, // Should be 'any'
          variable: { kind: 'Identifier', name: 'item', location: defaultLocation },
          collection: { kind: 'Identifier', name: 'items', location: defaultLocation },
          predicate: {
            kind: 'BinaryExpr',
            location: defaultLocation,
            operator: '==',
            left: { kind: 'Identifier', name: 'item', location: defaultLocation },
            right: { kind: 'NumberLiteral', value: 42, isFloat: false, location: defaultLocation },
          },
        },
      ],
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

/**
 * Complex broken AST combining multiple issues
 */
export const complexBroken: DeepPartial<Domain> = {
  kind: 'Domain',
  location: defaultLocation,
  // Missing name and version
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      location: defaultLocation,
      name: { kind: 'Identifier', name: 'Email', location: defaultLocation },
      // Missing definition - should be unrepaired
    },
  ],
  entities: [
    {
      kind: 'Entity',
      location: defaultLocation,
      // Missing name
      fields: [
        {
          kind: 'Field',
          location: defaultLocation,
          name: { kind: 'Identifier', name: 'data', location: defaultLocation },
          type: { kind: 'PrimitiveType', name: 'string' as never, location: defaultLocation },
          // Missing optional, annotations
        },
      ],
      invariants: [
        {
          kind: 'BinaryExpr',
          location: defaultLocation,
          operator: '&&' as never,
          left: { kind: 'BooleanLiteral', value: true, location: defaultLocation },
          right: { kind: 'BooleanLiteral', value: false, location: defaultLocation },
        },
      ],
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      location: defaultLocation,
      // Missing name, input, output, and all arrays
    },
  ],
  // Missing invariants, policies, views, scenarios, chaos arrays
};
