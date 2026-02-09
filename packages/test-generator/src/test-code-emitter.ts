// ============================================================================
// Test Code Emitter
// ============================================================================
//
// Generates complete, runnable test code by integrating:
// - Data synthesis from constraints
// - Expected outcome computation from postconditions
// - Data trace comments for reproducibility
// ============================================================================

import type * as AST from '@isl-lang/parser';
import {
  synthesizeInputs,
  type SynthesizedInput,
  type SynthesisOptions,
  generateSeed,
} from './data-synthesizer';
import {
  synthesizeExpectedOutcome,
  compileTemporalAssertion,
  compileSecurityAssertion,
  type ExpectedOutcomeResult,
} from './expected-outcome';
import type { TestFramework } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface EmittedTest {
  /** Test name */
  name: string;
  /** Test description */
  description: string;
  /** Complete test code */
  code: string;
  /** Category (valid, boundary, invalid, precondition_violation) */
  category: string;
  /** Data trace comment */
  dataTrace: string;
}

export interface EmittedTestFile {
  /** File name */
  filename: string;
  /** Complete file content */
  content: string;
  /** Tests in this file */
  tests: EmittedTest[];
  /** Statistics */
  stats: {
    totalTests: number;
    validTests: number;
    boundaryTests: number;
    invalidTests: number;
    preconditionTests: number;
  };
}

export interface EmitOptions extends SynthesisOptions {
  framework?: TestFramework;
  includeDataTrace?: boolean;
  behaviorImportPath?: string;
}

// ============================================================================
// MAIN EMITTER
// ============================================================================

/**
 * Emit complete test file for a behavior
 */
export function emitTestFile(
  behavior: AST.Behavior,
  domain: AST.Domain,
  options: EmitOptions = {}
): EmittedTestFile {
  const {
    framework = 'vitest',
    includeDataTrace = true,
    behaviorImportPath = '../src',
    seed = generateSeed(behavior.name.name),
  } = options;

  const behaviorName = behavior.name.name;

  // Synthesize all inputs
  const inputs = synthesizeInputs(behavior, domain, { ...options, seed });

  // Generate tests from inputs
  const tests: EmittedTest[] = [];

  for (const input of inputs) {
    const outcome = synthesizeExpectedOutcome(behavior, input, domain);
    const test = emitTest(behavior, input, outcome, framework, includeDataTrace);
    tests.push(test);
  }

  // Compute stats
  const stats = {
    totalTests: tests.length,
    validTests: tests.filter(t => t.category === 'valid').length,
    boundaryTests: tests.filter(t => t.category === 'boundary').length,
    invalidTests: tests.filter(t => t.category === 'invalid').length,
    preconditionTests: tests.filter(t => t.category === 'precondition_violation').length,
  };

  // Generate complete file
  const content = generateFileContent(
    behavior, domain, tests, framework, behaviorImportPath, seed
  );

  return {
    filename: `${behaviorName}.test.ts`,
    content,
    tests,
    stats,
  };
}

// ============================================================================
// TEST GENERATION
// ============================================================================

function emitTest(
  behavior: AST.Behavior,
  input: SynthesizedInput,
  outcome: ExpectedOutcomeResult,
  _framework: TestFramework,
  includeDataTrace: boolean
): EmittedTest {
  const testName = `${input.category}: ${input.description}`;
  const dataTrace = includeDataTrace ? generateDataTraceComment(input) : '';

  const code = generateTestCode(behavior, input, outcome, dataTrace);

  return {
    name: testName,
    description: input.description,
    code,
    category: input.category,
    dataTrace,
  };
}

function generateTestCode(
  behavior: AST.Behavior,
  input: SynthesizedInput,
  outcome: ExpectedOutcomeResult,
  dataTrace: string
): string {
  const behaviorName = behavior.name.name;
  const funcName = camelCase(behaviorName);
  const inputTypeName = `${behaviorName}Input`;

  // Format input values
  const inputCode = formatInputObject(input.values, inputTypeName);

  // Generate assertion code
  const assertionCode = outcome.contractCode;

  // Build the test
  const lines: string[] = [];

  // Data trace comment
  if (dataTrace) {
    lines.push(dataTrace);
  }

  // Arrange section
  lines.push('// Arrange');
  lines.push(inputCode);
  lines.push('');

  // Capture state if needed
  if (outcome.capturesBefore.length > 0) {
    lines.push('// Capture state before execution');
    lines.push('const __old__: Record<string, unknown> = {};');
    for (const capture of outcome.capturesBefore) {
      const safeName = capture.replace(/\./g, '_').replace(/[()]/g, '');
      lines.push(`__old__['${safeName}'] = await captureState('${capture}');`);
    }
    lines.push('');
  }

  // Act section
  lines.push('// Act');
  lines.push(`const result = await ${funcName}(input);`);
  lines.push('');

  // Assert section
  lines.push('// Assert');
  lines.push(assertionCode);

  return lines.join('\n');
}

// ============================================================================
// FILE GENERATION
// ============================================================================

function generateFileContent(
  behavior: AST.Behavior,
  domain: AST.Domain,
  tests: EmittedTest[],
  framework: TestFramework,
  behaviorImportPath: string,
  seed: number
): string {
  const behaviorName = behavior.name.name;
  const domainName = domain.name.name;
  // Note: funcName = camelCase(behaviorName) is available if needed for imports

  const lines: string[] = [];

  // File header with generation info
  lines.push(`// ============================================================================`);
  lines.push(`// Generated Tests for ${behaviorName}`);
  lines.push(`// Domain: ${domainName}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Seed: ${seed}`);
  lines.push(`// ============================================================================`);
  lines.push('');

  // Imports
  lines.push(generateImports(behavior, domain, framework, behaviorImportPath));
  lines.push('');

  // Test context setup
  lines.push(generateTestContext(domain));
  lines.push('');

  // Describe block
  lines.push(`describe('${behaviorName}', () => {`);

  // Group tests by category
  const categories = ['valid', 'boundary', 'invalid', 'precondition_violation'] as const;

  for (const category of categories) {
    const categoryTests = tests.filter(t => t.category === category);
    if (categoryTests.length === 0) continue;

    const categoryLabel = getCategoryLabel(category);
    lines.push('');
    lines.push(`  describe('${categoryLabel}', () => {`);

    for (const test of categoryTests) {
      lines.push('');
      lines.push(`    it('${escapeString(test.description)}', async () => {`);
      lines.push(indentCode(test.code, 6));
      lines.push('    });');
    }

    lines.push('  });');
  }

  // Temporal constraint tests
  if (behavior.temporal && behavior.temporal.length > 0) {
    lines.push('');
    lines.push(`  describe('Temporal Constraints', () => {`);

    for (const temporal of behavior.temporal) {
      const assertion = compileTemporalAssertion(temporal, behaviorName);
      lines.push('');
      lines.push(`    it('${escapeString(assertion.description)}', async () => {`);
      // Use first valid input for temporal tests
      const validInput = tests.find(t => t.category === 'valid');
      if (validInput) {
        lines.push(indentCode('// Arrange — reuse a valid input', 6));
        lines.push(indentCode(`const input = ${formatInlineInput(validInput)};`, 6));
        lines.push('');
      }
      lines.push(indentCode(assertion.code, 6));
      lines.push('    });');
    }

    lines.push('  });');
  }

  // Security constraint tests
  if (behavior.security && behavior.security.length > 0) {
    lines.push('');
    lines.push(`  describe('Security Constraints', () => {`);

    for (const security of behavior.security) {
      const assertion = compileSecurityAssertion(security, behaviorName);
      lines.push('');
      lines.push(`    it('${escapeString(assertion.description)}', async () => {`);
      const validInput = tests.find(t => t.category === 'valid');
      if (validInput) {
        lines.push(indentCode('// Arrange — reuse a valid input', 6));
        lines.push(indentCode(`const input = ${formatInlineInput(validInput)};`, 6));
        lines.push('');
      }
      lines.push(indentCode(assertion.code, 6));
      lines.push('    });');
    }

    lines.push('  });');
  }

  lines.push('});');

  // Helper functions
  lines.push('');
  lines.push(generateHelperFunctions(behavior, domain));

  return lines.join('\n');
}

function generateImports(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework,
  behaviorImportPath: string
): string {
  const behaviorName = behavior.name.name;
  const funcName = camelCase(behaviorName);
  const lines: string[] = [];

  // Test framework imports
  if (framework === 'vitest') {
    lines.push(`import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`);
  } else {
    lines.push(`import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';`);
  }

  lines.push('');

  // Behavior import
  lines.push(`// Behavior implementation`);
  lines.push(`import { ${funcName} } from '${behaviorImportPath}/${behaviorName}';`);

  // Types import
  lines.push(`import type { ${behaviorName}Input, ${behaviorName}Result } from '${behaviorImportPath}/types';`);

  // Entity imports if needed
  const entityNames = domain.entities.map(e => e.name.name);
  if (entityNames.length > 0) {
    lines.push('');
    lines.push(`// Entity mocks`);
    lines.push(`import { ${entityNames.join(', ')} } from './fixtures';`);
  }

  return lines.join('\n');
}

function generateTestContext(domain: AST.Domain): string {
  const lines: string[] = [];

  lines.push('// Test context');
  lines.push('let testContext: {');
  lines.push('  reset: () => void;');
  lines.push('  captureState: () => Record<string, unknown>;');
  lines.push('};');
  lines.push('');
  lines.push('beforeEach(() => {');
  lines.push('  testContext = {');
  lines.push('    reset: () => {');
  lines.push('      // Reset entity state');
  for (const entity of domain.entities) {
    lines.push(`      ${entity.name.name}.reset?.();`);
  }
  lines.push('    },');
  lines.push('    captureState: () => ({');
  lines.push('      timestamp: Date.now(),');
  lines.push('    }),');
  lines.push('  };');
  lines.push('  testContext.reset();');
  lines.push('});');
  lines.push('');
  lines.push('afterEach(() => {');
  lines.push('  // Cleanup');
  lines.push('});');

  return lines.join('\n');
}

function generateHelperFunctions(
  _behavior: AST.Behavior,
  _domain: AST.Domain
): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push('// Helper Functions');
  lines.push('// ============================================================================');
  lines.push('');

  // Capture state helper
  lines.push('async function captureState(path: string): Promise<unknown> {');
  lines.push('  // Implement state capture for old() expressions');
  lines.push('  return undefined;');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// DATA TRACE COMMENT GENERATION
// ============================================================================

function generateDataTraceComment(input: SynthesizedInput): string {
  const { dataTrace } = input;
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * @dataTrace`);
  lines.push(` * Seed: ${dataTrace.seed}`);
  lines.push(` * Strategy: ${dataTrace.strategy}`);
  lines.push(` * Generated: ${dataTrace.generatedAt}`);

  if (dataTrace.constraints.length > 0) {
    lines.push(` * Constraints:`);
    for (const constraint of dataTrace.constraints) {
      const constraintStr = constraint.constraints.length > 0
        ? constraint.constraints.join(', ')
        : 'none';
      lines.push(` *   - ${constraint.field} (${constraint.type}): ${constraintStr}`);
    }
  }

  lines.push(' */');

  return lines.join('\n');
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatInputObject(
  values: Record<string, unknown>,
  typeName: string
): string {
  const lines: string[] = [];
  lines.push(`const input: ${typeName} = {`);

  for (const [key, value] of Object.entries(values)) {
    lines.push(`  ${key}: ${formatValue(value)},`);
  }

  lines.push('};');

  return lines.join('\n');
}

function formatValue(value: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    // Check if it looks like a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return `'${value}'`;
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => formatValue(v, indent + 1));
    return `[\n${spaces}  ${items.join(`,\n${spaces}  `)}\n${spaces}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    const formatted = entries.map(([k, v]) => 
      `${spaces}  ${k}: ${formatValue(v, indent + 1)}`
    );

    return `{\n${formatted.join(',\n')}\n${spaces}}`;
  }

  return String(value);
}

function indentCode(code: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return code.split('\n').map(line => indent + line).join('\n');
}

function camelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'valid': return 'Valid Inputs';
    case 'boundary': return 'Boundary Cases';
    case 'invalid': return 'Invalid Inputs (Negative Tests)';
    case 'precondition_violation': return 'Precondition Violations';
    default: return category;
  }
}

function formatInlineInput(test: EmittedTest): string {
  // Extract the input object from the test code (between the first { and matching })
  const match = test.code.match(/const input[^=]*=\s*(\{[\s\S]*?\});/);
  if (match && match[1]) {
    return match[1].replace(/\n\s*/g, ' ');
  }
  return '{}';
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  formatInputObject,
  formatValue,
  generateDataTraceComment,
};
