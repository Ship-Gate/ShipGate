// ============================================================================
// Scenario Test Generator
// Converts ISL scenarios to executable test cases
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import { compileExpression, compileAssertion } from './expression-compiler';
import type { ScenarioContext, TestFramework } from './types';

/**
 * Generate tests from scenario blocks
 */
export function generateScenarioTests(
  scenarioBlock: AST.ScenarioBlock,
  framework: TestFramework
): string {
  const behaviorName = scenarioBlock.behaviorName.name;
  const scenarios = scenarioBlock.scenarios;

  const tests = scenarios.map((scenario) => generateScenarioTest(scenario, behaviorName, framework));

  return `
describe('${behaviorName} Scenarios', () => {
  ${tests.join('\n\n  ')}
});
  `.trim();
}

/**
 * Generate a single scenario test
 */
function generateScenarioTest(
  scenario: AST.Scenario,
  behaviorName: string,
  framework: TestFramework
): string {
  const scenarioName = scenario.name.value;
  const givenCode = generateGivenBlock(scenario.given);
  const whenCode = generateWhenBlock(scenario.when, behaviorName);
  const thenCode = generateThenBlock(scenario.then, framework);

  return `
  it('${scenarioName}', async () => {
    // Given
    ${givenCode}

    // When
    ${whenCode}

    // Then
    ${thenCode}
  });
  `.trim();
}

/**
 * Generate setup code from 'given' statements
 */
function generateGivenBlock(statements: AST.Statement[]): string {
  if (statements.length === 0) {
    return '// No setup required';
  }

  return statements.map((stmt) => compileStatement(stmt)).join('\n    ');
}

/**
 * Generate execution code from 'when' statements
 */
function generateWhenBlock(statements: AST.Statement[], behaviorName: string): string {
  if (statements.length === 0) {
    return `const result = await ${behaviorName}({});`;
  }

  return statements.map((stmt) => compileStatement(stmt)).join('\n    ');
}

/**
 * Generate assertion code from 'then' expressions
 */
function generateThenBlock(expressions: AST.Expression[], framework: TestFramework): string {
  if (expressions.length === 0) {
    return 'expect(result).toBeDefined();';
  }

  return expressions.map((expr) => compileThenExpression(expr, framework)).join('\n    ');
}

/**
 * Compile a statement to TypeScript code
 */
function compileStatement(stmt: AST.Statement): string {
  switch (stmt.kind) {
    case 'AssignmentStmt':
      return `const ${stmt.target.name} = ${compileExpression(stmt.value)};`;

    case 'CallStmt':
      const callCode = compileExpression(stmt.call);
      if (stmt.target) {
        return `const ${stmt.target.name} = await ${callCode};`;
      }
      return `await ${callCode};`;

    case 'LoopStmt':
      const count = compileExpression(stmt.count);
      const variable = stmt.variable?.name || '_i';
      const body = stmt.body.map((s) => compileStatement(s)).join('\n      ');
      return `for (let ${variable} = 0; ${variable} < ${count}; ${variable}++) {\n      ${body}\n    }`;

    default:
      return `// Unknown statement: ${(stmt as AST.Statement).kind}`;
  }
}

/**
 * Compile a 'then' expression to an assertion
 */
function compileThenExpression(expr: AST.Expression, framework: TestFramework): string {
  // Handle "result is success" pattern
  if (expr.kind === 'BinaryExpr') {
    const left = expr.left;
    const right = expr.right;

    // Check for "result is success" or "result is ERROR_NAME"
    if (left.kind === 'Identifier' && left.name === 'result') {
      if (right.kind === 'Identifier') {
        if (right.name === 'success') {
          return 'expect(result.success).toBe(true);';
        }
        if (right.name === 'error') {
          return 'expect(result.success).toBe(false);';
        }
        // Specific error type
        return `expect(result.error).toBe('${right.name}');`;
      }
    }
  }

  // Default to compiled assertion
  return compileAssertion(expr, framework);
}

/**
 * Generate describe block for all scenario blocks in a domain
 */
export function generateAllScenariosDescribeBlock(
  domain: AST.Domain,
  framework: TestFramework
): string {
  const scenarioBlocks = domain.scenarios;

  if (scenarioBlocks.length === 0) {
    return '';
  }

  const tests = scenarioBlocks.map((block) => generateScenarioTests(block, framework));

  return tests.join('\n\n');
}

/**
 * Generate scenario context for a single scenario
 */
export function extractScenarioContext(
  scenario: AST.Scenario,
  behaviorName: string
): ScenarioContext {
  return {
    behaviorName,
    scenarioName: scenario.name.value,
    givenStatements: scenario.given,
    whenStatements: scenario.when,
    thenExpressions: scenario.then,
  };
}

/**
 * Generate helper functions for scenario testing
 */
export function generateScenarioHelpers(domain: AST.Domain): string {
  const behaviors = domain.behaviors.map((b) => b.name.name);

  return `
// Scenario test helpers
export const scenarioHelpers = {
  // Create mock implementations for behaviors
  ${behaviors.map((name) => `
  mock${name}(impl: (input: ${name}Input) => Promise<${name}Result>): void {
    // Mock implementation
  }`).join(',\n  ')}

  // State snapshot helpers
  captureState(): Record<string, unknown> {
    return {
      // Capture current state of entities
    };
  },

  restoreState(snapshot: Record<string, unknown>): void {
    // Restore state from snapshot
  },

  // Comparison helpers
  assertStateUnchanged(before: Record<string, unknown>, after: Record<string, unknown>): void {
    expect(before).toEqual(after);
  },

  assertEntityCreated<T>(entityName: string, predicate: (e: T) => boolean): void {
    // Assert entity was created matching predicate
  },

  assertEntityUpdated<T>(entityName: string, id: string, changes: Partial<T>): void {
    // Assert entity was updated with changes
  }
};
  `.trim();
}

/**
 * Generate data builders for scenarios
 */
export function generateScenarioDataBuilders(behavior: AST.Behavior): string {
  const behaviorName = behavior.name.name;
  const inputFields = behavior.input.fields;

  const fieldBuilders = inputFields.map((field) => {
    const fieldName = field.name.name;
    return `
  with${capitalize(fieldName)}(value: ${getTypeScriptType(field.type)}): this {
    this.data.${fieldName} = value;
    return this;
  }`;
  }).join('\n');

  return `
// Data builder for ${behaviorName} scenarios
export class ${behaviorName}InputBuilder {
  private data: Partial<${behaviorName}Input> = {};

  ${fieldBuilders}

  build(): ${behaviorName}Input {
    return this.data as ${behaviorName}Input;
  }

  static create(): ${behaviorName}InputBuilder {
    return new ${behaviorName}InputBuilder();
  }
}
  `.trim();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getTypeScriptType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return mapPrimitiveType(type.name);
    case 'ReferenceType':
      return type.name.parts.map((p) => p.name).join('.');
    case 'ListType':
      return `${getTypeScriptType(type.element)}[]`;
    case 'OptionalType':
      return `${getTypeScriptType(type.inner)} | undefined`;
    default:
      return 'unknown';
  }
}

function mapPrimitiveType(name: string): string {
  switch (name) {
    case 'String':
      return 'string';
    case 'Int':
    case 'Decimal':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'UUID':
      return 'string';
    case 'Timestamp':
      return 'Date';
    case 'Duration':
      return 'number';
    default:
      return 'unknown';
  }
}
