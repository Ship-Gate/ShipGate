// ============================================================================
// Postcondition Test Generator
// Converts ISL postconditions to result assertion tests
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import { compileExpression, compileAssertion } from './expression-compiler';
import type { PostconditionTest, TestFramework } from './types';

/**
 * Generate postcondition assertion tests for a behavior
 */
export function generatePostconditionTests(
  behavior: AST.Behavior,
  framework: TestFramework
): PostconditionTest[] {
  const tests: PostconditionTest[] = [];

  behavior.postconditions.forEach((block) => {
    const condition = extractConditionName(block.condition);
    const testName = `when ${condition}`;

    tests.push({
      name: testName,
      condition,
      expressions: block.predicates,
      testCode: generatePostconditionBlockCode(block, behavior, framework),
    });
  });

  return tests;
}

/**
 * Extract the condition name from a postcondition block
 */
function extractConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
  if (condition === 'success') {
    return 'success';
  }
  if (condition === 'any_error') {
    return 'any error';
  }
  return condition.name;
}

/**
 * Generate test code for a postcondition block
 */
function generatePostconditionBlockCode(
  block: AST.PostconditionBlock,
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const condition = extractConditionName(block.condition);
  const behaviorName = behavior.name.name;
  const assertions = block.predicates.map((pred) => compileAssertion(pred, framework)).join('\n      ');

  if (condition === 'success') {
    return `
    describe('on success', () => {
      it('should satisfy all success postconditions', async () => {
        // Setup
        const input = createValidInput();
        const __old__ = captureState();

        // Execute
        const result = await ${behaviorName}(input);

        // Verify success
        expect(result.success).toBe(true);

        // Verify postconditions
        ${assertions}
      });
    });
    `.trim();
  }

  if (condition === 'any error') {
    return `
    describe('on any error', () => {
      it('should satisfy error postconditions', async () => {
        // Setup: trigger an error condition
        const input = createInputThatCausesError();
        const __old__ = captureState();

        // Execute
        const result = await ${behaviorName}(input);

        // Verify error
        expect(result.success).toBe(false);

        // Verify postconditions
        ${assertions}
      });
    });
    `.trim();
  }

  // Specific error type
  return `
    describe('on ${condition}', () => {
      it('should satisfy ${condition} postconditions', async () => {
        // Setup: trigger ${condition}
        const input = createInputFor${sanitizeName(condition)}();
        const __old__ = captureState();

        // Execute
        const result = await ${behaviorName}(input);

        // Verify specific error
        expect(result.success).toBe(false);
        expect(result.error).toBe('${condition}');

        // Verify postconditions
        ${assertions}
      });
    });
  `.trim();
}

/**
 * Generate a describe block containing all postcondition tests
 */
export function generatePostconditionsDescribeBlock(
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const tests = generatePostconditionTests(behavior, framework);
  const behaviorName = behavior.name.name;

  if (tests.length === 0) {
    return '';
  }

  const testCases = tests.map((test) => test.testCode).join('\n\n    ');

  return `
  describe('Postconditions', () => {
    // Helpers for state capture
    const captureState = () => ({
      // Capture relevant state before operation
    });

    ${testCases}
  });
  `.trim();
}

/**
 * Generate postcondition assertion helper code
 */
export function generatePostconditionAssertions(
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const behaviorName = behavior.name.name;
  
  const successAssertions = behavior.postconditions
    .filter((b) => b.condition === 'success')
    .flatMap((b) => b.predicates)
    .map((p, i) => `
  assertSuccessPostcondition${i + 1}(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: State): void {
    // ${compileExpression(p)}
    expect(${compileExpression(p)}).toBe(true);
  }`);

  const errorAssertions = behavior.postconditions
    .filter((b) => b.condition === 'any_error')
    .flatMap((b) => b.predicates)
    .map((p, i) => `
  assertErrorPostcondition${i + 1}(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: State): void {
    // ${compileExpression(p)}
    expect(${compileExpression(p)}).toBe(true);
  }`);

  return `
// Postcondition assertions for ${behaviorName}
export const postconditionAssertions = {
  ${successAssertions.join(',\n')}
  ${errorAssertions.join(',\n')}

  assertAllSuccess(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: State): void {
    ${successAssertions.map((_, i) => `this.assertSuccessPostcondition${i + 1}(result, input, __old__);`).join('\n    ')}
  },

  assertAllError(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: State): void {
    ${errorAssertions.map((_, i) => `this.assertErrorPostcondition${i + 1}(result, input, __old__);`).join('\n    ')}
  }
};
  `.trim();
}

/**
 * Generate 'implies' style tests from postconditions
 */
export function generateImpliesTests(
  behavior: AST.Behavior,
  framework: TestFramework
): string {
  const behaviorName = behavior.name.name;
  const tests: string[] = [];

  behavior.postconditions.forEach((block) => {
    const condition = extractConditionName(block.condition);

    block.predicates.forEach((predicate, index) => {
      const predicateCode = compileExpression(predicate);
      const assertion = compileAssertion(predicate, framework);

      tests.push(`
    it('${condition} implies ${truncate(predicateCode, 40)}', async () => {
      const input = createInputFor${sanitizeName(condition)}();
      const __old__ = captureState();
      const result = await ${behaviorName}(input);

      if (${condition === 'success' ? 'result.success' : condition === 'any error' ? '!result.success' : `result.error === '${condition}'`}) {
        ${assertion}
      }
    });
      `.trim());
    });
  });

  return tests.join('\n\n    ');
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
