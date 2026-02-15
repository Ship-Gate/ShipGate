// ============================================================================
// ISL JVM Code Generator - Java Type Mapping
// ============================================================================

import type {
  TypeDeclaration,
  TypeDefinition,
  ConstrainedType,
  EnumType,
  StructType,
  UnionType,
  Constraint,
  Field,
} from '@isl-lang/parser';
import type { GeneratorOptions } from '../generator';

// ============================================================================
// IMPORTS GENERATOR
// ============================================================================

export function generateJavaTypeImports(def: TypeDefinition): string[] {
  const imports = new Set<string>();

  collectImports(def, imports);

  return Array.from(imports).sort();
}

function collectImports(def: TypeDefinition, imports: Set<string>): void {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'UUID':
          imports.add('import java.util.UUID;');
          break;
        case 'Timestamp':
          imports.add('import java.time.Instant;');
          break;
        case 'Decimal':
          imports.add('import java.math.BigDecimal;');
          break;
        case 'Duration':
          imports.add('import java.time.Duration;');
          break;
      }
      break;
    case 'ListType':
      imports.add('import java.util.List;');
      collectImports(def.element, imports);
      break;
    case 'MapType':
      imports.add('import java.util.Map;');
      collectImports(def.key, imports);
      collectImports(def.value, imports);
      break;
    case 'OptionalType':
      imports.add('import java.util.Optional;');
      collectImports(def.inner, imports);
      break;
    case 'ConstrainedType':
      collectImports(def.base, imports);
      break;
    case 'StructType':
      for (const field of def.fields) {
        collectImports(field.type, imports);
      }
      break;
    case 'UnionType':
      for (const variant of def.variants) {
        for (const field of variant.fields) {
          collectImports(field.type, imports);
        }
      }
      break;
  }
}

// ============================================================================
// TYPE GENERATOR
// ============================================================================

export function generateJavaTypes(
  type: TypeDeclaration,
  options: GeneratorOptions
): string {
  const name = type.name.name;
  const def = type.definition;

  switch (def.kind) {
    case 'ConstrainedType':
      return generateConstrainedType(name, def, options);
    case 'EnumType':
      return generateEnumType(name, def, options);
    case 'StructType':
      return generateStructType(name, def, options);
    case 'UnionType':
      return generateUnionType(name, def, options);
    default:
      return generateTypeAlias(name, def, options);
  }
}

// ============================================================================
// CONSTRAINED TYPE (Value Object)
// ============================================================================

function generateConstrainedType(
  name: string,
  def: ConstrainedType,
  _options: GeneratorOptions
): string {
  const baseType = javaBaseType(def.base);
  const lines: string[] = [];
  const validationLines: string[] = [];

  // Generate validation code from constraints
  for (const constraint of def.constraints) {
    const validation = generateConstraintValidation(constraint, 'value');
    if (validation) {
      validationLines.push(validation);
    }
  }

  // Add custom validation annotation if has pattern
  const formatConstraint = def.constraints.find(c => c.name === 'format');
  if (formatConstraint) {
    lines.push(generateValidationAnnotation(name, formatConstraint));
    lines.push('');
  }

  // Generate record with validation
  lines.push(`public record ${name}(${baseType} value) {`);
  
  if (validationLines.length > 0) {
    lines.push(`    public ${name} {`);
    for (const validation of validationLines) {
      lines.push(`        ${validation}`);
    }
    lines.push('    }');
  }

  // Add factory method
  lines.push('');
  lines.push(`    public static ${name} of(${baseType} value) {`);
  lines.push(`        return new ${name}(value);`);
  lines.push('    }');

  lines.push('}');
  return lines.join('\n');
}

function generateConstraintValidation(constraint: Constraint, varName: string): string | null {
  switch (constraint.name) {
    case 'format':
      if (constraint.value.kind === 'RegexLiteral') {
        const pattern = escapeJavaString(constraint.value.pattern);
        return `if (!${varName}.matches("${pattern}")) {
            throw new IllegalArgumentException("Invalid format for ${varName}");
        }`;
      }
      break;
    case 'min_length':
      if (constraint.value.kind === 'NumberLiteral') {
        return `if (${varName}.length() < ${constraint.value.value}) {
            throw new IllegalArgumentException("${varName} must be at least ${constraint.value.value} characters");
        }`;
      }
      break;
    case 'max_length':
      if (constraint.value.kind === 'NumberLiteral') {
        return `if (${varName}.length() > ${constraint.value.value}) {
            throw new IllegalArgumentException("${varName} must be at most ${constraint.value.value} characters");
        }`;
      }
      break;
    case 'min':
      if (constraint.value.kind === 'NumberLiteral') {
        return `if (${varName} < ${constraint.value.value}) {
            throw new IllegalArgumentException("${varName} must be at least ${constraint.value.value}");
        }`;
      }
      break;
    case 'max':
      if (constraint.value.kind === 'NumberLiteral') {
        return `if (${varName} > ${constraint.value.value}) {
            throw new IllegalArgumentException("${varName} must be at most ${constraint.value.value}");
        }`;
      }
      break;
    case 'precision':
      if (constraint.value.kind === 'NumberLiteral') {
        return `// Precision constraint: ${constraint.value.value} decimal places`;
      }
      break;
  }
  return null;
}

function generateValidationAnnotation(name: string, constraint: Constraint): string {
  if (constraint.value.kind !== 'RegexLiteral') return '';

  const pattern = escapeJavaString(constraint.value.pattern);
  return `@jakarta.validation.Constraint(validatedBy = {})
@java.lang.annotation.Target({java.lang.annotation.ElementType.TYPE_USE, java.lang.annotation.ElementType.PARAMETER})
@java.lang.annotation.Retention(java.lang.annotation.RetentionPolicy.RUNTIME)
@jakarta.validation.constraints.Pattern(regexp = "${pattern}")
public @interface Valid${name} {
    String message() default "Invalid ${name}";
    Class<?>[] groups() default {};
    Class<? extends jakarta.validation.Payload>[] payload() default {};
}`;
}

// ============================================================================
// ENUM TYPE
// ============================================================================

function generateEnumType(
  name: string,
  def: EnumType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`public enum ${name} {`);

  const variants = def.variants.map((v, idx) => {
    const comma = idx < def.variants.length - 1 ? ',' : '';
    if (v.value) {
      // Enum with explicit value - use litKind from Literal type
      if (v.value.litKind === 'number') {
        // Cast to access runtime value property
        const numValue = (v.value as unknown as { value: number }).value;
        return `    ${v.name.name}(${numValue})${comma}`;
      } else if (v.value.litKind === 'string') {
        const strValue = (v.value as unknown as { value: string }).value;
        return `    ${v.name.name}("${strValue}")${comma}`;
      }
    }
    return `    ${v.name.name}${comma}`;
  });

  lines.push(variants.join('\n'));

  // Check if any variant has an explicit value
  const hasValues = def.variants.some(v => v.value);
  if (hasValues) {
    const firstValue = def.variants.find(v => v.value)?.value;
    const valueType = firstValue?.litKind === 'number' ? 'int' : 'String';
    
    lines.push('    ;');
    lines.push('');
    lines.push(`    private final ${valueType} value;`);
    lines.push('');
    lines.push(`    ${name}(${valueType} value) {`);
    lines.push('        this.value = value;');
    lines.push('    }');
    lines.push('');
    lines.push(`    public ${valueType} getValue() {`);
    lines.push('        return value;');
    lines.push('    }');
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// STRUCT TYPE
// ============================================================================

function generateStructType(
  name: string,
  def: StructType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`public record ${name}(`);

  const fieldLines = def.fields.map((field, idx) => {
    const type = javaFieldType(field);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < def.fields.length - 1 ? ',' : '';
    const nullable = field.optional ? '@jakarta.annotation.Nullable ' : '';
    return `    ${nullable}${type} ${fieldName}${comma}`;
  });

  lines.push(fieldLines.join('\n'));
  lines.push(') {}');

  return lines.join('\n');
}

// ============================================================================
// UNION TYPE (Sealed Interface)
// ============================================================================

function generateUnionType(
  name: string,
  def: UnionType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`public sealed interface ${name} {`);

  for (const variant of def.variants) {
    if (variant.fields.length === 0) {
      lines.push(`    record ${variant.name.name}() implements ${name} {}`);
    } else {
      lines.push(`    record ${variant.name.name}(`);
      const fieldLines = variant.fields.map((field, idx) => {
        const type = javaFieldType(field);
        const fieldName = toCamelCase(field.name.name);
        const comma = idx < variant.fields.length - 1 ? ',' : '';
        return `        ${type} ${fieldName}${comma}`;
      });
      lines.push(fieldLines.join('\n'));
      lines.push(`    ) implements ${name} {}`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// TYPE ALIAS
// ============================================================================

function generateTypeAlias(
  name: string,
  def: TypeDefinition,
  _options: GeneratorOptions
): string {
  const baseType = javaBaseType(def);
  return `public record ${name}(${baseType} value) {
    public static ${name} of(${baseType} value) {
        return new ${name}(value);
    }
}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function javaBaseType(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'int';
        case 'Decimal': return 'BigDecimal';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'Duration';
        default: return 'Object';
      }
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return javaBaseType(def.base);
    default:
      return 'Object';
  }
}

function javaFieldType(field: Field): string {
  const base = javaTypeFromDef(field.type);
  return field.optional ? base : base;
}

function javaTypeFromDef(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Integer';
        case 'Decimal': return 'BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'Duration';
        default: return 'Object';
      }
    case 'ListType':
      return `List<${javaTypeFromDef(def.element)}>`;
    case 'MapType':
      return `Map<${javaTypeFromDef(def.key)}, ${javaTypeFromDef(def.value)}>`;
    case 'OptionalType':
      return javaTypeFromDef(def.inner);
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return javaTypeFromDef(def.base);
    default:
      return 'Object';
  }
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function escapeJavaString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
