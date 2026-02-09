// ============================================================================
// Type Checker Error Definitions
// ============================================================================
//
// Uses the unified @isl-lang/errors infrastructure while maintaining
// backward compatibility with existing type checker code.
//
// ============================================================================

import type { SourceLocation } from './types.js';
import {
  TYPE_ERRORS,
  SEMANTIC_ERRORS,
  diagnostic,
  findSimilar,
  ISL_BUILTIN_TYPES,
  type Diagnostic as UnifiedDiagnostic,
} from '@isl-lang/errors';

// Re-export types for backward compatibility
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface RelatedInformation {
  message: string;
  location: SourceLocation;
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  location: SourceLocation;
  source: string;
  relatedInformation?: RelatedInformation[];
  notes?: string[];
  help?: string[];
}

// ============================================================================
// Error Codes - Map to unified codes
// ============================================================================

export const ErrorCodes = {
  // Import resolution errors
  CIRCULAR_IMPORT: 'ISL_T001',
  MODULE_NOT_FOUND: 'ISL_T002',
  READ_ERROR: 'ISL_T003',
  PARSE_ERROR: 'ISL_T004',
  
  // Type resolution errors
  UNDEFINED_TYPE: 'ISL_T010',
  UNDEFINED_ENTITY: 'ISL_T011',
  UNDEFINED_FIELD: 'ISL_T012',
  UNDEFINED_VARIABLE: 'ISL_T013',
  UNDEFINED_BEHAVIOR: 'ISL_T014',
  UNDEFINED_ENUM_VARIANT: 'ISL_T015',
  
  // Duplicate errors
  DUPLICATE_TYPE: 'ISL_T020',
  DUPLICATE_ENTITY: 'ISL_T021',
  DUPLICATE_FIELD: 'ISL_T022',
  DUPLICATE_BEHAVIOR: 'ISL_T023',
  DUPLICATE_VARIABLE: 'ISL_T024',
  DUPLICATE_PARAMETER: 'ISL_T025',
  DUPLICATE_ENUM_VARIANT: 'ISL_T026',
  
  // Type mismatch errors
  TYPE_MISMATCH: 'ISL_T030',
  INCOMPATIBLE_TYPES: 'ISL_T031',
  INVALID_OPERATOR: 'ISL_T032',
  INVALID_ARGUMENT_COUNT: 'ISL_T033',
  INVALID_ARGUMENT_TYPE: 'ISL_T034',
  
  // Context errors
  OLD_OUTSIDE_POSTCONDITION: 'ISL_T040',
  RESULT_OUTSIDE_POSTCONDITION: 'ISL_T041',
  INPUT_INVALID_FIELD: 'ISL_T042',
  
  // Lifecycle errors
  INVALID_LIFECYCLE_STATE: 'ISL_T050',
  INVALID_LIFECYCLE_TRANSITION: 'ISL_T051',
  UNDEFINED_LIFECYCLE_STATE: 'ISL_T052',
  
  // Entity method errors
  INVALID_ENTITY_LOOKUP: 'ISL_T060',
  INVALID_ENTITY_EXISTS: 'ISL_T061',
  
  // Constraint errors
  INVALID_CONSTRAINT_VALUE: 'ISL_T070',
  INVALID_CONSTRAINT_TYPE: 'ISL_T071',
  
  // Other errors
  CIRCULAR_REFERENCE: 'ISL_T080',
  INVALID_EXPRESSION: 'ISL_T081',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================================================
// Error Factory Functions
// ============================================================================

export function createError(
  code: ErrorCode,
  message: string,
  location: SourceLocation,
  related?: RelatedInformation[],
  notes?: string[],
  help?: string[]
): Diagnostic {
  return {
    severity: 'error',
    code,
    message,
    location,
    source: 'typechecker',
    relatedInformation: related,
    notes,
    help,
  };
}

export function createWarning(
  code: string,
  message: string,
  location: SourceLocation,
  related?: RelatedInformation[],
  help?: string[]
): Diagnostic {
  return {
    severity: 'warning',
    code,
    message,
    location,
    source: 'typechecker',
    relatedInformation: related,
    help,
  };
}

// ============================================================================
// Specific Error Creators (Enhanced with suggestions)
// ============================================================================

export function undefinedTypeError(
  name: string,
  location: SourceLocation,
  availableTypes: string[] = []
): Diagnostic {
  const allTypes = [...ISL_BUILTIN_TYPES, ...availableTypes];
  const suggestions = findSimilar(name, allTypes, { maxDistance: 3 });
  
  const help: string[] = [];
  if (suggestions.length > 0) {
    help.push(`Did you mean '${suggestions[0]!.value}'?`);
  }
  
  // Check for lowercase version of builtin type
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  if (ISL_BUILTIN_TYPES.includes(capitalizedName) && capitalizedName !== name) {
    help.push(`Type names are case-sensitive. Use '${capitalizedName}'`);
  }

  return createError(
    ErrorCodes.UNDEFINED_TYPE,
    `Type '${name}' is not defined`,
    location,
    undefined,
    [`File: ${location.file}`, `Range: ${location.line}:${location.column}-${location.endLine}:${location.endColumn}`],
    help
  );
}

export function undefinedEntityError(
  name: string,
  location: SourceLocation,
  availableEntities: string[] = []
): Diagnostic {
  const suggestions = findSimilar(name, availableEntities, { maxDistance: 3 });
  const help = suggestions.length > 0 
    ? [`Did you mean '${suggestions[0]!.value}'?`]
    : undefined;

  return createError(
    ErrorCodes.UNDEFINED_ENTITY,
    `Entity '${name}' is not defined`,
    location,
    undefined,
    undefined,
    help
  );
}

export function undefinedFieldError(
  fieldName: string,
  typeName: string,
  location: SourceLocation,
  availableFields: string[] = []
): Diagnostic {
  const suggestions = findSimilar(fieldName, availableFields, { maxDistance: 3 });
  const help: string[] = [];
  
  if (suggestions.length > 0) {
    help.push(`Did you mean '${suggestions[0]!.value}'?`);
  }
  
  if (availableFields.length > 0 && availableFields.length <= 5) {
    help.push(`Available fields: ${availableFields.join(', ')}`);
  }

  return createError(
    ErrorCodes.UNDEFINED_FIELD,
    `Field '${fieldName}' does not exist on type '${typeName}'`,
    location,
    undefined,
    [`File: ${location.file}`, `Range: ${location.line}:${location.column}-${location.endLine}:${location.endColumn}`],
    help
  );
}

export function undefinedVariableError(
  name: string,
  location: SourceLocation,
  availableVars: string[] = []
): Diagnostic {
  const suggestions = findSimilar(name, availableVars, { maxDistance: 2 });
  const help = suggestions.length > 0
    ? [`Did you mean '${suggestions[0]!.value}'?`]
    : undefined;

  return createError(
    ErrorCodes.UNDEFINED_VARIABLE,
    `Variable '${name}' is not defined in this scope`,
    location,
    undefined,
    undefined,
    help
  );
}

export function undefinedBehaviorError(
  name: string,
  location: SourceLocation,
  availableBehaviors: string[] = []
): Diagnostic {
  const suggestions = findSimilar(name, availableBehaviors, { maxDistance: 3 });
  const help = suggestions.length > 0
    ? [`Did you mean '${suggestions[0]!.value}'?`]
    : undefined;

  return createError(
    ErrorCodes.UNDEFINED_BEHAVIOR,
    `Behavior '${name}' is not defined`,
    location,
    undefined,
    undefined,
    help
  );
}

export function undefinedEnumVariantError(
  variant: string,
  enumName: string,
  location: SourceLocation,
  availableVariants: string[] = []
): Diagnostic {
  const suggestions = findSimilar(variant, availableVariants, { maxDistance: 2 });
  const help: string[] = [];
  
  if (suggestions.length > 0) {
    help.push(`Did you mean '${enumName}.${suggestions[0]!.value}'?`);
  }
  
  if (availableVariants.length > 0 && availableVariants.length <= 8) {
    help.push(`Valid variants: ${availableVariants.join(', ')}`);
  }

  return createError(
    ErrorCodes.UNDEFINED_ENUM_VARIANT,
    `Enum '${enumName}' does not have variant '${variant}'`,
    location,
    undefined,
    undefined,
    help
  );
}

export function duplicateTypeError(
  name: string,
  location: SourceLocation,
  previousLocation: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.DUPLICATE_TYPE,
    `Type '${name}' is already defined`,
    location,
    [{ message: 'Previously defined here', location: previousLocation }],
    undefined,
    ['Rename one of the types or remove the duplicate']
  );
}

export function duplicateEntityError(
  name: string,
  location: SourceLocation,
  previousLocation: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.DUPLICATE_ENTITY,
    `Entity '${name}' is already defined`,
    location,
    [{ message: 'Previously defined here', location: previousLocation }],
    undefined,
    ['Rename one of the entities or remove the duplicate']
  );
}

export function duplicateFieldError(
  fieldName: string,
  containerName: string,
  location: SourceLocation,
  previousLocation: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.DUPLICATE_FIELD,
    `Field '${fieldName}' is already defined in '${containerName}'`,
    location,
    [{ message: 'Previously defined here', location: previousLocation }],
    undefined,
    ['Each field must have a unique name within its container']
  );
}

export function duplicateBehaviorError(
  name: string,
  location: SourceLocation,
  previousLocation: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.DUPLICATE_BEHAVIOR,
    `Behavior '${name}' is already defined`,
    location,
    [{ message: 'Previously defined here', location: previousLocation }],
    undefined,
    ['Rename one of the behaviors or remove the duplicate']
  );
}

export function typeMismatchError(
  expected: string,
  actual: string,
  location: SourceLocation
): Diagnostic {
  const help: string[] = [];
  
  // Suggest conversion functions for common mismatches
  if (expected === 'String' && actual === 'Int') {
    help.push('Use toString() to convert Int to String');
  } else if (expected === 'Int' && actual === 'String') {
    help.push('Use parseInt() to convert String to Int');
  } else if (expected === 'Decimal' && actual === 'String') {
    help.push('Use parseDecimal() to convert String to Decimal');
  } else if (expected === 'String' && actual === 'Decimal') {
    help.push('Use toString() to convert Decimal to String');
  }

  return createError(
    ErrorCodes.TYPE_MISMATCH,
    `Type mismatch: expected '${expected}', got '${actual}'`,
    location,
    undefined,
    [`The expression has type '${actual}' but '${expected}' was expected`],
    help
  );
}

export function incompatibleTypesError(
  left: string,
  right: string,
  operator: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INCOMPATIBLE_TYPES,
    `Cannot apply operator '${operator}' to types '${left}' and '${right}'`,
    location,
    undefined,
    undefined,
    ['Ensure both operands have compatible types']
  );
}

export function invalidOperatorError(
  operator: string,
  type: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_OPERATOR,
    `Operator '${operator}' cannot be applied to type '${type}'`,
    location,
    undefined,
    undefined,
    [`Check which operators are supported for type '${type}'`]
  );
}

export function oldOutsidePostconditionError(location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.OLD_OUTSIDE_POSTCONDITION,
    "'old()' can only be used in postconditions",
    location,
    undefined,
    ["old() captures the value of an expression before a behavior executes"],
    ["Move this expression to a postcondition, or reference the value directly"]
  );
}

export function resultOutsidePostconditionError(location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.RESULT_OUTSIDE_POSTCONDITION,
    "'result' can only be used in postconditions",
    location,
    undefined,
    ["'result' refers to the output of a behavior after it completes"],
    ["Move this expression to a postcondition"]
  );
}

export function inputInvalidFieldError(
  fieldName: string,
  behaviorName: string,
  location: SourceLocation,
  availableFields: string[] = []
): Diagnostic {
  const suggestions = findSimilar(fieldName, availableFields, { maxDistance: 2 });
  const help: string[] = [];
  
  if (suggestions.length > 0) {
    help.push(`Did you mean '${suggestions[0]!.value}'?`);
  }
  
  if (availableFields.length > 0) {
    help.push(`Available input fields: ${availableFields.join(', ')}`);
  }

  return createError(
    ErrorCodes.INPUT_INVALID_FIELD,
    `Input field '${fieldName}' is not defined in behavior '${behaviorName}'`,
    location,
    undefined,
    undefined,
    help
  );
}

export function invalidLifecycleStateError(
  state: string,
  entityName: string,
  validStates: string[],
  location: SourceLocation
): Diagnostic {
  const suggestions = findSimilar(state, validStates, { maxDistance: 2 });
  const help: string[] = [];
  
  if (suggestions.length > 0) {
    help.push(`Did you mean '${suggestions[0]!.value}'?`);
  }
  help.push(`Valid states for '${entityName}': ${validStates.join(', ')}`);

  return createError(
    ErrorCodes.INVALID_LIFECYCLE_STATE,
    `'${state}' is not a valid lifecycle state for entity '${entityName}'`,
    location,
    undefined,
    undefined,
    help
  );
}

export function invalidEntityLookupError(
  entityName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_ENTITY_LOOKUP,
    `Entity '${entityName}' does not support lookup()`,
    location,
    undefined,
    ['lookup() is available on entities with a primary key defined'],
    undefined
  );
}

export function invalidEntityExistsError(
  entityName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_ENTITY_EXISTS,
    `Entity '${entityName}' does not support exists()`,
    location,
    undefined,
    undefined,
    undefined
  );
}

export function invalidConstraintValueError(
  constraintName: string,
  expectedType: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_CONSTRAINT_VALUE,
    `Constraint '${constraintName}' expects a value of type '${expectedType}'`,
    location,
    undefined,
    undefined,
    [`Provide a ${expectedType} value for the '${constraintName}' constraint`]
  );
}

export function circularReferenceError(
  typeName: string,
  cycle: string[],
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.CIRCULAR_REFERENCE,
    `Circular reference detected: ${cycle.join(' -> ')} -> ${typeName}`,
    location,
    undefined,
    [
      `File: ${location.file}`,
      `Range: ${location.line}:${location.column}-${location.endLine}:${location.endColumn}`,
      'Circular type references create infinite types',
    ],
    ['Break the cycle by using Optional<T> or a reference type']
  );
}
