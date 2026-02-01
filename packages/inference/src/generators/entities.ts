/**
 * Entity Generator
 *
 * Generate ISL entity specifications from extracted types.
 */

import type { ExtractedType, ExtractedField, ExtractedValidation } from '../analyzer.js';

export interface GeneratedEntity {
  name: string;
  fields: ExtractedField[];
  isEnum: boolean;
  enumValues?: string[];
  invariants: string[];
}

/**
 * Generate entity specifications from extracted types
 */
export function generateEntities(
  types: ExtractedType[],
  validations: ExtractedValidation[]
): GeneratedEntity[] {
  const entities: GeneratedEntity[] = [];

  for (const type of types) {
    if (type.isEnum) {
      entities.push({
        name: type.name,
        fields: [],
        isEnum: true,
        enumValues: type.enumValues,
        invariants: [],
      });
    } else {
      const entityInvariants = deriveInvariants(type, validations);
      const enhancedFields = enhanceFields(type.fields);

      entities.push({
        name: type.name,
        fields: enhancedFields,
        isEnum: false,
        invariants: entityInvariants,
      });
    }
  }

  return entities;
}

/**
 * Enhance fields with additional annotations based on naming patterns
 */
function enhanceFields(fields: ExtractedField[]): ExtractedField[] {
  return fields.map((field) => {
    const enhanced = { ...field, annotations: [...field.annotations] };

    // ID fields
    if (field.name === 'id' || field.name.endsWith('_id')) {
      if (!enhanced.annotations.includes('immutable')) {
        enhanced.annotations.push('immutable');
      }
      if (field.name === 'id' && !enhanced.annotations.includes('unique')) {
        enhanced.annotations.push('unique');
      }
    }

    // Email fields
    if (field.name === 'email' || field.name.includes('email')) {
      if (!enhanced.annotations.includes('unique')) {
        enhanced.annotations.push('unique');
      }
      enhanced.type = 'Email';
    }

    // Password/secret fields
    if (
      field.name.includes('password') ||
      field.name.includes('secret') ||
      field.name.includes('token') ||
      field.name.includes('key')
    ) {
      if (!enhanced.annotations.includes('secret')) {
        enhanced.annotations.push('secret');
      }
    }

    // Timestamp fields
    if (field.name === 'created_at' || field.name === 'createdAt') {
      if (!enhanced.annotations.includes('immutable')) {
        enhanced.annotations.push('immutable');
      }
      enhanced.type = 'Timestamp';
    }

    if (field.name === 'updated_at' || field.name === 'updatedAt') {
      enhanced.type = 'Timestamp';
    }

    // Status fields (likely indexed)
    if (field.name === 'status' || field.name.endsWith('_status')) {
      if (!enhanced.annotations.includes('indexed')) {
        enhanced.annotations.push('indexed');
      }
    }

    // Default values
    if (field.defaultValue && !enhanced.annotations.some((a) => a.startsWith('default'))) {
      enhanced.annotations.push(`default: ${field.defaultValue}`);
    }

    return enhanced;
  });
}

/**
 * Derive invariants for an entity from its fields and validations
 */
function deriveInvariants(type: ExtractedType, validations: ExtractedValidation[]): string[] {
  const invariants: string[] = [];

  // Find validations related to this entity's fields
  for (const field of type.fields) {
    const fieldValidations = validations.filter(
      (v) => v.field === field.name && v.type === 'invariant'
    );

    for (const validation of fieldValidations) {
      invariants.push(validation.condition);
    }

    // Derive invariants from field constraints
    if (field.type === 'Int' || field.type === 'Float') {
      // Check for common numeric patterns
      if (field.name.includes('count') || field.name.includes('amount')) {
        invariants.push(`${field.name} >= 0`);
      }
      if (field.name.includes('percentage') || field.name.includes('rate')) {
        invariants.push(`${field.name} >= 0`);
        invariants.push(`${field.name} <= 100`);
      }
    }
  }

  // Check for status lifecycle invariants
  const statusField = type.fields.find((f) => f.name === 'status');
  const lockedUntilField = type.fields.find((f) => f.name === 'locked_until');
  if (statusField && lockedUntilField) {
    invariants.push('locked_until != null implies status == LOCKED');
  }

  // Check for failed attempts pattern
  const failedAttemptsField = type.fields.find((f) => f.name === 'failed_attempts');
  if (failedAttemptsField) {
    invariants.push('failed_attempts >= 0');
    invariants.push('failed_attempts <= 10');
  }

  // Check for timestamp ordering
  const createdAt = type.fields.find((f) => f.name === 'created_at');
  const expiresAt = type.fields.find((f) => f.name === 'expires_at');
  if (createdAt && expiresAt) {
    invariants.push('expires_at > created_at');
  }

  return [...new Set(invariants)]; // Remove duplicates
}

/**
 * Detect lifecycle states from enum fields
 */
export function detectLifecycle(
  entity: GeneratedEntity,
  allEntities: GeneratedEntity[]
): string[] | undefined {
  const statusField = entity.fields.find((f) => f.name === 'status');
  if (!statusField) return undefined;

  // Find the enum that matches the status type
  const statusEnum = allEntities.find(
    (e) => e.isEnum && e.name === statusField.type
  );
  if (!statusEnum?.enumValues) return undefined;

  // Generate common lifecycle transitions
  const states = statusEnum.enumValues;
  const transitions: string[] = [];

  // Common patterns
  if (states.includes('PENDING') && states.includes('ACTIVE')) {
    transitions.push('PENDING -> ACTIVE');
  }
  if (states.includes('PENDING_VERIFICATION') && states.includes('ACTIVE')) {
    transitions.push('PENDING_VERIFICATION -> ACTIVE');
  }
  if (states.includes('ACTIVE') && states.includes('LOCKED')) {
    transitions.push('ACTIVE -> LOCKED');
    transitions.push('LOCKED -> ACTIVE');
  }
  if (states.includes('ACTIVE') && states.includes('INACTIVE')) {
    transitions.push('ACTIVE -> INACTIVE');
    transitions.push('INACTIVE -> ACTIVE');
  }
  if (states.includes('ACTIVE') && states.includes('SUSPENDED')) {
    transitions.push('ACTIVE -> SUSPENDED');
    transitions.push('SUSPENDED -> ACTIVE');
  }
  if (states.includes('ACTIVE') && states.includes('DELETED')) {
    transitions.push('ACTIVE -> DELETED');
  }

  return transitions.length > 0 ? transitions : undefined;
}
