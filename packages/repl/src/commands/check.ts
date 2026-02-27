// ============================================================================
// Check Command
// Type-check the current domain
// ============================================================================

import type { Domain, CommandResult, CheckResult, CheckError, CheckWarning } from '../types.js';

/**
 * Perform comprehensive domain checking
 */
export function checkCommand(domain: Domain | null): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  const errors: CheckError[] = [];
  const warnings: CheckWarning[] = [];

  // Check entities
  for (const entity of domain.entities) {
    checkEntity(entity, domain, errors, warnings);
  }

  // Check behaviors
  for (const behavior of domain.behaviors) {
    checkBehavior(behavior, domain, errors, warnings);
  }

  // Check types
  for (const type of domain.types) {
    checkType(type, domain, errors, warnings);
  }

  // Check invariants
  for (const invariant of domain.invariants) {
    checkInvariant(invariant, domain, errors, warnings);
  }

  // Build result message
  const lines: string[] = [];
  
  if (errors.length === 0 && warnings.length === 0) {
    lines.push(`✓ Domain '${domain.name.name}' is valid`);
    lines.push('');
    lines.push('Summary:');
    lines.push(`  ${domain.entities.length} entities checked`);
    lines.push(`  ${domain.behaviors.length} behaviors checked`);
    lines.push(`  ${domain.types.length} types checked`);
  } else {
    if (errors.length > 0) {
      lines.push(`✗ ${errors.length} error(s) found:`);
      for (const error of errors) {
        const loc = error.location 
          ? ` at ${error.location.line}:${error.location.column}` 
          : '';
        lines.push(`  • ${error.message}${loc}`);
      }
    }

    if (warnings.length > 0) {
      if (errors.length > 0) lines.push('');
      lines.push(`⚠ ${warnings.length} warning(s):`);
      for (const warning of warnings) {
        const loc = warning.location 
          ? ` at ${warning.location.line}:${warning.location.column}` 
          : '';
        lines.push(`  • ${warning.message}${loc}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    message: lines.join('\n'),
    data: { errors, warnings },
  };
}

/**
 * Check entity
 */
function checkEntity(
  entity: Domain['entities'][0],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[]
): void {
  // Check for duplicate field names
  const fieldNames = new Set<string>();
  for (const field of entity.fields) {
    if (fieldNames.has(field.name.name)) {
      errors.push({
        message: `Duplicate field '${field.name.name}' in entity '${entity.name.name}'`,
        code: 'E001',
      });
    }
    fieldNames.add(field.name.name);
  }

  // Check field types
  for (const field of entity.fields) {
    checkTypeReference(field.type, domain, errors, warnings, `${entity.name.name}.${field.name.name}`);
  }

  // Check lifecycle
  if (entity.lifecycle) {
    const stateNames = new Set(entity.lifecycle.states.map(s => s.name));
    
    for (const transition of entity.lifecycle.transitions) {
      if (transition.from !== '*' && !stateNames.has(transition.from)) {
        errors.push({
          message: `Unknown state '${transition.from}' in lifecycle of '${entity.name.name}'`,
          code: 'E002',
        });
      }
      if (!stateNames.has(transition.to)) {
        errors.push({
          message: `Unknown state '${transition.to}' in lifecycle of '${entity.name.name}'`,
          code: 'E002',
        });
      }
    }
  }

  // Warn if entity has no fields
  if (entity.fields.length === 0) {
    warnings.push({
      message: `Entity '${entity.name.name}' has no fields`,
    });
  }
}

/**
 * Check behavior
 */
function checkBehavior(
  behavior: Domain['behaviors'][0],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[]
): void {
  // Check input fields
  const inputNames = new Set<string>();
  for (const field of behavior.input.fields) {
    if (inputNames.has(field.name.name)) {
      errors.push({
        message: `Duplicate input field '${field.name.name}' in behavior '${behavior.name.name}'`,
        code: 'E003',
      });
    }
    inputNames.add(field.name.name);
    
    checkTypeReference(
      field.type, 
      domain, 
      errors, 
      warnings, 
      `${behavior.name.name}.input.${field.name.name}`
    );
  }

  // Check output type
  checkTypeReference(
    behavior.output.success,
    domain,
    errors,
    warnings,
    `${behavior.name.name}.output.success`
  );

  // Check error names are unique
  const errorNames = new Set<string>();
  for (const error of behavior.output.errors) {
    if (errorNames.has(error.name.name)) {
      errors.push({
        message: `Duplicate error '${error.name.name}' in behavior '${behavior.name.name}'`,
        code: 'E004',
      });
    }
    errorNames.add(error.name.name);
  }

  // Check side effects reference valid entities
  for (const effect of behavior.sideEffects) {
    const entity = domain.entities.find(e => e.name.name === effect.entity.name);
    if (!entity) {
      errors.push({
        message: `Unknown entity '${effect.entity.name}' in side effects of '${behavior.name.name}'`,
        code: 'E005',
      });
    }
  }

  // Warn if behavior has no input
  if (behavior.input.fields.length === 0) {
    warnings.push({
      message: `Behavior '${behavior.name.name}' has no input fields`,
    });
  }
}

/**
 * Check type declaration
 */
function checkType(
  type: Domain['types'][0],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[]
): void {
  checkTypeDefinition(type.definition, domain, errors, warnings, type.name.name);
}

/**
 * Check type definition
 */
function checkTypeDefinition(
  type: Domain['types'][0]['definition'],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[],
  context: string
): void {
  switch (type.kind) {
    case 'EnumType':
      // Check for duplicate variants
      const variants = new Set<string>();
      for (const variant of type.variants) {
        if (variants.has(variant.name.name)) {
          errors.push({
            message: `Duplicate enum variant '${variant.name.name}' in '${context}'`,
            code: 'E006',
          });
        }
        variants.add(variant.name.name);
      }
      
      // Warn if enum has no variants
      if (type.variants.length === 0) {
        warnings.push({
          message: `Enum '${context}' has no variants`,
        });
      }
      break;

    case 'StructType':
      const fields = new Set<string>();
      for (const field of type.fields) {
        if (fields.has(field.name.name)) {
          errors.push({
            message: `Duplicate field '${field.name.name}' in struct '${context}'`,
            code: 'E001',
          });
        }
        fields.add(field.name.name);
        checkTypeReference(field.type, domain, errors, warnings, `${context}.${field.name.name}`);
      }
      break;

    case 'UnionType':
      const unionVariants = new Set<string>();
      for (const variant of type.variants) {
        if (unionVariants.has(variant.name.name)) {
          errors.push({
            message: `Duplicate union variant '${variant.name.name}' in '${context}'`,
            code: 'E006',
          });
        }
        unionVariants.add(variant.name.name);
      }
      break;

    case 'ListType':
      checkTypeReference(type.element, domain, errors, warnings, `${context}[]`);
      break;

    case 'MapType':
      checkTypeReference(type.key, domain, errors, warnings, `${context}.key`);
      checkTypeReference(type.value, domain, errors, warnings, `${context}.value`);
      break;

    case 'OptionalType':
      checkTypeReference(type.inner, domain, errors, warnings, `${context}?`);
      break;

    case 'ConstrainedType':
      checkTypeReference(type.base, domain, errors, warnings, context);
      break;
  }
}

/**
 * Check type reference
 */
function checkTypeReference(
  type: Domain['types'][0]['definition'],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[],
  context: string
): void {
  if (type.kind === 'ReferenceType') {
    const name = type.name.name;
    
    // Check if it's a known type
    const isEntity = domain.entities.some(e => e.name.name === name);
    const isType = domain.types.some(t => t.name.name === name);
    const isPrimitive = ['String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration'].includes(name);
    
    if (!isEntity && !isType && !isPrimitive) {
      errors.push({
        message: `Unknown type '${name}' referenced in '${context}'`,
        code: 'E007',
      });
    }
  }

  // Recursively check nested types
  checkTypeDefinition(type, domain, errors, warnings, context);
}

/**
 * Check invariant block
 */
function checkInvariant(
  invariant: Domain['invariants'][0],
  domain: Domain,
  errors: CheckError[],
  warnings: CheckWarning[]
): void {
  // Check that invariant expressions are valid
  // This would require expression type checking
  if (invariant.conditions.length === 0) {
    warnings.push({
      message: `Invariant block '${invariant.name?.name ?? 'unnamed'}' has no conditions`,
    });
  }
}

/**
 * Get check summary
 */
export function getCheckSummary(result: CheckResult): string {
  if (result.success) {
    return '✓ All checks passed';
  }
  return `✗ ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
}
