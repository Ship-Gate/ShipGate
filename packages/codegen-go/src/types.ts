// ============================================================================
// ISL to Go Type Mapping
// ============================================================================

import type {
  TypeDefinition,
  PrimitiveType,
  ConstrainedType,
  ListType,
  MapType,
  OptionalType,
  ReferenceType,
  Annotation,
} from './ast-types.js';

// Go import tracking
export interface GoImports {
  standard: Set<string>;
  external: Set<string>;
}

// Type mapping result
export interface GoTypeResult {
  typeName: string;
  imports: GoImports;
  isPointer?: boolean;
}

// Primitive type mapping
const PRIMITIVE_MAP: Record<string, { goType: string; imports: string[] }> = {
  String: { goType: 'string', imports: [] },
  Int: { goType: 'int64', imports: [] },
  Decimal: { goType: 'decimal.Decimal', imports: ['github.com/shopspring/decimal'] },
  Boolean: { goType: 'bool', imports: [] },
  Timestamp: { goType: 'time.Time', imports: ['time'] },
  UUID: { goType: 'uuid.UUID', imports: ['github.com/google/uuid'] },
  Duration: { goType: 'time.Duration', imports: ['time'] },
};

/**
 * Map ISL type to Go type
 */
export function mapType(typeDef: TypeDefinition, typeRegistry: Map<string, string> = new Map()): GoTypeResult {
  const imports: GoImports = { standard: new Set(), external: new Set() };

  switch (typeDef.kind) {
    case 'PrimitiveType':
      return mapPrimitiveType(typeDef);

    case 'ConstrainedType':
      return mapConstrainedType(typeDef, typeRegistry);

    case 'EnumType':
      // Enum types are handled separately, return string as placeholder
      return { typeName: 'string', imports };

    case 'StructType':
      // Struct types are handled separately
      return { typeName: 'struct{}', imports };

    case 'UnionType':
      // Union types become interfaces in Go
      return { typeName: 'interface{}', imports };

    case 'ListType':
      return mapListType(typeDef, typeRegistry);

    case 'MapType':
      return mapMapType(typeDef, typeRegistry);

    case 'OptionalType':
      return mapOptionalType(typeDef, typeRegistry);

    case 'ReferenceType':
      return mapReferenceType(typeDef, typeRegistry);

    default:
      return { typeName: 'interface{}', imports };
  }
}

/**
 * Map primitive type to Go type
 */
function mapPrimitiveType(typeDef: PrimitiveType): GoTypeResult {
  const mapping = PRIMITIVE_MAP[typeDef.name];
  const imports: GoImports = { standard: new Set(), external: new Set() };

  if (!mapping) {
    return { typeName: 'interface{}', imports };
  }

  for (const imp of mapping.imports) {
    if (imp.includes('/')) {
      imports.external.add(imp);
    } else {
      imports.standard.add(imp);
    }
  }

  return { typeName: mapping.goType, imports };
}

/**
 * Map constrained type - returns the base type
 */
function mapConstrainedType(typeDef: ConstrainedType, typeRegistry: Map<string, string>): GoTypeResult {
  return mapType(typeDef.base, typeRegistry);
}

/**
 * Map list type to Go slice
 */
function mapListType(typeDef: ListType, typeRegistry: Map<string, string>): GoTypeResult {
  const elementResult = mapType(typeDef.element, typeRegistry);
  return {
    typeName: `[]${elementResult.typeName}`,
    imports: elementResult.imports,
  };
}

/**
 * Map map type to Go map
 */
function mapMapType(typeDef: MapType, typeRegistry: Map<string, string>): GoTypeResult {
  const keyResult = mapType(typeDef.key, typeRegistry);
  const valueResult = mapType(typeDef.value, typeRegistry);

  const imports: GoImports = { standard: new Set(), external: new Set() };
  
  // Merge imports
  keyResult.imports.standard.forEach(i => imports.standard.add(i));
  keyResult.imports.external.forEach(i => imports.external.add(i));
  valueResult.imports.standard.forEach(i => imports.standard.add(i));
  valueResult.imports.external.forEach(i => imports.external.add(i));

  return {
    typeName: `map[${keyResult.typeName}]${valueResult.typeName}`,
    imports,
  };
}

/**
 * Map optional type to Go pointer
 */
function mapOptionalType(typeDef: OptionalType, typeRegistry: Map<string, string>): GoTypeResult {
  const innerResult = mapType(typeDef.inner, typeRegistry);
  return {
    typeName: `*${innerResult.typeName}`,
    imports: innerResult.imports,
    isPointer: true,
  };
}

/**
 * Map reference type
 */
function mapReferenceType(typeDef: ReferenceType, typeRegistry: Map<string, string>): GoTypeResult {
  const imports: GoImports = { standard: new Set(), external: new Set() };
  
  // Get the qualified name
  const parts = typeDef.name.parts.map(p => p.name);
  const fullName = parts.join('.');
  const simpleName = parts[parts.length - 1] ?? fullName;

  // Check if it's a registered type
  const registeredType = typeRegistry.get(simpleName);
  if (registeredType) {
    return { typeName: registeredType, imports };
  }

  // Check if it's a primitive type name
  if (PRIMITIVE_MAP[simpleName]) {
    return mapPrimitiveType({ kind: 'PrimitiveType', name: simpleName as PrimitiveType['name'], location: typeDef.location });
  }

  return { typeName: simpleName, imports };
}

/**
 * Convert ISL name to Go exported name (PascalCase)
 */
export function toGoName(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert ISL name to Go unexported name (camelCase)
 */
export function toGoPrivateName(name: string): string {
  const pascalName = toGoName(name);
  return pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
}

/**
 * Convert to snake_case for json tags
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert to SCREAMING_SNAKE_CASE for constants
 */
export function toScreamingSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
}

/**
 * Generate JSON tag for field
 */
export function generateJsonTag(fieldName: string, optional: boolean): string {
  const jsonName = toSnakeCase(fieldName);
  if (optional) {
    return `json:"${jsonName},omitempty"`;
  }
  return `json:"${jsonName}"`;
}

/**
 * Check if annotation indicates a sensitive field
 */
export function isSensitiveField(annotations: Annotation[]): boolean {
  const sensitiveAnnotations = ['secret', 'sensitive', 'pii'];
  return annotations.some(a => sensitiveAnnotations.includes(a.name.name.toLowerCase()));
}

/**
 * Check if annotation indicates an immutable field
 */
export function isImmutableField(annotations: Annotation[]): boolean {
  return annotations.some(a => a.name.name.toLowerCase() === 'immutable');
}

/**
 * Check if annotation indicates a unique field
 */
export function isUniqueField(annotations: Annotation[]): boolean {
  return annotations.some(a => a.name.name.toLowerCase() === 'unique');
}

/**
 * Check if annotation indicates an indexed field
 */
export function isIndexedField(annotations: Annotation[]): boolean {
  return annotations.some(a => a.name.name.toLowerCase() === 'indexed');
}

/**
 * Get Go zero value for type
 */
export function getZeroValue(goType: string): string {
  if (goType.startsWith('*')) return 'nil';
  if (goType.startsWith('[]')) return 'nil';
  if (goType.startsWith('map[')) return 'nil';
  if (goType === 'string') return '""';
  if (goType === 'bool') return 'false';
  if (goType.includes('int') || goType.includes('float')) return '0';
  if (goType === 'time.Time') return 'time.Time{}';
  if (goType === 'uuid.UUID') return 'uuid.Nil';
  if (goType === 'decimal.Decimal') return 'decimal.Zero';
  return `${goType}{}`;
}

/**
 * Merge two GoImports
 */
export function mergeImports(a: GoImports, b: GoImports): GoImports {
  return {
    standard: new Set([...a.standard, ...b.standard]),
    external: new Set([...a.external, ...b.external]),
  };
}

/**
 * Create empty imports
 */
export function emptyImports(): GoImports {
  return { standard: new Set(), external: new Set() };
}
