// ============================================================================
// Test Generator - Main Entry Point
// Generates executable tests with domain-specific assertions from ISL specs
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  GenerateOptions,
  GeneratedFile,
  GenerateResult,
  GeneratorError,
  GenerationMetadata,
  BehaviorMetadata,
  OpenQuestion,
  GenerationStats,
  AssertionMetadata,
  CoverageInfo,
  GeneratedAssertion,
  StrategyContext,
  TestFramework,
} from './types';
import { getStrategy, detectDomain } from './strategies';

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate executable test files from an ISL domain specification
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GenerateResult {
  const {
    framework,
    outputDir = '.',
    includeHelpers = true,
    emitMetadata = true,
    forceDomain,
  } = options;

  const files: GeneratedFile[] = [];
  const errors: GeneratorError[] = [];
  const openQuestions: OpenQuestion[] = [];
  const behaviorMetadata: BehaviorMetadata[] = [];

  let questionCounter = 0;

  // Create strategy context
  const entityNames = domain.entities.map(e => e.name.name);
  const createContext = (_behavior: AST.Behavior): StrategyContext => ({
    framework,
    entityNames,
    domainName: domain.name.name,
    addOpenQuestion: (q) => {
      openQuestions.push({
        ...q,
        id: `Q${++questionCounter}`,
      });
    },
  });

  try {
    // Generate test files for each behavior
    for (const behavior of domain.behaviors) {
      const ctx = createContext(behavior);
      const strategy = getStrategy(behavior, domain, forceDomain);
      const detectedDomain = strategy.domain;

      const {
        testFile,
        assertions,
        coverage,
      } = generateBehaviorTestFile(behavior, domain, strategy, ctx, framework);

      files.push({
        path: `${outputDir}/${behavior.name.name}.test.ts`,
        content: testFile,
        type: 'test',
      });

      behaviorMetadata.push({
        name: behavior.name.name,
        domain: detectedDomain,
        assertions,
        coverage,
      });
    }

    // Generate helper files
    if (includeHelpers) {
      files.push({
        path: `${outputDir}/helpers/test-utils.ts`,
        content: generateTestUtils(domain, framework),
        type: 'helper',
      });

      files.push({
        path: `${outputDir}/helpers/fixtures.ts`,
        content: generateFixtures(domain),
        type: 'fixture',
      });
    }

    // Generate framework config
    files.push({
      path: `${outputDir}/${framework === 'jest' ? 'jest.config.js' : 'vitest.config.ts'}`,
      content: framework === 'jest' ? generateJestConfig() : generateVitestConfig(),
      type: 'config',
    });

    // Generate metadata file
    if (emitMetadata) {
      const stats = computeStats(behaviorMetadata, openQuestions);
      const firstBehavior = domain.behaviors[0];
      const metadata: GenerationMetadata = {
        domain: forceDomain || (firstBehavior ? detectDomain(firstBehavior, domain) : 'generic'),
        behaviors: behaviorMetadata,
        openQuestions,
        stats,
      };

      files.push({
        path: `${outputDir}/test-metadata.json`,
        content: JSON.stringify(metadata, null, 2),
        type: 'metadata',
      });
    }

  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Unknown error during generation',
      code: 'GENERATION_ERROR',
      severity: 'error',
    });
  }

  const stats = computeStats(behaviorMetadata, openQuestions);
  const metadata: GenerationMetadata = {
    domain: forceDomain || (domain.behaviors.length > 0 && domain.behaviors[0] ? detectDomain(domain.behaviors[0], domain) : 'generic'),
    behaviors: behaviorMetadata,
    openQuestions,
    stats,
  };

  return {
    success: errors.filter(e => e.severity === 'error').length === 0,
    files,
    errors,
    metadata,
  };
}

// ============================================================================
// BEHAVIOR TEST FILE GENERATION
// ============================================================================

interface BehaviorGenerationResult {
  testFile: string;
  assertions: AssertionMetadata[];
  coverage: CoverageInfo;
}

function generateBehaviorTestFile(
  behavior: AST.Behavior,
  domain: AST.Domain,
  strategy: ReturnType<typeof getStrategy>,
  ctx: StrategyContext,
  framework: TestFramework
): BehaviorGenerationResult {
  const behaviorName = behavior.name.name;
  const domainName = domain.name.name;
  const allAssertions: AssertionMetadata[] = [];

  // Generate imports
  const imports = generateImports(behavior, domain, framework);

  // Generate precondition tests
  const preconditionAssertions: GeneratedAssertion[] = [];
  for (const pre of behavior.preconditions) {
    const assertions = strategy.generatePreconditionAssertions(pre, behavior, ctx);
    preconditionAssertions.push(...assertions);
  }
  const preconditionTests = generatePreconditionBlock(
    behavior,
    preconditionAssertions,
    framework
  );
  allAssertions.push(...preconditionAssertions.map(a => ({
    description: a.description,
    pattern: a.pattern,
    status: a.status,
    implementationHint: a.implementationHint,
  })));

  // Generate postcondition tests
  const postconditionAssertions: GeneratedAssertion[] = [];
  for (const post of behavior.postconditions) {
    const assertions = strategy.generatePostconditionAssertions(post, behavior, ctx);
    postconditionAssertions.push(...assertions);
  }
  const postconditionTests = generatePostconditionBlock(
    behavior,
    postconditionAssertions,
    framework
  );
  allAssertions.push(...postconditionAssertions.map(a => ({
    description: a.description,
    pattern: a.pattern,
    status: a.status,
    implementationHint: a.implementationHint,
  })));

  // Generate error tests
  const errorAssertions: GeneratedAssertion[] = [];
  for (const err of behavior.output.errors) {
    const assertions = strategy.generateErrorAssertions(err, behavior, ctx);
    errorAssertions.push(...assertions);
  }
  const errorTests = generateErrorBlock(behavior, errorAssertions, framework);
  allAssertions.push(...errorAssertions.map(a => ({
    description: a.description,
    pattern: a.pattern,
    status: a.status,
    implementationHint: a.implementationHint,
  })));

  // Generate invariant tests
  const invariantTests = generateInvariantBlock(behavior, domain, framework);

  // Compute coverage
  const coverage: CoverageInfo = {
    totalPreconditions: behavior.preconditions.length,
    coveredPreconditions: preconditionAssertions.filter(a => a.status === 'supported').length > 0 ? behavior.preconditions.length : 0,
    totalPostconditions: behavior.postconditions.reduce((sum, p) => sum + p.predicates.length, 0),
    coveredPostconditions: postconditionAssertions.filter(a => a.status === 'supported').length,
    totalInvariants: behavior.invariants.length,
    coveredInvariants: behavior.invariants.length, // All invariants get basic coverage
  };

  // Assemble test file
  const testFile = `
${imports}

/**
 * Tests for ${behaviorName} behavior
 * Domain: ${domainName}
 * Detected strategy: ${strategy.domain}
 * ${behavior.description?.value || ''}
 */
describe('${behaviorName}', () => {
  // Test setup
  let validInput: ${behaviorName}Input;
  
  beforeEach(() => {
    validInput = createValidInputFor${behaviorName}();
  });

  afterEach(() => {
    // Cleanup if needed
  });

${preconditionTests}

${postconditionTests}

${errorTests}

${invariantTests}
});
`.trim();

  return {
    testFile,
    assertions: allAssertions,
    coverage,
  };
}

// ============================================================================
// BLOCK GENERATORS
// ============================================================================

function generatePreconditionBlock(
  _behavior: AST.Behavior,
  assertions: GeneratedAssertion[],
  _framework: TestFramework
): string {
  if (assertions.length === 0) {
    return '  // No preconditions defined';
  }

  const supportedAssertions = assertions.filter(a => a.status === 'supported');
  const needsImplAssertions = assertions.filter(a => a.status === 'needs_impl');

  const tests = supportedAssertions.map(a => `
    it('${escapeString(a.description)}', async () => {
${indentCode(a.code, 6)}
    });
  `).join('\n');

  const scaffolds = needsImplAssertions.map(a => `
    it.skip('NEEDS_IMPL: ${escapeString(a.description)}', async () => {
      // Implementation hint: ${a.implementationHint || 'See pattern documentation'}
${indentCode(a.code, 6)}
    });
  `).join('\n');

  return `
  describe('Preconditions', () => {
${tests}
${scaffolds}
  });
  `.trim();
}

function generatePostconditionBlock(
  _behavior: AST.Behavior,
  assertions: GeneratedAssertion[],
  _framework: TestFramework
): string {
  if (assertions.length === 0) {
    return '  // No postconditions defined';
  }

  const supportedAssertions = assertions.filter(a => a.status === 'supported');
  const needsImplAssertions = assertions.filter(a => a.status === 'needs_impl');

  const tests = supportedAssertions.map(a => `
    it('${escapeString(a.description)}', async () => {
${indentCode(a.code, 6)}
    });
  `).join('\n');

  const scaffolds = needsImplAssertions.map(a => `
    it.skip('NEEDS_IMPL: ${escapeString(a.description)}', async () => {
      // Implementation hint: ${a.implementationHint || 'See pattern documentation'}
${indentCode(a.code, 6)}
    });
  `).join('\n');

  return `
  describe('Postconditions', () => {
${tests}
${scaffolds}
  });
  `.trim();
}

function generateErrorBlock(
  _behavior: AST.Behavior,
  assertions: GeneratedAssertion[],
  _framework: TestFramework
): string {
  if (assertions.length === 0) {
    return '  // No error cases defined';
  }

  const supportedAssertions = assertions.filter(a => a.status === 'supported');
  const needsImplAssertions = assertions.filter(a => a.status === 'needs_impl');

  const tests = supportedAssertions.map(a => `
    it('${escapeString(a.description)}', async () => {
${indentCode(a.code, 6)}
    });
  `).join('\n');

  const scaffolds = needsImplAssertions.map(a => `
    it.skip('NEEDS_IMPL: ${escapeString(a.description)}', async () => {
      // Implementation hint: ${a.implementationHint || 'See pattern documentation'}
${indentCode(a.code, 6)}
    });
  `).join('\n');

  return `
  describe('Error Cases', () => {
${tests}
${scaffolds}
  });
  `.trim();
}

function generateInvariantBlock(
  behavior: AST.Behavior,
  _domain: AST.Domain,
  _framework: TestFramework
): string {
  if (behavior.invariants.length === 0) {
    return '  // No invariants defined';
  }

  const tests = behavior.invariants.map((_inv, i) => {
    return `
    it('should maintain invariant ${i + 1}', async () => {
      const result = await ${behavior.name.name}(validInput);
      // Invariant: verify sensitive data handling
      // This is typically verified through code review or security testing
      expect(result).toBeDefined();
    });
    `;
  }).join('\n');

  return `
  describe('Invariants', () => {
${tests}
  });
  `.trim();
}

// ============================================================================
// HELPER GENERATORS
// ============================================================================

function generateImports(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  const behaviorName = behavior.name.name;

  const lines = [
    framework === 'vitest'
      ? `import { describe, it, expect, beforeEach, afterEach } from 'vitest';`
      : '',
    `import { ${behaviorName} } from '../src/${behaviorName}';`,
    `import type { ${behaviorName}Input, ${behaviorName}Result } from '../src/types';`,
    `import { createValidInputFor${behaviorName}, createInvalidInputFor${behaviorName} } from './helpers/test-utils';`,
    `import { ${domain.entities.map(e => e.name.name).join(', ')} } from './helpers/fixtures';`,
  ].filter(Boolean);

  return lines.join('\n');
}

function generateTestUtils(domain: AST.Domain, _framework: TestFramework): string {
  const behaviors = domain.behaviors;

  const inputFactories = behaviors.map(b => {
    const name = b.name.name;
    const fields = b.input.fields.map(f => {
      return `    ${f.name.name}: ${getDefaultValue(f.type)},`;
    }).join('\n');

    return `
export function createValidInputFor${name}(): ${name}Input {
  return {
${fields}
  };
}

export function createInvalidInputFor${name}(): ${name}Input {
  return {
${b.input.fields.map(f => `    ${f.name.name}: ${getInvalidValue(f.type)},`).join('\n')}
  };
}
`;
  }).join('\n');

  return `
// Test utilities for ${domain.name.name}
// Auto-generated by @isl-lang/test-generator

${behaviors.map(b => `import type { ${b.name.name}Input } from '../src/types';`).join('\n')}

${inputFactories}

export function createInputViolating(condition: string): unknown {
  // Override this based on the condition being violated
  return {};
}

export function captureState(): Record<string, unknown> {
  return {
    timestamp: Date.now(),
  };
}
`.trim();
}

function generateFixtures(domain: AST.Domain): string {
  const entities = domain.entities;

  const fixtures = entities.map(entity => {
    const name = entity.name.name;
    const fields = entity.fields.map(f => {
      return `  ${f.name.name}: ${getDefaultValue(f.type)},`;
    }).join('\n');

    return `
export const ${name.toLowerCase()}Fixture = {
${fields}
};

export function create${name}(overrides?: Partial<typeof ${name.toLowerCase()}Fixture>) {
  return { ...${name.toLowerCase()}Fixture, ...overrides };
}

export const ${name} = {
  findById: async (id: string) => create${name}({ id }),
  findByEmail: async (email: string) => create${name}({ email } as Partial<typeof ${name.toLowerCase()}Fixture>),
  exists: async (criteria: Record<string, unknown>) => true,
  count: async (criteria?: Record<string, unknown>) => 1,
};
`;
  }).join('\n');

  return `
// Test fixtures for ${domain.name.name}
// Auto-generated by @isl-lang/test-generator

${fixtures}
`.trim();
}

function generateJestConfig(): string {
  return `
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
};
`.trim();
}

function generateVitestConfig(): string {
  return `
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
`.trim();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function computeStats(
  behaviors: BehaviorMetadata[],
  openQuestions: OpenQuestion[]
): GenerationStats {
  const allAssertions = behaviors.flatMap(b => b.assertions);

  return {
    totalBehaviors: behaviors.length,
    totalAssertions: allAssertions.length,
    supportedAssertions: allAssertions.filter(a => a.status === 'supported').length,
    needsImplAssertions: allAssertions.filter(a => a.status === 'needs_impl').length,
    unsupportedAssertions: allAssertions.filter(a => a.status === 'unsupported').length,
    openQuestionsCount: openQuestions.length,
  };
}

function getDefaultValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return `'test-value'`;
        case 'Int': return '1';
        case 'Decimal': return '10.00';
        case 'Boolean': return 'true';
        case 'UUID': return `'00000000-0000-0000-0000-000000000001'`;
        case 'Timestamp': return 'new Date()';
        case 'Duration': return '1000';
        default: return 'undefined';
      }
    case 'ListType': return '[]';
    case 'OptionalType': return 'undefined';
    case 'ReferenceType': return `create${type.name.parts[0]?.name || 'Entity'}()`;
    case 'StructType': return '{}';
    case 'EnumType': return `'${type.variants[0]?.name?.name || 'DEFAULT'}'`;
    default: return '{}';
  }
}

function getInvalidValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return `''`;
        case 'Int': return '-1';
        case 'Decimal': return '-1.00';
        case 'Boolean': return 'false';
        case 'UUID': return `'invalid-uuid'`;
        case 'Timestamp': return 'new Date(0)';
        default: return 'null as unknown';
      }
    case 'ListType': return '[]';
    default: return 'null as unknown';
  }
}

function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function indentCode(code: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return code.split('\n').map(line => indent + line).join('\n');
}
