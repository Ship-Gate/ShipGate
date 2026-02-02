/**
 * ISL Test Generator
 * 
 * Generates test cases from ISL behavior specifications.
 */

import type * as AST from '../ast/types.js';

// ============================================================================
// Test Generation Types
// ============================================================================

export interface GeneratedTest {
  /** Test name */
  name: string;
  /** Test description */
  description: string;
  /** Behavior being tested */
  behaviorName: string;
  /** Test category */
  category: TestCategory;
  /** Generated test code */
  code: string;
  /** Input values for the test */
  inputs: Record<string, unknown>;
  /** Expected outcomes */
  expectations: TestExpectation[];
}

export type TestCategory = 
  | 'precondition'
  | 'postcondition'
  | 'invariant'
  | 'happy-path'
  | 'error-path'
  | 'boundary';

export interface TestExpectation {
  type: 'success' | 'error' | 'assert';
  expression?: string;
  errorType?: string;
  message?: string;
}

export interface TestSuite {
  /** Suite name */
  name: string;
  /** Generated tests */
  tests: GeneratedTest[];
  /** Setup code */
  setup?: string;
  /** Teardown code */
  teardown?: string;
}

export interface TestGenOptions {
  /** Test framework to generate for */
  framework?: 'vitest' | 'jest' | 'mocha';
  /** Generate boundary tests */
  includeBoundary?: boolean;
  /** Generate error path tests */
  includeErrors?: boolean;
  /** Custom test templates */
  templates?: Partial<TestTemplates>;
}

export interface TestTemplates {
  suite: string;
  test: string;
  assertion: string;
}

// ============================================================================
// Default Templates (for future template-based code generation)
// ============================================================================

/** Default test templates for different frameworks */
export const DEFAULT_TEMPLATES: Record<string, TestTemplates> = {
  vitest: {
    suite: `import { describe, it, expect } from 'vitest';
import { {{imports}} } from '{{module}}';

describe('{{suiteName}}', () => {
{{tests}}
});`,
    test: `  it('{{testName}}', async () => {
{{assertions}}
  });`,
    assertion: `    expect({{actual}}).{{matcher}}({{expected}});`,
  },
  jest: {
    suite: `import { {{imports}} } from '{{module}}';

describe('{{suiteName}}', () => {
{{tests}}
});`,
    test: `  it('{{testName}}', async () => {
{{assertions}}
  });`,
    assertion: `    expect({{actual}}).{{matcher}}({{expected}});`,
  },
  mocha: {
    suite: `import { {{imports}} } from '{{module}}';
import { expect } from 'chai';

describe('{{suiteName}}', () => {
{{tests}}
});`,
    test: `  it('{{testName}}', async () => {
{{assertions}}
  });`,
    assertion: `    expect({{actual}}).to.{{matcher}}({{expected}});`,
  },
};

// ============================================================================
// Test Generator Implementation
// ============================================================================

export class TestGenerator {
  private options: {
    framework: 'vitest' | 'jest' | 'mocha';
    includeBoundary: boolean;
    includeErrors: boolean;
  };

  constructor(options: TestGenOptions = {}) {
    const framework = options.framework ?? 'vitest';
    this.options = {
      framework,
      includeBoundary: options.includeBoundary ?? true,
      includeErrors: options.includeErrors ?? true,
    };
  }

  /**
   * Generate tests for a domain
   */
  generateSuite(domain: AST.DomainDeclaration): TestSuite {
    const tests: GeneratedTest[] = [];

    for (const behavior of domain.behaviors) {
      tests.push(...this.generateBehaviorTests(behavior));
    }

    return {
      name: `${domain.name.name}Tests`,
      tests,
    };
  }

  /**
   * Generate tests for a single behavior
   */
  generateBehaviorTests(behavior: AST.BehaviorDeclaration): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Generate happy path test
    tests.push(this.generateHappyPathTest(behavior));

    // Generate precondition tests
    if (behavior.preconditions) {
      tests.push(...this.generatePreconditionTests(behavior));
    }

    // Generate postcondition tests
    if (behavior.postconditions) {
      tests.push(...this.generatePostconditionTests(behavior));
    }

    // Generate error path tests
    if (this.options.includeErrors && behavior.output?.errors) {
      tests.push(...this.generateErrorTests(behavior));
    }

    // Generate boundary tests
    if (this.options.includeBoundary && behavior.input) {
      tests.push(...this.generateBoundaryTests(behavior));
    }

    return tests;
  }

  private generateHappyPathTest(behavior: AST.BehaviorDeclaration): GeneratedTest {
    const inputs = this.generateValidInputs(behavior);
    
    return {
      name: `${behavior.name.name}_happyPath`,
      description: `${behavior.name.name} succeeds with valid inputs`,
      behaviorName: behavior.name.name,
      category: 'happy-path',
      code: this.generateTestCode(behavior, inputs, [{ type: 'success' }]),
      inputs,
      expectations: [{ type: 'success' }],
    };
  }

  private generatePreconditionTests(behavior: AST.BehaviorDeclaration): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    
    if (!behavior.preconditions) return tests;

    for (let i = 0; i < behavior.preconditions.conditions.length; i++) {
      const condition = behavior.preconditions.conditions[i]!;
      const inputs = this.generateInvalidInputs(behavior, condition);
      
      tests.push({
        name: `${behavior.name.name}_precondition_${i + 1}_violated`,
        description: `${behavior.name.name} fails when precondition ${i + 1} is violated`,
        behaviorName: behavior.name.name,
        category: 'precondition',
        code: this.generateTestCode(behavior, inputs, [{ type: 'error' }]),
        inputs,
        expectations: [{ type: 'error' }],
      });
    }

    return tests;
  }

  private generatePostconditionTests(behavior: AST.BehaviorDeclaration): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    
    if (!behavior.postconditions) return tests;

    for (let i = 0; i < behavior.postconditions.conditions.length; i++) {
      const condition = behavior.postconditions.conditions[i]!;
      const inputs = this.generateValidInputs(behavior);
      
      // Extract the expression from the condition
      const expr = condition.statements[0]?.expression;
      const exprStr = expr ? this.expressionToString(expr) : 'true';
      
      tests.push({
        name: `${behavior.name.name}_postcondition_${i + 1}_holds`,
        description: `${behavior.name.name} satisfies postcondition ${i + 1}`,
        behaviorName: behavior.name.name,
        category: 'postcondition',
        code: this.generateTestCode(behavior, inputs, [
          { type: 'success' },
          { type: 'assert', expression: exprStr },
        ]),
        inputs,
        expectations: [
          { type: 'success' },
          { type: 'assert', expression: exprStr },
        ],
      });
    }

    return tests;
  }

  private generateErrorTests(behavior: AST.BehaviorDeclaration): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    
    if (!behavior.output?.errors) return tests;

    for (const error of behavior.output.errors) {
      const inputs = this.generateErrorTriggerInputs(behavior, error);
      
      tests.push({
        name: `${behavior.name.name}_error_${error.name.name}`,
        description: `${behavior.name.name} throws ${error.name.name}`,
        behaviorName: behavior.name.name,
        category: 'error-path',
        code: this.generateTestCode(behavior, inputs, [
          { type: 'error', errorType: error.name.name },
        ]),
        inputs,
        expectations: [{ type: 'error', errorType: error.name.name }],
      });
    }

    return tests;
  }

  private generateBoundaryTests(behavior: AST.BehaviorDeclaration): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    
    if (!behavior.input) return tests;

    for (const field of behavior.input.fields) {
      // Generate boundary test for constrained fields
      for (const constraint of field.constraints) {
        if (constraint.name.name === 'min' || constraint.name.name === 'max') {
          const inputs = this.generateBoundaryInputs(behavior, field, constraint);
          
          tests.push({
            name: `${behavior.name.name}_boundary_${field.name.name}_${constraint.name.name}`,
            description: `${behavior.name.name} handles ${constraint.name.name} boundary for ${field.name.name}`,
            behaviorName: behavior.name.name,
            category: 'boundary',
            code: this.generateTestCode(behavior, inputs, [{ type: 'success' }]),
            inputs,
            expectations: [{ type: 'success' }],
          });
        }
      }
    }

    return tests;
  }

  // Input generation helpers

  private generateValidInputs(behavior: AST.BehaviorDeclaration): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    
    if (!behavior.input) return inputs;

    for (const field of behavior.input.fields) {
      inputs[field.name.name] = this.generateValueForType(field.type);
    }

    return inputs;
  }

  private generateInvalidInputs(
    behavior: AST.BehaviorDeclaration,
    _condition: AST.Condition
  ): Record<string, unknown> {
    // Generate inputs that would violate the condition
    const inputs = this.generateValidInputs(behavior);
    
    // For simplicity, we just return empty/invalid values
    // A full implementation would analyze the condition
    for (const key of Object.keys(inputs)) {
      inputs[key] = null;
    }

    return inputs;
  }

  private generateErrorTriggerInputs(
    behavior: AST.BehaviorDeclaration,
    _error: AST.ErrorDeclaration
  ): Record<string, unknown> {
    // Generate inputs that would trigger the error
    return this.generateValidInputs(behavior);
  }

  private generateBoundaryInputs(
    behavior: AST.BehaviorDeclaration,
    field: AST.FieldDeclaration,
    constraint: AST.TypeConstraint
  ): Record<string, unknown> {
    const inputs = this.generateValidInputs(behavior);
    
    // Set the field to the boundary value
    if (constraint.value?.kind === 'NumberLiteral') {
      inputs[field.name.name] = constraint.value.value;
    }

    return inputs;
  }

  private generateValueForType(type: AST.TypeExpression): unknown {
    const typeName = type.kind === 'SimpleType' ? type.name.name.toLowerCase() : '';
    
    switch (typeName) {
      case 'string':
        return 'test-string';
      case 'int':
      case 'integer':
      case 'number':
        return 42;
      case 'float':
      case 'double':
        return 3.14;
      case 'boolean':
      case 'bool':
        return true;
      case 'uuid':
        return '550e8400-e29b-41d4-a716-446655440000';
      case 'email':
        return 'test@example.com';
      case 'datetime':
        return new Date().toISOString();
      default:
        return {};
    }
  }

  // Code generation helpers

  private generateTestCode(
    behavior: AST.BehaviorDeclaration,
    inputs: Record<string, unknown>,
    expectations: TestExpectation[]
  ): string {
    const lines: string[] = [];
    
    // Setup
    lines.push(`// Test: ${behavior.name.name}`);
    lines.push(`const input = ${JSON.stringify(inputs, null, 2)};`);
    lines.push('');
    
    // Execution
    lines.push(`const result = await ${behavior.name.name}(input);`);
    lines.push('');
    
    // Assertions
    for (const exp of expectations) {
      switch (exp.type) {
        case 'success':
          lines.push('expect(result).toBeDefined();');
          break;
        case 'error':
          if (exp.errorType) {
            lines.push(`expect(() => ${behavior.name.name}(input)).toThrow(${exp.errorType});`);
          } else {
            lines.push(`expect(() => ${behavior.name.name}(input)).toThrow();`);
          }
          break;
        case 'assert':
          lines.push(`expect(${exp.expression}).toBe(true);`);
          break;
      }
    }

    return lines.join('\n');
  }

  private expressionToString(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'MemberExpression':
        return `${this.expressionToString(expr.object)}.${expr.property.name}`;
      case 'ComparisonExpression':
        return `${this.expressionToString(expr.left)} ${expr.operator} ${this.expressionToString(expr.right)}`;
      case 'LogicalExpression':
        return `${this.expressionToString(expr.left)} ${expr.operator === 'and' ? '&&' : '||'} ${this.expressionToString(expr.right)}`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'BooleanLiteral':
        return String(expr.value);
      default:
        return 'true';
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate tests for a domain
 */
export function generateTests(
  domain: AST.DomainDeclaration,
  options?: TestGenOptions
): TestSuite {
  const generator = new TestGenerator(options);
  return generator.generateSuite(domain);
}

/**
 * Generate tests for a single behavior
 */
export function generateBehaviorTests(
  behavior: AST.BehaviorDeclaration,
  options?: TestGenOptions
): GeneratedTest[] {
  const generator = new TestGenerator(options);
  return generator.generateBehaviorTests(behavior);
}

/**
 * Get test code as a string
 */
export function generateTestCode(
  domain: AST.DomainDeclaration,
  options?: TestGenOptions
): string {
  const suite = generateTests(domain, options);
  
  // Simple code output
  const lines: string[] = [];
  lines.push(`// Generated tests for ${domain.name.name}`);
  lines.push('');
  
  for (const test of suite.tests) {
    lines.push(`// ${test.description}`);
    lines.push(`test('${test.name}', async () => {`);
    lines.push(test.code.split('\n').map(l => '  ' + l).join('\n'));
    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}
