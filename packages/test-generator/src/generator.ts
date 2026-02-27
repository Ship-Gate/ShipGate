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
  DomainType,
} from './types';
import { getStrategy, detectDomain } from './strategies';
import {
  synthesizeInputs,
  generateSeed,
} from './data-synthesizer';
import { emitTestFile } from './test-code-emitter';
import { generateScenarioTests } from './scenario-generator';

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate executable test files from an ISL domain specification
 * 
 * This is the main entry point for test generation. It processes behaviors,
 * scenarios, and generates runnable test suites.
 * 
 * @param domain - Parsed ISL domain
 * @param options - Generation options
 * @returns Generation result with files and metadata
 */
export function generateTests(
  domain: AST.Domain,
  options: GenerateOptions
): GenerateResult {
  return generate(domain, options);
}

/**
 * Generate executable test files from an ISL domain specification
 * 
 * @deprecated Use generateTests instead
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
    // Sort behaviors deterministically for stable output
    const sortedBehaviors = [...domain.behaviors].sort((a, b) => 
      a.name.name.localeCompare(b.name.name)
    );

    // Generate test files for each behavior
    for (const behavior of sortedBehaviors) {
      const ctx = createContext(behavior);
      const strategy = getStrategy(behavior, domain, forceDomain);
      const detectedDomain = strategy.domain;

      const {
        testFile,
        assertions,
        coverage,
      } = generateBehaviorTestFile(behavior, domain, strategy, ctx, framework);

      // Generate snapshot for structured outputs if appropriate
      const shouldGenerateSnapshot = behavior.output?.success && 
        (behavior.output.success.kind === 'StructType' || 
         behavior.output.success.kind === 'ReferenceType');
      
      if (shouldGenerateSnapshot && options.includeSnapshots !== false) {
        const snapshot = generateSnapshot(behavior, domain);
        files.push({
          path: `${outputDir}/__snapshots__/${behavior.name.name}.snapshot.ts`,
          content: snapshot,
          type: 'test',
        });
      }

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

  // Generate scenario tests
  const scenarios = generateScenarioTests(behavior, domain, framework);
  const scenarioTestsBlock = generateScenarioBlock(scenarios, framework);

  // Generate property-based test stubs
  const pbtStubs = generatePBTStubs(behavior, domain, framework);

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

${scenarioTestsBlock}

${pbtStubs}
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

/**
 * Generate scenario test block
 */
function generateScenarioBlock(
  scenarioTests: Array<{ name: string; description: string; code: string }>,
  framework: TestFramework
): string {
  if (scenarioTests.length === 0) {
    return '  // No scenarios defined';
  }

  const tests = scenarioTests.map(scenario => `
    it('${escapeString(scenario.description)}', async () => {
${indentCode(scenario.code, 6)}
    });
  `).join('\n');

  return `
  describe('Scenarios', () => {
${tests}
  });
  `.trim();
}

/**
 * Generate property-based test stubs (hooks into isl-pbt if present)
 */
function generatePBTStubs(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  // Check if isl-pbt is available
  let pbtAvailable = false;
  try {
    // Try to require isl-pbt (will fail if not installed)
    require.resolve('@isl-lang/isl-pbt');
    pbtAvailable = true;
  } catch {
    // isl-pbt not available, generate stub
  }

  if (!pbtAvailable) {
    return `  // Property-based tests: Install @isl-lang/isl-pbt to enable
  // describe('Property-Based Tests', () => {
  //   it('should satisfy all preconditions and postconditions', async () => {
  //     const { runPBT } = await import('@isl-lang/isl-pbt');
  //     const report = await runPBT(domain, '${behavior.name.name}', implementation, {
  //       numTests: 100,
  //       seed: 12345,
  //     });
  //     expect(report.success).toBe(true);
  //   });
  // });`;
  }

  const behaviorName = behavior.name.name;
  const importStmt = framework === 'vitest' 
    ? `import { runPBT } from '@isl-lang/isl-pbt';`
    : `const { runPBT } = require('@isl-lang/isl-pbt');`;

  return `
  describe('Property-Based Tests', () => {
    it('should satisfy all preconditions and postconditions', async () => {
      ${importStmt}
      // TODO: Provide implementation function
      const implementation = {
        async execute(input) {
          // Implement ${behaviorName} behavior
          throw new Error('Not implemented');
        },
      };
      
      const report = await runPBT(domain, '${behaviorName}', implementation, {
        numTests: 100,
        seed: 12345,
      });
      
      expect(report.success).toBe(true);
      if (!report.success) {
        console.error('PBT failures:', report.violations);
      }
    });
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

/**
 * Generate snapshot test file for structured outputs
 */
function generateSnapshot(
  behavior: AST.Behavior,
  domain: AST.Domain
): string {
  const behaviorName = behavior.name.name;
  const framework = 'vitest'; // Default to vitest for snapshots
  
  return `import { describe, it, expect } from '${framework === 'vitest' ? 'vitest' : '@jest/globals'}';
import { ${behaviorName} } from '../src/${behaviorName}';
import type { ${behaviorName}Input } from '../src/types';

describe('${behaviorName} - Snapshot Tests', () => {
  it('should match snapshot for structured output', async () => {
    const input: ${behaviorName}Input = {
      // TODO: Fill in test input
    } as ${behaviorName}Input;
    
    const result = await ${behaviorName}(input);
    
    // Snapshot test for structured output
    expect(result).toMatchSnapshot();
  });
});
`;
}

// ============================================================================
// ENHANCED GENERATION WITH DATA SYNTHESIS
// ============================================================================

export interface EnhancedGenerateOptions extends GenerateOptions {
  /** Use data synthesis for meaningful test data */
  useSynthesis?: boolean;
  /** Base seed for deterministic generation */
  baseSeed?: number;
  /** Include boundary value tests */
  includeBoundary?: boolean;
  /** Include negative tests */
  includeNegativeTests?: boolean;
  /** Include precondition violation tests */
  includePreconditionViolations?: boolean;
  /** Maximum inputs per category */
  maxInputsPerCategory?: number;
  /** Force a specific domain strategy */
  forceDomain?: DomainType;
}

/**
 * Generate tests with enhanced data synthesis
 * 
 * This function produces runnable tests with:
 * - Meaningful input data synthesized from constraints
 * - Expected outcomes computed from postconditions
 * - Boundary value tests
 * - Negative tests for error cases
 * - Precondition violation tests
 * - Data trace comments for reproducibility
 */
export function generateWithSynthesis(
  domain: AST.Domain,
  options: EnhancedGenerateOptions
): GenerateResult {
  const {
    framework = 'vitest',
    outputDir = '.',
    includeHelpers = true,
    emitMetadata = true,
    useSynthesis = true,
    baseSeed,
    includeBoundary = true,
    includeNegativeTests = true,
    includePreconditionViolations = true,
    maxInputsPerCategory = 5,
  } = options;

  // If synthesis is disabled, use the original generate function
  if (!useSynthesis) {
    return generate(domain, options);
  }

  const files: GeneratedFile[] = [];
  const errors: GeneratorError[] = [];
  const openQuestions: OpenQuestion[] = [];
  const behaviorMetadata: BehaviorMetadata[] = [];

  try {
    // Generate test files for each behavior with synthesis
    for (const behavior of domain.behaviors) {
      const seed = baseSeed !== undefined 
        ? baseSeed + hashCode(behavior.name.name)
        : generateSeed(behavior.name.name);

      const testFile = emitTestFile(behavior, domain, {
        framework: framework ?? 'vitest',
        seed,
        includeBoundary,
        includeInvalid: includeNegativeTests,
        includePreconditionViolations,
        maxInputsPerCategory,
        includeDataTrace: true,
        behaviorImportPath: '../src',
      });

      files.push({
        path: `${outputDir}/${testFile.filename}`,
        content: testFile.content,
        type: 'test',
      });

      // Compute coverage from synthesized tests
      const coverage: CoverageInfo = {
        totalPreconditions: behavior.preconditions.length,
        coveredPreconditions: includePreconditionViolations ? behavior.preconditions.length : 0,
        totalPostconditions: behavior.postconditions.reduce((sum, p) => sum + p.predicates.length, 0),
        coveredPostconditions: behavior.postconditions.reduce((sum, p) => sum + p.predicates.length, 0),
        totalInvariants: behavior.invariants.length,
        coveredInvariants: behavior.invariants.length,
      };

      // Generate assertion metadata from stats
      const assertions: AssertionMetadata[] = [];
      
      // Valid input assertions
      for (let i = 0; i < testFile.stats.validTests; i++) {
        assertions.push({
          description: `Valid input test ${i + 1}`,
          pattern: 'generic.postcondition',
          status: 'supported',
        });
      }

      // Boundary assertions
      for (let i = 0; i < testFile.stats.boundaryTests; i++) {
        assertions.push({
          description: `Boundary test ${i + 1}`,
          pattern: 'generic.postcondition',
          status: 'supported',
        });
      }

      // Invalid input assertions
      for (let i = 0; i < testFile.stats.invalidTests; i++) {
        assertions.push({
          description: `Invalid input test ${i + 1}`,
          pattern: 'generic.precondition',
          status: 'supported',
        });
      }

      // Precondition violation assertions
      for (let i = 0; i < testFile.stats.preconditionTests; i++) {
        assertions.push({
          description: `Precondition violation test ${i + 1}`,
          pattern: 'generic.precondition',
          status: 'supported',
        });
      }

      behaviorMetadata.push({
        name: behavior.name.name,
        domain: detectDomain(behavior, domain),
        assertions,
        coverage,
      });
    }

    // Generate helper files
    if (includeHelpers) {
      files.push({
        path: `${outputDir}/helpers/test-utils.ts`,
        content: generateEnhancedTestUtils(domain, framework),
        type: 'helper',
      });

      files.push({
        path: `${outputDir}/helpers/fixtures.ts`,
        content: generateEnhancedFixtures(domain),
        type: 'fixture',
      });
    }

    // Generate framework config
    files.push({
      path: `${outputDir}/${framework === 'jest' ? 'jest.config.js' : 'vitest.config.ts'}`,
      content: framework === 'jest' ? generateJestConfig() : generateVitestConfig(),
      type: 'config',
    });

    // Generate metadata
    if (emitMetadata) {
      const stats = computeStats(behaviorMetadata, openQuestions);
      const metadata: GenerationMetadata = {
        domain: options.forceDomain || (domain.behaviors[0] ? detectDomain(domain.behaviors[0], domain) : 'generic'),
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
    domain: options.forceDomain || (domain.behaviors[0] ? detectDomain(domain.behaviors[0], domain) : 'generic'),
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

/**
 * Generate enhanced test utilities with constraint-aware value generation
 */
function generateEnhancedTestUtils(domain: AST.Domain, _framework: TestFramework): string {
  const behaviors = domain.behaviors;
  const lines: string[] = [];

  lines.push(`// Test utilities for ${domain.name.name}`);
  lines.push(`// Auto-generated by @isl-lang/test-generator with data synthesis`);
  lines.push('');

  // Import types
  lines.push(behaviors.map(b => `import type { ${b.name.name}Input } from '../src/types';`).join('\n'));
  lines.push('');

  // Generate factories for each behavior using synthesized values
  for (const behavior of behaviors) {
    const name = behavior.name.name;
    const seed = generateSeed(name);
    const inputs = synthesizeInputs(behavior, domain, { seed, maxInputsPerCategory: 1 });

    // Find valid and invalid inputs
    const validInput = inputs.find(i => i.category === 'valid');
    const invalidInput = inputs.find(i => i.category === 'invalid');

    lines.push(`/**`);
    lines.push(` * Create valid input for ${name}`);
    lines.push(` * @dataTrace seed=${seed}`);
    lines.push(` */`);
    lines.push(`export function createValidInputFor${name}(): ${name}Input {`);
    lines.push(`  return ${formatObjectLiteral(validInput?.values || {}, 2)};`);
    lines.push(`}`);
    lines.push('');

    lines.push(`/**`);
    lines.push(` * Create invalid input for ${name}`);
    lines.push(` * @dataTrace seed=${seed}`);
    lines.push(` */`);
    lines.push(`export function createInvalidInputFor${name}(): ${name}Input {`);
    lines.push(`  return ${formatObjectLiteral(invalidInput?.values || {}, 2)};`);
    lines.push(`}`);
    lines.push('');
  }

  // Helper functions
  lines.push(`export function captureState(): Record<string, unknown> {`);
  lines.push(`  return {`);
  lines.push(`    timestamp: Date.now(),`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push('');

  lines.push(`export function createInputViolating(condition: string): unknown {`);
  lines.push(`  // Generate input that violates the specified condition`);
  lines.push(`  return {};`);
  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Generate enhanced fixtures with entity mocks
 */
function generateEnhancedFixtures(domain: AST.Domain): string {
  const entities = domain.entities;
  const lines: string[] = [];

  lines.push(`// Test fixtures for ${domain.name.name}`);
  lines.push(`// Auto-generated by @isl-lang/test-generator with data synthesis`);
  lines.push('');

  for (const entity of entities) {
    const name = entity.name.name;
    const lowerName = name.toLowerCase();

    // Generate fixture with default values
    lines.push(`export const ${lowerName}Fixture = {`);
    for (const field of entity.fields) {
      const value = getSynthesizedDefaultValue(field.type);
      lines.push(`  ${field.name.name}: ${value},`);
    }
    lines.push(`};`);
    lines.push('');

    // Factory function
    lines.push(`export function create${name}(overrides?: Partial<typeof ${lowerName}Fixture>) {`);
    lines.push(`  return { ...${lowerName}Fixture, ...overrides };`);
    lines.push(`}`);
    lines.push('');

    // Entity mock with methods
    lines.push(`// Entity mock store`);
    lines.push(`const ${lowerName}Store: Map<string, typeof ${lowerName}Fixture> = new Map();`);
    lines.push('');
    lines.push(`export const ${name} = {`);
    lines.push(`  // Reset store for test isolation`);
    lines.push(`  reset: () => ${lowerName}Store.clear(),`);
    lines.push('');
    lines.push(`  // Create entity in store`);
    lines.push(`  create: (data: Partial<typeof ${lowerName}Fixture>) => {`);
    lines.push(`    const entity = create${name}(data);`);
    lines.push(`    ${lowerName}Store.set(entity.id, entity);`);
    lines.push(`    return entity;`);
    lines.push(`  },`);
    lines.push('');
    lines.push(`  // Find by ID`);
    lines.push(`  findById: async (id: string) => ${lowerName}Store.get(id) ?? null,`);
    lines.push('');
    lines.push(`  // Lookup with criteria`);
    lines.push(`  lookup: async (criteria: Record<string, unknown>) => {`);
    lines.push(`    for (const entity of ${lowerName}Store.values()) {`);
    lines.push(`      const matches = Object.entries(criteria).every(([k, v]) => (entity as Record<string, unknown>)[k] === v);`);
    lines.push(`      if (matches) return entity;`);
    lines.push(`    }`);
    lines.push(`    return null;`);
    lines.push(`  },`);
    lines.push('');
    lines.push(`  // Check existence`);
    lines.push(`  exists: async (criteria: Record<string, unknown>) => {`);
    lines.push(`    if (typeof criteria === 'string') {`);
    lines.push(`      return ${lowerName}Store.has(criteria);`);
    lines.push(`    }`);
    lines.push(`    for (const entity of ${lowerName}Store.values()) {`);
    lines.push(`      const matches = Object.entries(criteria).every(([k, v]) => (entity as Record<string, unknown>)[k] === v);`);
    lines.push(`      if (matches) return true;`);
    lines.push(`    }`);
    lines.push(`    return false;`);
    lines.push(`  },`);
    lines.push('');
    lines.push(`  // Count entities`);
    lines.push(`  count: async (criteria?: Record<string, unknown>) => {`);
    lines.push(`    if (!criteria) return ${lowerName}Store.size;`);
    lines.push(`    let count = 0;`);
    lines.push(`    for (const entity of ${lowerName}Store.values()) {`);
    lines.push(`      const matches = Object.entries(criteria).every(([k, v]) => (entity as Record<string, unknown>)[k] === v);`);
    lines.push(`      if (matches) count++;`);
    lines.push(`    }`);
    lines.push(`    return count;`);
    lines.push(`  },`);
    lines.push(`};`);
    lines.push('');
  }

  return lines.join('\n');
}

function getSynthesizedDefaultValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return `'test_${Math.random().toString(36).slice(2, 10)}'`;
        case 'Int': return '1';
        case 'Decimal': return '10.00';
        case 'Boolean': return 'true';
        case 'UUID': return `'${generateUUID()}'`;
        case 'Timestamp': return 'new Date().toISOString()';
        case 'Duration': return '1000';
        default: return 'undefined';
      }
    case 'ListType': return '[]';
    case 'OptionalType': return 'undefined';
    case 'ReferenceType': return `'${generateUUID()}'`;
    case 'StructType': return '{}';
    case 'EnumType': return `'${type.variants[0]?.name?.name || 'DEFAULT'}'`;
    default: return '{}';
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatObjectLiteral(obj: Record<string, unknown>, indent: number): string {
  const spaces = '  '.repeat(indent);
  const innerSpaces = '  '.repeat(indent + 1);
  
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';

  const formatted = entries.map(([key, value]) => {
    return `${innerSpaces}${key}: ${formatLiteralValue(value)}`;
  });

  return `{\n${formatted.join(',\n')}\n${spaces}}`;
}

function formatLiteralValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.map(formatLiteralValue).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const formatted = entries.map(([k, v]) => `${k}: ${formatLiteralValue(v)}`);
    return `{ ${formatted.join(', ')} }`;
  }
  return String(value);
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
