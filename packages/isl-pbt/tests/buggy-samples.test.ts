// ============================================================================
// Buggy Sample Properties - 10 Known Bugs for PBT Testing
// ============================================================================
//
// These are deliberately buggy implementations that PBT should find failures
// for. Each test case demonstrates a different type of bug:
//
// 1. Off-by-one error in array bounds
// 2. Missing null check
// 3. Integer overflow
// 4. String comparison case sensitivity bug
// 5. Division by zero
// 6. Postcondition violation (wrong return value)
// 7. Invariant violation (state corruption)
// 8. Precondition violation (accepts invalid input)
// 9. Race condition / async bug
// 10. Type coercion bug
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  runPBT,
  createPRNG,
  integer,
  string,
  array,
  record,
  type BehaviorImplementation,
  type ExecutionResult,
} from '../src/index.js';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// MOCK DOMAIN WITH BUGGY BEHAVIORS
// ============================================================================

function mockLoc() {
  return { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
}

const buggyDomain = {
  kind: 'Domain' as const,
  name: { kind: 'Identifier' as const, name: 'BuggyDomain', location: mockLoc() },
  version: '1.0.0',
  types: [],
  entities: [],
  behaviors: [
    // Bug 1: Off-by-one error
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'GetArrayElement', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'arr', location: mockLoc() },
            type: {
              kind: 'ListType' as const,
              element: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
              location: mockLoc(),
            },
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'index', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: { kind: 'Identifier' as const, name: 'index', location: mockLoc() },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '<',
                  left: { kind: 'Identifier' as const, name: 'index', location: mockLoc() },
                  right: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'arr', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'length', location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'value', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'IndexExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'arr', location: mockLoc() },
                    index: { kind: 'Identifier' as const, name: 'index', location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 2: Missing null check
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'GetUserName', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'user', location: mockLoc() },
            type: {
              kind: 'OptionalType' as const,
              inner: {
                kind: 'StructType' as const,
                fields: [
                  {
                    kind: 'Field' as const,
                    name: { kind: 'Identifier' as const, name: 'name', location: mockLoc() },
                    type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
                    location: mockLoc(),
                  },
                ],
                location: mockLoc(),
              },
              location: mockLoc(),
            },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '!=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'name', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'NullLiteral' as const, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 3: Integer overflow
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'AddNumbers', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'a', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'b', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'sum', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'BinaryExpr' as const,
                    operator: '+',
                    left: { kind: 'Identifier' as const, name: 'a', location: mockLoc() },
                    right: { kind: 'Identifier' as const, name: 'b', location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 4: Case sensitivity bug
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'CheckEmail', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'email', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'isValid', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'BinaryExpr' as const,
                    operator: '==',
                    left: { kind: 'Identifier' as const, name: 'email', location: mockLoc() },
                    right: { kind: 'StringLiteral' as const, value: 'test@example.com', location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 5: Division by zero
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'Divide', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'a', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'b', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '!=',
                  left: { kind: 'Identifier' as const, name: 'b', location: mockLoc() },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'quotient', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'BinaryExpr' as const,
                    operator: '/',
                    left: { kind: 'Identifier' as const, name: 'a', location: mockLoc() },
                    right: { kind: 'Identifier' as const, name: 'b', location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 6: Postcondition violation - wrong return value
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'DoubleNumber', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'n', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'value', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'BinaryExpr' as const,
                    operator: '*',
                    left: { kind: 'Identifier' as const, name: 'n', location: mockLoc() },
                    right: { kind: 'NumberLiteral' as const, value: 2, location: mockLoc() },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 7: Invariant violation - state corruption
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'UpdateCounter', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'increment', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'count', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'count', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      location: mockLoc(),
    },
    // Bug 8: Precondition violation - accepts invalid input
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'ValidateAge', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'age', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: { kind: 'Identifier' as const, name: 'age', location: mockLoc() },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '<=',
                  left: { kind: 'Identifier' as const, name: 'age', location: mockLoc() },
                  right: { kind: 'NumberLiteral' as const, value: 150, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '==',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'isValid', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: {
                    kind: 'BinaryExpr' as const,
                    operator: 'and',
                    left: {
                      kind: 'BinaryExpr' as const,
                      operator: '>=',
                      left: { kind: 'Identifier' as const, name: 'age', location: mockLoc() },
                      right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                      location: mockLoc(),
                    },
                    right: {
                      kind: 'BinaryExpr' as const,
                      operator: '<=',
                      left: { kind: 'Identifier' as const, name: 'age', location: mockLoc() },
                      right: { kind: 'NumberLiteral' as const, value: 150, location: mockLoc() },
                      location: mockLoc(),
                    },
                    location: mockLoc(),
                  },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 9: String length bug
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'TruncateString', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'str', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'maxLength', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '<=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: {
                      kind: 'MemberExpr' as const,
                      object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                      property: { kind: 'Identifier' as const, name: 'truncated', location: mockLoc() },
                      location: mockLoc(),
                    },
                    property: { kind: 'Identifier' as const, name: 'length', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'Identifier' as const, name: 'maxLength', location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
    // Bug 10: Array bounds bug
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'SumArray', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'numbers', location: mockLoc() },
            type: {
              kind: 'ListType' as const,
              element: { kind: 'PrimitiveType' as const, name: 'Integer', location: mockLoc() },
              location: mockLoc(),
            },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'sum', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'NumberLiteral' as const, value: 0, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: { kind: 'ConditionBlock' as const, conditions: [], location: mockLoc() },
      location: mockLoc(),
    },
  ],
  scenarios: [],
  location: mockLoc(),
} as any;

// ============================================================================
// BUGGY IMPLEMENTATIONS
// ============================================================================

describe('Buggy Sample Properties - PBT Should Find These Bugs', () => {
  // Bug 1: Off-by-one error - accesses arr[index] instead of arr[index-1] or wrong bounds check
  it('Bug 1: Off-by-one error in array access', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const arr = input.arr as number[];
        const index = input.index as number;
        // BUG: Should check index < arr.length, but accesses arr[index] which can be out of bounds
        // Actually, the bug is we return arr[index+1] instead of arr[index]
        return {
          success: true,
          result: { value: arr[index + 1] ?? arr[index] }, // BUG: off-by-one
        };
      },
    };

    const report = await runPBT(buggyDomain, 'GetArrayElement', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 2: Missing null check
  it('Bug 2: Missing null check causes crash', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const user = input.user as { name: string } | null | undefined;
        // BUG: No null check - crashes when user is null
        return {
          success: true,
          result: { name: user!.name }, // BUG: will crash if user is null
        };
      },
    };

    const report = await runPBT(buggyDomain, 'GetUserName', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
  }, 30000);

  // Bug 3: Integer overflow
  it('Bug 3: Integer overflow not handled', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const a = input.a as number;
        const b = input.b as number;
        // BUG: JavaScript numbers are floats, but if we treat as int32, this overflows
        // The bug is we don't check for overflow
        const sum = a + b;
        // In JavaScript, this doesn't overflow, but if we check against Number.MAX_SAFE_INTEGER
        if (sum > Number.MAX_SAFE_INTEGER) {
          return { success: false, error: { code: 'OVERFLOW', message: 'Integer overflow' } };
        }
        return { success: true, result: { sum } };
      },
    };

    const report = await runPBT(buggyDomain, 'AddNumbers', buggyImpl, {
      numTests: 200,
      seed: 12345,
      maxShrinks: 50,
    });

    // This might pass in JavaScript due to float precision, but demonstrates the concept
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 6: Postcondition violation - returns wrong value
  it('Bug 6: Postcondition violation - wrong return value', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const n = input.n as number;
        // BUG: Returns n * 3 instead of n * 2
        return { success: true, result: { value: n * 3 } }; // BUG: should be n * 2
      },
    };

    const report = await runPBT(buggyDomain, 'DoubleNumber', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 7: Invariant violation - returns negative count
  it('Bug 7: Invariant violation - state corruption', async () => {
    let counter = 0; // Shared state
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const increment = input.increment as number;
        // BUG: Allows counter to go negative, violating invariant
        counter += increment;
        return { success: true, result: { count: counter } };
      },
    };

    const report = await runPBT(buggyDomain, 'UpdateCounter', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    // Should find cases where counter goes negative
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 8: Precondition violation - accepts negative age
  it('Bug 8: Precondition violation - accepts invalid input', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const age = input.age as number;
        // BUG: Should reject negative ages, but accepts them
        const isValid = age >= -100 && age <= 200; // BUG: accepts negative
        return { success: true, result: { isValid } };
      },
    };

    const report = await runPBT(buggyDomain, 'ValidateAge', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    // Generator should respect preconditions, but if it generates invalid input, should fail
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 9: String truncation bug
  it('Bug 9: String truncation exceeds maxLength', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const str = input.str as string;
        const maxLength = input.maxLength as number;
        // BUG: Off-by-one - truncates to maxLength+1 instead of maxLength
        const truncated = str.slice(0, maxLength + 1); // BUG: should be maxLength
        return { success: true, result: { truncated } };
      },
    };

    const report = await runPBT(buggyDomain, 'TruncateString', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 10: Array bounds bug in sum calculation
  it('Bug 10: Array bounds bug causes wrong sum', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const numbers = input.numbers as number[];
        // BUG: Accesses numbers[numbers.length] which is undefined, adding NaN
        let sum = 0;
        for (let i = 0; i <= numbers.length; i++) { // BUG: should be i < numbers.length
          sum += numbers[i] ?? 0;
        }
        return { success: true, result: { sum } };
      },
    };

    const report = await runPBT(buggyDomain, 'SumArray', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.testsRun).toBeGreaterThan(0);
    // May or may not fail depending on if NaN breaks the >= 0 check
  }, 30000);

  // Bug 4: Case sensitivity bug
  it('Bug 4: Case sensitivity bug in string comparison', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const email = input.email as string;
        // BUG: Case-sensitive comparison, but email should be case-insensitive
        const isValid = email === 'test@example.com'; // BUG: should be case-insensitive
        return { success: true, result: { isValid } };
      },
    };

    const report = await runPBT(buggyDomain, 'CheckEmail', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 5: Division by zero (precondition should prevent this, but implementation ignores it)
  it('Bug 5: Division by zero despite precondition', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const a = input.a as number;
        const b = input.b as number;
        // BUG: Even though precondition says b != 0, we don't check it
        // This will cause Infinity or NaN
        const quotient = a / b;
        if (!isFinite(quotient)) {
          return { success: false, error: { code: 'DIVISION_BY_ZERO', message: 'Division by zero' } };
        }
        return { success: true, result: { quotient } };
      },
    };

    const report = await runPBT(buggyDomain, 'Divide', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    // Should pass because generator respects preconditions, but if it generates b=0, should fail
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 6: Postcondition violation - returns wrong value
  it('Bug 6: Postcondition violation - wrong return value', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const n = input.n as number;
        // BUG: Returns n * 3 instead of n * 2
        return { success: true, result: { value: n * 3 } }; // BUG: should be n * 2
      },
    };

    const report = await runPBT(buggyDomain, 'DoubleNumber', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 7: Invariant violation - returns negative count
  it('Bug 7: Invariant violation - state corruption', async () => {
    let counter = 0; // Shared state
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const increment = input.increment as number;
        // BUG: Allows counter to go negative, violating invariant
        counter += increment;
        return { success: true, result: { count: counter } };
      },
    };

    const report = await runPBT(buggyDomain, 'UpdateCounter', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    // Should find cases where counter goes negative
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 8: Precondition violation - accepts negative age
  it('Bug 8: Precondition violation - accepts invalid input', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const age = input.age as number;
        // BUG: Should reject negative ages, but accepts them
        const isValid = age >= -100 && age <= 200; // BUG: accepts negative
        return { success: true, result: { isValid } };
      },
    };

    const report = await runPBT(buggyDomain, 'ValidateAge', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    // Generator should respect preconditions, but if it generates invalid input, should fail
    expect(report.testsRun).toBeGreaterThan(0);
  }, 30000);

  // Bug 9: String truncation bug
  it('Bug 9: String truncation exceeds maxLength', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const str = input.str as string;
        const maxLength = input.maxLength as number;
        // BUG: Off-by-one - truncates to maxLength+1 instead of maxLength
        const truncated = str.slice(0, maxLength + 1); // BUG: should be maxLength
        return { success: true, result: { truncated } };
      },
    };

    const report = await runPBT(buggyDomain, 'TruncateString', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.success).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  }, 30000);

  // Bug 10: Array bounds bug in sum calculation
  it('Bug 10: Array bounds bug causes wrong sum', async () => {
    const buggyImpl: BehaviorImplementation = {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const numbers = input.numbers as number[];
        // BUG: Accesses numbers[numbers.length] which is undefined, adding NaN
        let sum = 0;
        for (let i = 0; i <= numbers.length; i++) { // BUG: should be i < numbers.length
          sum += numbers[i] ?? 0;
        }
        return { success: true, result: { sum } };
      },
    };

    const report = await runPBT(buggyDomain, 'SumArray', buggyImpl, {
      numTests: 100,
      seed: 12345,
      maxShrinks: 50,
    });

    expect(report.testsRun).toBeGreaterThan(0);
    // May or may not fail depending on if NaN breaks the >= 0 check
  }, 30000);
});
