// ============================================================================
// TypeScript Test Adapter
// Generates executable TypeScript tests (Vitest/Jest)
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  LanguageAdapter,
  ExecutableTestOptions,
  TestBinding,
  PostconditionBinding,
  PreconditionBinding,
  ErrorBinding,
  CompilationContext,
} from '../types.js';

export class TypeScriptAdapter implements LanguageAdapter {
  language = 'typescript' as const;
  private framework: 'vitest' | 'jest';

  constructor(framework: 'vitest' | 'jest' = 'vitest') {
    this.framework = framework;
  }

  generateHeader(options: ExecutableTestOptions, binding: TestBinding): string {
    const imports = this.framework === 'vitest'
      ? `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`
      : ``;

    return `${imports}
import { ${binding.implementationName} } from '${binding.modulePath}';
import type { ${binding.inputType.implType}, ${binding.outputType.implType} } from '${binding.modulePath}/types';
import { 
  createTestContext, 
  assertPostcondition, 
  assertPrecondition,
  createOldProxy,
  type StateCapture 
} from './helpers/test-runtime';
import { 
  createValid${binding.behaviorName}Input,
  createInvalid${binding.behaviorName}Input,
} from './fixtures';
`;
  }

  generateSetup(binding: TestBinding): string {
    return `
  let ctx: ReturnType<typeof createTestContext>;
  let validInput: ${binding.inputType.implType};
  let __old__: StateCapture;

  beforeEach(() => {
    ctx = createTestContext({
      // Bind entities to test data
    });
    validInput = createValid${binding.behaviorName}Input();
    __old__ = ctx.captureState();
  });

  afterEach(() => {
    ctx.reset();
  });
`;
  }

  generatePostconditionAssertion(
    postcondition: PostconditionBinding,
    binding: TestBinding
  ): string {
    const conditionCheck = postcondition.condition === 'success'
      ? 'result.success === true'
      : postcondition.condition === 'error'
        ? 'result.success === false'
        : `result.error === '${postcondition.condition}'`;

    return `
    it('postcondition: ${this.escapeString(postcondition.description)}', async () => {
      // Arrange
      const input = createValid${binding.behaviorName}Input();
      const __old__ = ctx.captureState();

      // Act
      const result = await ${binding.implementationName}(input);

      // Assert - postcondition must hold when condition is met
      if (${conditionCheck}) {
        assertPostcondition(
          ${postcondition.assertionCode},
          '${this.escapeString(postcondition.description)}',
          { input, result, oldState: __old__ }
        );
      }
    });
`;
  }

  generatePreconditionTest(
    precondition: PreconditionBinding,
    binding: TestBinding
  ): string {
    return `
    it('should validate precondition: ${this.escapeString(precondition.description)}', async () => {
      // Arrange - input that violates precondition
      const invalidInput = ${precondition.violatingInput || `createInvalid${binding.behaviorName}Input()`};

      // Act
      const result = await ${binding.implementationName}(invalidInput);

      // Assert - should reject invalid input
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid input for precondition: ${this.escapeString(precondition.description)}', async () => {
      // Arrange
      const validInput = createValid${binding.behaviorName}Input();
      
      // Assert precondition holds for valid input
      assertPrecondition(
        ${precondition.validationCode},
        '${this.escapeString(precondition.description)}',
        validInput
      );
    });
`;
  }

  generateErrorTest(error: ErrorBinding, binding: TestBinding): string {
    return `
    it('should return ${error.name} when ${this.escapeString(error.when)}', async () => {
      // Arrange - input that triggers ${error.name}
      const input = ${error.triggerInput};

      // Act
      const result = await ${binding.implementationName}(input);

      // Assert
      ${error.assertionCode}
    });
`;
  }

  generateViolationTest(
    postcondition: PostconditionBinding,
    binding: TestBinding
  ): string {
    return `
    it('VIOLATION TEST: should fail when "${this.escapeString(postcondition.description)}" is violated', async () => {
      // This test verifies that our assertion DOES fail when the contract is violated.
      // If this test passes, the contract enforcement is working correctly.
      
      // Arrange - create a mock implementation that violates the contract
      const mockResult = {
        success: ${postcondition.condition === 'success' ? 'true' : 'false'},
        // Deliberately violate the postcondition
        // TODO: Set up result that violates: ${postcondition.description}
      };

      // Act & Assert - the assertion should fail
      expect(() => {
        assertPostcondition(
          false, // Simulating violated condition
          '${this.escapeString(postcondition.description)}',
          { input: validInput, result: mockResult, oldState: __old__ }
        );
      }).toThrow(/Postcondition violated/);
    });
`;
  }

  generateTestFile(
    behavior: AST.Behavior,
    domain: AST.Domain,
    binding: TestBinding,
    options: ExecutableTestOptions
  ): string {
    const header = this.generateHeader(options, binding);
    const setup = this.generateSetup(binding);

    // Generate postcondition tests
    const postconditionTests = binding.postconditions
      .map(p => this.generatePostconditionAssertion(p, binding))
      .join('\n');

    // Generate precondition tests
    const preconditionTests = binding.preconditions
      .map(p => this.generatePreconditionTest(p, binding))
      .join('\n');

    // Generate error tests
    const errorTests = binding.errors
      .map(e => this.generateErrorTest(e, binding))
      .join('\n');

    return `${header}

/**
 * Executable Tests for ${behavior.name.name}
 * 
 * These tests bind to the real implementation and assert contract compliance.
 * Tests WILL FAIL if the implementation violates any postcondition.
 */
describe('${behavior.name.name}', () => {
${setup}

  describe('Preconditions', () => {
${preconditionTests}
  });

  describe('Postconditions', () => {
${postconditionTests}
  });

  describe('Error Cases', () => {
${errorTests}
  });

  describe('Contract Integration', () => {
    it('should satisfy all postconditions on success', async () => {
      // Arrange
      const input = createValid${binding.behaviorName}Input();
      const __old__ = ctx.captureState();

      // Act
      const result = await ${binding.implementationName}(input);

      // Assert all success postconditions
      if (result.success) {
${binding.postconditions
  .filter(p => p.condition === 'success')
  .map(p => `        assertPostcondition(
          ${p.assertionCode},
          '${this.escapeString(p.description)}',
          { input, result, oldState: __old__ }
        );`)
  .join('\n')}
      }
    });

    it('should satisfy all postconditions on error', async () => {
      // Arrange - trigger an error
      const input = createInvalid${binding.behaviorName}Input();
      const __old__ = ctx.captureState();

      // Act
      const result = await ${binding.implementationName}(input);

      // Assert all error postconditions
      if (!result.success) {
${binding.postconditions
  .filter(p => p.condition === 'error')
  .map(p => `        assertPostcondition(
          ${p.assertionCode},
          '${this.escapeString(p.description)}',
          { input, result, oldState: __old__ }
        );`)
  .join('\n')}
      }
    });
  });
});
`;
  }

  compileExpression(expr: AST.Expression, context: CompilationContext): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;

      case 'StringLiteral':
        return JSON.stringify(expr.value);

      case 'NumberLiteral':
        return String(expr.value);

      case 'BooleanLiteral':
        return String(expr.value);

      case 'NullLiteral':
        return 'null';

      case 'BinaryExpr':
        return this.compileBinaryExpr(expr, context);

      case 'UnaryExpr':
        return this.compileUnaryExpr(expr, context);

      case 'CallExpr':
        return this.compileCallExpr(expr, context);

      case 'MemberExpr':
        return `${this.compileExpression(expr.object, context)}.${expr.property.name}`;

      case 'IndexExpr':
        return `${this.compileExpression(expr.object, context)}[${this.compileExpression(expr.index, context)}]`;

      case 'QuantifierExpr':
        return this.compileQuantifierExpr(expr, context);

      case 'ConditionalExpr':
        return `(${this.compileExpression(expr.condition, context)} ? ${this.compileExpression(expr.thenBranch, context)} : ${this.compileExpression(expr.elseBranch, context)})`;

      case 'OldExpr':
        return this.compileOldExpr(expr, context);

      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';

      case 'InputExpr':
        return `input.${expr.property.name}`;

      case 'LambdaExpr':
        return `(${expr.params.map(p => p.name).join(', ')}) => ${this.compileExpression(expr.body, context)}`;

      case 'ListExpr':
        return `[${expr.elements.map(e => this.compileExpression(e, context)).join(', ')}]`;

      default:
        return `/* unsupported: ${(expr as AST.ASTNode).kind} */`;
    }
  }

  private compileBinaryExpr(expr: AST.BinaryExpr, context: CompilationContext): string {
    const left = this.compileExpression(expr.left, context);
    const right = this.compileExpression(expr.right, context);
    
    switch (expr.operator) {
      case '==': return `(${left} === ${right})`;
      case '!=': return `(${left} !== ${right})`;
      case 'and': return `(${left} && ${right})`;
      case 'or': return `(${left} || ${right})`;
      case 'implies': return `(!${left} || ${right})`;
      default: return `(${left} ${expr.operator} ${right})`;
    }
  }

  private compileUnaryExpr(expr: AST.UnaryExpr, context: CompilationContext): string {
    const operand = this.compileExpression(expr.operand, context);
    return expr.operator === 'not' ? `!(${operand})` : `${expr.operator}(${operand})`;
  }

  private compileCallExpr(expr: AST.CallExpr, context: CompilationContext): string {
    const callee = this.compileExpression(expr.callee, context);
    const args = expr.arguments.map(a => this.compileExpression(a, context)).join(', ');
    
    // Handle entity method calls
    if (expr.callee.kind === 'MemberExpr') {
      const obj = expr.callee.object;
      const method = expr.callee.property.name;
      
      if (obj.kind === 'Identifier' && context.entityNames.includes(obj.name)) {
        const prefix = context.inOldExpr ? `__old__.entity('${obj.name}')` : `ctx.entities.get('${obj.name}')`;
        return `${prefix}?.${method}(${args})`;
      }
    }
    
    return `${callee}(${args})`;
  }

  private compileQuantifierExpr(expr: AST.QuantifierExpr, context: CompilationContext): string {
    const collection = this.compileExpression(expr.collection, context);
    const variable = expr.variable.name;
    const predicate = this.compileExpression(expr.predicate, context);

    switch (expr.quantifier) {
      case 'all': return `${collection}.every((${variable}) => ${predicate})`;
      case 'any': return `${collection}.some((${variable}) => ${predicate})`;
      case 'none': return `!${collection}.some((${variable}) => ${predicate})`;
      case 'count': return `${collection}.filter((${variable}) => ${predicate}).length`;
      default: return `${collection}.filter((${variable}) => ${predicate})`;
    }
  }

  private compileOldExpr(expr: AST.OldExpr, context: CompilationContext): string {
    const oldContext = { ...context, inOldExpr: true };
    return this.compileExpression(expr.expression, oldContext);
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
  }
}
