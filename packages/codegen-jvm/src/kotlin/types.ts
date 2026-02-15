// ============================================================================
// ISL JVM Code Generator - Kotlin Type Mapping
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

export function generateKotlinTypeImports(): string[] {
  return [
    'import java.util.UUID',
    'import java.time.Instant',
    'import java.time.Duration',
    'import java.math.BigDecimal',
  ];
}

// ============================================================================
// TYPE GENERATOR
// ============================================================================

export function generateKotlinTypes(
  type: TypeDeclaration,
  options: GeneratorOptions
): string {
  const name = type.name.name;
  const def = type.definition;

  switch (def.kind) {
    case 'ConstrainedType':
      return generateValueClass(name, def, options);
    case 'EnumType':
      return generateEnumClass(name, def, options);
    case 'StructType':
      return generateDataClassFromStruct(name, def, options);
    case 'UnionType':
      return generateSealedClassFromUnion(name, def, options);
    default:
      return generateTypeAlias(name, def, options);
  }
}

// ============================================================================
// VALUE CLASS (inline class)
// ============================================================================

function generateValueClass(
  name: string,
  def: ConstrainedType,
  _options: GeneratorOptions
): string {
  const baseType = kotlinBaseType(def.base);
  const lines: string[] = [];

  // Generate KDoc
  lines.push('/**');
  lines.push(` * Value class for ${name}`);
  lines.push(' */');

  // Generate value class
  lines.push('@JvmInline');
  lines.push(`value class ${name}(val value: ${baseType}) {`);

  // Generate init block with validation
  const validations = generateKotlinValidations(def.constraints, 'value');
  if (validations.length > 0) {
    lines.push('    init {');
    for (const validation of validations) {
      lines.push(`        ${validation}`);
    }
    lines.push('    }');
  }

  // Companion object with factory
  lines.push('');
  lines.push('    companion object {');
  lines.push(`        fun of(value: ${baseType}): ${name} = ${name}(value)`);
  lines.push('    }');

  lines.push('}');

  return lines.join('\n');
}

function generateKotlinValidations(constraints: Constraint[], varName: string): string[] {
  const validations: string[] = [];

  for (const constraint of constraints) {
    switch (constraint.name) {
      case 'format':
        if (constraint.value.kind === 'RegexLiteral') {
          const pattern = escapeKotlinString(constraint.value.pattern);
          validations.push(
            `require(${varName}.matches(Regex("${pattern}"))) { "Invalid ${varName} format" }`
          );
        }
        break;
      case 'min_length':
        if (constraint.value.kind === 'NumberLiteral') {
          validations.push(
            `require(${varName}.length >= ${constraint.value.value}) { "${varName} must be at least ${constraint.value.value} characters" }`
          );
        }
        break;
      case 'max_length':
        if (constraint.value.kind === 'NumberLiteral') {
          validations.push(
            `require(${varName}.length <= ${constraint.value.value}) { "${varName} must be at most ${constraint.value.value} characters" }`
          );
        }
        break;
      case 'min':
        if (constraint.value.kind === 'NumberLiteral') {
          validations.push(
            `require(${varName} >= ${constraint.value.value}) { "${varName} must be at least ${constraint.value.value}" }`
          );
        }
        break;
      case 'max':
        if (constraint.value.kind === 'NumberLiteral') {
          validations.push(
            `require(${varName} <= ${constraint.value.value}) { "${varName} must be at most ${constraint.value.value}" }`
          );
        }
        break;
    }
  }

  return validations;
}

// ============================================================================
// ENUM CLASS
// ============================================================================

function generateEnumClass(
  name: string,
  def: EnumType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];
  const hasValues = def.variants.some(v => v.value);

  if (hasValues) {
    const firstValue = def.variants.find(v => v.value)?.value;
    const valueType = firstValue?.litKind === 'number' ? 'Int' : 'String';

    lines.push(`enum class ${name}(val value: ${valueType}) {`);

    const variants = def.variants.map((v, idx) => {
      const comma = idx < def.variants.length - 1 ? ',' : ';';
      if (v.value) {
        // Use litKind from Literal type to determine value type
        if (v.value.litKind === 'number') {
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
  } else {
    lines.push(`enum class ${name} {`);

    const variants = def.variants.map((v, idx) => {
      const comma = idx < def.variants.length - 1 ? ',' : '';
      return `    ${v.name.name}${comma}`;
    });

    lines.push(variants.join('\n'));
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// DATA CLASS FROM STRUCT
// ============================================================================

function generateDataClassFromStruct(
  name: string,
  def: StructType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`data class ${name}(`);

  const fieldLines = def.fields.map((field, idx) => {
    const type = kotlinFieldType(field);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < def.fields.length - 1 ? ',' : '';
    const defaultValue = field.optional ? ' = null' : '';
    return `    val ${fieldName}: ${type}${defaultValue}${comma}`;
  });

  lines.push(fieldLines.join('\n'));
  lines.push(')');

  return lines.join('\n');
}

// ============================================================================
// SEALED CLASS FROM UNION
// ============================================================================

function generateSealedClassFromUnion(
  name: string,
  def: UnionType,
  _options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`sealed class ${name} {`);

  for (const variant of def.variants) {
    if (variant.fields.length === 0) {
      lines.push(`    data object ${variant.name.name} : ${name}()`);
    } else {
      lines.push(`    data class ${variant.name.name}(`);
      const fieldLines = variant.fields.map((field, idx) => {
        const type = kotlinFieldType(field);
        const fieldName = toCamelCase(field.name.name);
        const comma = idx < variant.fields.length - 1 ? ',' : '';
        return `        val ${fieldName}: ${type}${comma}`;
      });
      lines.push(fieldLines.join('\n'));
      lines.push(`    ) : ${name}()`);
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
  const baseType = kotlinBaseType(def);
  return `typealias ${name} = ${baseType}`;
}

// ============================================================================
// TYPE MAPPING
// ============================================================================

function kotlinBaseType(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Int';
        case 'Decimal': return 'BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'Duration';
        default: return 'Any';
      }
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return kotlinBaseType(def.base);
    default:
      return 'Any';
  }
}

function kotlinFieldType(field: Field): string {
  const base = kotlinTypeFromDef(field.type);
  return field.optional ? `${base}?` : base;
}

export function kotlinTypeFromDef(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Int';
        case 'Decimal': return 'BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'Duration';
        default: return 'Any';
      }
    case 'ListType':
      return `List<${kotlinTypeFromDef(def.element)}>`;
    case 'MapType':
      return `Map<${kotlinTypeFromDef(def.key)}, ${kotlinTypeFromDef(def.value)}>`;
    case 'OptionalType':
      return `${kotlinTypeFromDef(def.inner)}?`;
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return kotlinTypeFromDef(def.base);
    default:
      return 'Any';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function escapeKotlinString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
