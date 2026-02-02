// ============================================================================
// Test Generator - Main Logic
// Generates executable Jest/Vitest tests from ISL domains
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { GenerateOptions, GeneratedFile, GeneratorError, TestFramework } from './types.js';
import { generatePreconditionsDescribeBlock } from './preconditions.js';
import { 
  generatePostconditionsDescribeBlock, 
  generateImpliesTests,
  type PostconditionGeneratorContext 
} from './postconditions.js';
import { generateScenarioTests, generateScenarioHelpers, generateScenarioDataBuilders } from './scenarios.js';
import { generateChaosTests, generateChaosController } from './chaos.js';
import { getJestTemplate, getJestConfig } from './templates/jest.js';
import { getVitestTemplate, getVitestConfig } from './templates/vitest.js';

/**
 * Generate executable test files from an ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const { framework, outputDir = '.', includeHelpers = true, includeChaosTests = true } = options;
  const files: GeneratedFile[] = [];
  const errors: GeneratorError[] = [];

  try {
    // Generate main test file for each behavior
    for (const behavior of domain.behaviors) {
      const testFile = generateBehaviorTestFile(behavior, domain, framework);
      files.push({
        path: `${outputDir}/${behavior.name.name}.test.ts`,
        content: testFile,
        type: 'test',
      });
    }

    // Generate scenario test files
    for (const scenarioBlock of domain.scenarios) {
      const testFile = generateScenarioTestFile(scenarioBlock, framework);
      files.push({
        path: `${outputDir}/${scenarioBlock.behaviorName.name}.scenarios.test.ts`,
        content: testFile,
        type: 'test',
      });
    }

    // Generate chaos test files
    if (includeChaosTests) {
      for (const chaosBlock of domain.chaos) {
        const testFile = generateChaosTestFile(chaosBlock, framework);
        files.push({
          path: `${outputDir}/${chaosBlock.behaviorName.name}.chaos.test.ts`,
          content: testFile,
          type: 'test',
        });
      }
    }

    // Generate helper files
    if (includeHelpers) {
      files.push({
        path: `${outputDir}/helpers/chaos-controller.ts`,
        content: generateChaosController(),
        type: 'helper',
      });

      files.push({
        path: `${outputDir}/helpers/scenario-helpers.ts`,
        content: generateScenarioHelpers(domain),
        type: 'helper',
      });

      files.push({
        path: `${outputDir}/helpers/test-utils.ts`,
        content: generateTestUtils(domain, framework),
        type: 'helper',
      });

      // Generate data builders for each behavior
      for (const behavior of domain.behaviors) {
        files.push({
          path: `${outputDir}/helpers/${behavior.name.name}.builder.ts`,
          content: generateScenarioDataBuilders(behavior),
          type: 'helper',
        });
      }
    }

    // Generate fixture files
    files.push({
      path: `${outputDir}/fixtures/index.ts`,
      content: generateFixtures(domain),
      type: 'fixture',
    });

    // Generate framework config
    if (framework === 'jest') {
      files.push({
        path: `${outputDir}/jest.config.js`,
        content: getJestConfig(),
        type: 'config',
      });
    } else {
      files.push({
        path: `${outputDir}/vitest.config.ts`,
        content: getVitestConfig(),
        type: 'config',
      });
    }

  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Unknown error during generation',
      code: 'GENERATION_ERROR',
    });
  }

  return files;
}

/**
 * Generate a complete test file for a behavior
 */
function generateBehaviorTestFile(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  const behaviorName = behavior.name.name;
  const domainName = domain.name.name;
  const template = framework === 'jest' ? getJestTemplate() : getVitestTemplate();

  // Extract entity names from domain
  const entityNames = domain.entities.map((e) => e.name.name);
  const genCtx: PostconditionGeneratorContext = {
    entityNames,
    domainName,
  };

  const imports = generateImports(behavior, domain, framework);
  const preconditionTests = generatePreconditionsDescribeBlock(behavior, framework);
  const postconditionTests = generatePostconditionsDescribeBlock(behavior, framework, genCtx);
  const impliesTests = generateImpliesTests(behavior, framework, genCtx);
  const invariantTests = generateInvariantTests(behavior, domain, framework);

  return `
${template.header}

${imports}

/**
 * Tests for ${behaviorName} behavior
 * Domain: ${domainName}
 * ${behavior.description?.value || ''}
 */
describe('${behaviorName}', () => {
  // Test setup
  ${template.beforeEach}

  // Teardown
  ${template.afterEach}

  ${preconditionTests}

  ${postconditionTests}

  describe('Contract Implications', () => {
    ${impliesTests}
  });

  ${invariantTests}

  ${generateErrorTests(behavior, framework)}

  ${generateTemporalTests(behavior, framework)}
});
  `.trim();
}

/**
 * Generate imports for a behavior test file
 */
function generateImports(behavior: AST.Behavior, domain: AST.Domain, framework: TestFramework): string {
  const behaviorName = behavior.name.name;
  const entityNames = domain.entities.map((e) => e.name.name);
  
  const imports = [
    // Test runtime for entity bindings
    `import { createTestContext } from '@isl-lang/test-runtime';`,
    // Behavior implementation
    `import { ${behaviorName} } from '../src/${behaviorName}';`,
    // Types
    `import type { ${behaviorName}Input, ${behaviorName}Result } from '../src/types';`,
    // Test helpers
    `import { createTestInput, createInvalidInput } from './helpers/test-utils';`,
  ];

  if (framework === 'vitest') {
    imports.unshift(`import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`);
  }

  // Add a comment showing entity bindings
  if (entityNames.length > 0) {
    imports.push('');
    imports.push(`// Entity bindings from test runtime: ${entityNames.join(', ')}`);
  }

  return imports.join('\n');
}

/**
 * Generate test file for scenarios
 */
function generateScenarioTestFile(
  scenarioBlock: AST.ScenarioBlock,
  framework: TestFramework
): string {
  const behaviorName = scenarioBlock.behaviorName.name;
  const template = framework === 'jest' ? getJestTemplate() : getVitestTemplate();
  const scenarioTests = generateScenarioTests(scenarioBlock, framework);

  const imports = [
    framework === 'vitest' ? `import { describe, it, expect, beforeEach, afterEach } from 'vitest';` : '',
    `import { ${behaviorName} } from '../src/${behaviorName}';`,
    `import { ${behaviorName}InputBuilder } from './helpers/${behaviorName}.builder';`,
    `import { scenarioHelpers } from './helpers/scenario-helpers';`,
  ].filter(Boolean).join('\n');

  return `
${template.header}

${imports}

/**
 * Scenario tests for ${behaviorName}
 */
${scenarioTests}
  `.trim();
}

/**
 * Generate test file for chaos scenarios
 */
function generateChaosTestFile(
  chaosBlock: AST.ChaosBlock,
  framework: TestFramework
): string {
  const behaviorName = chaosBlock.behaviorName.name;
  const template = framework === 'jest' ? getJestTemplate() : getVitestTemplate();
  const chaosTests = generateChaosTests(chaosBlock, framework);

  const imports = [
    framework === 'vitest' ? `import { describe, it, expect, beforeEach, afterEach } from 'vitest';` : '',
    `import { ${behaviorName} } from '../src/${behaviorName}';`,
    `import { ChaosController } from './helpers/chaos-controller';`,
  ].filter(Boolean).join('\n');

  return `
${template.header}

${imports}

/**
 * Chaos tests for ${behaviorName}
 * Tests resilience under failure conditions
 */
${chaosTests}
  `.trim();
}

/**
 * Generate invariant tests for a behavior
 */
function generateInvariantTests(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  if (behavior.invariants.length === 0) {
    return '';
  }

  const entityNames = domain.entities.map((e) => e.name.name);

  const tests = behavior.invariants.map((inv, index) => {
    const invCode = compileExpressionSimple(inv, entityNames);
    return `
    it('should maintain invariant ${index + 1}: ${truncate(invCode, 40)}', async () => {
      const input = createTestInput();
      const result = await ${behavior.name.name}(input);
      
      // Invariant should hold regardless of result
      expect(${invCode}).toBe(true);
    });
    `.trim();
  }).join('\n\n    ');

  return `
  describe('Invariants', () => {
    ${tests}
  });
  `.trim();
}

/**
 * Generate error case tests
 */
function generateErrorTests(behavior: AST.Behavior, framework: TestFramework): string {
  const errorSpecs = behavior.output.errors;

  if (errorSpecs.length === 0) {
    return '';
  }

  const tests = errorSpecs.map((errorSpec) => {
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';
    const retriable = errorSpec.retriable;

    return `
    it('should return ${errorName} when ${when}', async () => {
      const input = createInputFor${errorName}();
      const result = await ${behavior.name.name}(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('${errorName}');
      ${retriable ? `expect(result.retriable).toBe(true);` : `expect(result.retriable).toBe(false);`}
    });
    `.trim();
  }).join('\n\n    ');

  return `
  describe('Error Cases', () => {
    ${tests}
  });
  `.trim();
}

/**
 * Generate temporal property tests
 */
function generateTemporalTests(behavior: AST.Behavior, framework: TestFramework): string {
  if (behavior.temporal.length === 0) {
    return '';
  }

  const tests = behavior.temporal.map((temporal, index) => {
    const operator = temporal.operator;
    const predicate = compileExpressionSimple(temporal.predicate);
    const duration = temporal.duration;

    if (operator === 'within' && duration) {
      const durationMs = convertDurationToMs(duration);
      return `
    it('should complete within ${formatDuration(duration)}', async () => {
      const input = createTestInput();
      const start = Date.now();
      
      await ${behavior.name.name}(input);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThanOrEqual(${durationMs});
    });
      `.trim();
    }

    if (operator === 'eventually') {
      const durationMs = duration ? convertDurationToMs(duration) : 5000;
      return `
    it('should eventually ${predicate}', async () => {
      const input = createTestInput();
      await ${behavior.name.name}(input);
      
      // Poll for condition
      await expect(async () => {
        const state = await checkCondition();
        expect(${predicate}).toBe(true);
      }).toPass({ timeout: ${durationMs} });
    });
      `.trim();
    }

    if (operator === 'always') {
      return `
    it('should always maintain ${predicate}', async () => {
      const input = createTestInput();
      
      // Check condition before
      expect(${predicate}).toBe(true);
      
      await ${behavior.name.name}(input);
      
      // Check condition after
      expect(${predicate}).toBe(true);
    });
      `.trim();
    }

    if (operator === 'never') {
      return `
    it('should never ${predicate}', async () => {
      const input = createTestInput();
      await ${behavior.name.name}(input);
      
      expect(${predicate}).toBe(false);
    });
      `.trim();
    }

    return '';
  }).filter(Boolean).join('\n\n    ');

  if (!tests) {
    return '';
  }

  return `
  describe('Temporal Properties', () => {
    ${tests}
  });
  `.trim();
}

/**
 * Generate test utility helpers
 */
function generateTestUtils(domain: AST.Domain, framework: TestFramework): string {
  const behaviors = domain.behaviors;

  const inputFactories = behaviors.map((b) => {
    const name = b.name.name;
    return `
export function createTestInputFor${name}(): ${name}Input {
  return {
    ${b.input.fields.map((f) => `${f.name.name}: ${getDefaultValue(f.type)}`).join(',\n    ')}
  };
}

export function createInvalidInputFor${name}(): ${name}Input {
  return {
    ${b.input.fields.map((f) => `${f.name.name}: ${getInvalidValue(f.type)}`).join(',\n    ')}
  };
}
    `.trim();
  }).join('\n\n');

  return `
// Test utilities for ${domain.name.name}

${inputFactories}

export function captureState(): Record<string, unknown> {
  return {
    timestamp: Date.now(),
    // Add entity state captures here
  };
}

export function createTestInput(): unknown {
  return {};
}

export function createInvalidInput(): unknown {
  return {};
}

export function createInputThatCausesError(): unknown {
  return {};
}
  `.trim();
}

/**
 * Generate fixtures file
 */
function generateFixtures(domain: AST.Domain): string {
  const entities = domain.entities;

  const entityFixtures = entities.map((entity) => {
    const name = entity.name.name;
    return `
export const ${name.toLowerCase()}Fixture: ${name} = {
  ${entity.fields.map((f) => `${f.name.name}: ${getDefaultValue(f.type)}`).join(',\n  ')}
};

export function create${name}(overrides?: Partial<${name}>): ${name} {
  return { ...${name.toLowerCase()}Fixture, ...overrides };
}
    `.trim();
  }).join('\n\n');

  return `
// Test fixtures for ${domain.name.name}

${entityFixtures}
  `.trim();
}

// Helper functions

import { compileExpression, createCompilerContext } from './expression-compiler.js';

function compileExpressionSimple(expr: AST.Expression, entityNames: string[] = []): string {
  // Use the full expression compiler with entity context
  const ctx = createCompilerContext(entityNames);
  return compileExpression(expr, ctx);
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

function convertDurationToMs(duration: AST.DurationLiteral): number {
  switch (duration.unit) {
    case 'ms':
      return duration.value;
    case 'seconds':
      return duration.value * 1000;
    case 'minutes':
      return duration.value * 60 * 1000;
    case 'hours':
      return duration.value * 60 * 60 * 1000;
    case 'days':
      return duration.value * 24 * 60 * 60 * 1000;
  }
}

function formatDuration(duration: AST.DurationLiteral): string {
  return `${duration.value}${duration.unit}`;
}

function getDefaultValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String':
          return `'test-value'`;
        case 'Int':
          return '1';
        case 'Decimal':
          return '1.0';
        case 'Boolean':
          return 'true';
        case 'UUID':
          return `'00000000-0000-0000-0000-000000000001'`;
        case 'Timestamp':
          return 'new Date()';
        case 'Duration':
          return '1000';
        default:
          return 'undefined';
      }
    case 'ListType':
      return '[]';
    case 'OptionalType':
      return 'undefined';
    case 'ReferenceType':
      return `create${type.name.parts[0].name}()`;
    default:
      return '{}';
  }
}

function getInvalidValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String':
          return `''`; // Empty string often invalid
        case 'Int':
          return '-1'; // Negative often invalid
        case 'Decimal':
          return '-1.0';
        case 'Boolean':
          return 'false';
        case 'UUID':
          return `'invalid-uuid'`;
        case 'Timestamp':
          return 'new Date(0)';
        default:
          return 'null as unknown';
      }
    case 'ListType':
      return '[]'; // Empty list often invalid
    default:
      return 'null as unknown';
  }
}
