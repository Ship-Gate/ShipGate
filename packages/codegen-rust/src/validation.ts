// ============================================================================
// Validator Crate Derives Generation
// ============================================================================

import type { Field, Constraint, TypeDefinition, Annotation } from './ast-types';
import { mapConstraintsToValidation } from './types';

export interface ValidationConfig {
  /** Whether to use the validator crate */
  useValidator: boolean;
  /** Whether to generate custom validation functions */
  generateCustomValidators: boolean;
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  useValidator: true,
  generateCustomValidators: true,
};

/**
 * Generate validation derives
 */
export function generateValidationDerives(config: ValidationConfig = DEFAULT_VALIDATION_CONFIG): string[] {
  if (config.useValidator) {
    return ['Validate'];
  }
  return [];
}

/**
 * Generate validation field attributes
 */
export function generateValidationFieldAttrs(
  field: Field,
  constraints: Constraint[] = []
): string[] {
  const attrs: string[] = [];
  
  // Get validation attributes from constraints
  const validationAttrs = mapConstraintsToValidation(constraints);
  
  // Extract constraints from the field's type if it's constrained
  if (field.type.kind === 'ConstrainedType') {
    const typeConstraints = mapConstraintsToValidation(field.type.constraints);
    validationAttrs.push(...typeConstraints);
  }
  
  // Check field annotations for validation hints
  for (const ann of field.annotations) {
    const name = ann.name.name.toLowerCase();
    
    if (name === 'unique') {
      // Custom validator for uniqueness
      attrs.push('#[validate(custom = "validate_unique")]');
    }
    
    if (name === 'pii' || name === 'sensitive') {
      // Mark for PII handling
      attrs.push('// PII field - handle with care');
    }
  }
  
  // Generate #[validate(...)] attributes
  if (validationAttrs.length > 0) {
    for (const attr of validationAttrs) {
      attrs.push(`#[validate(${attr})]`);
    }
  }
  
  // Nested validation for complex types
  if (needsNestedValidation(field.type)) {
    attrs.push('#[validate(nested)]');
  }
  
  return attrs;
}

/**
 * Check if a type needs nested validation
 */
function needsNestedValidation(typeDef: TypeDefinition): boolean {
  switch (typeDef.kind) {
    case 'ReferenceType':
      return true; // Custom types may have validation
    case 'ListType':
      return needsNestedValidation(typeDef.element);
    case 'OptionalType':
      return needsNestedValidation(typeDef.inner);
    case 'StructType':
      return true;
    default:
      return false;
  }
}

/**
 * Generate validator imports
 */
export function generateValidatorImports(): string {
  return 'use validator::Validate;';
}

/**
 * Generate a custom newtype struct with validation
 */
export function generateValidatedNewtype(
  name: string,
  baseType: string,
  constraints: Constraint[]
): string {
  const validationAttrs = mapConstraintsToValidation(constraints);
  const lines: string[] = [];
  
  // Derive macro
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize, Validate)]');
  
  // Struct definition
  if (validationAttrs.length > 0) {
    const attrStr = validationAttrs.join(', ');
    lines.push(`pub struct ${name}(#[validate(${attrStr})] ${baseType});`);
  } else {
    lines.push(`pub struct ${name}(${baseType});`);
  }
  
  // Implementation
  lines.push('');
  lines.push(`impl ${name} {`);
  lines.push(`    pub fn new(value: impl Into<${baseType}>) -> Result<Self, validator::ValidationErrors> {`);
  lines.push(`        let instance = Self(value.into());`);
  lines.push('        instance.validate()?;');
  lines.push('        Ok(instance)');
  lines.push('    }');
  lines.push('');
  lines.push(`    pub fn into_inner(self) -> ${baseType} {`);
  lines.push('        self.0');
  lines.push('    }');
  lines.push('');
  lines.push(`    pub fn as_inner(&self) -> &${baseType} {`);
  lines.push('        &self.0');
  lines.push('    }');
  lines.push('}');
  
  // Display implementation
  lines.push('');
  lines.push(`impl std::fmt::Display for ${name} {`);
  lines.push('    fn fmt(&self, f: &mut std::fmt::Formatter<\'_>) -> std::fmt::Result {');
  lines.push('        write!(f, "{}", self.0)');
  lines.push('    }');
  lines.push('}');
  
  // From implementation
  lines.push('');
  lines.push(`impl AsRef<${baseType}> for ${name} {`);
  lines.push(`    fn as_ref(&self) -> &${baseType} {`);
  lines.push('        &self.0');
  lines.push('    }');
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate custom validation function stub
 */
export function generateCustomValidator(
  name: string,
  fieldType: string,
  description: string
): string {
  const lines: string[] = [];
  
  lines.push(`/// Custom validator: ${description}`);
  lines.push(`fn validate_${name}(value: &${fieldType}) -> Result<(), validator::ValidationError> {`);
  lines.push('    // TODO: Implement custom validation logic');
  lines.push('    Ok(())');
  lines.push('}');
  
  return lines.join('\n');
}
