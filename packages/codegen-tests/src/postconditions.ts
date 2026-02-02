// ============================================================================
// Postcondition Test Generator
// Converts ISL postconditions to result assertion tests
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { 
  compileExpression, 
  compileAssertion, 
  createCompilerContext,
  type CompilerContext 
} from './expression-compiler.js';
import type { PostconditionTest, TestFramework } from './types.js';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Context for generating postcondition tests
 */
export interface PostconditionGeneratorContext {
  /** Entity names in the domain */
  entityNames: string[];
  /** Domain name */
  domainName?: string;
}

/**
 * Generate postcondition assertion tests for a behavior
 * 
 * @param behavior - The behavior AST node
 * @param framework - Test framework ('jest' or 'vitest')
 * @param genCtx - Generator context with entity names
 */
export function generatePostconditionTests(
  behavior: AST.Behavior,
  framework: TestFramework,
  genCtx: PostconditionGeneratorContext = { entityNames: [] }
): PostconditionTest[] {
  const tests: PostconditionTest[] = [];
  const ctx = createCompilerContext(genCtx.entityNames);

  behavior.postconditions.forEach((block) => {
    const condition = extractConditionName(block.condition);
    const testName = `when ${condition}`;

    tests.push({
      name: testName,
      condition,
      expressions: block.predicates,
      testCode: generatePostconditionBlockCode(block, behavior, framework, ctx),
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
  framework: TestFramework,
  ctx: CompilerContext
): string {
  const condition = extractConditionName(block.condition);
  const behaviorName = behavior.name.name;
  const assertions = block.predicates
    .map((pred) => compileAssertion(pred, framework, ctx))
    .join('\n        ');

  if (condition === 'success') {
    return `
    describe('on success', () => {
      it('should satisfy all success postconditions', async () => {
        // Setup
        const input = createValidInput();
        const __old__ = ctx.captureState();

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
        const __old__ = ctx.captureState();

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
        const __old__ = ctx.captureState();

        // Execute
        const result = await ${behaviorName}(input);

        // Verify specific error
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('${condition}');

        // Verify postconditions
        ${assertions}
      });
    });
  `.trim();
}

/**
 * Generate a describe block containing all postcondition tests
 * 
 * @param behavior - The behavior AST node
 * @param framework - Test framework
 * @param genCtx - Generator context with entity names
 */
export function generatePostconditionsDescribeBlock(
  behavior: AST.Behavior,
  framework: TestFramework,
  genCtx: PostconditionGeneratorContext = { entityNames: [] }
): string {
  const tests = generatePostconditionTests(behavior, framework, genCtx);

  if (tests.length === 0) {
    return '';
  }

  const testCases = tests.map((test) => test.testCode).join('\n\n    ');
  const entityList = genCtx.entityNames.map(e => `'${e}'`).join(', ');

  return `
  describe('Postconditions', () => {
    // Test context with entity bindings
    const ctx = createTestContext({ entities: [${entityList}] });
    const { ${genCtx.entityNames.join(', ')} } = ctx.entities;

    beforeEach(() => ctx.reset());

    ${testCases}
  });
  `.trim();
}

/**
 * Generate postcondition assertion helper code
 */
export function generatePostconditionAssertions(
  behavior: AST.Behavior,
  framework: TestFramework,
  genCtx: PostconditionGeneratorContext = { entityNames: [] }
): string {
  const behaviorName = behavior.name.name;
  const ctx = createCompilerContext(genCtx.entityNames);
  
  const successAssertions = behavior.postconditions
    .filter((b) => b.condition === 'success')
    .flatMap((b) => b.predicates)
    .map((p, i) => `
  assertSuccessPostcondition${i + 1}(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: StateCapture): void {
    // ${compileExpression(p, ctx)}
    expect(${compileExpression(p, ctx)}).toBe(true);
  }`);

  const errorAssertions = behavior.postconditions
    .filter((b) => b.condition === 'any_error')
    .flatMap((b) => b.predicates)
    .map((p, i) => `
  assertErrorPostcondition${i + 1}(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: StateCapture): void {
    // ${compileExpression(p, ctx)}
    expect(${compileExpression(p, ctx)}).toBe(true);
  }`);

  return `
// Postcondition assertions for ${behaviorName}
export const postconditionAssertions = {
  ${successAssertions.join(',\n')}
  ${errorAssertions.join(',\n')}

  assertAllSuccess(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: StateCapture): void {
    ${successAssertions.map((_, i) => `this.assertSuccessPostcondition${i + 1}(result, input, __old__);`).join('\n    ')}
  },

  assertAllError(result: ${behaviorName}Result, input: ${behaviorName}Input, __old__: StateCapture): void {
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
  framework: TestFramework,
  genCtx: PostconditionGeneratorContext = { entityNames: [] }
): string {
  const behaviorName = behavior.name.name;
  const ctx = createCompilerContext(genCtx.entityNames);
  const tests: string[] = [];

  behavior.postconditions.forEach((block) => {
    const condition = extractConditionName(block.condition);

    block.predicates.forEach((predicate) => {
      const predicateCode = compileExpression(predicate, ctx);
      const assertion = compileAssertion(predicate, framework, ctx);

      tests.push(`
    it('${condition} implies ${truncate(predicateCode, 40)}', async () => {
      const input = createInputFor${sanitizeName(condition)}();
      const __old__ = ctx.captureState();
      const result = await ${behaviorName}(input);

      if (${condition === 'success' ? 'result.success' : condition === 'any error' ? '!result.success' : `result.error?.code === '${condition}'`}) {
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
