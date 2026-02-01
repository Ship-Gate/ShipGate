// ============================================================================
// ISL Interpreter - Scenario Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import type { Environment, Value } from '@isl-lang/runtime-interpreter';
import type {
  Scenario,
  Statement,
  Expression as ASTExpression,
} from '@isl-lang/parser';
import {
  runScenarios,
  runScenario,
  type ScenarioContext,
} from '../src/scenarios';
import type { Bindings, ScenarioTestData, VerificationOptions } from '../src/types';
import { toValue } from '../src/bindings';

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

function createMockEnvironment(bindings: Bindings): Environment {
  return {
    parent: null,
    bindings: new Map(bindings.pre),
    types: new Map(),
    effects: new Map(),
  };
}

async function mockEvaluate(expr: ASTExpression, env: Environment): Promise<Value> {
  // Simple mock evaluation for testing
  switch (expr.kind) {
    case 'Identifier':
      return env.bindings.get(expr.name) ?? { tag: 'option', value: null };
    case 'BooleanLiteral':
      return { tag: 'boolean', value: expr.value };
    case 'NumberLiteral':
      return { tag: 'int', value: BigInt(expr.value) };
    case 'StringLiteral':
      return { tag: 'string', value: expr.value };
    case 'BinaryExpr':
      const left = await mockEvaluate(expr.left, env);
      const right = await mockEvaluate(expr.right, env);
      if (expr.operator === '==') {
        if (left.tag === 'int' && right.tag === 'int') {
          return { tag: 'boolean', value: left.value === right.value };
        }
        if (left.tag === 'string' && right.tag === 'string') {
          return { tag: 'boolean', value: left.value === right.value };
        }
        if (left.tag === 'boolean' && right.tag === 'boolean') {
          return { tag: 'boolean', value: left.value === right.value };
        }
      }
      if (expr.operator === '>') {
        if (left.tag === 'int' && right.tag === 'int') {
          return { tag: 'boolean', value: left.value > right.value };
        }
      }
      if (expr.operator === 'and') {
        if (left.tag === 'boolean' && right.tag === 'boolean') {
          return { tag: 'boolean', value: left.value && right.value };
        }
      }
      throw new Error(`Unsupported binary operator: ${expr.operator}`);
    default:
      throw new Error(`Unsupported expression kind: ${expr.kind}`);
  }
}

async function mockExecute(stmt: Statement, env: Environment): Promise<void> {
  // Simple mock execution
  if (stmt.kind === 'AssignmentStmt') {
    const value = await mockEvaluate(stmt.value, env);
    env.bindings.set(stmt.target.name, value);
  }
}

function createMockContext(bindings: Bindings): ScenarioContext {
  return {
    bindings,
    evaluate: mockEvaluate,
    execute: mockExecute,
    createEnvironment: createMockEnvironment,
    options: {
      mode: 'scenario',
      timeout: 5000,
      sandbox: true,
      moduleSystem: 'auto',
      stackTraces: true,
      failFast: false,
      verbose: false,
    },
  };
}

function createMockScenario(
  name: string,
  given: Statement[],
  when: Statement[],
  then: ASTExpression[]
): Scenario {
  const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
  return {
    kind: 'Scenario',
    name: { kind: 'StringLiteral', value: name, location: loc },
    given,
    when,
    then,
    location: loc,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Scenarios', () => {
  describe('runScenario', () => {
    it('should run a simple passing scenario', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenario = createMockScenario(
        'simple test',
        [], // given
        [], // when
        [{ kind: 'BooleanLiteral', value: true, location: loc }] // then: true
      );
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const result = await runScenario(scenario, undefined, ctx);
      
      expect(result.name).toBe('simple test');
      expect(result.passed).toBe(true);
      expect(result.then).toHaveLength(1);
      expect(result.then[0].status).toBe('passed');
    });
    
    it('should run a failing scenario', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenario = createMockScenario(
        'failing test',
        [],
        [],
        [{ kind: 'BooleanLiteral', value: false, location: loc }]
      );
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const result = await runScenario(scenario, undefined, ctx);
      
      expect(result.name).toBe('failing test');
      expect(result.passed).toBe(false);
      expect(result.then[0].status).toBe('failed');
    });
    
    it('should execute given steps', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const givenStep: Statement = {
        kind: 'AssignmentStmt',
        target: { kind: 'Identifier', name: 'x', location: loc },
        value: { kind: 'NumberLiteral', value: 42, isFloat: false, location: loc },
        location: loc,
      };
      
      const scenario = createMockScenario(
        'with given',
        [givenStep],
        [],
        [
          {
            kind: 'BinaryExpr',
            operator: '==',
            left: { kind: 'Identifier', name: 'x', location: loc },
            right: { kind: 'NumberLiteral', value: 42, isFloat: false, location: loc },
            location: loc,
          },
        ]
      );
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const result = await runScenario(scenario, undefined, ctx);
      
      expect(result.passed).toBe(true);
      expect(result.given).toHaveLength(1);
      expect(result.given[0].result.status).toBe('passed');
    });
    
    it('should use test data for given values', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenario = createMockScenario(
        'with test data',
        [],
        [],
        [
          {
            kind: 'BinaryExpr',
            operator: '>',
            left: { kind: 'Identifier', name: 'balance', location: loc },
            right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc },
            location: loc,
          },
        ]
      );
      
      const testData: ScenarioTestData = {
        name: 'with test data',
        given: { balance: 500 },
      };
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const result = await runScenario(scenario, testData, ctx);
      
      expect(result.passed).toBe(true);
    });
    
    it('should check expected results from test data', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenario = createMockScenario('check expected', [], [], []);
      
      const testData: ScenarioTestData = {
        name: 'check expected',
        expected: {
          success: true,
        },
      };
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
        result: { tag: 'boolean', value: true },
      };
      
      const ctx = createMockContext(bindings);
      const result = await runScenario(scenario, testData, ctx);
      
      expect(result.then.some((t) => t.message?.includes('success'))).toBe(true);
    });
  });
  
  describe('runScenarios', () => {
    it('should run multiple scenarios', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenarios = [
        createMockScenario('test 1', [], [], [
          { kind: 'BooleanLiteral', value: true, location: loc },
        ]),
        createMockScenario('test 2', [], [], [
          { kind: 'BooleanLiteral', value: true, location: loc },
        ]),
      ];
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const results = await runScenarios(scenarios, undefined, ctx);
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('test 1');
      expect(results[1].name).toBe('test 2');
    });
    
    it('should stop on first failure with failFast', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenarios = [
        createMockScenario('passing', [], [], [
          { kind: 'BooleanLiteral', value: true, location: loc },
        ]),
        createMockScenario('failing', [], [], [
          { kind: 'BooleanLiteral', value: false, location: loc },
        ]),
        createMockScenario('should not run', [], [], [
          { kind: 'BooleanLiteral', value: true, location: loc },
        ]),
      ];
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      ctx.options.failFast = true;
      
      const results = await runScenarios(scenarios, undefined, ctx);
      
      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });
    
    it('should match scenarios with test data by name', async () => {
      const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
      
      const scenarios = [
        createMockScenario('test 1', [], [], [
          {
            kind: 'BinaryExpr',
            operator: '==',
            left: { kind: 'Identifier', name: 'x', location: loc },
            right: { kind: 'NumberLiteral', value: 10, isFloat: false, location: loc },
            location: loc,
          },
        ]),
      ];
      
      const testData: ScenarioTestData[] = [
        {
          name: 'test 1',
          given: { x: 10 },
        },
      ];
      
      const bindings: Bindings = {
        pre: new Map(),
        post: new Map(),
        old: new Map(),
      };
      
      const ctx = createMockContext(bindings);
      const results = await runScenarios(scenarios, testData, ctx);
      
      expect(results[0].passed).toBe(true);
    });
  });
});

describe('Scenario Error Handling', () => {
  it('should catch evaluation errors', async () => {
    const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
    
    const scenario: Scenario = {
      kind: 'Scenario',
      name: { kind: 'StringLiteral', value: 'error test', location: loc },
      given: [],
      when: [],
      then: [
        {
          kind: 'CallExpr',
          callee: { kind: 'Identifier', name: 'undefinedFunction', location: loc },
          arguments: [],
          location: loc,
        },
      ],
      location: loc,
    };
    
    const bindings: Bindings = {
      pre: new Map(),
      post: new Map(),
      old: new Map(),
    };
    
    const ctx = createMockContext(bindings);
    const result = await runScenario(scenario, undefined, ctx);
    
    expect(result.passed).toBe(false);
    expect(result.then.some((t) => t.status === 'error')).toBe(true);
  });
  
  it('should handle step execution errors', async () => {
    const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
    
    const errorStep: Statement = {
      kind: 'CallStmt',
      call: {
        kind: 'CallExpr',
        callee: { kind: 'Identifier', name: 'throwingFunction', location: loc },
        arguments: [],
        location: loc,
      },
      location: loc,
    };
    
    const scenario: Scenario = {
      kind: 'Scenario',
      name: { kind: 'StringLiteral', value: 'step error test', location: loc },
      given: [errorStep],
      when: [],
      then: [],
      location: loc,
    };
    
    const bindings: Bindings = {
      pre: new Map(),
      post: new Map(),
      old: new Map(),
    };
    
    const ctx = createMockContext(bindings);
    const result = await runScenario(scenario, undefined, ctx);
    
    expect(result.passed).toBe(false);
    expect(result.given.some((g) => g.result.status === 'error')).toBe(true);
  });
});
