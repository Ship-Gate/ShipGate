// ============================================================================
// Property Test Generator - Main Logic
// Generates property-based tests using fast-check from ISL domains
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import type { GenerateOptions, GeneratedFile, ArbitraryDefinition, PropertyDefinition } from './types';
import { generateAllArbitraries, generateEntityArbitrary, generateInputArbitrary } from './arbitraries';
import { generateAllProperties, generateEntityInvariantProperties, generatePostconditionProperties } from './properties';
import { generateAllShrinkers, generateShrinkerUtils } from './shrinking';
import {
  getFastCheckTemplate,
  generatePropertyTest,
  generatePropertyDescribe,
  generateArbitraryDeclaration,
  generateImports,
  generateTestFileContent,
} from './templates/fastcheck';

/**
 * Generate property-based test files from an ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions = {}
): GeneratedFile[] {
  const {
    iterations = 100,
    includeInvariants = true,
    includePostconditions = true,
    includeEntityTests = true,
  } = options;

  const files: GeneratedFile[] = [];

  // Generate arbitraries
  const arbitraries = generateAllArbitraries(domain);

  // Generate properties
  const properties = generateAllProperties(domain);

  // Generate main test file
  const mainTestFile = generateMainTestFile(domain, arbitraries, properties, iterations);
  files.push({
    path: `${domain.name.name}.property.test.ts`,
    content: mainTestFile,
    type: 'test',
  });

  // Generate per-behavior test files
  for (const behavior of domain.behaviors) {
    const behaviorTestFile = generateBehaviorTestFile(behavior, domain, arbitraries, iterations);
    files.push({
      path: `${behavior.name.name}.property.test.ts`,
      content: behaviorTestFile,
      type: 'test',
    });
  }

  // Generate per-entity test files if enabled
  if (includeEntityTests) {
    for (const entity of domain.entities) {
      if (entity.invariants.length > 0) {
        const entityTestFile = generateEntityTestFile(entity, iterations);
        files.push({
          path: `${entity.name.name}.invariants.test.ts`,
          content: entityTestFile,
          type: 'test',
        });
      }
    }
  }

  // Generate arbitraries file
  const arbitrariesFile = generateArbitrariesFile(domain, arbitraries);
  files.push({
    path: 'arbitraries.ts',
    content: arbitrariesFile,
    type: 'arbitrary',
  });

  // Generate custom shrinkers
  const shrinkers = generateAllShrinkers(domain);
  if (shrinkers.length > 0) {
    const shrinkersFile = generateShrinkersFile(shrinkers);
    files.push({
      path: 'shrinkers.ts',
      content: shrinkersFile,
      type: 'helper',
    });
  }

  // Generate helpers file
  const helpersFile = generateHelpersFile(domain);
  files.push({
    path: 'property-helpers.ts',
    content: helpersFile,
    type: 'helper',
  });

  return files;
}

/**
 * Generate main test file with all properties
 */
function generateMainTestFile(
  domain: AST.Domain,
  arbitraries: ArbitraryDefinition[],
  properties: PropertyDefinition[],
  iterations: number
): string {
  const template = getFastCheckTemplate();
  const domainName = domain.name.name;

  // Generate imports
  const behaviorNames = domain.behaviors.map((b) => b.name.name);
  const typeNames = [
    ...domain.types.map((t) => t.name.name),
    ...domain.entities.map((e) => e.name.name),
    ...domain.behaviors.map((b) => `${b.name.name}Input`),
  ];
  const imports = generateImports(behaviorNames, typeNames);

  // Generate arbitrary declarations
  const arbitraryDeclarations = arbitraries.map((arb) =>
    generateArbitraryDeclaration(arb.name, arb.code)
  );

  // Generate property tests grouped by type
  const entityProperties = properties.filter((p) => p.name.includes('invariant'));
  const behaviorProperties = properties.filter((p) => !p.name.includes('invariant'));

  const entityTests = entityProperties.map((prop) =>
    generatePropertyTest(
      prop.name,
      prop.description,
      prop.arbitraries.join(', '),
      prop.assertion,
      prop.async,
      iterations
    )
  );

  const behaviorTests = behaviorProperties.map((prop) =>
    generatePropertyTest(
      prop.name,
      prop.description,
      prop.arbitraries.join(', '),
      prop.assertion,
      prop.async,
      iterations
    )
  );

  const allTests: string[] = [];

  if (entityTests.length > 0) {
    allTests.push(generatePropertyDescribe(`${domainName} Entity Invariants`, entityTests));
  }

  if (behaviorTests.length > 0) {
    allTests.push(generatePropertyDescribe(`${domainName} Behavior Properties`, behaviorTests));
  }

  return generateTestFileContent(
    imports,
    arbitraryDeclarations,
    allTests,
    template.helpers
  );
}

/**
 * Generate test file for a specific behavior
 */
function generateBehaviorTestFile(
  behavior: AST.Behavior,
  domain: AST.Domain,
  allArbitraries: ArbitraryDefinition[],
  iterations: number
): string {
  const template = getFastCheckTemplate();
  const behaviorName = behavior.name.name;

  // Get relevant arbitraries
  const inputArb = allArbitraries.find((a) => a.name === `arb${behaviorName}Input`);
  const relevantArbs = inputArb ? [inputArb] : [];

  // Add any dependent arbitraries
  if (inputArb) {
    for (const dep of inputArb.dependencies) {
      const depArb = allArbitraries.find((a) => a.name === dep);
      if (depArb) {
        relevantArbs.unshift(depArb);
      }
    }
  }

  // Generate properties for this behavior
  const postconditionProps = generatePostconditionProperties(behavior);
  const allBehaviorProps = postconditionProps;

  // Generate imports
  const imports = `
import fc from 'fast-check';
import { describe, test, expect, beforeEach } from 'vitest';
import { ${behaviorName} } from './implementation';
import type { ${behaviorName}Input, ${behaviorName}Result } from './types';
  `.trim();

  // Generate arbitrary declarations
  const arbitraryDeclarations = relevantArbs.map((arb) =>
    generateArbitraryDeclaration(arb.name, arb.code)
  );

  // Generate tests
  const tests = allBehaviorProps.map((prop) =>
    generatePropertyTest(
      prop.name,
      prop.description,
      prop.arbitraries.join(', '),
      prop.assertion,
      prop.async,
      iterations
    )
  );

  // Add standard property tests
  const standardTests = generateStandardBehaviorTests(behavior, iterations);
  tests.push(...standardTests);

  return generateTestFileContent(
    imports,
    arbitraryDeclarations,
    [generatePropertyDescribe(`${behaviorName} Properties`, tests)],
    template.helpers
  );
}

/**
 * Generate test file for entity invariants
 */
function generateEntityTestFile(
  entity: AST.Entity,
  iterations: number
): string {
  const template = getFastCheckTemplate();
  const entityName = entity.name.name;
  const entityArb = generateEntityArbitrary(entity);

  const imports = `
import fc from 'fast-check';
import { describe, test, expect } from 'vitest';
import type { ${entityName} } from './types';
  `.trim();

  const arbitraryDeclarations = [generateArbitraryDeclaration(entityArb.name, entityArb.code)];

  const properties = generateEntityInvariantProperties(entity);
  const tests = properties.map((prop) =>
    generatePropertyTest(
      prop.name,
      prop.description,
      prop.arbitraries.join(', '),
      prop.assertion,
      prop.async,
      iterations
    )
  );

  return generateTestFileContent(
    imports,
    arbitraryDeclarations,
    [generatePropertyDescribe(`${entityName} Invariants`, tests)],
    template.helpers
  );
}

/**
 * Generate arbitraries file
 */
function generateArbitrariesFile(
  domain: AST.Domain,
  arbitraries: ArbitraryDefinition[]
): string {
  const domainName = domain.name.name;

  const typeNames = [
    ...domain.types.map((t) => t.name.name),
    ...domain.entities.map((e) => e.name.name),
    ...domain.behaviors.map((b) => `${b.name.name}Input`),
  ];

  const imports = `
import fc from 'fast-check';
import type { ${typeNames.join(', ')} } from './types';
  `.trim();

  const declarations = arbitraries.map((arb) =>
    `export ${generateArbitraryDeclaration(arb.name, arb.code)}`
  );

  return `
/**
 * Arbitraries for ${domainName}
 * Generated from ISL specification
 * @generated
 */

${imports}

${declarations.join('\n\n')}
  `.trim();
}

/**
 * Generate shrinkers file
 */
function generateShrinkersFile(shrinkers: ReturnType<typeof generateAllShrinkers>): string {
  const shrinkerCode = shrinkers.map((s) => s.code).join('\n\n');
  const utils = generateShrinkerUtils();

  return `
/**
 * Custom shrinkers for property-based testing
 * @generated
 */

${utils}

${shrinkerCode}
  `.trim();
}

/**
 * Generate helpers file
 */
function generateHelpersFile(domain: AST.Domain): string {
  const entityNames = domain.entities.map((e) => e.name.name);

  return `
/**
 * Property test helpers for ${domain.name.name}
 * @generated
 */

import fc from 'fast-check';

/**
 * Capture current state for old() expressions in postconditions
 */
export function captureState(): Record<string, unknown> {
  return {
    timestamp: Date.now(),
    ${entityNames.map((name) => `${name.toLowerCase()}Count: get${name}Count()`).join(',\n    ')}
  };
}

/**
 * Capture global state for invariant checking
 */
export function captureGlobalState(): Record<string, unknown> {
  return captureState();
}

${entityNames.map((name) => `
/**
 * Get count of ${name} entities (stub - implement with your storage)
 */
function get${name}Count(): number {
  // TODO: Implement with actual storage
  return 0;
}
`).join('\n')}

/**
 * Run property test with retry on transient failures
 */
export async function runPropertyWithRetry<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>,
  options: { numRuns?: number; maxRetries?: number } = {}
): Promise<void> {
  const { numRuns = 100, maxRetries = 3 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fc.assert(
        fc.asyncProperty(arb, predicate),
        { numRuns, verbose: true }
      );
      return;
    } catch (error) {
      lastError = error as Error;
      // Only retry on transient errors, not property violations
      if (!isTransientError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('network')
    );
  }
  return false;
}

/**
 * Generate deterministic seed for reproducible tests
 */
export function generateSeed(testName: string): number {
  let hash = 0;
  for (let i = 0; i < testName.length; i++) {
    hash = ((hash << 5) - hash) + testName.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
  `.trim();
}

/**
 * Generate standard property tests for a behavior
 */
function generateStandardBehaviorTests(
  behavior: AST.Behavior,
  iterations: number
): string[] {
  const behaviorName = behavior.name.name;
  const arbName = `arb${behaviorName}Input`;
  const tests: string[] = [];

  // No crash test
  tests.push(`
test('${behaviorName}: never crashes on valid input', async () => {
  await fc.assert(
    fc.asyncProperty(${arbName}, async (input) => {
      // Should not throw
      const result = await ${behaviorName}(input);
      expect(result).toBeDefined();
      return true;
    }),
    { numRuns: ${iterations}, verbose: true }
  );
});
  `.trim());

  // Result structure test
  tests.push(`
test('${behaviorName}: result has valid structure', async () => {
  await fc.assert(
    fc.asyncProperty(${arbName}, async (input) => {
      const result = await ${behaviorName}(input);
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
      return true;
    }),
    { numRuns: ${iterations}, verbose: true }
  );
});
  `.trim());

  // Check for idempotency key
  const hasIdempotencyKey = behavior.input.fields.some(
    (f) => f.name.name.toLowerCase().includes('idempotency')
  );

  if (hasIdempotencyKey) {
    tests.push(`
test('${behaviorName}: idempotent with same key', async () => {
  await fc.assert(
    fc.asyncProperty(${arbName}, fc.string(), async (input, key) => {
      const inputWithKey = { ...input, idempotencyKey: key };
      const result1 = await ${behaviorName}(inputWithKey);
      const result2 = await ${behaviorName}(inputWithKey);
      expect(result1).toEqual(result2);
      return true;
    }),
    { numRuns: ${Math.floor(iterations / 2)}, verbose: true }
  );
});
    `.trim());
  }

  return tests;
}
