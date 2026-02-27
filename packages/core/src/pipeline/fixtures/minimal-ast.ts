/**
 * Minimal AST Fixture
 *
 * A minimal valid ISL Domain AST for testing the pipeline.
 */

import type { Domain, Identifier, StringLiteral, SourceLocation } from '@isl-lang/parser';

/**
 * Create a source location (required by AST nodes)
 */
function loc(line: number = 1, column: number = 1): SourceLocation {
  return {
    file: 'test.isl',
    line,
    column,
    endLine: line,
    endColumn: column + 10,
  };
}

/**
 * Create an identifier node
 */
function id(value: string, line: number = 1): Identifier {
  return {
    kind: 'Identifier',
    value,
    location: loc(line),
  };
}

/**
 * Create a string literal node
 */
function str(value: string, line: number = 1): StringLiteral {
  return {
    kind: 'StringLiteral',
    value,
    location: loc(line),
  };
}

/**
 * Minimal Domain AST with one entity
 */
export const MINIMAL_AST: Domain = {
  kind: 'Domain',
  name: id('MinimalDomain'),
  version: str('1.0.0'),
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: id('User', 3),
      fields: [
        {
          kind: 'Field',
          name: id('id', 4),
          type: {
            kind: 'PrimitiveType',
            name: 'UUID',
            location: loc(4),
          },
          isOptional: false,
          annotations: [],
          location: loc(4),
        },
        {
          kind: 'Field',
          name: id('name', 5),
          type: {
            kind: 'PrimitiveType',
            name: 'String',
            location: loc(5),
          },
          isOptional: false,
          annotations: [],
          location: loc(5),
        },
      ],
      annotations: [],
      location: loc(3),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: id('CreateUser', 8),
      on: id('User'),
      parameters: [
        {
          kind: 'Parameter',
          name: id('name'),
          type: {
            kind: 'PrimitiveType',
            name: 'String',
            location: loc(8),
          },
          isOptional: false,
          location: loc(8),
        },
      ],
      preconditions: [
        {
          kind: 'BinaryExpression',
          operator: '!=',
          left: { kind: 'Identifier', value: 'name', location: loc(9) },
          right: { kind: 'StringLiteral', value: '', location: loc(9) },
          location: loc(9),
        },
      ],
      postconditions: [
        {
          kind: 'BinaryExpression',
          operator: '>',
          left: {
            kind: 'MemberExpression',
            object: { kind: 'Identifier', value: 'result', location: loc(10) },
            property: { kind: 'Identifier', value: 'id', location: loc(10) },
            location: loc(10),
          },
          right: { kind: 'NumberLiteral', value: 0, location: loc(10) },
          location: loc(10),
        },
      ],
      effects: [],
      annotations: [],
      location: loc(8),
    },
  ],
  invariants: [
    {
      kind: 'InvariantBlock',
      on: id('User'),
      invariants: [
        {
          kind: 'Invariant',
          label: str('user-name-not-empty'),
          condition: {
            kind: 'BinaryExpression',
            operator: '!=',
            left: {
              kind: 'MemberExpression',
              object: { kind: 'Identifier', value: 'this', location: loc(13) },
              property: { kind: 'Identifier', value: 'name', location: loc(13) },
              location: loc(13),
            },
            right: { kind: 'StringLiteral', value: '', location: loc(13) },
            location: loc(13),
          },
          location: loc(13),
        },
      ],
      location: loc(12),
    },
  ],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(1),
};

/**
 * Empty Domain AST (valid but with no clauses)
 */
export const EMPTY_AST: Domain = {
  kind: 'Domain',
  name: id('EmptyDomain'),
  version: str('0.0.1'),
  imports: [],
  types: [],
  entities: [],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(1),
};

/**
 * Complex Domain AST with multiple entities and behaviors
 */
export const COMPLEX_AST: Domain = {
  kind: 'Domain',
  name: id('PaymentSystem'),
  version: str('2.0.0'),
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: id('Account'),
      fields: [
        {
          kind: 'Field',
          name: id('id'),
          type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('balance'),
          type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('currency'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
      ],
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Entity',
      name: id('Transaction'),
      fields: [
        {
          kind: 'Field',
          name: id('id'),
          type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('amount'),
          type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('status'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          isOptional: false,
          annotations: [],
          location: loc(),
        },
      ],
      annotations: [],
      location: loc(),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: id('Deposit'),
      on: id('Account'),
      parameters: [
        {
          kind: 'Parameter',
          name: id('amount'),
          type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
          isOptional: false,
          location: loc(),
        },
      ],
      preconditions: [
        {
          kind: 'BinaryExpression',
          operator: '>',
          left: { kind: 'Identifier', value: 'amount', location: loc() },
          right: { kind: 'NumberLiteral', value: 0, location: loc() },
          location: loc(),
        },
      ],
      postconditions: [
        {
          kind: 'BinaryExpression',
          operator: '==',
          left: {
            kind: 'MemberExpression',
            object: { kind: 'Identifier', value: 'this', location: loc() },
            property: { kind: 'Identifier', value: 'balance', location: loc() },
            location: loc(),
          },
          right: {
            kind: 'BinaryExpression',
            operator: '+',
            left: {
              kind: 'MemberExpression',
              object: { kind: 'Identifier', value: 'old', location: loc() },
              property: { kind: 'Identifier', value: 'balance', location: loc() },
              location: loc(),
            },
            right: { kind: 'Identifier', value: 'amount', location: loc() },
            location: loc(),
          },
          location: loc(),
        },
      ],
      effects: [
        {
          kind: 'Effect',
          action: 'emit',
          target: str('TransactionCreated'),
          location: loc(),
        },
      ],
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Behavior',
      name: id('Withdraw'),
      on: id('Account'),
      parameters: [
        {
          kind: 'Parameter',
          name: id('amount'),
          type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
          isOptional: false,
          location: loc(),
        },
      ],
      preconditions: [
        {
          kind: 'BinaryExpression',
          operator: '>',
          left: { kind: 'Identifier', value: 'amount', location: loc() },
          right: { kind: 'NumberLiteral', value: 0, location: loc() },
          location: loc(),
        },
        {
          kind: 'BinaryExpression',
          operator: '>=',
          left: {
            kind: 'MemberExpression',
            object: { kind: 'Identifier', value: 'this', location: loc() },
            property: { kind: 'Identifier', value: 'balance', location: loc() },
            location: loc(),
          },
          right: { kind: 'Identifier', value: 'amount', location: loc() },
          location: loc(),
        },
      ],
      postconditions: [
        {
          kind: 'BinaryExpression',
          operator: '==',
          left: {
            kind: 'MemberExpression',
            object: { kind: 'Identifier', value: 'this', location: loc() },
            property: { kind: 'Identifier', value: 'balance', location: loc() },
            location: loc(),
          },
          right: {
            kind: 'BinaryExpression',
            operator: '-',
            left: {
              kind: 'MemberExpression',
              object: { kind: 'Identifier', value: 'old', location: loc() },
              property: { kind: 'Identifier', value: 'balance', location: loc() },
              location: loc(),
            },
            right: { kind: 'Identifier', value: 'amount', location: loc() },
            location: loc(),
          },
          location: loc(),
        },
      ],
      effects: [
        {
          kind: 'Effect',
          action: 'emit',
          target: str('WithdrawalProcessed'),
          location: loc(),
        },
      ],
      annotations: [],
      location: loc(),
    },
  ],
  invariants: [
    {
      kind: 'InvariantBlock',
      on: id('Account'),
      invariants: [
        {
          kind: 'Invariant',
          label: str('balance-non-negative'),
          condition: {
            kind: 'BinaryExpression',
            operator: '>=',
            left: {
              kind: 'MemberExpression',
              object: { kind: 'Identifier', value: 'this', location: loc() },
              property: { kind: 'Identifier', value: 'balance', location: loc() },
              location: loc(),
            },
            right: { kind: 'NumberLiteral', value: 0, location: loc() },
            location: loc(),
          },
          location: loc(),
        },
      ],
      location: loc(),
    },
  ],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(),
};
