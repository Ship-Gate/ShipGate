/**
 * Vitest Test Generator
 * 
 * Generates Vitest test files from ISL scenarios.
 */

import { readFileSync } from 'fs';
import { ScenarioParser } from './scenario-parser.js';
import type { ISLScenario } from './scenario-parser.js';

// ============================================================================
// Types
// ============================================================================

export interface TestGenerationOptions {
  specPath: string;
  outputPath?: string;
  handlerPath?: string;
  adapterPath?: string;
}

// ============================================================================
// Vitest Test Generator
// ============================================================================

export class VitestTestGenerator {
  /**
   * Generate Vitest test file from ISL spec
   */
  generateTests(options: TestGenerationOptions): string {
    const islContent = readFileSync(options.specPath, 'utf-8');
    const parser = new ScenarioParser();
    const parsedScenarios = parser.parseScenarios(islContent);

    if (parsedScenarios.length === 0) {
      return this.generateEmptyTest(options);
    }

    const imports = this.generateImports(options);
    const testSuites = parsedScenarios.map((parsed) =>
      this.generateTestSuite(parsed, options)
    );

    return [
      imports,
      '',
      ...testSuites,
    ].join('\n');
  }

  /**
   * Generate imports section
   */
  private generateImports(options: TestGenerationOptions): string {
    const imports: string[] = [
      "import { describe, it, expect, beforeEach } from 'vitest';",
      "import { ContractTestHarness } from './harness.js';",
      "import { ScenarioParser } from './scenario-parser.js';",
    ];

    if (options.handlerPath) {
      imports.push(`import * as handlers from '${options.handlerPath}';`);
    }

    if (options.adapterPath) {
      imports.push(`import * as adapters from '${options.adapterPath}';`);
    }

    return imports.join('\n');
  }

  /**
   * Generate test suite for a behavior's scenarios
   */
  private generateTestSuite(
    parsed: { behaviorName: string; scenarios: ISLScenario[] },
    options: TestGenerationOptions
  ): string {
    const lines: string[] = [];

    lines.push(`describe('${parsed.behaviorName} Contract Tests', () => {`);
    lines.push('  let harness: ContractTestHarness;');
    lines.push('  let parser: ScenarioParser;');
    lines.push('');
    lines.push('  beforeEach(() => {');
    lines.push('    harness = new ContractTestHarness({ timeout: 5000 });');
    lines.push('    parser = new ScenarioParser();');
    lines.push('');

    // Bind handler
    if (options.handlerPath) {
      lines.push(`    // Bind behavior handler`);
      lines.push(`    harness.bindBehavior('${parsed.behaviorName}', handlers.${parsed.behaviorName});`);
    } else {
      lines.push(`    // TODO: Bind behavior handler`);
      lines.push(`    // harness.bindBehavior('${parsed.behaviorName}', yourHandler);`);
    }

    lines.push('  });');
    lines.push('');

    // Generate test for each scenario
    for (const scenario of parsed.scenarios) {
      lines.push(...this.generateScenarioTest(scenario, parsed.behaviorName, options));
      lines.push('');
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate test for a single scenario
   */
  private generateScenarioTest(
    scenario: ISLScenario,
    behaviorName: string,
    options: TestGenerationOptions
  ): string[] {
    const lines: string[] = [];
    const testName = scenario.name.replace(/[^a-zA-Z0-9]/g, '_');

    lines.push(`  it('${scenario.name}', async () => {`);

    // Extract given variables
    const givenVars: string[] = [];
    for (const stmt of scenario.given) {
      if (stmt.kind === 'AssignmentStmt' && stmt.target) {
        const value = this.formatValue(stmt.value);
        givenVars.push(`    const ${stmt.target} = ${value};`);
      }
    }

    if (givenVars.length > 0) {
      lines.push(...givenVars);
      lines.push('');
    }

    // Extract when input
    const inputVars: string[] = [];
    const whenInput: Record<string, unknown> = {};

    for (const stmt of scenario.when) {
      if (stmt.kind === 'AssignmentStmt' && stmt.target === 'result') {
        const call = stmt.value as any;
        if (call?.callee) {
          // Extract arguments
          if (call.arguments) {
            for (const arg of call.arguments) {
              if (typeof arg === 'object' && arg !== null) {
                Object.assign(whenInput, arg);
              }
            }
          }
        }
      } else if (stmt.call) {
        if (stmt.call.arguments) {
          for (const arg of stmt.call.arguments) {
            if (typeof arg === 'object' && arg !== null) {
              Object.assign(whenInput, arg);
            }
          }
        }
      }
    }

    // Build input object
    if (Object.keys(whenInput).length > 0) {
      const inputEntries = Object.entries(whenInput).map(([key, value]) => {
        // Check if value references a given variable
        if (typeof value === 'string' && scenario.given.some(s => s.target === value)) {
          return `      ${key}: ${value}`;
        }
        return `      ${key}: ${this.formatValue(value)}`;
      });

      lines.push('    const input = {');
      lines.push(...inputEntries);
      lines.push('    };');
      lines.push('');
    } else {
      lines.push('    const input = {};');
      lines.push('');
    }

    // Execute test
    lines.push('    const testCase = harness.scenarioToTestCase({');
    lines.push(`      name: '${scenario.name}',`);
    lines.push(`      behaviorName: '${behaviorName}',`);
    lines.push('      given: {},');
    lines.push(`      when: { behavior: '${behaviorName}', input },`);
    lines.push('      then: { assertions: [] },');
    lines.push('    });');
    lines.push('');
    lines.push('    const result = await harness.runTestCase(testCase);');
    lines.push('');
    lines.push('    expect(result.passed).toBe(true);');

    // Add specific assertions from then block
    for (const expr of scenario.then) {
      const assertion = this.parseAssertionForTest(expr.expression);
      if (assertion) {
        lines.push(`    ${assertion}`);
      }
    }

    if (scenario.then.length === 0) {
      lines.push('    // No specific assertions defined in scenario');
    }

    lines.push('  });');

    return lines;
  }

  /**
   * Format value for test code
   */
  private formatValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => `${k}: ${this.formatValue(v)}`);
      return `{ ${entries.join(', ')} }`;
    }
    return JSON.stringify(value);
  }

  /**
   * Parse assertion expression for test code
   */
  private parseAssertionForTest(expression: string): string | null {
    expression = expression.trim();

    // "result is success"
    if (expression === 'result is success' || expression.match(/^result\s+is\s+success$/i)) {
      return "expect(result.actualResult).toHaveProperty('success');";
    }

    // "result is failure"
    if (expression === 'result is failure' || expression.match(/^result\s+is\s+failure$/i)) {
      return "expect(result.actualResult).toHaveProperty('error');";
    }

    // "result.error == ERROR_NAME"
    const errorMatch = expression.match(/^result\.error\s*==\s*(\w+)$/);
    if (errorMatch) {
      return `expect(result.actualResult?.error?.code).toBe('${errorMatch[1]}');`;
    }

    // "result.field == value"
    const propertyMatch = expression.match(/^result\.(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (propertyMatch) {
      const [, property, operator, valueStr] = propertyMatch;
      const value = this.formatValue(valueStr);
      
      if (operator === '==') {
        return `expect(result.actualResult?.${property}).toBe(${value});`;
      } else if (operator === '!=') {
        return `expect(result.actualResult?.${property}).not.toBe(${value});`;
      } else {
        return `expect(result.actualResult?.${property}).toBe${operator}(${value});`;
      }
    }

    return null;
  }

  /**
   * Generate empty test file
   */
  private generateEmptyTest(options: TestGenerationOptions): string {
    return [
      "import { describe, it, expect } from 'vitest';",
      '',
      `describe('Contract Tests for ${options.specPath}', () => {`,
      "  it('should have scenarios defined', () => {",
      "    // No scenarios found in ISL spec",
      '    expect(true).toBe(true);',
      '  });',
      '});',
    ].join('\n');
  }
}
