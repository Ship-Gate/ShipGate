// ============================================================================
// Fast-Check Template
// Template code for property-based test generation
// ============================================================================

export interface FastCheckTemplate {
  header: string;
  imports: string;
  helpers: string;
  assertConfig: string;
}

/**
 * Get the fast-check template for test files
 */
export function getFastCheckTemplate(): FastCheckTemplate {
  return {
    header: `
/**
 * Generated property-based tests - fast-check
 * Do not modify manually. Regenerate from ISL spec.
 * @generated
 */
    `.trim(),

    imports: `
import fc from 'fast-check';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
    `.trim(),

    helpers: `
// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Capture current state for old() expressions
 */
function captureState(): Record<string, unknown> {
  return {
    timestamp: Date.now(),
    // Add entity state snapshots here
  };
}

/**
 * Capture global state for invariant checking
 */
function captureGlobalState(): Record<string, unknown> {
  return captureState();
}

/**
 * Run a property test with standard configuration
 */
function runProperty<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
  options: { numRuns?: number; seed?: number } = {}
): void {
  const { numRuns = 100, seed } = options;
  
  fc.assert(
    fc.property(arb, predicate),
    { numRuns, seed, verbose: true }
  );
}

/**
 * Run an async property test
 */
function runAsyncProperty<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>,
  options: { numRuns?: number; seed?: number } = {}
): Promise<void> {
  const { numRuns = 100, seed } = options;
  
  return fc.assert(
    fc.asyncProperty(arb, predicate),
    { numRuns, seed, verbose: true }
  );
}
    `.trim(),

    assertConfig: `
// Default fast-check configuration
const fcConfig: fc.Parameters<unknown> = {
  numRuns: 100,
  verbose: true,
  endOnFailure: true,
};
    `.trim(),
  };
}

/**
 * Generate a property test block
 */
export function generatePropertyTest(
  name: string,
  description: string,
  arbitraryCode: string,
  assertionCode: string,
  isAsync: boolean,
  iterations: number = 100
): string {
  const propertyType = isAsync ? 'fc.asyncProperty' : 'fc.property';
  const asyncKeyword = isAsync ? 'async ' : '';

  return `
test('${escapeString(name)}', ${asyncKeyword}() => {
  // ${description}
  ${isAsync ? 'await ' : ''}fc.assert(
    ${propertyType}(
      ${arbitraryCode},
      ${asyncKeyword}(input) => {
        ${assertionCode}
      }
    ),
    { numRuns: ${iterations}, verbose: true }
  );
});
  `.trim();
}

/**
 * Generate a describe block for property tests
 */
export function generatePropertyDescribe(
  name: string,
  tests: string[]
): string {
  return `
describe('${escapeString(name)} Properties', () => {
  ${tests.join('\n\n  ')}
});
  `.trim();
}

/**
 * Generate arbitrary declaration
 */
export function generateArbitraryDeclaration(
  name: string,
  code: string
): string {
  return `const ${name} = ${code};`;
}

/**
 * Generate composite arbitrary from multiple arbitraries
 */
export function generateCompositeArbitrary(
  name: string,
  arbitraries: string[]
): string {
  if (arbitraries.length === 1) {
    return `const ${name} = ${arbitraries[0]};`;
  }

  return `const ${name} = fc.tuple(${arbitraries.join(', ')});`;
}

/**
 * Generate fc.record from field definitions
 */
export function generateRecordArbitrary(
  fields: Array<{ name: string; arbitrary: string }>
): string {
  const fieldDefs = fields
    .map(({ name, arbitrary }) => `  ${name}: ${arbitrary}`)
    .join(',\n');

  return `fc.record({\n${fieldDefs}\n})`;
}

/**
 * Generate fc.oneof from variants
 */
export function generateOneOfArbitrary(variants: string[]): string {
  return `fc.oneof(\n  ${variants.join(',\n  ')}\n)`;
}

/**
 * Generate filter chain for constrained arbitrary
 */
export function generateFilteredArbitrary(
  baseArbitrary: string,
  filters: string[]
): string {
  if (filters.length === 0) {
    return baseArbitrary;
  }

  return filters.reduce(
    (arb, filter) => `${arb}.filter(v => ${filter})`,
    baseArbitrary
  );
}

/**
 * Generate map chain for transformed arbitrary
 */
export function generateMappedArbitrary(
  baseArbitrary: string,
  mapFn: string
): string {
  return `${baseArbitrary}.map(${mapFn})`;
}

/**
 * Generate chain for dependent arbitraries
 */
export function generateChainedArbitrary(
  baseArbitrary: string,
  chainFn: string
): string {
  return `${baseArbitrary}.chain(${chainFn})`;
}

/**
 * Generate arbitrary with custom shrinker
 */
export function generateArbitraryWithShrinker(
  baseArbitrary: string,
  shrinkerFn: string
): string {
  return `${baseArbitrary}.noShrink().map(v => new fc.Value(v, ${shrinkerFn}))`;
}

/**
 * Generate import statements for generated test file
 */
export function generateImports(
  behaviorNames: string[],
  typeNames: string[]
): string {
  const behaviorImports = behaviorNames.length > 0
    ? `import { ${behaviorNames.join(', ')} } from './implementation';`
    : '';

  const typeImports = typeNames.length > 0
    ? `import type { ${typeNames.join(', ')} } from './types';`
    : '';

  return [
    `import fc from 'fast-check';`,
    `import { describe, test, expect } from 'vitest';`,
    behaviorImports,
    typeImports,
  ].filter(Boolean).join('\n');
}

/**
 * Escape string for use in test names
 */
function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/**
 * Generate full test file content
 */
export function generateTestFileContent(
  imports: string,
  arbitraries: string[],
  properties: string[],
  helpers: string
): string {
  const template = getFastCheckTemplate();

  return `
${template.header}

${imports}

${helpers}

// ============================================================================
// Arbitraries
// ============================================================================

${arbitraries.join('\n\n')}

// ============================================================================
// Property Tests
// ============================================================================

${properties.join('\n\n')}
  `.trim();
}
