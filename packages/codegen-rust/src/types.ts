// ============================================================================
// ISL Types → Rust Types Mapping
// ============================================================================

import type { TypeDefinition, Constraint } from './ast-types';

export interface RustType {
  /** The Rust type string (e.g., "String", "Vec<Email>") */
  type: string;
  /** Whether this type needs to be imported */
  imports: RustImport[];
  /** Whether this is a custom type that needs definition */
  isCustom: boolean;
  /** Validation attributes if any */
  validationAttrs: string[];
}

export interface RustImport {
  crate: string;
  items: string[];
}

/**
 * Map ISL primitive types to Rust types
 */
export function mapPrimitiveType(name: string): RustType {
  switch (name) {
    case 'String':
      return {
        type: 'String',
        imports: [],
        isCustom: false,
        validationAttrs: [],
      };

    case 'Int':
      return {
        type: 'i64',
        imports: [],
        isCustom: false,
        validationAttrs: [],
      };

    case 'Decimal':
      return {
        type: 'rust_decimal::Decimal',
        imports: [{ crate: 'rust_decimal', items: ['Decimal'] }],
        isCustom: false,
        validationAttrs: [],
      };

    case 'Boolean':
      return {
        type: 'bool',
        imports: [],
        isCustom: false,
        validationAttrs: [],
      };

    case 'Timestamp':
      return {
        type: 'DateTime<Utc>',
        imports: [{ crate: 'chrono', items: ['DateTime', 'Utc'] }],
        isCustom: false,
        validationAttrs: [],
      };

    case 'UUID':
      return {
        type: 'Uuid',
        imports: [{ crate: 'uuid', items: ['Uuid'] }],
        isCustom: false,
        validationAttrs: [],
      };

    case 'Duration':
      return {
        type: 'chrono::Duration',
        imports: [{ crate: 'chrono', items: ['Duration'] }],
        isCustom: false,
        validationAttrs: [],
      };

    default:
      // Unknown primitive, treat as custom type reference
      return {
        type: name,
        imports: [],
        isCustom: true,
        validationAttrs: [],
      };
  }
}

/**
 * Map ISL type definition to Rust type
 */
export function mapType(typeDef: TypeDefinition): RustType {
  switch (typeDef.kind) {
    case 'PrimitiveType':
      return mapPrimitiveType(typeDef.name);

    case 'ReferenceType': {
      const name = typeDef.name.parts.map(p => p.name).join('::');
      return {
        type: name,
        imports: [],
        isCustom: true,
        validationAttrs: [],
      };
    }

    case 'ConstrainedType': {
      const baseType = mapType(typeDef.base);
      const validationAttrs = mapConstraintsToValidation(typeDef.constraints);
      return {
        ...baseType,
        validationAttrs: [...baseType.validationAttrs, ...validationAttrs],
      };
    }

    case 'ListType': {
      const elementType = mapType(typeDef.element);
      return {
        type: `Vec<${elementType.type}>`,
        imports: elementType.imports,
        isCustom: false,
        validationAttrs: [],
      };
    }

    case 'MapType': {
      const keyType = mapType(typeDef.key);
      const valueType = mapType(typeDef.value);
      return {
        type: `HashMap<${keyType.type}, ${valueType.type}>`,
        imports: [
          { crate: 'std::collections', items: ['HashMap'] },
          ...keyType.imports,
          ...valueType.imports,
        ],
        isCustom: false,
        validationAttrs: [],
      };
    }

    case 'OptionalType': {
      const innerType = mapType(typeDef.inner);
      return {
        type: `Option<${innerType.type}>`,
        imports: innerType.imports,
        isCustom: false,
        validationAttrs: [],
      };
    }

    case 'EnumType':
      // Enums are handled separately in structs.ts
      return {
        type: 'ENUM_PLACEHOLDER',
        imports: [],
        isCustom: true,
        validationAttrs: [],
      };

    case 'StructType':
      // Structs are handled separately
      return {
        type: 'STRUCT_PLACEHOLDER',
        imports: [],
        isCustom: true,
        validationAttrs: [],
      };

    case 'UnionType':
      // Unions become Rust enums
      return {
        type: 'UNION_PLACEHOLDER',
        imports: [],
        isCustom: true,
        validationAttrs: [],
      };

    default:
      return {
        type: 'Unknown',
        imports: [],
        isCustom: false,
        validationAttrs: [],
      };
  }
}

/**
 * Map ISL constraints to Rust validator attributes
 */
export function mapConstraintsToValidation(constraints: Constraint[]): string[] {
  const attrs: string[] = [];

  for (const constraint of constraints) {
    switch (constraint.name) {
      case 'minLength':
      case 'min_length':
        attrs.push(`length(min = ${extractValue(constraint.value)})`);
        break;

      case 'maxLength':
      case 'max_length':
        attrs.push(`length(max = ${extractValue(constraint.value)})`);
        break;

      case 'min':
        attrs.push(`range(min = ${extractValue(constraint.value)})`);
        break;

      case 'max':
        attrs.push(`range(max = ${extractValue(constraint.value)})`);
        break;

      case 'pattern':
      case 'regex':
        attrs.push(`regex(path = "RE_${constraint.name.toUpperCase()}")`);
        break;

      case 'format':
        const format = extractStringValue(constraint.value);
        if (format === 'email') {
          attrs.push('email');
        } else if (format === 'url') {
          attrs.push('url');
        }
        break;

      case 'positive':
        attrs.push('range(min = 1)');
        break;

      case 'non_negative':
        attrs.push('range(min = 0)');
        break;
    }
  }

  return attrs;
}

/**
 * Extract numeric value from constraint expression
 */
function extractValue(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return '0';
  const e = expr as { kind?: string; value?: unknown };
  if (e.kind === 'NumberLiteral') {
    return String(e.value);
  }
  return '0';
}

/**
 * Extract string value from constraint expression
 */
function extractStringValue(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return '';
  const e = expr as { kind?: string; value?: unknown };
  if (e.kind === 'StringLiteral') {
    return String(e.value);
  }
  return '';
}

/**
 * Convert ISL type name to Rust-idiomatic name (PascalCase)
 */
export function toRustTypeName(name: string): string {
  // Already PascalCase
  return name;
}

/**
 * Convert name to snake_case for Rust field/function names
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert name to SCREAMING_SNAKE_CASE for constants
 */
export function toScreamingSnakeCase(name: string): string {
  return toSnakeCase(name).toUpperCase();
}

/**
 * Merge imports, deduplicating items
 */
export function mergeImports(imports: RustImport[]): RustImport[] {
  const importMap = new Map<string, Set<string>>();

  for (const imp of imports) {
    const existing = importMap.get(imp.crate);
    if (existing) {
      imp.items.forEach(item => existing.add(item));
    } else {
      importMap.set(imp.crate, new Set(imp.items));
    }
  }

  return Array.from(importMap.entries()).map(([crate, items]) => ({
    crate,
    items: Array.from(items).sort(),
  }));
}

/**
 * Generate import statements
 */
export function generateImports(imports: RustImport[]): string {
  const merged = mergeImports(imports);
  const lines: string[] = [];

  for (const imp of merged) {
    if (imp.items.length === 1) {
      lines.push(`use ${imp.crate}::${imp.items[0]};`);
    } else {
      lines.push(`use ${imp.crate}::{${imp.items.join(', ')}};`);
    }
  }

  return lines.join('\n');
}
