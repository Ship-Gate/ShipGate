// ============================================================================
// Local Type Definitions (copied from master_contracts to avoid circular deps)
// ============================================================================

// Source location tracking
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

// ============================================================================
// Resolved Types (used during type checking)
// ============================================================================

export type ResolvedType =
  | PrimitiveResolvedType
  | EntityResolvedType
  | EnumResolvedType
  | StructResolvedType
  | ListResolvedType
  | MapResolvedType
  | OptionalResolvedType
  | UnionResolvedType
  | FunctionResolvedType
  | BehaviorResolvedType
  | ErrorResolvedType
  | UnknownResolvedType
  | VoidResolvedType;

export interface PrimitiveResolvedType {
  kind: 'primitive';
  name: string;
  constraints: ResolvedConstraint[];
}

export interface ResolvedConstraint {
  name: string;
  value: unknown;
}

export interface EntityResolvedType {
  kind: 'entity';
  name: string;
  fields: Map<string, ResolvedType>;
  lifecycleStates?: string[];
}

export interface EnumResolvedType {
  kind: 'enum';
  name: string;
  variants: string[];
}

export interface StructResolvedType {
  kind: 'struct';
  name?: string;
  fields: Map<string, ResolvedType>;
}

export interface ListResolvedType {
  kind: 'list';
  element: ResolvedType;
}

export interface MapResolvedType {
  kind: 'map';
  key: ResolvedType;
  value: ResolvedType;
}

export interface OptionalResolvedType {
  kind: 'optional';
  inner: ResolvedType;
}

export interface UnionResolvedType {
  kind: 'union';
  name?: string;
  variants: Map<string, ResolvedType>;
}

export interface FunctionResolvedType {
  kind: 'function';
  params: ResolvedType[];
  returns: ResolvedType;
}

export interface BehaviorResolvedType {
  kind: 'behavior';
  name: string;
  inputFields: Map<string, ResolvedType>;
  outputType: ResolvedType;
  errorTypes: string[];
}

export interface ErrorResolvedType {
  kind: 'error';
  message: string;
}

export interface UnknownResolvedType {
  kind: 'unknown';
}

export interface VoidResolvedType {
  kind: 'void';
}

// ============================================================================
// Symbol Types
// ============================================================================

export type SymbolKind =
  | 'type'
  | 'entity'
  | 'behavior'
  | 'field'
  | 'variable'
  | 'parameter'
  | 'error'
  | 'invariant'
  | 'policy'
  | 'view'
  | 'enum_variant';

export type SymbolModifier =
  | 'immutable'
  | 'unique'
  | 'indexed'
  | 'pii'
  | 'secret'
  | 'sensitive'
  | 'computed'
  | 'optional'
  | 'deprecated';

export interface Symbol {
  name: string;
  kind: SymbolKind;
  type: ResolvedType;
  location: SourceLocation;
  documentation?: string;
  modifiers: SymbolModifier[];
}

// ============================================================================
// Type Utilities
// ============================================================================

export function typeToString(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'entity':
      return type.name;
    case 'enum':
      return type.name;
    case 'struct':
      return type.name || 'struct';
    case 'list':
      return `List<${typeToString(type.element)}>`;
    case 'map':
      return `Map<${typeToString(type.key)}, ${typeToString(type.value)}>`;
    case 'optional':
      return `${typeToString(type.inner)}?`;
    case 'union':
      return type.name || 'union';
    case 'function':
      return `(${type.params.map(typeToString).join(', ')}) => ${typeToString(type.returns)}`;
    case 'behavior':
      return `Behavior<${type.name}>`;
    case 'error':
      return `<error: ${type.message}>`;
    case 'unknown':
      return 'unknown';
    case 'void':
      return 'void';
  }
}

export function typesEqual(a: ResolvedType, b: ResolvedType): boolean {
  if (a.kind !== b.kind) return false;
  
  switch (a.kind) {
    case 'primitive':
      return a.name === (b as PrimitiveResolvedType).name;
    case 'entity':
      return a.name === (b as EntityResolvedType).name;
    case 'enum':
      return a.name === (b as EnumResolvedType).name;
    case 'list':
      return typesEqual(a.element, (b as ListResolvedType).element);
    case 'map':
      return typesEqual(a.key, (b as MapResolvedType).key) &&
             typesEqual(a.value, (b as MapResolvedType).value);
    case 'optional':
      return typesEqual(a.inner, (b as OptionalResolvedType).inner);
    case 'unknown':
    case 'void':
      return true;
    default:
      return false;
  }
}

export function isAssignableTo(source: ResolvedType, target: ResolvedType): boolean {
  // Unknown/error types are assignable to anything (to avoid cascading errors)
  if (source.kind === 'unknown' || source.kind === 'error') return true;
  if (target.kind === 'unknown') return true;
  
  // Optional types: non-optional can be assigned to optional
  if (target.kind === 'optional') {
    return isAssignableTo(source, target.inner);
  }
  
  // Same type check
  if (typesEqual(source, target)) return true;
  
  // Numeric coercion: Int can be assigned to Decimal
  if (source.kind === 'primitive' && target.kind === 'primitive') {
    if (source.name === 'Int' && target.name === 'Decimal') return true;
  }
  
  return false;
}

// Primitive type helpers
export const PRIMITIVE_TYPES = ['String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration'] as const;

export function isPrimitiveTypeName(name: string): boolean {
  return (PRIMITIVE_TYPES as readonly string[]).includes(name);
}

export function createPrimitiveType(name: string): PrimitiveResolvedType {
  return { kind: 'primitive', name, constraints: [] };
}

export const BOOLEAN_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'Boolean', constraints: [] };
export const STRING_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'String', constraints: [] };
export const INT_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'Int', constraints: [] };
export const DECIMAL_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'Decimal', constraints: [] };
export const TIMESTAMP_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'Timestamp', constraints: [] };
export const UUID_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'UUID', constraints: [] };
export const DURATION_TYPE: PrimitiveResolvedType = { kind: 'primitive', name: 'Duration', constraints: [] };
export const UNKNOWN_TYPE: UnknownResolvedType = { kind: 'unknown' };
export const VOID_TYPE: VoidResolvedType = { kind: 'void' };
