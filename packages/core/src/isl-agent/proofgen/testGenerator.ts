/**
 * Test Generator
 * 
 * Generates meaningful test cases from ISL specification clauses.
 * - Preconditions: Generate tests that invalid inputs should throw
 * - Postconditions: Generate tests that assert returned structures
 * - Invariants: Generate tests that verify invariants hold
 * 
 * Output is framework-agnostic templates that can be rendered
 * using adapters for vitest/jest/mocha.
 */

import {
  GeneratedTestCase,
  GeneratedTestSuite,
  TestInput,
  TestExpectation,
  TestValue,
  MockSetup,
  ClauseReference,
  TestType,
  TestPriority,
  FieldInfo,
  TypeInfo,
  ClauseInfo,
  PostconditionInfo,
  ErrorInfo,
  StrategyContext,
  TestGenerationStrategy,
  TestGeneratorConfig,
  SuiteMetadata,
  DEFAULT_CONFIG,
  ResultAssertion,
} from './testGenTypes.js';

import type {
  Behavior,
  Domain,
  Expression,
  Field,
  InputSpec,
  OutputSpec,
  PostconditionBlock,
  TypeDefinition,
  ErrorSpec,
  Identifier,
} from '@isl-lang/parser';

// ============================================================================
// Test Generator Class
// ============================================================================

export class TestGenerator {
  private config: TestGeneratorConfig;
  private strategies: Map<string, TestGenerationStrategy> = new Map();

  constructor(config: Partial<TestGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a test generation strategy
   */
  registerStrategy(strategy: TestGenerationStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Generate test suite for a behavior
   */
  generateTestSuite(domain: Domain, behavior: Behavior): GeneratedTestSuite {
    const tests: GeneratedTestCase[] = [];
    const domainName = domain.name.name;
    const behaviorName = behavior.name.name;

    // Extract info from behavior
    const inputFields = this.extractInputFields(behavior.input);
    const outputType = this.extractOutputType(behavior.output);
    const preconditions = this.extractClauses(behavior.preconditions);
    const postconditions = this.extractPostconditions(behavior.postconditions);
    const invariants = this.extractClauses(behavior.invariants);
    const errors = this.extractErrors(behavior.output);

    // Create strategy context
    const context: StrategyContext = {
      domainName,
      behaviorName,
      inputFields,
      outputType,
      preconditions,
      postconditions,
      invariants,
      errors,
    };

    // Generate precondition violation tests
    if (this.config.includePreconditionTests) {
      tests.push(...this.generatePreconditionTests(context, behavior));
    }

    // Generate postcondition success tests
    if (this.config.includePostconditionTests) {
      tests.push(...this.generatePostconditionTests(context, behavior));
    }

    // Generate invariant tests
    if (this.config.includeInvariantTests) {
      tests.push(...this.generateInvariantTests(context, behavior));
    }

    // Apply domain-specific strategies
    for (const strategyId of this.config.strategies) {
      const strategy = this.strategies.get(strategyId);
      if (strategy && strategy.appliesTo.includes(domainName)) {
        tests.push(...strategy.generateTests(context));
      }
    }

    // Generate boundary tests
    if (this.config.generateBoundaryTests) {
      tests.push(...this.generateBoundaryTests(context, behavior));
    }

    const metadata: SuiteMetadata = {
      generatedAt: new Date().toISOString(),
      generatorVersion: '1.0.0',
      specFingerprint: this.computeFingerprint(domain, behavior),
      stats: {
        preconditionTests: tests.filter(t => t.testType === 'precondition_violation').length,
        postconditionTests: tests.filter(t => t.testType.startsWith('postcondition')).length,
        invariantTests: tests.filter(t => t.testType === 'invariant_hold').length,
        scenarioTests: tests.filter(t => t.testType === 'scenario').length,
        totalTests: tests.length,
      },
    };

    return {
      behaviorName,
      domainName,
      version: domain.version.value,
      tests,
      metadata,
    };
  }

  /**
   * Generate tests for all behaviors in a domain
   */
  generateAllTestSuites(domain: Domain): GeneratedTestSuite[] {
    return domain.behaviors.map(behavior => this.generateTestSuite(domain, behavior));
  }

  // ============================================================================
  // Precondition Test Generation
  // ============================================================================

  private generatePreconditionTests(
    context: StrategyContext,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    for (let i = 0; i < context.preconditions.length; i++) {
      const precondition = context.preconditions[i]!;
      const violation = this.generatePreconditionViolation(
        context,
        precondition,
        i,
        behavior
      );
      if (violation) {
        tests.push(violation);
      }
    }

    return tests;
  }

  private generatePreconditionViolation(
    context: StrategyContext,
    precondition: ClauseInfo,
    index: number,
    behavior: Behavior
  ): GeneratedTestCase | null {
    const expr = precondition.expression;
    const violation = this.analyzePreconditionForViolation(expr, context.inputFields);

    if (!violation) {
      return null;
    }

    const id = `${context.behaviorName}_pre_${index}_violation`;
    
    return {
      id,
      name: `should reject when precondition violated: ${this.summarizeExpression(expr)}`,
      description: `Tests that ${context.behaviorName} throws when: ${expr} is false`,
      behaviorName: context.behaviorName,
      testType: 'precondition_violation',
      sourceClause: {
        clauseType: 'precondition',
        index,
        expression: expr,
        line: precondition.line,
      },
      input: violation.input,
      expected: {
        outcome: 'throw',
        exceptionType: 'PreconditionError',
      },
      tags: ['precondition', 'negative', 'validation'],
      priority: 'high',
    };
  }

  private analyzePreconditionForViolation(
    expr: string,
    fields: FieldInfo[]
  ): { input: TestInput } | null {
    const params: Record<string, TestValue> = {};

    // Generate valid values for all fields first
    for (const field of fields) {
      params[field.name] = this.generateValidValue(field);
    }

    // Parse expression to find what to violate
    // Common patterns:
    // - input.field > 0 -> set field to 0 or negative
    // - input.field.length > 0 -> set field to empty
    // - Entity.exists(field: input.field) -> mock entity.exists to return false
    // - input.field in config.allowed_values -> set to invalid value

    if (expr.includes('> 0')) {
      const fieldMatch = expr.match(/input\.(\w+)/);
      if (fieldMatch && fieldMatch[1]) {
        const fieldName = fieldMatch[1];
        params[fieldName] = {
          type: 'invalid',
          reason: 'Must be greater than 0',
          value: 0,
        };
      }
    } else if (expr.includes('.length > 0')) {
      const fieldMatch = expr.match(/input\.(\w+)\.length/);
      if (fieldMatch && fieldMatch[1]) {
        const fieldName = fieldMatch[1];
        params[fieldName] = {
          type: 'invalid',
          reason: 'Must not be empty',
          value: '',
        };
      }
    } else if (expr.includes('.exists(')) {
      // Entity existence check - need to mock
      const mocks: MockSetup[] = [];
      const entityMatch = expr.match(/(\w+)\.exists\(/);
      if (entityMatch && entityMatch[1]) {
        mocks.push({
          entity: entityMatch[1],
          method: 'exists',
          returns: { type: 'literal', value: false },
        });
      }
      return { input: { params, mocks } };
    } else if (expr.includes(' in ')) {
      const fieldMatch = expr.match(/input\.(\w+)/);
      if (fieldMatch && fieldMatch[1]) {
        const fieldName = fieldMatch[1];
        params[fieldName] = {
          type: 'invalid',
          reason: 'Not in allowed values',
          value: '__INVALID_VALUE__',
        };
      }
    } else if (expr.includes('not ') || expr.includes('!')) {
      // Negation - need to make the inner condition true
      const fieldMatch = expr.match(/input\.(\w+)/);
      if (fieldMatch && fieldMatch[1]) {
        const fieldName = fieldMatch[1];
        params[fieldName] = {
          type: 'invalid',
          reason: 'Condition should be false',
          value: true,
        };
      }
    }

    return { input: { params } };
  }

  // ============================================================================
  // Postcondition Test Generation
  // ============================================================================

  private generatePostconditionTests(
    context: StrategyContext,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    for (const postcondition of context.postconditions) {
      if (postcondition.condition === 'success') {
        tests.push(...this.generateSuccessPostconditionTests(context, postcondition, behavior));
      } else if (postcondition.condition === 'failure' || postcondition.condition.includes('error')) {
        tests.push(...this.generateFailurePostconditionTests(context, postcondition, behavior));
      }
    }

    return tests;
  }

  private generateSuccessPostconditionTests(
    context: StrategyContext,
    postcondition: PostconditionInfo,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    // Generate a test for each predicate in the success block
    for (let i = 0; i < postcondition.predicates.length; i++) {
      const predicate = postcondition.predicates[i]!;
      const assertions = this.generateAssertionsFromExpression(predicate.expression);

      const id = `${context.behaviorName}_post_success_${i}`;
      
      tests.push({
        id,
        name: `should satisfy postcondition on success: ${this.summarizeExpression(predicate.expression)}`,
        description: `Tests that successful ${context.behaviorName} ensures: ${predicate.expression}`,
        behaviorName: context.behaviorName,
        testType: 'postcondition_success',
        sourceClause: {
          clauseType: 'postcondition',
          index: i,
          expression: predicate.expression,
          line: predicate.line,
        },
        input: this.generateValidInput(context.inputFields, behavior),
        expected: {
          outcome: 'success',
          assertions,
        },
        tags: ['postcondition', 'positive', 'state'],
        priority: 'critical',
      });
    }

    return tests;
  }

  private generateFailurePostconditionTests(
    context: StrategyContext,
    postcondition: PostconditionInfo,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    // Find matching error for this postcondition
    const errorName = postcondition.condition.toUpperCase().replace(/\s+/g, '_');
    const error = context.errors.find(e => e.name === errorName);

    for (let i = 0; i < postcondition.predicates.length; i++) {
      const predicate = postcondition.predicates[i]!;

      const id = `${context.behaviorName}_post_error_${errorName}_${i}`;

      tests.push({
        id,
        name: `should satisfy postcondition on ${errorName}: ${this.summarizeExpression(predicate.expression)}`,
        description: `Tests that ${context.behaviorName} error case ensures: ${predicate.expression}`,
        behaviorName: context.behaviorName,
        testType: 'postcondition_failure',
        sourceClause: {
          clauseType: 'postcondition',
          index: i,
          expression: predicate.expression,
          line: predicate.line,
        },
        input: this.generateInputForError(context, error),
        expected: {
          outcome: 'error',
          errorCode: errorName,
        },
        tags: ['postcondition', 'negative', 'error'],
        priority: 'high',
      });
    }

    return tests;
  }

  // ============================================================================
  // Invariant Test Generation
  // ============================================================================

  private generateInvariantTests(
    context: StrategyContext,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    for (let i = 0; i < context.invariants.length; i++) {
      const invariant = context.invariants[i]!;
      
      const id = `${context.behaviorName}_invariant_${i}`;

      tests.push({
        id,
        name: `should maintain invariant: ${this.summarizeExpression(invariant.expression)}`,
        description: `Tests that ${context.behaviorName} maintains: ${invariant.expression}`,
        behaviorName: context.behaviorName,
        testType: 'invariant_hold',
        sourceClause: {
          clauseType: 'invariant',
          index: i,
          expression: invariant.expression,
          line: invariant.line,
        },
        input: this.generateValidInput(context.inputFields, behavior),
        expected: {
          outcome: 'success',
          assertions: this.generateAssertionsFromExpression(invariant.expression),
        },
        tags: ['invariant', 'consistency'],
        priority: 'critical',
      });
    }

    return tests;
  }

  // ============================================================================
  // Boundary Test Generation
  // ============================================================================

  private generateBoundaryTests(
    context: StrategyContext,
    behavior: Behavior
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];

    for (const field of context.inputFields) {
      // Find constraints that define boundaries
      for (const constraint of field.constraints) {
        if (['min', 'max', 'min_length', 'max_length'].includes(constraint.name)) {
          const boundaryTests = this.generateBoundaryTestsForConstraint(
            context,
            field,
            constraint
          );
          tests.push(...boundaryTests);
        }
      }
    }

    return tests;
  }

  private generateBoundaryTestsForConstraint(
    context: StrategyContext,
    field: FieldInfo,
    constraint: { name: string; value: unknown }
  ): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];
    const value = constraint.value as number;

    const baseParams: Record<string, TestValue> = {};
    for (const f of context.inputFields) {
      baseParams[f.name] = this.generateValidValue(f);
    }

    switch (constraint.name) {
      case 'min':
      case 'min_length':
        // Test at minimum boundary
        tests.push({
          id: `${context.behaviorName}_boundary_${field.name}_min`,
          name: `should accept ${field.name} at minimum: ${value}`,
          description: `Boundary test for ${field.name} at ${constraint.name}=${value}`,
          behaviorName: context.behaviorName,
          testType: 'boundary',
          sourceClause: {
            clauseType: 'precondition',
            index: -1,
            expression: `${field.name}.${constraint.name} >= ${value}`,
          },
          input: {
            params: {
              ...baseParams,
              [field.name]: { type: 'literal', value: this.generateBoundaryValue(field, value, 'at') },
            },
          },
          expected: { outcome: 'success' },
          tags: ['boundary', 'min'],
          priority: 'medium',
        });

        // Test below minimum (should fail)
        tests.push({
          id: `${context.behaviorName}_boundary_${field.name}_below_min`,
          name: `should reject ${field.name} below minimum: ${value - 1}`,
          description: `Boundary violation test for ${field.name} below ${constraint.name}=${value}`,
          behaviorName: context.behaviorName,
          testType: 'boundary',
          sourceClause: {
            clauseType: 'precondition',
            index: -1,
            expression: `${field.name}.${constraint.name} >= ${value}`,
          },
          input: {
            params: {
              ...baseParams,
              [field.name]: {
                type: 'invalid',
                reason: `Below ${constraint.name}`,
                value: this.generateBoundaryValue(field, value - 1, 'below'),
              },
            },
          },
          expected: { outcome: 'throw' },
          tags: ['boundary', 'min', 'negative'],
          priority: 'medium',
        });
        break;

      case 'max':
      case 'max_length':
        // Test at maximum boundary
        tests.push({
          id: `${context.behaviorName}_boundary_${field.name}_max`,
          name: `should accept ${field.name} at maximum: ${value}`,
          description: `Boundary test for ${field.name} at ${constraint.name}=${value}`,
          behaviorName: context.behaviorName,
          testType: 'boundary',
          sourceClause: {
            clauseType: 'precondition',
            index: -1,
            expression: `${field.name}.${constraint.name} <= ${value}`,
          },
          input: {
            params: {
              ...baseParams,
              [field.name]: { type: 'literal', value: this.generateBoundaryValue(field, value, 'at') },
            },
          },
          expected: { outcome: 'success' },
          tags: ['boundary', 'max'],
          priority: 'medium',
        });

        // Test above maximum (should fail)
        tests.push({
          id: `${context.behaviorName}_boundary_${field.name}_above_max`,
          name: `should reject ${field.name} above maximum: ${value + 1}`,
          description: `Boundary violation test for ${field.name} above ${constraint.name}=${value}`,
          behaviorName: context.behaviorName,
          testType: 'boundary',
          sourceClause: {
            clauseType: 'precondition',
            index: -1,
            expression: `${field.name}.${constraint.name} <= ${value}`,
          },
          input: {
            params: {
              ...baseParams,
              [field.name]: {
                type: 'invalid',
                reason: `Above ${constraint.name}`,
                value: this.generateBoundaryValue(field, value + 1, 'above'),
              },
            },
          },
          expected: { outcome: 'throw' },
          tags: ['boundary', 'max', 'negative'],
          priority: 'medium',
        });
        break;
    }

    return tests;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractInputFields(input: InputSpec): FieldInfo[] {
    return input.fields.map(field => this.fieldToInfo(field));
  }

  private fieldToInfo(field: Field): FieldInfo {
    return {
      name: field.name.name,
      typeName: this.typeToName(field.type),
      optional: field.optional,
      constraints: this.extractConstraints(field.type),
      annotations: field.annotations.map(a => a.name.name),
    };
  }

  private typeToName(type: TypeDefinition): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return type.name;
      case 'ReferenceType':
        return type.name.parts.map(p => p.name).join('.');
      case 'ListType':
        return `List<${this.typeToName(type.element)}>`;
      case 'MapType':
        return `Map<${this.typeToName(type.key)}, ${this.typeToName(type.value)}>`;
      case 'OptionalType':
        return `${this.typeToName(type.inner)}?`;
      case 'ConstrainedType':
        return this.typeToName(type.base);
      default:
        return 'unknown';
    }
  }

  private extractConstraints(type: TypeDefinition): { name: string; value: unknown }[] {
    if (type.kind === 'ConstrainedType') {
      return type.constraints.map(c => ({
        name: c.name,
        value: this.extractLiteralValue(c.value),
      }));
    }
    return [];
  }

  private extractLiteralValue(expr: Expression): unknown {
    switch (expr.kind) {
      case 'NumberLiteral':
        return expr.value;
      case 'StringLiteral':
        return expr.value;
      case 'BooleanLiteral':
        return expr.value;
      default:
        return null;
    }
  }

  private extractOutputType(output: OutputSpec): TypeInfo {
    return {
      kind: 'reference',
      name: this.typeToName(output.success),
    };
  }

  private extractClauses(expressions: Expression[]): ClauseInfo[] {
    return expressions.map((expr, index) => ({
      index,
      expression: this.expressionToString(expr),
      line: expr.location.line,
    }));
  }

  private extractPostconditions(postconditions: PostconditionBlock[]): PostconditionInfo[] {
    return postconditions.map(pc => ({
      condition: typeof pc.condition === 'string' ? pc.condition : pc.condition.name,
      predicates: pc.predicates.map((p, i) => ({
        index: i,
        expression: this.expressionToString(p),
        line: p.location.line,
      })),
    }));
  }

  private extractErrors(output: OutputSpec): ErrorInfo[] {
    return output.errors.map(err => ({
      name: err.name.name,
      when: err.when?.value,
      retriable: err.retriable,
    }));
  }

  private expressionToString(expr: Expression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'BinaryExpr':
        return `${this.expressionToString(expr.left)} ${expr.operator} ${this.expressionToString(expr.right)}`;
      case 'MemberExpr':
        return `${this.expressionToString(expr.object)}.${expr.property.name}`;
      case 'CallExpr':
        const args = expr.arguments.map(a => this.expressionToString(a)).join(', ');
        return `${this.expressionToString(expr.callee)}(${args})`;
      case 'UnaryExpr':
        return `${expr.operator} ${this.expressionToString(expr.operand)}`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'BooleanLiteral':
        return String(expr.value);
      case 'OldExpr':
        return `old(${this.expressionToString(expr.expression)})`;
      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';
      case 'InputExpr':
        return `input.${expr.property.name}`;
      default:
        return `[${expr.kind}]`;
    }
  }

  private summarizeExpression(expr: string): string {
    // Truncate long expressions
    if (expr.length > 60) {
      return expr.substring(0, 57) + '...';
    }
    return expr;
  }

  private generateValidValue(field: FieldInfo): TestValue {
    // Generate a valid value based on type and constraints
    switch (field.typeName) {
      case 'String':
        return { type: 'literal', value: `valid_${field.name}` };
      case 'Int':
        const minConstraint = field.constraints.find(c => c.name === 'min');
        const min = (minConstraint?.value as number) || 1;
        return { type: 'literal', value: min };
      case 'Boolean':
        return { type: 'literal', value: true };
      case 'UUID':
        return { type: 'generated', generator: { kind: 'uuid' } };
      case 'Timestamp':
        return { type: 'generated', generator: { kind: 'timestamp' } };
      default:
        if (field.typeName.startsWith('List<')) {
          return { type: 'literal', value: [] };
        }
        if (field.typeName.startsWith('Map<')) {
          return { type: 'literal', value: {} };
        }
        return { type: 'literal', value: `value_${field.name}` };
    }
  }

  private generateValidInput(fields: FieldInfo[], behavior: Behavior): TestInput {
    const params: Record<string, TestValue> = {};
    const mocks: MockSetup[] = [];

    for (const field of fields) {
      if (!field.optional) {
        params[field.name] = this.generateValidValue(field);
      }
    }

    // Check preconditions for required entity mocks
    for (const pre of behavior.preconditions) {
      const expr = this.expressionToString(pre);
      if (expr.includes('.exists(')) {
        const entityMatch = expr.match(/(\w+)\.exists\(/);
        if (entityMatch && entityMatch[1]) {
          mocks.push({
            entity: entityMatch[1],
            method: 'exists',
            returns: { type: 'literal', value: true },
          });
        }
      }
      if (expr.includes('.lookup(')) {
        const entityMatch = expr.match(/(\w+)\.lookup\(/);
        if (entityMatch && entityMatch[1]) {
          mocks.push({
            entity: entityMatch[1],
            method: 'lookup',
            returns: { type: 'literal', value: { id: 'mock-id' } },
          });
        }
      }
    }

    return { params, mocks };
  }

  private generateInputForError(context: StrategyContext, error?: ErrorInfo): TestInput {
    const params: Record<string, TestValue> = {};

    for (const field of context.inputFields) {
      params[field.name] = this.generateValidValue(field);
    }

    // Try to create input that triggers this specific error
    if (error?.when) {
      // Parse the "when" clause to understand what triggers this error
      const when = error.when.toLowerCase();
      if (when.includes('not found') || when.includes('does not exist')) {
        return {
          params,
          mocks: [{
            entity: 'Unknown',
            method: 'exists',
            returns: { type: 'literal', value: false },
          }],
        };
      }
    }

    return { params };
  }

  private generateAssertionsFromExpression(expr: string): ResultAssertion[] {
    const assertions: ResultAssertion[] = [];

    // Parse common patterns
    // result.field == value
    const equalityMatch = expr.match(/result\.(\w+)\s*==\s*(.+)/);
    if (equalityMatch) {
      assertions.push({
        path: `result.${equalityMatch[1]}`,
        operator: 'equals',
        expected: { type: 'reference', path: equalityMatch[2]! },
      });
    }

    // result.field != null
    const notNullMatch = expr.match(/result\.(\w+)\s*!=\s*null/);
    if (notNullMatch) {
      assertions.push({
        path: `result.${notNullMatch[1]}`,
        operator: 'is_not_null',
        expected: { type: 'literal', value: null },
      });
    }

    // Entity.exists(result.id)
    const existsMatch = expr.match(/(\w+)\.exists\(.*result\.(\w+)/);
    if (existsMatch) {
      assertions.push({
        path: `result.${existsMatch[2]}`,
        operator: 'is_truthy',
        expected: { type: 'literal', value: true },
      });
    }

    // Default assertion if no patterns matched
    if (assertions.length === 0) {
      assertions.push({
        path: 'result',
        operator: 'is_truthy',
        expected: { type: 'literal', value: true },
      });
    }

    return assertions;
  }

  private generateBoundaryValue(field: FieldInfo, value: number, position: 'at' | 'below' | 'above'): unknown {
    if (field.typeName === 'String' || field.constraints.some(c => c.name.includes('length'))) {
      // Generate string of specific length
      return 'x'.repeat(Math.max(0, value));
    }
    return value;
  }

  private computeFingerprint(domain: Domain, behavior: Behavior): string {
    // Simple fingerprint based on domain, behavior and precondition count
    const content = `${domain.name.name}:${behavior.name.name}:${behavior.preconditions.length}:${behavior.postconditions.length}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTestGenerator(config?: Partial<TestGeneratorConfig>): TestGenerator {
  return new TestGenerator(config);
}
