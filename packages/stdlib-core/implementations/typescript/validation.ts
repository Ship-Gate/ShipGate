// ============================================================================
// ISL Standard Library - Validation Framework
// @stdlib/validation
// ============================================================================

// ============================================================================
// CORE TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  value?: unknown;
}

export type Validator<T> = (value: unknown) => ValidationResult & { value?: T };

export interface ValidatorOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
}

// ============================================================================
// VALIDATION RESULT HELPERS
// ============================================================================

export function ok<T>(value: T): ValidationResult & { value: T } {
  return { valid: true, errors: [], value };
}

export function fail(error: ValidationError): ValidationResult {
  return { valid: false, errors: [error] };
}

export function failMany(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

export function createError(
  path: string,
  message: string,
  code: string,
  value?: unknown
): ValidationError {
  return { path, message, code, value };
}

// ============================================================================
// CONSTRAINT VALIDATORS
// ============================================================================

export function minLength(min: number): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return fail(createError('', 'Expected string', 'TYPE_ERROR', value));
    }
    if (value.length < min) {
      return fail(createError('', `Minimum length is ${min}, got ${value.length}`, 'MIN_LENGTH', value));
    }
    return ok(value);
  };
}

export function maxLength(max: number): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return fail(createError('', 'Expected string', 'TYPE_ERROR', value));
    }
    if (value.length > max) {
      return fail(createError('', `Maximum length is ${max}, got ${value.length}`, 'MAX_LENGTH', value));
    }
    return ok(value);
  };
}

export function length(len: number): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return fail(createError('', 'Expected string', 'TYPE_ERROR', value));
    }
    if (value.length !== len) {
      return fail(createError('', `Expected length ${len}, got ${value.length}`, 'LENGTH', value));
    }
    return ok(value);
  };
}

export function pattern(regex: RegExp): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return fail(createError('', 'Expected string', 'TYPE_ERROR', value));
    }
    if (!regex.test(value)) {
      return fail(createError('', `Does not match pattern ${regex}`, 'PATTERN', value));
    }
    return ok(value);
  };
}

export function min(minimum: number): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number') {
      return fail(createError('', 'Expected number', 'TYPE_ERROR', value));
    }
    if (value < minimum) {
      return fail(createError('', `Minimum value is ${minimum}, got ${value}`, 'MIN', value));
    }
    return ok(value);
  };
}

export function max(maximum: number): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number') {
      return fail(createError('', 'Expected number', 'TYPE_ERROR', value));
    }
    if (value > maximum) {
      return fail(createError('', `Maximum value is ${maximum}, got ${value}`, 'MAX', value));
    }
    return ok(value);
  };
}

export function range(minimum: number, maximum: number): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number') {
      return fail(createError('', 'Expected number', 'TYPE_ERROR', value));
    }
    if (value < minimum || value > maximum) {
      return fail(createError('', `Value must be between ${minimum} and ${maximum}, got ${value}`, 'RANGE', value));
    }
    return ok(value);
  };
}

export function precision(decimals: number): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number') {
      return fail(createError('', 'Expected number', 'TYPE_ERROR', value));
    }
    const parts = value.toString().split('.');
    if (parts[1] && parts[1].length > decimals) {
      return fail(createError('', `Maximum ${decimals} decimal places allowed`, 'PRECISION', value));
    }
    return ok(value);
  };
}

export function oneOf<T extends string | number>(values: readonly T[]): Validator<T> {
  return (value: unknown) => {
    if (!values.includes(value as T)) {
      return fail(createError('', `Value must be one of: ${values.join(', ')}`, 'ONE_OF', value));
    }
    return ok(value as T);
  };
}

// ============================================================================
// COMPOSITE VALIDATORS
// ============================================================================

export function compose<T>(...validators: Validator<unknown>[]): Validator<T> {
  return (value: unknown) => {
    const allErrors: ValidationError[] = [];
    let currentValue = value;
    
    for (const validator of validators) {
      const result = validator(currentValue);
      if (!result.valid) {
        allErrors.push(...result.errors);
        break;
      }
      if (result.value !== undefined) {
        currentValue = result.value;
      }
    }
    
    if (allErrors.length > 0) {
      return failMany(allErrors);
    }
    
    return ok(currentValue as T);
  };
}

export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value: unknown) => {
    if (value === undefined || value === null) {
      return ok(undefined);
    }
    return validator(value);
  };
}

export function nullable<T>(validator: Validator<T>): Validator<T | null> {
  return (value: unknown) => {
    if (value === null) {
      return ok(null);
    }
    return validator(value);
  };
}

export function array<T>(itemValidator: Validator<T>): Validator<T[]> {
  return (value: unknown) => {
    if (!Array.isArray(value)) {
      return fail(createError('', 'Expected array', 'TYPE_ERROR', value));
    }
    
    const results: T[] = [];
    const errors: ValidationError[] = [];
    
    for (let i = 0; i < value.length; i++) {
      const result = itemValidator(value[i]);
      if (!result.valid) {
        for (const error of result.errors) {
          errors.push({
            ...error,
            path: `[${i}]${error.path ? '.' + error.path : ''}`,
          });
        }
      } else if (result.value !== undefined) {
        results.push(result.value);
      }
    }
    
    if (errors.length > 0) {
      return failMany(errors);
    }
    
    return ok(results);
  };
}

// ============================================================================
// OBJECT VALIDATOR
// ============================================================================

type Schema<T> = {
  [K in keyof T]: Validator<T[K]>;
};

export function object<T extends Record<string, unknown>>(schema: Schema<T>): Validator<T> {
  return (value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return fail(createError('', 'Expected object', 'TYPE_ERROR', value));
    }
    
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const errors: ValidationError[] = [];
    
    for (const [key, validator] of Object.entries(schema)) {
      const fieldResult = (validator as Validator<unknown>)(obj[key]);
      if (!fieldResult.valid) {
        for (const error of fieldResult.errors) {
          errors.push({
            ...error,
            path: key + (error.path ? '.' + error.path : ''),
          });
        }
      } else if (fieldResult.value !== undefined) {
        result[key] = fieldResult.value;
      }
    }
    
    if (errors.length > 0) {
      return failMany(errors);
    }
    
    return ok(result as T);
  };
}

// ============================================================================
// TYPE VALIDATORS
// ============================================================================

export function string(): Validator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      return fail(createError('', 'Expected string', 'TYPE_ERROR', value));
    }
    return ok(value);
  };
}

export function number(): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return fail(createError('', 'Expected number', 'TYPE_ERROR', value));
    }
    return ok(value);
  };
}

export function integer(): Validator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return fail(createError('', 'Expected integer', 'TYPE_ERROR', value));
    }
    return ok(value);
  };
}

export function boolean(): Validator<boolean> {
  return (value: unknown) => {
    if (typeof value !== 'boolean') {
      return fail(createError('', 'Expected boolean', 'TYPE_ERROR', value));
    }
    return ok(value);
  };
}

// ============================================================================
// VALIDATOR FACTORY
// ============================================================================

export interface ValidatorBuilder<T> {
  validate: Validator<T>;
  min: (value: number) => ValidatorBuilder<T>;
  max: (value: number) => ValidatorBuilder<T>;
  minLength: (value: number) => ValidatorBuilder<T>;
  maxLength: (value: number) => ValidatorBuilder<T>;
  pattern: (regex: RegExp) => ValidatorBuilder<T>;
  optional: () => ValidatorBuilder<T | undefined>;
}

export function createValidator<T>(baseValidator: Validator<T>): ValidatorBuilder<T> {
  let validators: Validator<unknown>[] = [baseValidator];
  
  const builder: ValidatorBuilder<T> = {
    validate: (value: unknown) => compose<T>(...validators)(value),
    min: (value: number) => {
      validators.push(min(value) as Validator<unknown>);
      return builder;
    },
    max: (value: number) => {
      validators.push(max(value) as Validator<unknown>);
      return builder;
    },
    minLength: (value: number) => {
      validators.push(minLength(value) as Validator<unknown>);
      return builder;
    },
    maxLength: (value: number) => {
      validators.push(maxLength(value) as Validator<unknown>);
      return builder;
    },
    pattern: (regex: RegExp) => {
      validators.push(pattern(regex) as Validator<unknown>);
      return builder;
    },
    optional: () => {
      const currentValidators = validators;
      validators = [];
      return createValidator(optional(compose<T>(...currentValidators))) as ValidatorBuilder<T | undefined>;
    },
  };
  
  return builder;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Validation = {
  // Results
  ok,
  fail,
  failMany,
  createError,
  
  // Constraints
  minLength,
  maxLength,
  length,
  pattern,
  min,
  max,
  range,
  precision,
  oneOf,
  
  // Compositors
  compose,
  optional,
  nullable,
  array,
  object,
  
  // Types
  string,
  number,
  integer,
  boolean,
  
  // Factory
  createValidator,
};

export default Validation;
