/**
 * Behavior Generator
 *
 * Generate ISL behavior specifications from extracted functions.
 */

import type {
  ExtractedFunction,
  ExtractedValidation,
  ExtractedTestCase,
  ExtractedParameter,
  ExtractedError,
} from '../analyzer.js';

export interface GeneratedBehavior {
  name: string;
  description?: string;
  inputs: ExtractedParameter[];
  outputs: {
    success: string;
    errors: ExtractedError[];
  };
  preconditions: string[];
  postconditions: string[];
}

/**
 * Generate behavior specifications from extracted functions
 */
export function generateBehaviors(
  functions: ExtractedFunction[],
  validations: ExtractedValidation[],
  testCases: ExtractedTestCase[]
): GeneratedBehavior[] {
  const behaviors: GeneratedBehavior[] = [];

  for (const func of functions) {
    // Skip getters, setters, and utility functions
    if (isUtilityFunction(func.name)) continue;

    const behavior = generateBehavior(func, validations, testCases);
    behaviors.push(behavior);
  }

  return behaviors;
}

function generateBehavior(
  func: ExtractedFunction,
  validations: ExtractedValidation[],
  testCases: ExtractedTestCase[]
): GeneratedBehavior {
  // Get function-specific validations
  const funcValidations = validations.filter(
    (v) => func.parameters.some((p) => v.field === p.name)
  );

  // Get test cases for this function
  const funcTests = testCases.filter(
    (t) => t.functionName === func.name || t.functionName === toCamelCase(func.name)
  );

  // Generate preconditions
  const preconditions = generatePreconditions(func, funcValidations, funcTests);

  // Generate postconditions
  const postconditions = generatePostconditions(func, funcTests);

  // Generate description from function name and tests
  const description = generateDescription(func, funcTests);

  // Enhance error cases from tests
  const errors = enhanceErrors(func.throwsErrors, funcTests);

  return {
    name: func.name,
    description,
    inputs: func.parameters.map((p) => enhanceParameter(p, funcValidations)),
    outputs: {
      success: func.returnType === 'Void' ? 'Boolean' : func.returnType,
      errors,
    },
    preconditions,
    postconditions,
  };
}

function generatePreconditions(
  func: ExtractedFunction,
  validations: ExtractedValidation[],
  testCases: ExtractedTestCase[]
): string[] {
  const preconditions: string[] = [];

  // Add preconditions from validations
  for (const validation of validations) {
    if (validation.type === 'precondition') {
      preconditions.push(validation.condition);
    }
  }

  // Infer preconditions from parameters
  for (const param of func.parameters) {
    if (param.type === 'Email' || param.name.includes('email')) {
      if (!preconditions.some((p) => p.includes('email'))) {
        preconditions.push(`${param.name}.is_valid_format`);
      }
    }

    if (param.name.includes('password')) {
      if (!preconditions.some((p) => p.includes('password') && p.includes('length'))) {
        preconditions.push(`${param.name}.length >= 8`);
      }
    }

    // Non-optional parameters should be present
    if (!param.optional && param.type === 'String') {
      if (!preconditions.some((p) => p.includes(param.name))) {
        preconditions.push(`${param.name}.length > 0`);
      }
    }
  }

  // Learn from test cases - look for patterns in inputs
  for (const test of testCases) {
    // If a test expects an error for certain input, that's a precondition
    if (test.expectedError) {
      for (const [key, value] of Object.entries(test.inputs)) {
        if (typeof value === 'string' && value.length < 3) {
          preconditions.push(`${key}.length >= 3`);
        }
      }
    }
  }

  return [...new Set(preconditions)]; // Remove duplicates
}

function generatePostconditions(
  func: ExtractedFunction,
  testCases: ExtractedTestCase[]
): string[] {
  const postconditions: string[] = [];

  // Infer from side effects
  for (const effect of func.sideEffects) {
    switch (effect.type) {
      case 'create':
        postconditions.push(`${effect.target}.exists(result.id)`);
        break;
      case 'update':
        postconditions.push(`${effect.target}.updated_at == now()`);
        break;
      case 'delete':
        postconditions.push(`not ${effect.target}.exists(input.id)`);
        break;
    }
  }

  // Learn from test assertions
  for (const test of testCases) {
    if (!test.expectedError) {
      for (const assertion of test.assertions) {
        // Convert assertion to postcondition format
        const postcondition = assertionToPostcondition(assertion);
        if (postcondition && !postconditions.includes(postcondition)) {
          postconditions.push(postcondition);
        }
      }
    }
  }

  // Common patterns based on function name
  if (func.name.toLowerCase().includes('create')) {
    const entityMatch = func.returnType.match(/^[A-Z][a-z]+/);
    if (entityMatch) {
      const entity = entityMatch[0];
      if (!postconditions.some((p) => p.includes(`${entity}.exists`))) {
        postconditions.push(`${entity}.exists(result.id)`);
      }
    }
  }

  return postconditions;
}

function generateDescription(
  func: ExtractedFunction,
  testCases: ExtractedTestCase[]
): string {
  // Try to get description from test name
  for (const test of testCases) {
    if (test.name && test.name !== func.name) {
      return test.name;
    }
  }

  // Generate from function name
  const words = func.name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .toLowerCase();

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function enhanceErrors(
  errors: ExtractedError[],
  testCases: ExtractedTestCase[]
): ExtractedError[] {
  const enhanced = [...errors];

  // Add errors discovered in tests
  for (const test of testCases) {
    if (test.expectedError) {
      const errorType = toScreamingSnakeCase(test.expectedError);
      if (!enhanced.some((e) => e.type === errorType)) {
        enhanced.push({
          type: errorType,
          condition: test.name,
        });
      }
    }
  }

  return enhanced;
}

function enhanceParameter(
  param: ExtractedParameter,
  _validations: ExtractedValidation[]
): ExtractedParameter {
  // TODO: Use validations to add annotations based on constraints
  // const paramValidation = validations.find((v) => v.field === param.name);

  return {
    ...param,
    // Could add annotations based on validations
  };
}

function assertionToPostcondition(assertion: string): string | null {
  // Convert common assertion patterns to postconditions
  if (assertion.includes('==')) {
    return assertion.replace(/\s+==\s+/, ' == ');
  }
  if (assertion.includes('toBe') || assertion.includes('toEqual')) {
    return null; // Too generic
  }
  if (assertion.includes('exists') || assertion.includes('defined')) {
    return assertion;
  }
  return null;
}

function isUtilityFunction(name: string): boolean {
  const utilityPatterns = [
    /^get[A-Z]/,
    /^set[A-Z]/,
    /^is[A-Z]/,
    /^has[A-Z]/,
    /^to[A-Z]/,
    /^from[A-Z]/,
    /^_/,
    /^private/,
    /^internal/,
    /Helper$/,
    /Util$/,
  ];
  return utilityPatterns.some((p) => p.test(name));
}

function toCamelCase(str: string): string {
  return str
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toScreamingSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase();
}
