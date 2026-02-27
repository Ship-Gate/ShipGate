// ============================================================================
// Precondition Test Generator
// Converts ISL preconditions to validation test cases
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { compileExpression, compileAssertion } from './expression-compiler.js';
import type { PreconditionTest, TestFramework } from './types.js';

/**
 * Generate precondition validation tests for a behavior
 */
export function generatePreconditionTests(
  behavior: AST.Behavior,
  framework: TestFramework
): PreconditionTest[] {
  const tests: PreconditionTest[] = [];

  behavior.preconditions.forEach((precondition, index) => {
    const testName = extractPreconditionName(precondition, index);
    const testCode = generatePreconditionTestCode(precondition, behavior, framework);

    tests.push({
      name: testName,
      expression: precondition,
      testCode,
    });
  });

  return tests;
}

/**
 * Extract a human-readable name from a precondition expression
 */
function extractPreconditionName(expr: AST.Expression, index: number): string {
  // Try to derive a meaningful name from the expression
  const exprString = compileExpression(expr);

  // Common patterns
  if (exprString.includes('.exists')) {
    const match = exprString.match(/(\w+)\.exists/);
    return match ? `should require ${match[1]} to exist` : `precondition ${index + 1}`;
  }

  if (exprString.includes('.is_valid')) {
    const match = exprString.match(/(\w+)\.is_valid/);
    return match ? `should validate ${match[1]} format` : `precondition ${index + 1}`;
  }

  if (exprString.includes('.length')) {
    return `should validate length constraint`;
  }

  if (exprString.includes('>=') || exprString.includes('<=') || exprString.includes('>') || exprString.includes('<')) {
    return `should validate numeric constraint`;
  }

  if (exprString.includes('.status')) {
    return `should check status requirement`;
  }

  return `should satisfy precondition: ${truncate(exprString, 50)}`;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

/**
 * Generate test code for a precondition
 */
function generatePreconditionTestCode(
  precondition: AST.Expression,
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const assertion = compileAssertion(precondition, framework);
  const behaviorName = behavior.name.name;

  return `
    it('should reject when precondition is not met', async () => {
      // Setup: create input that violates precondition
      const invalidInput = createInvalidInput();

      // Execute
      const result = await ${behaviorName}(invalidInput);

      // Verify: should fail due to precondition violation
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept when precondition is met', async () => {
      // Setup: create valid input
      const validInput = createValidInput();

      // Verify precondition is satisfied
      ${assertion}
    });
  `.trim();
}

/**
 * Generate a describe block containing all precondition tests
 */
export function generatePreconditionsDescribeBlock(
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const tests = generatePreconditionTests(behavior, framework);
  const behaviorName = behavior.name.name;

  if (tests.length === 0) {
    return '';
  }

  const testCases = tests.map((test) => `
    describe('${test.name}', () => {
      it('should validate precondition', () => {
        // Precondition: ${compileExpression(test.expression)}
        const input = createTestInput();
        const preconditionMet = ${compileExpression(test.expression)};
        expect(preconditionMet).toBe(true);
      });

      it('should reject invalid input', async () => {
        const invalidInput = createInvalidInputFor${sanitizeName(test.name)}();
        const result = await ${behaviorName}(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  `).join('\n');

  return `
  describe('Preconditions', () => {
    ${testCases}
  });
  `.trim();
}

/**
 * Generate precondition validation helper code
 */
export function generatePreconditionValidators(
  behavior: AST.Behavior
): string {
  const validators = behavior.preconditions.map((pre, index) => {
    const compiled = compileExpression(pre);
    return `
  validatePrecondition${index + 1}(input: ${behavior.name.name}Input): boolean {
    return ${compiled};
  }`;
  });

  return `
// Precondition validators for ${behavior.name.name}
export const preconditionValidators = {
  ${validators.join(',\n')}

  validateAll(input: ${behavior.name.name}Input): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    ${behavior.preconditions.map((_, i) => `
    if (!this.validatePrecondition${i + 1}(input)) {
      violations.push('Precondition ${i + 1} violated');
    }`).join('')}
    return { valid: violations.length === 0, violations };
  }
};
  `.trim();
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
