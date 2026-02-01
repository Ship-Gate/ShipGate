// ============================================================================
// Go Validation Tag Generator
// Generates go-playground/validator tags from ISL constraints
// ============================================================================

import type {
  Field,
  TypeDefinition,
  ConstrainedType,
  Constraint,
  Annotation,
  NumberLiteral,
  StringLiteral,
  RegexLiteral,
} from './ast-types.js';

/**
 * Generate validation tag for a field
 */
export function generateValidationTag(field: Field): string | null {
  const rules: string[] = [];

  // Required if not optional
  if (!field.optional) {
    rules.push('required');
  }

  // Get constraints from type
  const typeConstraints = extractConstraints(field.type);
  rules.push(...typeConstraints);

  // Get constraints from annotations
  const annotationConstraints = extractAnnotationConstraints(field.annotations);
  rules.push(...annotationConstraints);

  if (rules.length === 0) {
    return null;
  }

  return `validate:"${rules.join(',')}"`;
}

/**
 * Extract validation rules from type constraints
 */
function extractConstraints(typeDef: TypeDefinition): string[] {
  if (typeDef.kind !== 'ConstrainedType') {
    return [];
  }

  const constrainedType = typeDef as ConstrainedType;
  const rules: string[] = [];

  for (const constraint of constrainedType.constraints) {
    const rule = constraintToValidationRule(constraint);
    if (rule) {
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * Convert a single constraint to validation rule
 */
function constraintToValidationRule(constraint: Constraint): string | null {
  const name = constraint.name.toLowerCase();
  const value = constraint.value;

  switch (name) {
    // Length constraints
    case 'min_length':
    case 'minlength':
      if (value.kind === 'NumberLiteral') {
        return `min=${(value as NumberLiteral).value}`;
      }
      break;

    case 'max_length':
    case 'maxlength':
      if (value.kind === 'NumberLiteral') {
        return `max=${(value as NumberLiteral).value}`;
      }
      break;

    case 'length':
      if (value.kind === 'NumberLiteral') {
        return `len=${(value as NumberLiteral).value}`;
      }
      break;

    // Numeric constraints
    case 'min':
      if (value.kind === 'NumberLiteral') {
        return `min=${(value as NumberLiteral).value}`;
      }
      break;

    case 'max':
      if (value.kind === 'NumberLiteral') {
        return `max=${(value as NumberLiteral).value}`;
      }
      break;

    case 'gt':
      if (value.kind === 'NumberLiteral') {
        return `gt=${(value as NumberLiteral).value}`;
      }
      break;

    case 'gte':
      if (value.kind === 'NumberLiteral') {
        return `gte=${(value as NumberLiteral).value}`;
      }
      break;

    case 'lt':
      if (value.kind === 'NumberLiteral') {
        return `lt=${(value as NumberLiteral).value}`;
      }
      break;

    case 'lte':
      if (value.kind === 'NumberLiteral') {
        return `lte=${(value as NumberLiteral).value}`;
      }
      break;

    // Format constraints
    case 'format':
      if (value.kind === 'RegexLiteral') {
        // For regex, we'll need a custom validator
        return null; // Handled separately
      }
      if (value.kind === 'StringLiteral') {
        const format = (value as StringLiteral).value;
        return mapFormatToValidator(format);
      }
      break;

    case 'pattern':
      // Regex patterns require custom validator
      return null;

    case 'email':
      return 'email';

    case 'url':
      return 'url';

    case 'uuid':
      return 'uuid';

    // Precision for decimals
    case 'precision':
      // Not directly supported, handled in type
      return null;

    default:
      // Unknown constraint
      return null;
  }

  return null;
}

/**
 * Map common format names to validator tags
 */
function mapFormatToValidator(format: string): string | null {
  const formatMap: Record<string, string> = {
    email: 'email',
    url: 'url',
    uri: 'uri',
    uuid: 'uuid',
    ipv4: 'ipv4',
    ipv6: 'ipv6',
    ip: 'ip',
    cidr: 'cidr',
    mac: 'mac',
    hostname: 'hostname',
    fqdn: 'fqdn',
    alpha: 'alpha',
    alphanum: 'alphanum',
    numeric: 'numeric',
    hexadecimal: 'hexadecimal',
    base64: 'base64',
    json: 'json',
    jwt: 'jwt',
    creditcard: 'credit_card',
    isbn: 'isbn',
    isbn10: 'isbn10',
    isbn13: 'isbn13',
    ssn: 'ssn',
    lowercase: 'lowercase',
    uppercase: 'uppercase',
  };

  return formatMap[format.toLowerCase()] ?? null;
}

/**
 * Extract validation rules from annotations
 */
function extractAnnotationConstraints(annotations: Annotation[]): string[] {
  const rules: string[] = [];

  for (const annotation of annotations) {
    const name = annotation.name.name.toLowerCase();

    switch (name) {
      case 'email':
        rules.push('email');
        break;

      case 'url':
        rules.push('url');
        break;

      case 'uuid':
        rules.push('uuid');
        break;

      case 'unique':
        // Not a validation concern, handled at DB level
        break;

      case 'indexed':
        // Not a validation concern
        break;

      case 'required':
        if (!rules.includes('required')) {
          rules.push('required');
        }
        break;

      case 'nonempty':
        rules.push('required');
        break;

      default:
        // Check for validation-like annotations with values
        if (annotation.value) {
          const rule = processAnnotationValue(name, annotation.value);
          if (rule) {
            rules.push(rule);
          }
        }
    }
  }

  return rules;
}

/**
 * Process annotation with value
 */
function processAnnotationValue(name: string, value: unknown): string | null {
  // Type guard for expression-like objects
  const expr = value as { kind?: string; value?: unknown };
  
  switch (name) {
    case 'min':
      if (expr.kind === 'NumberLiteral') {
        return `min=${(expr as NumberLiteral).value}`;
      }
      break;

    case 'max':
      if (expr.kind === 'NumberLiteral') {
        return `max=${(expr as NumberLiteral).value}`;
      }
      break;

    case 'len':
    case 'length':
      if (expr.kind === 'NumberLiteral') {
        return `len=${(expr as NumberLiteral).value}`;
      }
      break;

    case 'oneof':
      if (expr.kind === 'StringLiteral') {
        return `oneof=${(expr as StringLiteral).value}`;
      }
      break;
  }

  return null;
}

/**
 * Generate custom validation function for regex patterns
 */
export function generateRegexValidator(
  typeName: string,
  pattern: string
): string {
  const funcName = `validate${typeName}`;
  const lines: string[] = [];

  lines.push(`var ${typeName}Pattern = regexp.MustCompile(\`${pattern}\`)`);
  lines.push('');
  lines.push(`// ${funcName} validates the ${typeName} format.`);
  lines.push(`func ${funcName}(fl validator.FieldLevel) bool {`);
  lines.push(`\treturn ${typeName}Pattern.MatchString(fl.Field().String())`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate validation registration code
 */
export function generateValidatorRegistration(
  customValidators: Map<string, string>
): string {
  if (customValidators.size === 0) {
    return '';
  }

  const lines: string[] = [];
  
  lines.push('// RegisterCustomValidators registers custom validation functions.');
  lines.push('func RegisterCustomValidators(v *validator.Validate) error {');
  
  for (const [name, funcName] of customValidators) {
    lines.push(`\tif err := v.RegisterValidation("${name}", ${funcName}); err != nil {`);
    lines.push(`\t\treturn err`);
    lines.push(`\t}`);
  }
  
  lines.push('\treturn nil');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate struct-level validation method
 */
export function generateStructValidator(structName: string): string {
  const lines: string[] = [];

  lines.push(`// Validate validates the ${structName} struct.`);
  lines.push(`func (s *${structName}) Validate() error {`);
  lines.push('\tvalidate := validator.New()');
  lines.push('\treturn validate.Struct(s)');
  lines.push('}');

  return lines.join('\n');
}
