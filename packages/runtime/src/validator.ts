/**
 * ISL Runtime Validator
 * 
 * Type validation and constraint checking.
 */

import {
  type IslValue,
  type IslEntity,
  type TypeRef,
  type TypeConstraints,
  type EntityTypeDef,
  type FieldDef,
  type DomainDef,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  expected?: string;
  actual?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a value against a type reference
 */
export function validateType(
  value: IslValue,
  typeRef: TypeRef,
  domain: DomainDef,
  path: string = ''
): ValidationResult {
  const errors: ValidationError[] = [];

  // Handle optional types
  if (typeRef.optional) {
    if (value === null || value === undefined) {
      return { valid: true, errors: [] };
    }
  } else if (value === null || value === undefined) {
    errors.push({
      path,
      message: 'Value is required',
      code: 'REQUIRED',
      expected: typeRef.name,
      actual: String(value),
    });
    return { valid: false, errors };
  }

  // Check by type name
  const typeName = typeRef.name;

  // Primitive types
  switch (typeName) {
    case 'String':
      if (typeof value !== 'string') {
        errors.push({ path, message: 'Expected string', code: 'TYPE_MISMATCH', expected: 'String', actual: typeof value });
      }
      break;

    case 'Int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push({ path, message: 'Expected integer', code: 'TYPE_MISMATCH', expected: 'Int', actual: typeof value });
      }
      break;

    case 'Float':
      if (typeof value !== 'number') {
        errors.push({ path, message: 'Expected number', code: 'TYPE_MISMATCH', expected: 'Float', actual: typeof value });
      }
      break;

    case 'Boolean':
      if (typeof value !== 'boolean') {
        errors.push({ path, message: 'Expected boolean', code: 'TYPE_MISMATCH', expected: 'Boolean', actual: typeof value });
      }
      break;

    case 'UUID':
    case 'ID':
      if (typeof value !== 'string' || !isValidUUID(value)) {
        errors.push({ path, message: 'Expected valid UUID', code: 'INVALID_UUID', expected: 'UUID', actual: String(value) });
      }
      break;

    case 'Timestamp':
    case 'DateTime':
    case 'Date':
    case 'Time':
      if (!(value instanceof Date) && typeof value !== 'string') {
        errors.push({ path, message: 'Expected date/time', code: 'TYPE_MISMATCH', expected: typeName, actual: typeof value });
      }
      break;

    case 'Email':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        errors.push({ path, message: 'Expected valid email', code: 'INVALID_EMAIL', expected: 'Email', actual: String(value) });
      }
      break;

    case 'URL':
      if (typeof value !== 'string' || !isValidURL(value)) {
        errors.push({ path, message: 'Expected valid URL', code: 'INVALID_URL', expected: 'URL', actual: String(value) });
      }
      break;

    case 'List':
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'Expected array', code: 'TYPE_MISMATCH', expected: 'List', actual: typeof value });
      } else if (typeRef.typeArgs && typeRef.typeArgs[0]) {
        const elementType = typeRef.typeArgs[0];
        for (let i = 0; i < value.length; i++) {
          const elementResult = validateType(value[i], elementType, domain, `${path}[${i}]`);
          errors.push(...elementResult.errors);
        }
      }
      break;

    case 'Map':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({ path, message: 'Expected object', code: 'TYPE_MISMATCH', expected: 'Map', actual: typeof value });
      } else if (typeRef.typeArgs && typeRef.typeArgs[1]) {
        const valueType = typeRef.typeArgs[1];
        for (const [key, val] of Object.entries(value)) {
          const valueResult = validateType(val as IslValue, valueType, domain, `${path}.${key}`);
          errors.push(...valueResult.errors);
        }
      }
      break;

    case 'Set':
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'Expected array (Set)', code: 'TYPE_MISMATCH', expected: 'Set', actual: typeof value });
      } else {
        // Check for duplicates
        const seen = new Set();
        for (let i = 0; i < value.length; i++) {
          const serialized = JSON.stringify(value[i]);
          if (seen.has(serialized)) {
            errors.push({ path: `${path}[${i}]`, message: 'Duplicate value in Set', code: 'DUPLICATE_VALUE' });
          }
          seen.add(serialized);
        }
        // Validate element types
        if (typeRef.typeArgs && typeRef.typeArgs[0]) {
          const elementType = typeRef.typeArgs[0];
          for (let i = 0; i < value.length; i++) {
            const elementResult = validateType(value[i], elementType, domain, `${path}[${i}]`);
            errors.push(...elementResult.errors);
          }
        }
      }
      break;

    case 'Any':
    case 'JSON':
      // Accept anything
      break;

    case 'Void':
      if (value !== undefined && value !== null) {
        errors.push({ path, message: 'Expected void (no value)', code: 'UNEXPECTED_VALUE' });
      }
      break;

    default:
      // Check for entity or enum type
      const entityDef = domain.entities.get(typeName);
      if (entityDef) {
        const entityResult = validateEntity(value as IslEntity, entityDef, domain, path);
        errors.push(...entityResult.errors);
      } else {
        const enumDef = domain.enums.get(typeName);
        if (enumDef) {
          if (!enumDef.values.includes(value as string)) {
            errors.push({
              path,
              message: `Invalid enum value`,
              code: 'INVALID_ENUM',
              expected: enumDef.values.join(' | '),
              actual: String(value),
            });
          }
        } else {
          // Check custom types
          const typeDef = domain.types.get(typeName);
          if (!typeDef) {
            errors.push({ path, message: `Unknown type: ${typeName}`, code: 'UNKNOWN_TYPE' });
          }
        }
      }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an entity against its definition
 */
export function validateEntity(
  entity: IslEntity,
  entityDef: EntityTypeDef,
  domain: DomainDef,
  path: string = ''
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check entity type
  if (entity.__type !== entityDef.name) {
    errors.push({
      path: `${path}.__type`,
      message: `Entity type mismatch`,
      code: 'TYPE_MISMATCH',
      expected: entityDef.name,
      actual: entity.__type,
    });
  }

  // Check required fields
  for (const field of entityDef.fields) {
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const value = entity[field.name];

    // Required check
    if (!field.type.optional && field.modifiers.includes('required')) {
      if (value === null || value === undefined) {
        errors.push({
          path: fieldPath,
          message: `Field '${field.name}' is required`,
          code: 'REQUIRED',
        });
        continue;
      }
    }

    // Type check
    if (value !== undefined) {
      const typeResult = validateType(value, field.type, domain, fieldPath);
      errors.push(...typeResult.errors);
    }
  }

  // Check for unknown fields
  const knownFields = new Set(['__type', '__id', ...entityDef.fields.map(f => f.name)]);
  for (const key of Object.keys(entity)) {
    if (!knownFields.has(key)) {
      errors.push({
        path: `${path}.${key}`,
        message: `Unknown field '${key}'`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate value against constraints
 */
export function validateConstraints(
  value: IslValue,
  constraints: TypeConstraints,
  path: string = ''
): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value === 'number') {
    if (constraints.min !== undefined && value < constraints.min) {
      errors.push({
        path,
        message: `Value must be >= ${constraints.min}`,
        code: 'MIN_VALUE',
        expected: `>= ${constraints.min}`,
        actual: String(value),
      });
    }
    if (constraints.max !== undefined && value > constraints.max) {
      errors.push({
        path,
        message: `Value must be <= ${constraints.max}`,
        code: 'MAX_VALUE',
        expected: `<= ${constraints.max}`,
        actual: String(value),
      });
    }
  }

  if (typeof value === 'string') {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      errors.push({
        path,
        message: `String must be at least ${constraints.minLength} characters`,
        code: 'MIN_LENGTH',
        expected: `>= ${constraints.minLength} chars`,
        actual: `${value.length} chars`,
      });
    }
    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${constraints.maxLength} characters`,
        code: 'MAX_LENGTH',
        expected: `<= ${constraints.maxLength} chars`,
        actual: `${value.length} chars`,
      });
    }
    if (constraints.pattern && !constraints.pattern.test(value)) {
      errors.push({
        path,
        message: `String does not match pattern`,
        code: 'PATTERN_MISMATCH',
        expected: constraints.pattern.toString(),
        actual: value,
      });
    }
    if (constraints.enum && !constraints.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${constraints.enum.join(', ')}`,
        code: 'ENUM_MISMATCH',
        expected: constraints.enum.join(' | '),
        actual: value,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
