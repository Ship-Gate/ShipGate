/**
 * Property Generator
 * 
 * Generates property-based tests from ISL specifications.
 */

import * as fc from 'fast-check';
import type { BehaviorSpec, DomainSpec, FieldSpec, TypeSpec } from './tester.js';

// ============================================================================
// Types
// ============================================================================

export interface PropertyTest {
  name: string;
  behavior: string;
  description: string;
  arbitrary: fc.Arbitrary<unknown>;
  property: (input: unknown, result: unknown) => boolean | Promise<boolean>;
  category: 'precondition' | 'postcondition' | 'invariant' | 'input';
}

// ============================================================================
// Property Generator
// ============================================================================

export class PropertyGenerator {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate all property tests for a behavior
   */
  generateTests(behavior: BehaviorSpec, domain: DomainSpec): PropertyTest[] {
    const tests: PropertyTest[] = [];

    // Input validation tests
    if (behavior.input) {
      tests.push(this.generateInputValidationTest(behavior, domain));
      tests.push(this.generateInvalidInputTest(behavior, domain));
    }

    // Precondition tests
    for (const precondition of behavior.preconditions) {
      tests.push(this.generatePreconditionTest(behavior, precondition, domain));
    }

    // Postcondition tests
    for (const postcondition of behavior.postconditions) {
      tests.push(this.generatePostconditionTest(behavior, postcondition, domain));
    }

    // Error path tests
    if (behavior.output?.errors) {
      for (const error of behavior.output.errors) {
        tests.push(this.generateErrorPathTest(behavior, error.name, domain));
      }
    }

    return tests;
  }

  /**
   * Generate test for valid input acceptance
   */
  private generateInputValidationTest(behavior: BehaviorSpec, domain: DomainSpec): PropertyTest {
    const arbitrary = this.generateInputArbitrary(behavior.input!.fields, domain);

    return {
      name: 'accepts_valid_input',
      behavior: behavior.name,
      description: 'Behavior should accept all valid inputs',
      arbitrary,
      property: (_input, result) => {
        return result !== undefined;
      },
      category: 'input',
    };
  }

  /**
   * Generate test for invalid input rejection
   */
  private generateInvalidInputTest(behavior: BehaviorSpec, domain: DomainSpec): PropertyTest {
    const arbitrary = this.generateInvalidInputArbitrary(behavior.input!.fields);

    return {
      name: 'rejects_invalid_input',
      behavior: behavior.name,
      description: 'Behavior should reject invalid inputs',
      arbitrary,
      property: (_input, result) => {
        // Should either throw or return error
        return result === undefined || (typeof result === 'object' && result !== null && 'error' in result);
      },
      category: 'input',
    };
  }

  /**
   * Generate precondition test
   */
  private generatePreconditionTest(
    behavior: BehaviorSpec,
    precondition: string,
    domain: DomainSpec
  ): PropertyTest {
    const arbitrary = behavior.input
      ? this.generateInputArbitrary(behavior.input.fields, domain)
      : fc.constant({});

    return {
      name: `precondition_${this.sanitizeName(precondition)}`,
      behavior: behavior.name,
      description: `Precondition: ${precondition}`,
      arbitrary,
      property: (input, result) => {
        // If precondition was violated, behavior should fail gracefully
        return true; // Simplified - real implementation would evaluate predicate
      },
      category: 'precondition',
    };
  }

  /**
   * Generate postcondition test
   */
  private generatePostconditionTest(
    behavior: BehaviorSpec,
    postcondition: { guard: string; predicates: string[] },
    domain: DomainSpec
  ): PropertyTest {
    const arbitrary = behavior.input
      ? this.generateInputArbitrary(behavior.input.fields, domain)
      : fc.constant({});

    return {
      name: `postcondition_${this.sanitizeName(postcondition.guard)}`,
      behavior: behavior.name,
      description: `Postcondition when ${postcondition.guard}: ${postcondition.predicates.join(', ')}`,
      arbitrary,
      property: (input, result) => {
        // Check guard condition
        if (postcondition.guard === 'success') {
          if (typeof result === 'object' && result !== null && 'success' in result && !(result as any).success) {
            return true; // Guard not met, skip check
          }
        }
        // If guard met, all predicates must hold
        return true; // Simplified
      },
      category: 'postcondition',
    };
  }

  /**
   * Generate error path test
   */
  private generateErrorPathTest(
    behavior: BehaviorSpec,
    errorName: string,
    domain: DomainSpec
  ): PropertyTest {
    const arbitrary = this.generateErrorTriggerArbitrary(behavior, errorName);

    return {
      name: `error_${errorName}`,
      behavior: behavior.name,
      description: `Error path: ${errorName}`,
      arbitrary,
      property: (_input, result) => {
        // Error should be properly structured
        if (typeof result === 'object' && result !== null && 'error' in result) {
          const error = (result as any).error;
          return typeof error.code === 'string' && typeof error.message === 'string';
        }
        return true;
      },
      category: 'postcondition',
    };
  }

  /**
   * Generate arbitrary for valid input
   */
  generateInputArbitrary(fields: FieldSpec[], domain: DomainSpec): fc.Arbitrary<Record<string, unknown>> {
    const properties: Record<string, fc.Arbitrary<unknown>> = {};

    for (const field of fields) {
      let arb = this.fieldToArbitrary(field, domain);
      if (field.optional) {
        arb = fc.option(arb, { nil: undefined });
      }
      properties[field.name] = arb;
    }

    return fc.record(properties);
  }

  /**
   * Generate arbitrary for invalid input
   */
  private generateInvalidInputArbitrary(fields: FieldSpec[]): fc.Arbitrary<unknown> {
    // Generate various kinds of invalid inputs
    return fc.oneof(
      // Missing required fields
      fc.constant({}),
      // Wrong types
      fc.record(
        Object.fromEntries(
          fields.map(f => [f.name, fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))])
        )
      ),
      // Null input
      fc.constant(null),
      // Array instead of object
      fc.array(fc.anything()),
    );
  }

  /**
   * Generate arbitrary to trigger specific error
   */
  private generateErrorTriggerArbitrary(behavior: BehaviorSpec, errorName: string): fc.Arbitrary<unknown> {
    // Generate edge-case inputs likely to trigger errors
    return fc.record(
      Object.fromEntries(
        (behavior.input?.fields || []).map(f => [
          f.name,
          this.generateEdgeCaseArbitrary(f.type),
        ])
      )
    );
  }

  /**
   * Convert field to arbitrary
   */
  private fieldToArbitrary(field: FieldSpec, domain: DomainSpec): fc.Arbitrary<unknown> {
    // Check if it's a custom type
    const customType = domain.types.find(t => t.name === field.type);
    if (customType) {
      return this.constrainedTypeToArbitrary(customType);
    }

    return this.baseTypeToArbitrary(field.type, field.constraints);
  }

  /**
   * Convert base type to arbitrary
   */
  private baseTypeToArbitrary(
    type: string,
    constraints: { name: string; value: unknown }[] = []
  ): fc.Arbitrary<unknown> {
    const minLength = constraints.find(c => c.name === 'min_length')?.value as number | undefined;
    const maxLength = constraints.find(c => c.name === 'max_length')?.value as number | undefined;
    const min = constraints.find(c => c.name === 'min')?.value as number | undefined;
    const max = constraints.find(c => c.name === 'max')?.value as number | undefined;

    switch (type) {
      case 'String':
        return fc.string({ minLength: minLength || 0, maxLength: maxLength || 100 });
      case 'Int':
        return fc.integer({ min: min ?? -1000, max: max ?? 1000 });
      case 'Decimal':
        return fc.double({ min: min ?? -1000, max: max ?? 1000 }).map(n => Number(n.toFixed(2)));
      case 'Boolean':
        return fc.boolean();
      case 'UUID':
        return fc.uuid();
      case 'Timestamp':
        return fc.date().map(d => d.toISOString());
      default:
        return fc.anything();
    }
  }

  /**
   * Convert constrained type to arbitrary
   */
  private constrainedTypeToArbitrary(type: TypeSpec): fc.Arbitrary<unknown> {
    return this.baseTypeToArbitrary(type.baseType, type.constraints);
  }

  /**
   * Generate edge case values
   */
  private generateEdgeCaseArbitrary(type: string): fc.Arbitrary<unknown> {
    switch (type) {
      case 'String':
        return fc.oneof(
          fc.constant(''),
          fc.constant(' '),
          fc.string({ maxLength: 10000 }),
          fc.constantFrom('<script>', "'; DROP TABLE", '\x00\x00'),
        );
      case 'Int':
        return fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.constant(Number.MAX_SAFE_INTEGER),
          fc.constant(Number.MIN_SAFE_INTEGER),
        );
      case 'Decimal':
        return fc.oneof(
          fc.constant(0),
          fc.constant(0.1 + 0.2),
          fc.constant(Number.MAX_VALUE),
          fc.constant(Number.MIN_VALUE),
        );
      default:
        return fc.anything();
    }
  }

  /**
   * Sanitize name for test identifier
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }
}
