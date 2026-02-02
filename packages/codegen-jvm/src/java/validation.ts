// ============================================================================
// ISL JVM Code Generator - Jakarta Validation
// ============================================================================

import type {
  TypeDeclaration,
  TypeDefinition,
  ConstrainedType,
  Constraint,
  Field,
} from '../../../../master_contracts/ast';
import type { GeneratorOptions } from '../generator';

// ============================================================================
// CUSTOM VALIDATOR GENERATOR
// ============================================================================

export function generateJavaValidation(
  type: TypeDeclaration,
  options: GeneratorOptions
): string {
  const name = type.name.name;
  const def = type.definition;

  if (def.kind !== 'ConstrainedType') {
    return '';
  }

  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.validation;`);
  lines.push('');

  // Imports
  lines.push('import jakarta.validation.Constraint;');
  lines.push('import jakarta.validation.ConstraintValidator;');
  lines.push('import jakarta.validation.ConstraintValidatorContext;');
  lines.push('import jakarta.validation.Payload;');
  lines.push('import java.lang.annotation.*;');
  lines.push('');

  // Generate annotation
  lines.push(generateValidationAnnotation(name, def));
  lines.push('');

  // Generate validator
  lines.push(generateValidator(name, def));

  return lines.join('\n');
}

// ============================================================================
// VALIDATION ANNOTATION
// ============================================================================

function generateValidationAnnotation(name: string, _def: ConstrainedType): string {
  const lines: string[] = [];

  lines.push(`@Documented`);
  lines.push(`@Constraint(validatedBy = ${name}Validator.class)`);
  lines.push(`@Target({ElementType.METHOD, ElementType.FIELD, ElementType.ANNOTATION_TYPE, ElementType.CONSTRUCTOR, ElementType.PARAMETER, ElementType.TYPE_USE})`);
  lines.push(`@Retention(RetentionPolicy.RUNTIME)`);
  lines.push(`public @interface Valid${name} {`);
  lines.push(`    String message() default "Invalid ${name}";`);
  lines.push(`    Class<?>[] groups() default {};`);
  lines.push(`    Class<? extends Payload>[] payload() default {};`);
  lines.push(`}`);

  return lines.join('\n');
}

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

function generateValidator(name: string, def: ConstrainedType): string {
  const lines: string[] = [];
  const baseType = getBaseTypeName(def.base);

  lines.push(`public class ${name}Validator implements ConstraintValidator<Valid${name}, ${baseType}> {`);
  lines.push('');

  // Extract format constraint for pattern field
  const formatConstraint = def.constraints.find(c => c.name === 'format');

  // Generate pattern field if needed
  if (formatConstraint && formatConstraint.value.kind === 'RegexLiteral') {
    const pattern = escapeJavaString(formatConstraint.value.pattern);
    lines.push(`    private static final java.util.regex.Pattern PATTERN = `);
    lines.push(`        java.util.regex.Pattern.compile("${pattern}");`);
    lines.push('');
  }

  // Initialize method
  lines.push(`    @Override`);
  lines.push(`    public void initialize(Valid${name} constraintAnnotation) {`);
  lines.push(`        // No initialization needed`);
  lines.push(`    }`);
  lines.push('');

  // isValid method
  lines.push(`    @Override`);
  lines.push(`    public boolean isValid(${baseType} value, ConstraintValidatorContext context) {`);
  lines.push(`        if (value == null) {`);
  lines.push(`            return true; // Null check is done by @NotNull`);
  lines.push(`        }`);
  lines.push('');

  // Generate validation checks
  if (baseType === 'String') {
    generateStringValidations(lines, def.constraints);
  } else if (baseType === 'Integer' || baseType === 'Long' || baseType === 'BigDecimal') {
    generateNumericValidations(lines, def.constraints);
  }

  lines.push('');
  lines.push(`        return true;`);
  lines.push(`    }`);
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// STRING VALIDATIONS
// ============================================================================

function generateStringValidations(lines: string[], constraints: Constraint[]): void {
  for (const constraint of constraints) {
    switch (constraint.name) {
      case 'format':
        if (constraint.value.kind === 'RegexLiteral') {
          lines.push(`        if (!PATTERN.matcher(value).matches()) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
      case 'min_length':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.length() < ${constraint.value.value}) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
      case 'max_length':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.length() > ${constraint.value.value}) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
      case 'length':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.length() != ${constraint.value.value}) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
    }
  }
}

// ============================================================================
// NUMERIC VALIDATIONS
// ============================================================================

function generateNumericValidations(lines: string[], constraints: Constraint[]): void {
  for (const constraint of constraints) {
    switch (constraint.name) {
      case 'min':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.compareTo(new java.math.BigDecimal("${constraint.value.value}")) < 0) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
      case 'max':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.compareTo(new java.math.BigDecimal("${constraint.value.value}")) > 0) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
      case 'precision':
        if (constraint.value.kind === 'NumberLiteral') {
          lines.push(`        if (value.scale() > ${constraint.value.value}) {`);
          lines.push(`            return false;`);
          lines.push(`        }`);
        }
        break;
    }
  }
}

// ============================================================================
// VALIDATION ANNOTATIONS FOR FIELDS
// ============================================================================

export function generateFieldValidationAnnotations(
  field: Field,
  _options: GeneratorOptions
): string[] {
  const annotations: string[] = [];

  if (!field.optional) {
    annotations.push('@NotNull');
  }

  // Check field type for nested constraints
  if (field.type.kind === 'ConstrainedType') {
    const constraints = field.type.constraints;
    for (const constraint of constraints) {
      const ann = constraintToAnnotation(constraint);
      if (ann) {
        annotations.push(ann);
      }
    }
  }

  // Check ISL annotations
  for (const ann of field.annotations) {
    switch (ann.name.name) {
      case 'email':
        annotations.push('@Email');
        break;
      case 'min':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Min(${ann.value.value})`);
        }
        break;
      case 'max':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Max(${ann.value.value})`);
        }
        break;
      case 'size':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Size(max = ${ann.value.value})`);
        }
        break;
      case 'positive':
        annotations.push('@Positive');
        break;
      case 'negative':
        annotations.push('@Negative');
        break;
      case 'past':
        annotations.push('@Past');
        break;
      case 'future':
        annotations.push('@Future');
        break;
    }
  }

  return annotations;
}

function constraintToAnnotation(constraint: Constraint): string | null {
  switch (constraint.name) {
    case 'min_length':
      if (constraint.value.kind === 'NumberLiteral') {
        return `@Size(min = ${constraint.value.value})`;
      }
      break;
    case 'max_length':
      if (constraint.value.kind === 'NumberLiteral') {
        return `@Size(max = ${constraint.value.value})`;
      }
      break;
    case 'min':
      if (constraint.value.kind === 'NumberLiteral') {
        return `@Min(${constraint.value.value})`;
      }
      break;
    case 'max':
      if (constraint.value.kind === 'NumberLiteral') {
        return `@Max(${constraint.value.value})`;
      }
      break;
    case 'format':
      if (constraint.value.kind === 'RegexLiteral') {
        const pattern = escapeJavaString(constraint.value.pattern);
        return `@Pattern(regexp = "${pattern}")`;
      }
      break;
  }
  return null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getBaseTypeName(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Integer';
        case 'Decimal': return 'java.math.BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'java.time.Instant';
        case 'UUID': return 'java.util.UUID';
        default: return 'Object';
      }
    case 'ConstrainedType':
      return getBaseTypeName(def.base);
    default:
      return 'Object';
  }
}

function escapeJavaString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
