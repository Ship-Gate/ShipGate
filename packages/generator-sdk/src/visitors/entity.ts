/**
 * Entity Visitor
 *
 * Base implementation for visiting entity declarations.
 */

import type {
  EntityDeclaration,
  FieldDeclaration,
} from '@isl-lang/isl-core';

import type {
  GeneratedFile,
  GeneratorContext,
  VisitorResult,
  EntityVisitor,
} from '../types.js';

// ============================================================================
// Entity Visitor Base Class
// ============================================================================

/**
 * Base class for entity visitors.
 *
 * Provides utilities for processing entity declarations and their fields.
 *
 * @example
 * ```typescript
 * class MyEntityVisitor extends EntityVisitorBase {
 *   visitEntity(entity: EntityDeclaration, ctx: GeneratorContext): GeneratedFile[] {
 *     return [{
 *       path: `entities/${this.toFileName(entity)}.ts`,
 *       content: this.generateEntityCode(entity),
 *     }];
 *   }
 *
 *   private generateEntityCode(entity: EntityDeclaration): string {
 *     const fields = this.getFields(entity);
 *     return `interface ${entity.name.name} {\n${fields.map(f =>
 *       `  ${f.name.name}: ${this.fieldTypeToString(f)};`
 *     ).join('\n')}\n}`;
 *   }
 * }
 * ```
 */
export abstract class EntityVisitorBase implements EntityVisitor {
  /**
   * Visit an entity declaration.
   * Must be implemented by subclasses.
   */
  abstract visitEntity(
    entity: EntityDeclaration,
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called before visiting any entities.
   * Override to generate pre-entity files.
   */
  beforeEntities?(
    entities: EntityDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called after visiting all entities.
   * Override to generate post-entity files (e.g., index).
   */
  afterEntities?(
    entities: EntityDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get all fields from an entity.
   */
  protected getFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields;
  }

  /**
   * Get required fields (non-optional).
   */
  protected getRequiredFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields.filter((f) => !f.optional);
  }

  /**
   * Get optional fields.
   */
  protected getOptionalFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields.filter((f) => f.optional);
  }

  /**
   * Check if a field has a specific annotation.
   */
  protected hasAnnotation(field: FieldDeclaration, name: string): boolean {
    return field.annotations.some(
      (a) => a.name.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get annotation value if present.
   */
  protected getAnnotation(
    field: FieldDeclaration,
    name: string
  ): unknown | undefined {
    const annotation = field.annotations.find(
      (a) => a.name.name.toLowerCase() === name.toLowerCase()
    );
    return annotation?.value;
  }

  /**
   * Get immutable fields.
   */
  protected getImmutableFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields.filter((f) => this.hasAnnotation(f, 'immutable'));
  }

  /**
   * Get mutable fields (non-immutable, non-computed).
   */
  protected getMutableFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields.filter(
      (f) => !this.hasAnnotation(f, 'immutable') && !this.hasAnnotation(f, 'computed')
    );
  }

  /**
   * Get computed fields.
   */
  protected getComputedFields(entity: EntityDeclaration): FieldDeclaration[] {
    return entity.fields.filter((f) => this.hasAnnotation(f, 'computed'));
  }

  /**
   * Get the ID field (conventionally named 'id').
   */
  protected getIdField(entity: EntityDeclaration): FieldDeclaration | undefined {
    return entity.fields.find(
      (f) => f.name.name === 'id' || this.hasAnnotation(f, 'id')
    );
  }

  /**
   * Convert entity name to a file name.
   */
  protected toFileName(
    entity: EntityDeclaration,
    style: 'kebab' | 'snake' | 'camel' | 'pascal' = 'kebab'
  ): string {
    const name = entity.name.name;
    switch (style) {
      case 'kebab':
        return this.toKebabCase(name);
      case 'snake':
        return this.toSnakeCase(name);
      case 'camel':
        return this.toCamelCase(name);
      case 'pascal':
        return name;
      default:
        return name;
    }
  }

  /**
   * Convert field type to a string representation.
   */
  protected fieldTypeToString(field: FieldDeclaration): string {
    return this.typeExpressionToString(field.type);
  }

  /**
   * Convert a type expression to a string.
   */
  protected typeExpressionToString(type: unknown): string {
    const typeObj = type as { kind: string; name?: { name: string }; typeArguments?: unknown[]; variants?: unknown[]; fields?: unknown[]; elementType?: unknown };

    switch (typeObj.kind) {
      case 'SimpleType':
        return typeObj.name?.name ?? 'unknown';
      case 'GenericType': {
        const args = typeObj.typeArguments?.map((t) => this.typeExpressionToString(t)).join(', ') ?? '';
        return `${typeObj.name?.name}<${args}>`;
      }
      case 'ArrayType':
        return `${this.typeExpressionToString(typeObj.elementType)}[]`;
      case 'UnionType': {
        const variants = typeObj.variants as Array<{ name: { name: string } }>;
        return variants.map((v) => v.name.name).join(' | ');
      }
      default:
        return 'unknown';
    }
  }

  // ==========================================================================
  // Case Conversion Utilities
  // ==========================================================================

  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }

  protected toSnakeCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  protected toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  protected toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Configuration for creating an entity visitor.
 */
export interface EntityVisitorConfig {
  visitEntity: (
    entity: EntityDeclaration,
    context: GeneratorContext
  ) => VisitorResult;
  beforeEntities?: (
    entities: EntityDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
  afterEntities?: (
    entities: EntityDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
}

/**
 * Create an entity visitor from configuration.
 */
export function createEntityVisitor(config: EntityVisitorConfig): EntityVisitor {
  return {
    visitEntity: config.visitEntity,
    beforeEntities: config.beforeEntities,
    afterEntities: config.afterEntities,
  };
}
