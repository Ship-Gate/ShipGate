/**
 * Adapter functions to convert DomainDeclaration from @isl-lang/parser
 * to the simplified types expected by codegen-python and codegen-graphql
 */

import type { Domain as ParserDomain, Entity, Behavior, Field, TypeDeclaration, TypeDefinition } from '@isl-lang/parser';
import type { IslDomain, IslEntity, IslBehavior, IslField, IslEnum, IslType } from '@isl-lang/codegen-python';
import type { Domain as GraphQLDomain, Entity as GraphQLEntity, Behavior as GraphQLBehavior, Field as GraphQLField } from '@isl-lang/codegen-graphql';

/**
 * Convert ISL type definition to string representation
 */
function typeToString(type: TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'ReferenceType':
      return type.name.name;
    case 'OptionalType':
      return `${typeToString(type.inner)}?`;
    case 'ListType':
      return `List<${typeToString(type.element)}>`;
    case 'MapType':
      return `Map<${typeToString(type.key)}, ${typeToString(type.value)}>`;
    case 'EnumType':
      return 'String'; // Enums are handled separately
    case 'StructType':
      return 'Object';
    case 'UnionType':
      return 'Union';
    case 'ConstrainedType':
      return typeToString(type.base);
    default:
      return 'String';
  }
}

/**
 * Convert parser Field to Python IslField
 */
function fieldToPython(field: Field): IslField {
  return {
    name: field.name.name,
    type: typeToString(field.type),
    optional: field.optional,
    modifiers: field.annotations.map(a => a.name.name),
    default: field.defaultValue ? String(field.defaultValue) : undefined,
  };
}

/**
 * Convert parser Domain to Python IslDomain
 */
export function domainToPython(domain: ParserDomain): IslDomain {
  return {
    name: domain.name.name,
    version: domain.version.value,
    entities: domain.entities.map(entityToPython),
    behaviors: domain.behaviors.map(behaviorToPython),
    enums: domain.types
      .filter(t => t.definition.kind === 'EnumType')
      .map(t => ({
        name: t.name.name,
        values: (t.definition as { variants: Array<{ name: { name: string } }> }).variants.map(v => v.name.name),
      })),
    types: domain.types
      .filter(t => t.definition.kind !== 'EnumType')
      .map(t => ({
        name: t.name.name,
        baseType: typeToString(t.definition),
        constraints: {},
      })),
  };
}

/**
 * Convert parser Entity to Python IslEntity
 */
function entityToPython(entity: Entity): IslEntity {
  return {
    name: entity.name.name,
    fields: entity.fields.map(fieldToPython),
    invariants: entity.invariants.map(e => String(e)),
    lifecycle: undefined, // Not used in Python generator
  };
}

/**
 * Convert parser Behavior to Python IslBehavior
 */
function behaviorToPython(behavior: Behavior): IslBehavior {
  return {
    name: behavior.name.name,
    description: behavior.description?.value,
    input: behavior.input.fields.map(fieldToPython),
    output: {
      success: typeToString(behavior.output.success),
      errors: behavior.output.errors.map(e => ({
        code: e.name.name,
        message: e.when?.value,
      })),
    },
    preconditions: behavior.preconditions.map(e => String(e)),
    postconditions: behavior.postconditions.map(p => p.predicates.map(e => String(e)).join(' && ')),
  };
}

/**
 * Convert parser Field to GraphQL Field
 */
function fieldToGraphQL(field: Field): GraphQLField {
  return {
    name: field.name.name,
    type: typeToString(field.type),
    optional: field.optional,
    annotations: field.annotations.map(a => a.name.name),
  };
}

/**
 * Convert parser Domain to GraphQL Domain
 */
export function domainToGraphQL(domain: ParserDomain): GraphQLDomain {
  return {
    name: domain.name.name,
    version: domain.version.value,
    types: domain.types
      .filter(t => t.definition.kind !== 'EnumType')
      .map(t => ({
        name: t.name.name,
        baseType: typeToString(t.definition),
        constraints: [],
      })),
    entities: domain.entities.map(entityToGraphQL),
    behaviors: domain.behaviors.map(behaviorToGraphQL),
  };
}

/**
 * Convert parser Entity to GraphQL Entity
 */
function entityToGraphQL(entity: Entity): GraphQLEntity {
  return {
    name: entity.name.name,
    fields: entity.fields.map(fieldToGraphQL),
  };
}

/**
 * Convert parser Behavior to GraphQL Behavior
 */
function behaviorToGraphQL(behavior: Behavior): GraphQLBehavior {
  return {
    name: behavior.name.name,
    inputs: behavior.input.fields.map(fieldToGraphQL),
    outputType: typeToString(behavior.output.success),
    errors: behavior.output.errors.map(e => e.name.name),
  };
}
