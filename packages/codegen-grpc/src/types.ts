// ============================================================================
// ISL Type Definitions for gRPC Code Generation
// 
// Re-exports AST types from isl-core with aliases for convenience
// ============================================================================

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  EntityDeclaration,
  FieldDeclaration,
  TypeDeclaration,
  TypeExpression,
  TypeConstraint,
  LifecycleBlock,
  LifecycleTransition,
  SecurityBlock,
  SecurityRequirement,
  ComplianceBlock,
  ComplianceRequirement,
  InputBlock,
  OutputBlock,
  ErrorDeclaration,
  NumberLiteral,
  StringLiteral,
  Identifier,
  UnionType,
  TypeVariant,
} from '@isl-lang/isl-core';

// Re-export with aliases for convenience
export type Domain = DomainDeclaration;
export type Behavior = BehaviorDeclaration;
export type Entity = EntityDeclaration;
export type Field = FieldDeclaration;
export type LifecycleSpec = LifecycleBlock;
export type SecuritySpec = SecurityRequirement;
export type ComplianceSpec = ComplianceRequirement;
export type ErrorSpec = ErrorDeclaration;
export type InputSpec = InputBlock;
export type OutputSpec = OutputBlock;
export type Constraint = TypeConstraint;

// Re-export actual types
export type {
  DomainDeclaration,
  BehaviorDeclaration,
  EntityDeclaration,
  FieldDeclaration,
  TypeDeclaration,
  TypeExpression,
  TypeConstraint,
  LifecycleBlock,
  LifecycleTransition,
  SecurityBlock,
  SecurityRequirement,
  ComplianceBlock,
  ComplianceRequirement,
  InputBlock,
  OutputBlock,
  ErrorDeclaration,
  NumberLiteral,
  StringLiteral,
  Identifier,
  UnionType,
  TypeVariant,
};

// ============================================================================
// Type Definition Mappings
// 
// The code generation expects a different type hierarchy than the AST.
// These types provide the expected interface.
// ============================================================================

/**
 * Type definition that can be used in proto generation
 */
export type TypeDefinition =
  | PrimitiveType
  | ReferenceType
  | ListType
  | MapType
  | OptionalType
  | ConstrainedType
  | EnumType
  | StructType
  | UnionTypeDefinition;

export interface PrimitiveType {
  kind: 'PrimitiveType';
  name: string;
}

export interface ReferenceType {
  kind: 'ReferenceType';
  name: {
    parts: Array<{ name: string }>;
  };
}

export interface ListType {
  kind: 'ListType';
  element: TypeDefinition;
}

export interface MapType {
  kind: 'MapType';
  key: TypeDefinition;
  value: TypeDefinition;
}

export interface OptionalType {
  kind: 'OptionalType';
  inner: TypeDefinition;
}

export interface ConstrainedType {
  kind: 'ConstrainedType';
  base: TypeDefinition;
  constraints: ConstraintDefinition[];
}

export interface EnumType {
  kind: 'EnumType';
  variants: Array<{ name: { name: string } }>;
}

export interface StructType {
  kind: 'StructType';
  fields: Array<{
    name: { name: string };
    type: TypeDefinition;
    optional: boolean;
  }>;
}

export interface UnionTypeDefinition {
  kind: 'UnionType';
  variants: Array<{
    name: { name: string };
    fields?: Array<{
      name: { name: string };
      type: TypeDefinition;
      optional: boolean;
    }>;
  }>;
}

export interface ConstraintDefinition {
  name: string;
  value: NumberLiteral | StringLiteral | RegexLiteral;
}

export interface RegexLiteral {
  kind: 'RegexLiteral';
  pattern: string;
}

// ============================================================================
// Helper functions to convert AST types to TypeDefinition
// ============================================================================

/**
 * Convert a TypeExpression from the AST to a TypeDefinition
 */
export function toTypeDefinition(type: TypeExpression): TypeDefinition {
  switch (type.kind) {
    case 'SimpleType':
      // Check if it's a primitive type
      if (isPrimitiveTypeName(type.name.name)) {
        return { kind: 'PrimitiveType', name: type.name.name };
      }
      // Otherwise it's a reference
      return {
        kind: 'ReferenceType',
        name: { parts: [{ name: type.name.name }] },
      };

    case 'GenericType':
      if (type.name.name === 'List' || type.name.name === 'Array') {
        return {
          kind: 'ListType',
          element: toTypeDefinition(type.typeArguments[0]),
        };
      }
      if (type.name.name === 'Map') {
        return {
          kind: 'MapType',
          key: toTypeDefinition(type.typeArguments[0]),
          value: toTypeDefinition(type.typeArguments[1]),
        };
      }
      if (type.name.name === 'Optional') {
        return {
          kind: 'OptionalType',
          inner: toTypeDefinition(type.typeArguments[0]),
        };
      }
      // Generic reference type
      return {
        kind: 'ReferenceType',
        name: { parts: [{ name: type.name.name }] },
      };

    case 'ArrayType':
      return {
        kind: 'ListType',
        element: toTypeDefinition(type.elementType),
      };

    case 'UnionType':
      return {
        kind: 'UnionType',
        variants: type.variants.map((v) => ({
          name: { name: v.name.name },
          fields: v.fields?.map((f) => ({
            name: { name: f.name.name },
            type: toTypeDefinition(f.type),
            optional: f.optional,
          })),
        })),
      };

    case 'ObjectType':
      return {
        kind: 'StructType',
        fields: type.fields.map((f) => ({
          name: { name: f.name.name },
          type: toTypeDefinition(f.type),
          optional: f.optional,
        })),
      };

    default:
      // Fallback to string
      return { kind: 'PrimitiveType', name: 'String' };
  }
}

function isPrimitiveTypeName(name: string): boolean {
  return [
    'String',
    'Int',
    'Decimal',
    'Boolean',
    'Timestamp',
    'UUID',
    'Duration',
  ].includes(name);
}

/**
 * Convert TypeDeclaration to have a definition property
 */
export function toTypeDeclarationWithDefinition(
  decl: TypeDeclaration
): TypeDeclarationWithDefinition {
  // Convert baseType to a TypeDefinition
  const definition = toTypeDefinition(decl.baseType);

  // Apply constraints if present
  if (decl.constraints.length > 0) {
    return {
      ...decl,
      definition: {
        kind: 'ConstrainedType',
        base: definition,
        constraints: decl.constraints.map((c) => ({
          name: c.name.name,
          value: c.value as NumberLiteral | StringLiteral | RegexLiteral,
        })),
      },
    };
  }

  return {
    ...decl,
    definition,
  };
}

export interface TypeDeclarationWithDefinition extends TypeDeclaration {
  definition: TypeDefinition;
}
