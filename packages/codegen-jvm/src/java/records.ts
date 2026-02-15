// ============================================================================
// ISL JVM Code Generator - Java Records (Java 17+)
// ============================================================================

import type {
  Entity,
  Field,
  TypeDefinition,
} from '@isl-lang/parser';
import type { GeneratorOptions } from '../generator';

// ============================================================================
// ENTITY RECORD GENERATOR
// ============================================================================

export function generateJavaRecords(
  entity: Entity,
  options: GeneratorOptions
): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Generate Javadoc
  lines.push('/**');
  lines.push(` * Entity: ${name}`);
  lines.push(' * Generated from ISL specification.');
  lines.push(' */');

  // Generate record
  lines.push(`public record ${name}(`);

  const fieldLines = entity.fields.map((field, idx) => {
    const annotations = generateFieldAnnotations(field, options);
    const type = javaType(field.type);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < entity.fields.length - 1 ? ',' : '';
    return `    ${annotations}${type} ${fieldName}${comma}`;
  });

  lines.push(fieldLines.join('\n'));
  lines.push(') {');

  // Generate compact constructor with validation
  const validations = generateValidations(entity, options);
  if (validations.length > 0) {
    lines.push(`    public ${name} {`);
    for (const validation of validations) {
      lines.push(`        ${validation}`);
    }
    lines.push('    }');
  }

  // Generate builder if Java 21+
  if (options.javaVersion === 21) {
    lines.push('');
    lines.push(generateBuilder(entity));
  }

  // Generate factory methods
  lines.push('');
  lines.push(generateFactoryMethods(entity));

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// FIELD ANNOTATIONS
// ============================================================================

function generateFieldAnnotations(field: Field, options: GeneratorOptions): string {
  if (options.generateValidation === false) return '';

  const annotations: string[] = [];

  // Check for specific ISL annotations
  for (const ann of field.annotations) {
    switch (ann.name.name) {
      case 'immutable':
        // Records are immutable by default
        break;
      case 'unique':
        annotations.push('@jakarta.persistence.Column(unique = true)');
        break;
      case 'indexed':
        // Could add @Indexed for specific frameworks
        break;
      case 'secret':
        annotations.push('@com.fasterxml.jackson.annotation.JsonIgnore');
        break;
      case 'pii':
        annotations.push('@PII');
        break;
      case 'sensitive':
        annotations.push('@Sensitive');
        break;
    }
  }

  // Add validation annotations based on type
  if (!field.optional) {
    annotations.push('@NotNull');
  }

  // Check for references annotation
  const references = field.annotations.find(a => a.name.name === 'references');
  if (references && references.value) {
    // This would typically be handled by JPA relations
  }

  if (annotations.length === 0) return '';
  return annotations.join(' ') + ' ';
}

// ============================================================================
// VALIDATION GENERATION
// ============================================================================

function generateValidations(entity: Entity, _options: GeneratorOptions): string[] {
  const validations: string[] = [];

  // Add null checks for non-optional fields
  for (const field of entity.fields) {
    if (!field.optional) {
      const fieldName = toCamelCase(field.name.name);
      validations.push(
        `java.util.Objects.requireNonNull(${fieldName}, "${fieldName} must not be null");`
      );
    }
  }

  // Add invariant validations if entity has invariants
  // These would be converted to runtime checks
  for (const invariant of entity.invariants) {
    const check = generateInvariantCheck(invariant);
    if (check) {
      validations.push(check);
    }
  }

  return validations;
}

function generateInvariantCheck(invariant: any): string | null {
  // Basic support for simple invariant expressions
  if (invariant.kind === 'BinaryExpr') {
    if (invariant.operator === '>=' || invariant.operator === '<=' ||
        invariant.operator === '>' || invariant.operator === '<') {
      const left = expressionToJava(invariant.left);
      const right = expressionToJava(invariant.right);
      return `if (!(${left} ${invariant.operator} ${right})) {
            throw new IllegalArgumentException("Invariant violation: ${left} ${invariant.operator} ${right}");
        }`;
    }
  }
  return null;
}

function expressionToJava(expr: any): string {
  switch (expr.kind) {
    case 'Identifier':
      return toCamelCase(expr.name);
    case 'NumberLiteral':
      return String(expr.value);
    case 'MemberExpr':
      return `${expressionToJava(expr.object)}.${toCamelCase(expr.property.name)}()`;
    default:
      return '/* unknown expression */';
  }
}

// ============================================================================
// BUILDER GENERATION (Java 21+)
// ============================================================================

function generateBuilder(entity: Entity): string {
  const name = entity.name.name;
  const lines: string[] = [];

  lines.push(`    public static Builder builder() {`);
  lines.push(`        return new Builder();`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    public static final class Builder {`);

  // Fields
  for (const field of entity.fields) {
    const type = javaType(field.type);
    const fieldName = toCamelCase(field.name.name);
    lines.push(`        private ${type} ${fieldName};`);
  }
  lines.push('');

  // Setters
  for (const field of entity.fields) {
    const type = javaType(field.type);
    const fieldName = toCamelCase(field.name.name);
    const methodName = toCamelCase(field.name.name);
    lines.push(`        public Builder ${methodName}(${type} ${fieldName}) {`);
    lines.push(`            this.${fieldName} = ${fieldName};`);
    lines.push(`            return this;`);
    lines.push(`        }`);
    lines.push('');
  }

  // Build method
  lines.push(`        public ${name} build() {`);
  const args = entity.fields.map(f => toCamelCase(f.name.name)).join(', ');
  lines.push(`            return new ${name}(${args});`);
  lines.push(`        }`);
  lines.push(`    }`);

  return lines.join('\n');
}

// ============================================================================
// FACTORY METHODS
// ============================================================================

function generateFactoryMethods(entity: Entity): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Find required fields (non-optional, non-generated)
  const requiredFields = entity.fields.filter(f => {
    if (f.optional) return false;
    // Skip auto-generated fields like id, createdAt
    const isAutoGenerated = f.annotations.some(a => 
      a.name.name === 'immutable' || 
      f.name.name === 'id' ||
      f.name.name.includes('created') ||
      f.name.name.includes('updated')
    );
    return !isAutoGenerated;
  });

  // Generate create factory method
  if (requiredFields.length > 0 && requiredFields.length < entity.fields.length) {
    const params = requiredFields.map(f => 
      `${javaType(f.type)} ${toCamelCase(f.name.name)}`
    ).join(', ');

    const args = entity.fields.map(f => {
      const fieldName = toCamelCase(f.name.name);
      if (f.name.name === 'id') {
        return 'java.util.UUID.randomUUID()';
      }
      if (f.name.name.includes('created') || f.name.name.includes('At')) {
        return 'java.time.Instant.now()';
      }
      if (f.optional) {
        return 'null';
      }
      return fieldName;
    }).join(', ');

    lines.push(`    public static ${name} create(${params}) {`);
    lines.push(`        return new ${name}(${args});`);
    lines.push(`    }`);
  }

  return lines.join('\n');
}

// ============================================================================
// TYPE MAPPING
// ============================================================================

function javaType(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Integer';
        case 'Decimal': return 'java.math.BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'java.time.Duration';
        default: return 'Object';
      }
    case 'ListType':
      return `List<${javaType(def.element)}>`;
    case 'MapType':
      return `Map<${javaType(def.key)}, ${javaType(def.value)}>`;
    case 'OptionalType':
      return javaType(def.inner);
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return javaType(def.base);
    default:
      return 'Object';
  }
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
