/**
 * Test Harness Generator
 * 
 * Generates Vitest test suites from ISL behavior specifications.
 * Transforms postconditions and invariants into executable tests.
 */

import type {
  Domain,
  Behavior,
  PostconditionBlock,
  Expression,
  TemporalSpec,
  DurationLiteral,
} from '@isl-lang/parser';

export interface GeneratedTests {
  filename: string;
  content: string;
}

export interface TestGeneratorOptions {
  framework?: 'vitest' | 'jest';
  includeSetup?: boolean;
  generateMocks?: boolean;
}

export class TestGenerator {
  private options: Required<TestGeneratorOptions>;
  private output: string[] = [];
  private indent: number = 0;
  private domainName: string = '';

  constructor(options: TestGeneratorOptions = {}) {
    this.options = {
      framework: options.framework ?? 'vitest',
      includeSetup: options.includeSetup ?? true,
      generateMocks: options.generateMocks ?? true,
    };
  }

  /**
   * Generate test suite from an ISL domain
   */
  generate(domain: Domain): GeneratedTests {
    this.output = [];
    this.indent = 0;
    this.domainName = domain.name.name;
    void this.domainName; // Used for future reference

    // Imports
    this.generateImports(domain);
    this.writeLine('');

    // Generate tests for each behavior
    for (const behavior of domain.behaviors) {
      this.generateBehaviorTests(behavior);
      this.writeLine('');
    }

    return {
      filename: `${domain.name.name.toLowerCase()}.spec.ts`,
      content: this.output.join('\n'),
    };
  }

  private generateImports(domain: Domain): void {
    const framework = this.options.framework;
    
    if (framework === 'vitest') {
      this.writeLine("import { describe, it, expect, beforeEach, afterEach } from 'vitest';");
    } else {
      this.writeLine("import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';");
    }
    
    this.writeLine('');
    
    // Import test runtime for entity bindings
    this.writeLine('// Test runtime for entity bindings');
    this.writeLine("import { createTestContext } from '@isl-lang/test-runtime';");
    this.writeLine('');
    
    this.writeLine(`// Import types from generated types`);
    this.writeLine(`import type {`);
    this.indent++;
    
    for (const behavior of domain.behaviors) {
      this.writeLine(`${behavior.name.name}Input,`);
      this.writeLine(`${behavior.name.name}Result,`);
    }
    
    for (const entity of domain.entities) {
      this.writeLine(`${entity.name.name},`);
    }
    
    this.indent--;
    this.writeLine(`} from './${domain.name.name.toLowerCase()}.types.js';`);
    
    this.writeLine('');
    this.writeLine('// Import implementation to test');
    this.writeLine(`// TODO: Update this import path to your actual implementation`);
    for (const behavior of domain.behaviors) {
      const funcName = this.camelCase(behavior.name.name);
      this.writeLine(`// import { ${funcName} } from './implementations/${funcName}.js';`);
    }
    
    this.writeLine('');
    
    // Setup test context with entity bindings
    const entityNames = domain.entities.map(e => `'${e.name.name}'`).join(', ');
    this.writeLine('// Test context with entity bindings');
    this.writeLine(`const ctx = createTestContext({ entities: [${entityNames}] });`);
    if (domain.entities.length > 0) {
      const destructure = domain.entities.map(e => e.name.name).join(', ');
      this.writeLine(`const { ${destructure} } = ctx.entities;`);
    }
  }

  private generateBehaviorTests(behavior: Behavior): void {
    const name = behavior.name.name;

    this.writeLine(`describe('${name}', () => {`);
    this.indent++;

    // Setup and teardown
    if (this.options.includeSetup) {
      this.generateSetup(behavior);
      this.writeLine('');
    }

    // Generate tests from preconditions
    if (behavior.preconditions.length > 0) {
      this.generatePreconditionTests(behavior);
    }

    // Generate tests from postconditions
    if (behavior.postconditions.length > 0) {
      this.generatePostconditionTests(behavior);
    }

    // Generate tests from invariants
    if (behavior.invariants.length > 0) {
      this.generateInvariantTests(behavior);
    }

    // Generate temporal requirement tests
    if (behavior.temporal.length > 0) {
      this.generateTemporalTests(behavior);
    }

    this.indent--;
    this.writeLine('});');
  }

  private generateSetup(behavior: Behavior): void {
    const funcName = this.camelCase(behavior.name.name);
    
    this.writeLine('// Test setup');
    this.writeLine(`let ${funcName}: (input: ${behavior.name.name}Input) => Promise<${behavior.name.name}Result>;`);
    
    this.writeLine('');
    this.writeLine('beforeEach(() => {');
    this.indent++;
    this.writeLine('// Reset entity store');
    this.writeLine('ctx.reset();');
    this.writeLine('');
    this.writeLine('// TODO: Initialize your implementation here');
    this.writeLine(`// ${funcName} = createImplementation();`);
    this.indent--;
    this.writeLine('});');
    
    this.writeLine('');
    this.writeLine('afterEach(() => {');
    this.indent++;
    this.writeLine('// Cleanup');
    this.indent--;
    this.writeLine('});');
  }

  private generatePreconditionTests(behavior: Behavior): void {
    this.writeLine('describe("preconditions", () => {');
    this.indent++;

    for (const precondition of behavior.preconditions) {
      this.generatePreconditionTest(behavior, precondition);
    }

    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generatePreconditionTest(behavior: Behavior, precondition: Expression): void {
    const testName = this.expressionToTestName(precondition, 'rejects when');
    const funcName = this.camelCase(behavior.name.name);

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    this.writeLine('// Arrange: Create input that violates precondition');
    this.writeLine(`const invalidInput = {} as ${behavior.name.name}Input; // TODO: Set up invalid input`);
    this.writeLine('');
    this.writeLine('// Act');
    this.writeLine(`const result = await ${funcName}(invalidInput);`);
    this.writeLine('');
    this.writeLine('// Assert');
    this.writeLine('expect(result.success).toBe(false);');
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generatePostconditionTests(behavior: Behavior): void {
    this.writeLine('describe("postconditions", () => {');
    this.indent++;

    for (const block of behavior.postconditions) {
      this.generatePostconditionBlockTests(behavior, block);
    }

    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generatePostconditionBlockTests(behavior: Behavior, block: PostconditionBlock): void {
    const condition = this.getConditionName(block.condition);
    const funcName = this.camelCase(behavior.name.name);
    
    if (condition === 'success') {
      this.writeLine('describe("on success", () => {');
      this.indent++;
      
      for (const predicate of block.predicates) {
        this.generateSuccessPostconditionTest(behavior, predicate, funcName);
      }
      
      this.indent--;
      this.writeLine('});');
      this.writeLine('');
    } else if (condition === 'any_error') {
      this.writeLine('describe("on any error", () => {');
      this.indent++;
      
      for (const predicate of block.predicates) {
        this.generateFailurePostconditionTest(behavior, predicate, funcName);
      }
      
      this.indent--;
      this.writeLine('});');
      this.writeLine('');
    } else {
      // Named error condition
      this.writeLine(`describe("on ${condition}", () => {`);
      this.indent++;
      
      for (const predicate of block.predicates) {
        this.generateErrorPostconditionTest(behavior, predicate, funcName, condition);
      }
      
      this.indent--;
      this.writeLine('});');
      this.writeLine('');
    }
  }

  private getConditionName(condition: PostconditionBlock['condition']): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any_error';
    return condition.name;
  }

  private generateSuccessPostconditionTest(behavior: Behavior, predicate: Expression, funcName: string): void {
    const testName = this.expressionToTestName(predicate, 'ensures');

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    this.writeLine('// Arrange');
    this.writeLine(`const input: ${behavior.name.name}Input = {`);
    this.indent++;
    this.writeLine('// TODO: Set up valid input');
    this.indent--;
    this.writeLine('};');
    this.writeLine('');
    this.writeLine('// Capture state before operation');
    this.writeLine('const __old__ = ctx.captureState();');
    this.writeLine('');
    this.writeLine('// Act');
    this.writeLine(`const result = await ${funcName}(input);`);
    this.writeLine('');
    this.writeLine('// Assert');
    this.writeLine('expect(result.success).toBe(true);');
    this.writeLine('if (result.success) {');
    this.indent++;
    this.generateAssertionFromExpression(predicate, 'result.data', 'input');
    this.indent--;
    this.writeLine('}');
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateFailurePostconditionTest(behavior: Behavior, predicate: Expression, funcName: string): void {
    const testName = this.expressionToTestName(predicate, 'ensures on failure');

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    this.writeLine('// Arrange: Create input that causes failure');
    this.writeLine(`const failingInput: ${behavior.name.name}Input = {`);
    this.indent++;
    this.writeLine('// TODO: Set up failing input');
    this.indent--;
    this.writeLine('};');
    this.writeLine('');
    this.writeLine('// Act');
    this.writeLine(`const result = await ${funcName}(failingInput);`);
    this.writeLine('');
    this.writeLine('// Assert');
    this.writeLine('expect(result.success).toBe(false);');
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateErrorPostconditionTest(behavior: Behavior, predicate: Expression, funcName: string, errorName: string): void {
    const testName = this.expressionToTestName(predicate, `on ${errorName}`);

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    this.writeLine(`// Arrange: Create input that causes ${errorName}`);
    this.writeLine(`const input: ${behavior.name.name}Input = {`);
    this.indent++;
    this.writeLine('// TODO: Set up input that causes this error');
    this.indent--;
    this.writeLine('};');
    this.writeLine('');
    this.writeLine('// Act');
    this.writeLine(`const result = await ${funcName}(input);`);
    this.writeLine('');
    this.writeLine('// Assert');
    this.writeLine('expect(result.success).toBe(false);');
    this.writeLine('if (!result.success) {');
    this.indent++;
    this.writeLine(`expect(result.error.code).toBe('${errorName}');`);
    this.indent--;
    this.writeLine('}');
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateInvariantTests(behavior: Behavior): void {
    this.writeLine('describe("invariants", () => {');
    this.indent++;

    for (const invariant of behavior.invariants) {
      this.generateInvariantTest(behavior, invariant);
    }

    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateInvariantTest(behavior: Behavior, invariant: Expression): void {
    const testName = this.expressionToTestName(invariant, 'maintains');
    const funcName = this.camelCase(behavior.name.name);

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    this.writeLine('// Arrange');
    this.writeLine(`const input: ${behavior.name.name}Input = {`);
    this.indent++;
    this.writeLine('// TODO: Set up input');
    this.indent--;
    this.writeLine('};');
    this.writeLine('');
    this.writeLine('// Act');
    this.writeLine(`const result = await ${funcName}(input);`);
    this.writeLine('');
    this.writeLine('// Assert: Invariant should hold regardless of success/failure');
    this.writeLine(`// TODO: Verify invariant: ${this.expressionToString(invariant)}`);
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateTemporalTests(behavior: Behavior): void {
    this.writeLine('describe("temporal requirements", () => {');
    this.indent++;

    for (const temporal of behavior.temporal) {
      this.generateTemporalTest(behavior, temporal);
    }

    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateTemporalTest(behavior: Behavior, temporal: TemporalSpec): void {
    const funcName = this.camelCase(behavior.name.name);
    let testName: string;
    
    switch (temporal.operator) {
      case 'within':
        const ms = temporal.duration ? this.durationToMs(temporal.duration) : 1000;
        const percentile = temporal.percentile ? `p${temporal.percentile}` : 'p99';
        testName = `completes within ${ms}ms (${percentile})`;
        break;
      case 'eventually':
        testName = `eventually ${this.expressionToString(temporal.predicate)}`;
        break;
      case 'immediately':
        testName = `immediately ${this.expressionToString(temporal.predicate)}`;
        break;
      case 'never':
        testName = `never ${this.expressionToString(temporal.predicate)}`;
        break;
      case 'always':
        testName = `always ${this.expressionToString(temporal.predicate)}`;
        break;
      case 'response':
        testName = `responds with ${this.expressionToString(temporal.predicate)}`;
        break;
      default:
        testName = `temporal: ${this.expressionToString(temporal.predicate)}`;
    }

    this.writeLine(`it('${testName}', async () => {`);
    this.indent++;
    
    if (temporal.operator === 'within' && temporal.duration) {
      const ms = this.durationToMs(temporal.duration);
      this.writeLine('// Arrange');
      this.writeLine(`const input: ${behavior.name.name}Input = {`);
      this.indent++;
      this.writeLine('// TODO: Set up input');
      this.indent--;
      this.writeLine('};');
      this.writeLine('');
      this.writeLine('// Act');
      this.writeLine('const startTime = performance.now();');
      this.writeLine(`const result = await ${funcName}(input);`);
      this.writeLine('const endTime = performance.now();');
      this.writeLine('');
      this.writeLine('// Assert');
      this.writeLine(`expect(endTime - startTime).toBeLessThan(${ms});`);
    } else if (temporal.operator === 'eventually') {
      this.writeLine('// TODO: Implement eventual consistency check');
      this.writeLine('// This typically requires polling or event subscription');
    } else {
      this.writeLine(`// TODO: Implement ${temporal.operator} temporal check`);
    }
    
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  private generateAssertionFromExpression(expr: Expression, resultVar: string, inputVar: string): void {
    // Generate assertion based on expression type
    const exprStr = this.expressionToString(expr);
    const compiled = this.compileExpression(expr, resultVar, inputVar);
    
    this.writeLine(`// Verify: ${exprStr}`);
    this.writeLine(`expect(${compiled}).toBe(true);`);
  }

  /**
   * Compile an expression to TypeScript code
   * Handles entity methods like User.exists(), User.lookup()
   */
  private compileExpression(expr: Expression, resultVar: string, inputVar: string): string {
    switch (expr.kind) {
      case 'Identifier':
        if (expr.name === 'result') return resultVar;
        if (expr.name === 'input') return inputVar;
        return expr.name;
        
      case 'StringLiteral':
        return `"${expr.value}"`;
        
      case 'NumberLiteral':
        return String(expr.value);
        
      case 'BooleanLiteral':
        return String(expr.value);
        
      case 'MemberExpr': {
        const obj = this.compileExpression(expr.object, resultVar, inputVar);
        return `${obj}.${expr.property.name}`;
      }
        
      case 'CallExpr': {
        const callee = this.compileExpression(expr.callee, resultVar, inputVar);
        
        // Check if this is an entity method call like User.exists(...)
        if (expr.callee.kind === 'MemberExpr') {
          const method = expr.callee.property.name;
          if (['exists', 'lookup', 'count'].includes(method)) {
            // Wrap single argument in criteria object
            if (expr.arguments.length === 1) {
              const arg = expr.arguments[0]!;
              const argValue = this.compileExpression(arg, resultVar, inputVar);
              const fieldName = this.inferFieldName(arg);
              return `${callee}({ ${fieldName}: ${argValue} })`;
            }
          }
        }
        
        const args = expr.arguments.map(a => this.compileExpression(a, resultVar, inputVar)).join(', ');
        return `${callee}(${args})`;
      }
        
      case 'BinaryExpr': {
        const left = this.compileExpression(expr.left, resultVar, inputVar);
        const right = this.compileExpression(expr.right, resultVar, inputVar);
        
        // Handle logical operators
        if (expr.operator === 'implies') {
          return `(!${left} || ${right})`;
        }
        if (expr.operator === 'and') {
          return `(${left} && ${right})`;
        }
        if (expr.operator === 'or') {
          return `(${left} || ${right})`;
        }
        if (expr.operator === 'iff') {
          return `(${left} === ${right})`;
        }
        
        // Comparison operators
        const op = expr.operator === '==' ? '===' : expr.operator;
        return `(${left} ${op} ${right})`;
      }
        
      case 'OldExpr':
        // Use captured state for old() expressions
        const inner = this.compileOldExpression(expr.expression, resultVar, inputVar);
        return inner;
        
      default:
        return `/* unsupported: ${expr.kind} */`;
    }
  }
  
  /**
   * Compile expression inside old() context
   */
  private compileOldExpression(expr: Expression, resultVar: string, inputVar: string): string {
    if (expr.kind === 'CallExpr' && expr.callee.kind === 'MemberExpr') {
      // Entity method call in old context
      const entityName = expr.callee.object.kind === 'Identifier' ? (expr.callee.object as { name: string }).name : 'Entity';
      const method = expr.callee.property.name;
      
      if (['exists', 'lookup', 'count'].includes(method)) {
        if (expr.arguments.length === 0) {
          return `__old__.entity('${entityName}').${method}()`;
        }
        const arg = expr.arguments[0]!;
        const argValue = this.compileExpression(arg, resultVar, inputVar);
        const fieldName = this.inferFieldName(arg);
        return `__old__.entity('${entityName}').${method}({ ${fieldName}: ${argValue} })`;
      }
    }
    
    return `__old__.${this.compileExpression(expr, resultVar, inputVar)}`;
  }
  
  /**
   * Infer field name from expression
   */
  private inferFieldName(expr: Expression): string {
    if (expr.kind === 'MemberExpr') {
      return expr.property.name;
    }
    return 'id'; // Default
  }

  private expressionToTestName(expr: Expression, prefix: string): string {
    const exprStr = this.expressionToString(expr);
    // Clean up and truncate for test name
    const cleaned = exprStr
      .replace(/[^\w\s.()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 60);
    return `${prefix} ${cleaned}`;
  }

  private expressionToString(expr: Expression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'MemberExpr':
        return `${this.expressionToString(expr.object)}.${expr.property.name}`;
      case 'CallExpr':
        const args = expr.arguments.map(a => this.expressionToString(a)).join(', ');
        return `${this.expressionToString(expr.callee)}(${args})`;
      case 'BinaryExpr':
        return `${this.expressionToString(expr.left)} ${expr.operator} ${this.expressionToString(expr.right)}`;
      case 'OldExpr':
        return `old(${this.expressionToString(expr.expression)})`;
      default:
        return 'expression';
    }
  }

  private durationToMs(duration: DurationLiteral): number {
    const multipliers: Record<string, number> = {
      'ms': 1,
      'seconds': 1000,
      'minutes': 60000,
      'hours': 3600000,
      'days': 86400000,
    };
    return duration.value * (multipliers[duration.unit] ?? 1);
  }

  private camelCase(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  private writeLine(line: string): void {
    const indentStr = '  '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

/**
 * Generate test suite from an ISL domain
 */
export function generateTests(
  domain: Domain,
  options?: TestGeneratorOptions
): GeneratedTests {
  const generator = new TestGenerator(options);
  return generator.generate(domain);
}
