/**
 * Test Fixtures Index
 * 
 * Provides easy access to test fixture files for the ISL test suite.
 * All paths are relative to this file.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = typeof import.meta !== 'undefined' 
  ? dirname(fileURLToPath(import.meta.url))
  : __dirname;

// Fixture file paths
export const FIXTURE_PATHS = {
  valid: {
    minimal: join(__dirname, 'valid/minimal.isl'),
    allFeatures: join(__dirname, 'valid/all-features.isl'),
    complexTypes: join(__dirname, 'valid/complex-types.isl'),
    realWorld: {
      payment: join(__dirname, 'valid/real-world/payment.isl'),
      auth: join(__dirname, 'valid/real-world/auth.isl'),
      crud: join(__dirname, 'valid/real-world/crud.isl'),
    },
  },
  invalid: {
    syntaxErrors: {
      missingBraces: join(__dirname, 'invalid/syntax-errors/missing-braces.isl'),
      unterminatedString: join(__dirname, 'invalid/syntax-errors/unterminated-string.isl'),
      invalidToken: join(__dirname, 'invalid/syntax-errors/invalid-token.isl'),
      missingVersion: join(__dirname, 'invalid/syntax-errors/missing-version.isl'),
      unexpectedToken: join(__dirname, 'invalid/syntax-errors/unexpected-token.isl'),
      invalidEscape: join(__dirname, 'invalid/syntax-errors/invalid-escape.isl'),
      unterminatedComment: join(__dirname, 'invalid/syntax-errors/unterminated-comment.isl'),
    },
    typeErrors: {
      undefinedType: join(__dirname, 'invalid/type-errors/undefined-type.isl'),
      typeMismatch: join(__dirname, 'invalid/type-errors/type-mismatch.isl'),
      invalidOperator: join(__dirname, 'invalid/type-errors/invalid-operator.isl'),
      undefinedField: join(__dirname, 'invalid/type-errors/undefined-field.isl'),
      duplicateDeclaration: join(__dirname, 'invalid/type-errors/duplicate-declaration.isl'),
      contextErrors: join(__dirname, 'invalid/type-errors/context-errors.isl'),
      invalidLifecycle: join(__dirname, 'invalid/type-errors/invalid-lifecycle.isl'),
    },
    semanticErrors: {
      circularReference: join(__dirname, 'invalid/semantic-errors/circular-reference.isl'),
      missingRequired: join(__dirname, 'invalid/semantic-errors/missing-required.isl'),
      invalidConstraint: join(__dirname, 'invalid/semantic-errors/invalid-constraint.isl'),
      unreachableCode: join(__dirname, 'invalid/semantic-errors/unreachable-code.isl'),
      namingConvention: join(__dirname, 'invalid/semantic-errors/naming-convention.isl'),
    },
  },
  edgeCases: {
    unicode: join(__dirname, 'edge-cases/unicode.isl'),
    emptyBlocks: join(__dirname, 'edge-cases/empty-blocks.isl'),
    deeplyNested: join(__dirname, 'edge-cases/deeply-nested.isl'),
    maxSize: join(__dirname, 'edge-cases/max-size.isl'),
    specialValues: join(__dirname, 'edge-cases/special-values.isl'),
  },
} as const;

/**
 * Load a fixture file as a string
 */
export function loadFixture(path: string): string {
  return readFileSync(path, 'utf-8');
}

/**
 * Load all valid fixtures
 */
export function loadValidFixtures(): Record<string, string> {
  return {
    minimal: loadFixture(FIXTURE_PATHS.valid.minimal),
    allFeatures: loadFixture(FIXTURE_PATHS.valid.allFeatures),
    complexTypes: loadFixture(FIXTURE_PATHS.valid.complexTypes),
    payment: loadFixture(FIXTURE_PATHS.valid.realWorld.payment),
    auth: loadFixture(FIXTURE_PATHS.valid.realWorld.auth),
    crud: loadFixture(FIXTURE_PATHS.valid.realWorld.crud),
  };
}

/**
 * Load all syntax error fixtures
 */
export function loadSyntaxErrorFixtures(): Record<string, string> {
  const fixtures: Record<string, string> = {};
  for (const [name, path] of Object.entries(FIXTURE_PATHS.invalid.syntaxErrors)) {
    fixtures[name] = loadFixture(path);
  }
  return fixtures;
}

/**
 * Load all type error fixtures
 */
export function loadTypeErrorFixtures(): Record<string, string> {
  const fixtures: Record<string, string> = {};
  for (const [name, path] of Object.entries(FIXTURE_PATHS.invalid.typeErrors)) {
    fixtures[name] = loadFixture(path);
  }
  return fixtures;
}

/**
 * Load all semantic error fixtures
 */
export function loadSemanticErrorFixtures(): Record<string, string> {
  const fixtures: Record<string, string> = {};
  for (const [name, path] of Object.entries(FIXTURE_PATHS.invalid.semanticErrors)) {
    fixtures[name] = loadFixture(path);
  }
  return fixtures;
}

/**
 * Load all edge case fixtures
 */
export function loadEdgeCaseFixtures(): Record<string, string> {
  const fixtures: Record<string, string> = {};
  for (const [name, path] of Object.entries(FIXTURE_PATHS.edgeCases)) {
    fixtures[name] = loadFixture(path);
  }
  return fixtures;
}

/**
 * Get all fixture paths for a category
 */
export function getFixturePaths(category: 'valid' | 'invalid' | 'edgeCases'): string[] {
  const paths: string[] = [];
  
  function collectPaths(obj: Record<string, unknown>): void {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        paths.push(value);
      } else if (typeof value === 'object' && value !== null) {
        collectPaths(value as Record<string, unknown>);
      }
    }
  }
  
  collectPaths(FIXTURE_PATHS[category] as Record<string, unknown>);
  return paths;
}

// Export inline fixtures for simple test cases
export const INLINE_FIXTURES = {
  // Smallest valid spec
  minimal: `
domain Minimal {
  version: "1.0.0"
  entity Item { id: UUID [immutable, unique] }
}`,

  // Empty domain
  emptyDomain: `
domain Empty {
  version: "1.0.0"
}`,

  // Single entity
  singleEntity: `
domain Single {
  version: "1.0.0"
  entity User {
    id: UUID [immutable, unique]
    name: String
  }
}`,

  // Single behavior
  singleBehavior: `
domain SingleBehavior {
  version: "1.0.0"
  behavior DoSomething {
    input { value: String }
    output { success: Boolean }
  }
}`,

  // Types only
  typesOnly: `
domain TypesOnly {
  version: "1.0.0"
  type Email = String { max_length: 254 }
  type Money = Decimal { precision: 2, min: 0 }
  enum Status { ACTIVE, INACTIVE }
}`,
} as const;

// Re-export xfail utilities
export * from './xfail.js';
export * from './xfail-harness.js';

// Export expected error codes for validation
export const EXPECTED_ERRORS = {
  syntaxErrors: {
    missingBraces: ['P001'], // Expected closing brace
    unterminatedString: ['L001'], // Unterminated string
    invalidToken: ['L099'], // Unexpected character
    missingVersion: ['P002'], // Missing version
    unexpectedToken: ['P003'], // Unexpected token
    invalidEscape: ['L002'], // Invalid escape sequence
    unterminatedComment: ['L003'], // Unterminated comment
  },
  typeErrors: {
    undefinedType: ['TC001'], // Undefined type
    typeMismatch: ['TC020'], // Type mismatch
    invalidOperator: ['TC022'], // Invalid operator
    undefinedField: ['TC003'], // Undefined field
    duplicateDeclaration: ['TC010', 'TC011', 'TC012'], // Duplicate declarations
    contextErrors: ['TC030', 'TC031'], // Context errors
    invalidLifecycle: ['TC040', 'TC042'], // Lifecycle errors
  },
  semanticErrors: {
    circularReference: ['TC070'], // Circular reference
    missingRequired: ['S001'], // Missing required
    invalidConstraint: ['TC060', 'TC061'], // Invalid constraint
    unreachableCode: ['S002'], // Unreachable code
    namingConvention: ['S003'], // Naming convention
  },
} as const;
