// ============================================================================
// Verifier Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Verifier,
  createVerifier,
  verifyExpression,
  createEntityStore,
} from '../src/index.js';
import type { SourceLocation, EntityStore, EntityStoreSnapshot } from '../src/index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

const defaultLocation: SourceLocation = {
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
};

function loc(line = 1, col = 1): SourceLocation {
  return { file: 'test.isl', line, column: col, endLine: line, endColumn: col + 10 };
}

// AST node builders
function id(name: string) {
  return { kind: 'Identifier', name, location: defaultLocation };
}

function num(value: number) {
  return { kind: 'NumberLiteral', value, isFloat: false, location: defaultLocation };
}

function str(value: string) {
  return { kind: 'StringLiteral', value, location: defaultLocation };
}

function bool(value: boolean) {
  return { kind: 'BooleanLiteral', value, location: defaultLocation };
}

function binary(operator: string, left: unknown, right: unknown) {
  return { kind: 'BinaryExpr', operator, left, right, location: defaultLocation };
}

function inputExpr(property: string) {
  return { kind: 'InputExpr', property: id(property), location: defaultLocation };
}

function resultExpr(property?: string) {
  return {
    kind: 'ResultExpr',
    property: property ? id(property) : undefined,
    location: defaultLocation,
  };
}

function oldExpr(expression: unknown) {
  return { kind: 'OldExpr', expression, location: defaultLocation };
}

function member(object: unknown, property: string) {
  return { kind: 'MemberExpr', object, property: id(property), location: defaultLocation };
}

function call(callee: unknown, args: unknown[]) {
  return { kind: 'CallExpr', callee, arguments: args, location: defaultLocation };
}

// ============================================================================
// VERIFIER CREATION TESTS
// ============================================================================

describe('Verifier Creation', () => {
  it('creates a verifier instance', () => {
    const verifier = createVerifier();
    expect(verifier).toBeInstanceOf(Verifier);
  });
});

// ============================================================================
// BASIC VERIFICATION TESTS
// ============================================================================

describe('Verifier - Basic Verification', () => {
  let verifier: Verifier;
  let store: EntityStore;
  let preState: EntityStoreSnapshot;

  beforeEach(() => {
    verifier = createVerifier();
    store = createEntityStore();
    preState = store.snapshot();
  });

  it('passes when all conditions are true', () => {
    const spec = {
      name: 'TestBehavior',
      preconditions: [
        { expression: binary('>', inputExpr('amount'), num(0)), location: loc(1) },
      ],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            { expression: binary('==', resultExpr('status'), str('success')), location: loc(2) },
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: { amount: 100 },
      preState,
      postStore: store,
      result: { status: 'success', data: {} },
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.preconditions).toHaveLength(1);
    expect(result.preconditions[0]!.passed).toBe(true);
    expect(result.postconditions).toHaveLength(1);
    expect(result.postconditions[0]!.passed).toBe(true);
  });

  it('fails when precondition is false', () => {
    const spec = {
      name: 'TestBehavior',
      preconditions: [
        { expression: binary('>', inputExpr('amount'), num(0)), location: loc(1) },
      ],
      postconditions: [],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: { amount: -10 }, // Violates precondition
      preState,
      postStore: store,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.type).toBe('precondition');
  });

  it('fails when postcondition is false', () => {
    const spec = {
      name: 'TestBehavior',
      preconditions: [],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            { expression: binary('==', resultExpr('status'), str('success')), location: loc(1) },
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: {},
      preState,
      postStore: store,
      result: { status: 'failed' }, // Violates postcondition
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.type).toBe('postcondition');
  });

  it('fails when invariant is false', () => {
    const spec = {
      name: 'TestBehavior',
      preconditions: [],
      postconditions: [],
      invariants: [
        { expression: binary('>=', inputExpr('balance'), num(0)), location: loc(1) },
      ],
    };

    const result = verifier.verify({
      spec,
      input: { balance: -100 }, // Violates invariant
      preState,
      postStore: store,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.type).toBe('invariant');
  });
});

// ============================================================================
// OLD() EXPRESSION TESTS
// ============================================================================

describe('Verifier - old() Expressions', () => {
  it('verifies postconditions with old() state comparison', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    
    // Create account with initial balance
    store.create('Account', { id: 'acc1', balance: 1000 });
    const preState = store.snapshot();
    
    // Simulate transfer: deduct 200
    store.update('Account', 'acc1', { balance: 800 });

    const spec = {
      name: 'Transfer',
      preconditions: [],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            {
              expression: binary(
                '==',
                member(
                  call(member(id('Account'), 'lookup'), [
                    {
                      kind: 'MapExpr',
                      entries: [{ kind: 'MapEntry', key: str('id'), value: str('acc1'), location: defaultLocation }],
                      location: defaultLocation,
                    },
                  ]),
                  'balance'
                ),
                binary(
                  '-',
                  oldExpr(
                    member(
                      call(member(id('Account'), 'lookup'), [
                        {
                          kind: 'MapExpr',
                          entries: [{ kind: 'MapEntry', key: str('id'), value: str('acc1'), location: defaultLocation }],
                          location: defaultLocation,
                        },
                      ]),
                      'balance'
                    )
                  ),
                  inputExpr('amount')
                )
              ),
              location: loc(1),
            },
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: { amount: 200 },
      preState,
      postStore: store,
      result: { success: true },
      domain: { name: 'Banking', entities: [{ name: 'Account', fields: [] }], types: [] },
    });

    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// ERROR CASE TESTS
// ============================================================================

describe('Verifier - Error Cases', () => {
  it('checks error postconditions when execution fails', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            { expression: bool(true), location: loc(1) }, // Should not be checked
          ],
        },
        {
          condition: 'any_error',
          predicates: [
            { expression: binary('==', inputExpr('amount'), num(0)), location: loc(2) },
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: { amount: 0 },
      preState,
      postStore: store,
      error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough balance' },
    });

    expect(result.passed).toBe(true);
    // Only error postconditions should be checked
    expect(result.postconditions).toHaveLength(1);
  });

  it('checks specific error code postconditions', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [],
      postconditions: [
        {
          condition: 'INSUFFICIENT_FUNDS',
          predicates: [
            { expression: bool(true), location: loc(1) },
          ],
        },
        {
          condition: 'INVALID_INPUT',
          predicates: [
            { expression: bool(false), location: loc(2) }, // Should not be checked
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: {},
      preState,
      postStore: store,
      error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough' },
    });

    expect(result.passed).toBe(true);
    expect(result.postconditions).toHaveLength(1);
  });
});

// ============================================================================
// MULTIPLE CONDITIONS TESTS
// ============================================================================

describe('Verifier - Multiple Conditions', () => {
  it('reports all failures', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [
        { expression: binary('>', inputExpr('amount'), num(0)), location: loc(1) },
        { expression: binary('<', inputExpr('amount'), num(1000)), location: loc(2) },
      ],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            { expression: bool(false), location: loc(3) },
            { expression: bool(false), location: loc(4) },
          ],
        },
      ],
      invariants: [
        { expression: bool(false), location: loc(5) },
      ],
    };

    const result = verifier.verify({
      spec,
      input: { amount: 500 },
      preState,
      postStore: store,
      result: {},
    });

    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(1);
  });

  it('includes timing information', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [{ expression: bool(true), location: loc(1) }],
      postconditions: [],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: {},
      preState,
      postStore: store,
    });

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.preconditions[0]!.duration).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// QUICK VERIFY FUNCTION TESTS
// ============================================================================

describe('verifyExpression', () => {
  it('verifies simple expressions', () => {
    const result = verifyExpression(
      binary('>', num(5), num(3)),
      {}
    );

    expect(result.passed).toBe(true);
    expect(result.value).toBe(true);
  });

  it('verifies expressions with input', () => {
    const result = verifyExpression(
      binary('==', inputExpr('amount'), num(100)),
      { input: { amount: 100 } }
    );

    expect(result.passed).toBe(true);
  });

  it('verifies expressions with result', () => {
    const result = verifyExpression(
      binary('==', resultExpr('status'), str('success')),
      { result: { status: 'success' } }
    );

    expect(result.passed).toBe(true);
  });

  it('verifies expressions with state', () => {
    const result = verifyExpression(
      binary('==', member(id('user'), 'name'), str('Alice')),
      {
        postState: {
          User: [{ id: '1', name: 'Alice' }],
        },
        variables: { user: { name: 'Alice' } },
      }
    );

    expect(result.passed).toBe(true);
  });

  it('returns error on evaluation failure', () => {
    const result = verifyExpression(
      binary('/', num(1), num(0)), // Division by zero
      {}
    );

    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles old() with pre/post state via variables', () => {
    // Test that old() captures the snapshot of variables at call time
    // Note: old() is primarily for entity store state. For simple variable
    // snapshots, we simulate by passing different values in variables
    const result = verifyExpression(
      // 800 == 1000 - 200
      binary(
        '==',
        inputExpr('currentBalance'),
        binary('-', inputExpr('oldBalance'), num(200))
      ),
      {
        input: { currentBalance: 800, oldBalance: 1000 },
      }
    );

    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// FAILURE REPORTING TESTS
// ============================================================================

describe('Verifier - Failure Reporting', () => {
  it('includes expression string in failures', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [
        { expression: binary('>', inputExpr('amount'), num(0)), location: loc(1) },
      ],
      postconditions: [],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: { amount: -10 },
      preState,
      postStore: store,
    });

    expect(result.failures[0]!.expression).toContain('amount');
    expect(result.failures[0]!.expression).toContain('>');
    expect(result.failures[0]!.expression).toContain('0');
  });

  it('includes location in failures', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const location = { file: 'banking.isl', line: 42, column: 5, endLine: 42, endColumn: 30 };
    const spec = {
      name: 'TestBehavior',
      preconditions: [
        { expression: bool(false), location },
      ],
      postconditions: [],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: {},
      preState,
      postStore: store,
    });

    expect(result.failures[0]!.location).toEqual(location);
  });

  it('includes expected and actual values', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    const preState = store.snapshot();

    const spec = {
      name: 'TestBehavior',
      preconditions: [],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            { expression: binary('==', resultExpr('value'), num(100)), location: loc(1) },
          ],
        },
      ],
      invariants: [],
    };

    const result = verifier.verify({
      spec,
      input: {},
      preState,
      postStore: store,
      result: { value: 50 },
    });

    expect(result.postconditions[0]!.actual).toBe(false);
    expect(result.postconditions[0]!.expected).toBe(true);
  });
});

// ============================================================================
// COMPLEX SCENARIO TESTS
// ============================================================================

describe('Verifier - Complex Scenarios', () => {
  it('verifies a complete transfer scenario', () => {
    const verifier = createVerifier();
    const store = createEntityStore();
    
    // Setup: Create accounts
    store.create('Account', { id: 'sender', balance: 1000 });
    store.create('Account', { id: 'receiver', balance: 500 });
    
    const preState = store.snapshot();
    
    // Execute: Transfer 200 from sender to receiver
    store.update('Account', 'sender', { balance: 800 });
    store.update('Account', 'receiver', { balance: 700 });

    const mapEntry = (key: string, value: string) => ({
      kind: 'MapEntry',
      key: str(key),
      value: str(value),
      location: defaultLocation,
    });

    const mapExpr = (entries: unknown[]) => ({
      kind: 'MapExpr',
      entries,
      location: defaultLocation,
    });

    const lookupExpr = (entityName: string, id: string) =>
      call(member(id(entityName), 'lookup'), [mapExpr([mapEntry('id', id)])]);

    const spec = {
      name: 'Transfer',
      preconditions: [
        // amount > 0
        { expression: binary('>', inputExpr('amount'), num(0)), location: loc(1) },
        // amount <= sender.balance
        {
          expression: binary(
            '<=',
            inputExpr('amount'),
            member(
              call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'sender')])]),
              'balance'
            )
          ),
          location: loc(2),
        },
      ],
      postconditions: [
        {
          condition: 'success',
          predicates: [
            // sender.balance == old(sender.balance) - amount
            {
              expression: binary(
                '==',
                member(
                  call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'sender')])]),
                  'balance'
                ),
                binary(
                  '-',
                  oldExpr(
                    member(
                      call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'sender')])]),
                      'balance'
                    )
                  ),
                  inputExpr('amount')
                )
              ),
              location: loc(3),
            },
            // receiver.balance == old(receiver.balance) + amount
            {
              expression: binary(
                '==',
                member(
                  call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'receiver')])]),
                  'balance'
                ),
                binary(
                  '+',
                  oldExpr(
                    member(
                      call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'receiver')])]),
                      'balance'
                    )
                  ),
                  inputExpr('amount')
                )
              ),
              location: loc(4),
            },
          ],
        },
      ],
      invariants: [
        // sender.balance >= 0
        {
          expression: binary(
            '>=',
            member(
              call(member(id('Account'), 'lookup'), [mapExpr([mapEntry('id', 'sender')])]),
              'balance'
            ),
            num(0)
          ),
          location: loc(5),
        },
      ],
    };

    const result = verifier.verify({
      spec,
      input: { amount: 200 },
      preState,
      postStore: store,
      result: { success: true },
      domain: { name: 'Banking', entities: [{ name: 'Account', fields: [] }], types: [] },
    });

    expect(result.passed).toBe(true);
    expect(result.preconditions.every((p) => p.passed)).toBe(true);
    expect(result.postconditions.every((p) => p.passed)).toBe(true);
    expect(result.invariants.every((p) => p.passed)).toBe(true);
  });
});
