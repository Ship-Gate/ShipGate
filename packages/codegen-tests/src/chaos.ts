// ============================================================================
// Chaos Test Generator
// Converts ISL chaos scenarios to failure injection tests
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { compileExpression, compileAssertion } from './expression-compiler.js';
import type { ChaosContext, TestFramework } from './types.js';

/**
 * Generate chaos tests from chaos blocks
 */
export function generateChaosTests(
  chaosBlock: AST.ChaosBlock,
  framework: TestFramework
): string {
  const behaviorName = chaosBlock.behaviorName.name;
  const scenarios = chaosBlock.scenarios;

  const tests = scenarios.map((scenario) => generateChaosScenarioTest(scenario, behaviorName, framework));

  return `
describe('${behaviorName} Chaos Tests', () => {
  // Chaos injection utilities
  let chaosController: ChaosController;

  beforeEach(() => {
    chaosController = new ChaosController();
  });

  afterEach(async () => {
    await chaosController.cleanup();
  });

  ${tests.join('\n\n  ')}
});
  `.trim();
}

/**
 * Generate a single chaos scenario test
 */
function generateChaosScenarioTest(
  scenario: AST.ChaosScenario,
  behaviorName: string,
  framework: TestFramework
): string {
  const scenarioName = scenario.name.value;
  const injectCode = generateInjectBlock(scenario.inject);
  const whenCode = generateWhenBlock(scenario.when, behaviorName);
  const thenCode = generateThenBlock(scenario.then, framework);

  return `
  it('${scenarioName}', async () => {
    // Inject chaos
    ${injectCode}

    // When
    ${whenCode}

    // Then (verify resilience)
    ${thenCode}
  });
  `.trim();
}

/**
 * Generate chaos injection code
 */
function generateInjectBlock(injections: AST.Injection[]): string {
  if (injections.length === 0) {
    return '// No chaos injection';
  }

  return injections.map((injection) => compileInjection(injection)).join('\n    ');
}

/**
 * Compile a single injection to TypeScript code
 */
function compileInjection(injection: AST.Injection): string {
  const target = compileExpression(injection.target);
  const params = injection.parameters.map((p) => `${p.name.name}: ${compileExpression(p.value)}`).join(', ');

  switch (injection.type) {
    case 'database_failure':
      return `await chaosController.injectDatabaseFailure(${target}, { ${params} });`;

    case 'network_latency':
      return `await chaosController.injectNetworkLatency(${target}, { ${params} });`;

    case 'network_partition':
      return `await chaosController.injectNetworkPartition(${target}, { ${params} });`;

    case 'service_unavailable':
      return `await chaosController.injectServiceUnavailable(${target}, { ${params} });`;

    case 'cpu_pressure':
      return `await chaosController.injectCpuPressure({ ${params} });`;

    case 'memory_pressure':
      return `await chaosController.injectMemoryPressure({ ${params} });`;

    case 'clock_skew':
      return `await chaosController.injectClockSkew({ ${params} });`;

    case 'concurrent_requests':
      return generateConcurrentRequestsCode(injection);

    default:
      return `// Unknown injection type: ${injection.type}`;
  }
}

/**
 * Generate code for concurrent requests chaos
 */
function generateConcurrentRequestsCode(injection: AST.Injection): string {
  const countParam = injection.parameters.find((p) => p.name.name === 'count');
  const requestParam = injection.parameters.find((p) => p.name.name === 'request');

  const count = countParam ? compileExpression(countParam.value) : '10';
  const request = requestParam ? compileExpression(requestParam.value) : 'defaultRequest()';

  return `
    const concurrentPromises = Array.from({ length: ${count} }, () => ${request});
    const results = await Promise.allSettled(concurrentPromises);
  `.trim();
}

/**
 * Generate execution code from 'when' statements for chaos tests
 */
function generateWhenBlock(statements: AST.Statement[], behaviorName: string): string {
  if (statements.length === 0) {
    return `const result = await ${behaviorName}({});`;
  }

  return statements.map((stmt) => compileStatement(stmt)).join('\n    ');
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
 * Generate assertion code from 'then' expressions for chaos tests
 */
function generateThenBlock(expressions: AST.Expression[], framework: TestFramework): string {
  if (expressions.length === 0) {
    return 'expect(result).toBeDefined();';
  }

  return expressions.map((expr) => compileThenExpression(expr, framework)).join('\n    ');
}

/**
 * Compile a 'then' expression to an assertion
 */
function compileThenExpression(expr: AST.Expression, framework: TestFramework): string {
  // Handle "result is error" pattern
  if (expr.kind === 'BinaryExpr') {
    const left = expr.left;
    const right = expr.right;

    if (left.kind === 'Identifier' && left.name === 'result') {
      if (right.kind === 'Identifier') {
        if (right.name === 'error') {
          return 'expect(result.success).toBe(false);';
        }
        if (right.name === 'success') {
          return 'expect(result.success).toBe(true);';
        }
      }
    }
  }

  return compileAssertion(expr, framework);
}

/**
 * Generate describe block for all chaos blocks in a domain
 */
export function generateAllChaosDescribeBlock(
  domain: AST.Domain,
  framework: TestFramework
): string {
  const chaosBlocks = domain.chaos;

  if (chaosBlocks.length === 0) {
    return '';
  }

  const tests = chaosBlocks.map((block) => generateChaosTests(block, framework));

  return tests.join('\n\n');
}

/**
 * Generate chaos controller implementation
 */
export function generateChaosController(): string {
  return `
// Chaos Controller for failure injection
export class ChaosController {
  private activeInjections: Array<{ cleanup: () => Promise<void> }> = [];

  async injectDatabaseFailure(
    target: string,
    options: { mode: 'UNAVAILABLE' | 'TIMEOUT' | 'CORRUPT' }
  ): Promise<void> {
    // Mock the database to fail
    const originalImpl = this.getOriginalImpl(target);
    this.mockImpl(target, async () => {
      if (options.mode === 'UNAVAILABLE') {
        throw new Error('Database unavailable');
      }
      if (options.mode === 'TIMEOUT') {
        await new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
      }
      throw new Error('Database failure');
    });

    this.activeInjections.push({
      cleanup: async () => this.restoreImpl(target, originalImpl),
    });
  }

  async injectNetworkLatency(
    target: string,
    options: { delay: number; jitter?: number }
  ): Promise<void> {
    const originalImpl = this.getOriginalImpl(target);
    this.mockImpl(target, async (...args: unknown[]) => {
      const jitter = options.jitter ? Math.random() * options.jitter : 0;
      await new Promise((resolve) => setTimeout(resolve, options.delay + jitter));
      return originalImpl(...args);
    });

    this.activeInjections.push({
      cleanup: async () => this.restoreImpl(target, originalImpl),
    });
  }

  async injectNetworkPartition(
    target: string,
    options: { duration?: number }
  ): Promise<void> {
    const originalImpl = this.getOriginalImpl(target);
    this.mockImpl(target, async () => {
      throw new Error('Network partition: cannot reach service');
    });

    this.activeInjections.push({
      cleanup: async () => this.restoreImpl(target, originalImpl),
    });
  }

  async injectServiceUnavailable(
    target: string,
    options: { statusCode?: number }
  ): Promise<void> {
    const originalImpl = this.getOriginalImpl(target);
    this.mockImpl(target, async () => {
      const error = new Error('Service unavailable');
      (error as Error & { statusCode: number }).statusCode = options.statusCode || 503;
      throw error;
    });

    this.activeInjections.push({
      cleanup: async () => this.restoreImpl(target, originalImpl),
    });
  }

  async injectCpuPressure(options: { percentage: number; duration: number }): Promise<void> {
    // Simulate CPU pressure (limited in JavaScript)
    console.warn('CPU pressure injection simulated');
  }

  async injectMemoryPressure(options: { percentage: number }): Promise<void> {
    // Simulate memory pressure
    console.warn('Memory pressure injection simulated');
  }

  async injectClockSkew(options: { offset: number }): Promise<void> {
    const originalNow = Date.now;
    Date.now = () => originalNow() + options.offset;

    this.activeInjections.push({
      cleanup: async () => {
        Date.now = originalNow;
      },
    });
  }

  async cleanup(): Promise<void> {
    for (const injection of this.activeInjections.reverse()) {
      await injection.cleanup();
    }
    this.activeInjections = [];
  }

  private getOriginalImpl(target: string): (...args: unknown[]) => unknown {
    // Implementation would resolve target to actual function
    return () => {};
  }

  private mockImpl(target: string, impl: (...args: unknown[]) => unknown): void {
    // Implementation would replace target with mock
  }

  private restoreImpl(target: string, impl: (...args: unknown[]) => unknown): void {
    // Implementation would restore original
  }
}
  `.trim();
}

/**
 * Extract chaos context for a single scenario
 */
export function extractChaosContext(
  scenario: AST.ChaosScenario,
  behaviorName: string
): ChaosContext {
  return {
    behaviorName,
    scenarioName: scenario.name.value,
    injections: scenario.inject,
    whenStatements: scenario.when,
    thenExpressions: scenario.then,
  };
}
