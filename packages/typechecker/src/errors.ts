// ============================================================================
// Type Error Definitions
// ============================================================================

import type { SourceLocation } from './types';

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
}

// Error codes
export const ErrorCodes = {
  // Type resolution errors
  UNDEFINED_TYPE: 'TC001',
  UNDEFINED_ENTITY: 'TC002',
  UNDEFINED_FIELD: 'TC003',
  UNDEFINED_VARIABLE: 'TC004',
  UNDEFINED_BEHAVIOR: 'TC005',
  UNDEFINED_ENUM_VARIANT: 'TC006',
  
  // Duplicate errors
  DUPLICATE_TYPE: 'TC010',
  DUPLICATE_ENTITY: 'TC011',
  DUPLICATE_FIELD: 'TC012',
  DUPLICATE_BEHAVIOR: 'TC013',
  DUPLICATE_VARIABLE: 'TC014',
  DUPLICATE_PARAMETER: 'TC015',
  DUPLICATE_ENUM_VARIANT: 'TC016',
  
  // Type mismatch errors
  TYPE_MISMATCH: 'TC020',
  INCOMPATIBLE_TYPES: 'TC021',
  INVALID_OPERATOR: 'TC022',
  INVALID_ARGUMENT_COUNT: 'TC023',
  INVALID_ARGUMENT_TYPE: 'TC024',
  
  // Context errors
  OLD_OUTSIDE_POSTCONDITION: 'TC030',
  RESULT_OUTSIDE_POSTCONDITION: 'TC031',
  INPUT_INVALID_FIELD: 'TC032',
  
  // Lifecycle errors
  INVALID_LIFECYCLE_STATE: 'TC040',
  INVALID_LIFECYCLE_TRANSITION: 'TC041',
  UNDEFINED_LIFECYCLE_STATE: 'TC042',
  
  // Entity method errors
  INVALID_ENTITY_LOOKUP: 'TC050',
  INVALID_ENTITY_EXISTS: 'TC051',
  
  // Constraint errors
  INVALID_CONSTRAINT_VALUE: 'TC060',
  INVALID_CONSTRAINT_TYPE: 'TC061',
  
  // Other errors
  CIRCULAR_REFERENCE: 'TC070',
  INVALID_EXPRESSION: 'TC071',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Error factory functions
export function createError(
  code: ErrorCode,
  message: string,
  location: SourceLocation,
  related?: RelatedInformation[]
): Diagnostic {
  return {
    severity: 'error',
    code,
    message,
    location,
    source: 'typechecker',
    relatedInformation: related,
  };
}

export function createWarning(
  code: string,
  message: string,
  location: SourceLocation,
  related?: RelatedInformation[]
): Diagnostic {
  return {
    severity: 'warning',
    code,
    message,
    location,
    source: 'typechecker',
    relatedInformation: related,
  };
}

// Specific error creators
export function undefinedTypeError(name: string, location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_TYPE,
    `Type '${name}' is not defined`,
    location
  );
}

export function undefinedEntityError(name: string, location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_ENTITY,
    `Entity '${name}' is not defined`,
    location
  );
}

export function undefinedFieldError(
  fieldName: string,
  typeName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_FIELD,
    `Field '${fieldName}' does not exist on type '${typeName}'`,
    location
  );
}

export function undefinedVariableError(name: string, location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_VARIABLE,
    `Variable '${name}' is not defined in this scope`,
    location
  );
}

export function undefinedBehaviorError(name: string, location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_BEHAVIOR,
    `Behavior '${name}' is not defined`,
    location
  );
}

export function undefinedEnumVariantError(
  variant: string,
  enumName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.UNDEFINED_ENUM_VARIANT,
    `Enum '${enumName}' does not have variant '${variant}'`,
    location
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
    [{ message: 'Previously defined here', location: previousLocation }]
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
    [{ message: 'Previously defined here', location: previousLocation }]
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
    [{ message: 'Previously defined here', location: previousLocation }]
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
    [{ message: 'Previously defined here', location: previousLocation }]
  );
}

export function typeMismatchError(
  expected: string,
  actual: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.TYPE_MISMATCH,
    `Type mismatch: expected '${expected}', got '${actual}'`,
    location
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
    location
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
    location
  );
}

export function oldOutsidePostconditionError(location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.OLD_OUTSIDE_POSTCONDITION,
    `'old()' can only be used in postconditions`,
    location
  );
}

export function resultOutsidePostconditionError(location: SourceLocation): Diagnostic {
  return createError(
    ErrorCodes.RESULT_OUTSIDE_POSTCONDITION,
    `'result' can only be used in postconditions`,
    location
  );
}

export function inputInvalidFieldError(
  fieldName: string,
  behaviorName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INPUT_INVALID_FIELD,
    `Input field '${fieldName}' is not defined in behavior '${behaviorName}'`,
    location
  );
}

export function invalidLifecycleStateError(
  state: string,
  entityName: string,
  validStates: string[],
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_LIFECYCLE_STATE,
    `'${state}' is not a valid lifecycle state for entity '${entityName}'. Valid states: ${validStates.join(', ')}`,
    location
  );
}

export function invalidEntityLookupError(
  entityName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_ENTITY_LOOKUP,
    `Entity '${entityName}' does not support lookup()`,
    location
  );
}

export function invalidEntityExistsError(
  entityName: string,
  location: SourceLocation
): Diagnostic {
  return createError(
    ErrorCodes.INVALID_ENTITY_EXISTS,
    `Entity '${entityName}' does not support exists()`,
    location
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
    location
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
    location
  );
}
