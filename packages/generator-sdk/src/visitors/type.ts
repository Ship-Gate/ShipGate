/**
 * Type Visitor
 *
 * Base implementation for visiting type and enum declarations.
 */

import type {
  TypeDeclaration,
  EnumDeclaration,
  TypeExpression,
  TypeConstraint,
} from '@intentos/isl-core';

import type {
  GeneratedFile,
  GeneratorContext,
  VisitorResult,
  TypeVisitor,
} from '../types.js';

// ============================================================================
// Type Visitor Base Class
// ============================================================================

/**
 * Base class for type visitors.
 *
 * Provides utilities for processing type and enum declarations.
 *
 * @example
 * ```typescript
 * class MyTypeVisitor extends TypeVisitorBase {
 *   visitType(type: TypeDeclaration, ctx: GeneratorContext): GeneratedFile[] {
 *     const baseType = this.getBaseTypeName(type);
 *     const constraints = this.getConstraintStrings(type);
 *
 *     return [{
 *       path: `types/${this.toFileName(type)}.ts`,
 *       content: `// Type: ${type.name.name}\n// Base: ${baseType}\n// Constraints: ${constraints.join(', ')}`,
 *     }];
 *   }
 *
 *   visitEnum(enumDecl: EnumDeclaration, ctx: GeneratorContext): GeneratedFile[] {
 *     const variants = this.getEnumVariants(enumDecl);
 *     return [{
 *       path: `enums/${this.toFileName(enumDecl)}.ts`,
 *       content: `enum ${enumDecl.name.name} { ${variants.join(', ')} }`,
 *     }];
 *   }
 * }
 * ```
 */
export abstract class TypeVisitorBase implements TypeVisitor {
  /**
   * Visit a type declaration.
   * Must be implemented by subclasses.
   */
  abstract visitType(
    type: TypeDeclaration,
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Visit an enum declaration.
   * Must be implemented by subclasses.
   */
  abstract visitEnum(
    enumDecl: EnumDeclaration,
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called before visiting any types.
   */
  beforeTypes?(
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called after visiting all types.
   */
  afterTypes?(
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  // ==========================================================================
  // Type Utilities
  // ==========================================================================

  /**
   * Get the base type expression.
   */
  protected getBaseType(type: TypeDeclaration): TypeExpression {
    return type.baseType;
  }

  /**
   * Get the base type name as string.
   */
  protected getBaseTypeName(type: TypeDeclaration): string {
    return this.typeExpressionToString(type.baseType);
  }

  /**
   * Check if type has constraints.
   */
  protected hasConstraints(type: TypeDeclaration): boolean {
    return type.constraints.length > 0;
  }

  /**
   * Get all constraints.
   */
  protected getConstraints(type: TypeDeclaration): TypeConstraint[] {
    return type.constraints;
  }

  /**
   * Get a specific constraint by name.
   */
  protected getConstraint(
    type: TypeDeclaration,
    name: string
  ): TypeConstraint | undefined {
    return type.constraints.find(
      (c) => c.name.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get constraint value.
   */
  protected getConstraintValue(
    type: TypeDeclaration,
    name: string
  ): unknown | undefined {
    const constraint = this.getConstraint(type, name);
    if (!constraint?.value) return undefined;

    const value = constraint.value as { kind: string; value?: unknown };
    return value.value;
  }

  /**
   * Get all constraints as readable strings.
   */
  protected getConstraintStrings(type: TypeDeclaration): string[] {
    return type.constraints.map((c) => {
      const value = c.value as { kind: string; value?: unknown } | undefined;
      if (value?.value !== undefined) {
        return `${c.name.name}: ${value.value}`;
      }
      return c.name.name;
    });
  }

  /**
   * Check if type is a primitive wrapper.
   */
  protected isPrimitiveType(type: TypeDeclaration): boolean {
    const primitives = [
      'String',
      'Int',
      'Float',
      'Boolean',
      'UUID',
      'Email',
      'URL',
      'Phone',
      'Timestamp',
      'Date',
      'Duration',
      'Decimal',
    ];

    const baseName = this.getBaseTypeName(type);
    return primitives.includes(baseName);
  }

  // ==========================================================================
  // Enum Utilities
  // ==========================================================================

  /**
   * Get enum variant names.
   */
  protected getEnumVariants(enumDecl: EnumDeclaration): string[] {
    return enumDecl.variants.map((v) => v.name);
  }

  /**
   * Get enum variant count.
   */
  protected getEnumVariantCount(enumDecl: EnumDeclaration): number {
    return enumDecl.variants.length;
  }

  /**
   * Check if enum has a specific variant.
   */
  protected hasVariant(enumDecl: EnumDeclaration, name: string): boolean {
    return enumDecl.variants.some(
      (v) => v.name.toLowerCase() === name.toLowerCase()
    );
  }

  // ==========================================================================
  // Type Expression Utilities
  // ==========================================================================

  /**
   * Convert type expression to string.
   */
  protected typeExpressionToString(type: TypeExpression): string {
    const typeObj = type as {
      kind: string;
      name?: { name: string };
      typeArguments?: TypeExpression[];
      variants?: Array<{ name: { name: string } }>;
      fields?: Array<{ name: { name: string }; type: TypeExpression; optional?: boolean }>;
      elementType?: TypeExpression;
    };

    switch (typeObj.kind) {
      case 'SimpleType':
        return typeObj.name?.name ?? 'unknown';

      case 'GenericType': {
        const args =
          typeObj.typeArguments?.map((t) => this.typeExpressionToString(t)).join(', ') ?? '';
        return `${typeObj.name?.name}<${args}>`;
      }

      case 'ArrayType':
        return `${this.typeExpressionToString(typeObj.elementType!)}[]`;

      case 'UnionType':
        return typeObj.variants?.map((v) => v.name.name).join(' | ') ?? 'unknown';

      case 'ObjectType': {
        const fields = typeObj.fields?.map((f) => {
          const opt = f.optional ? '?' : '';
          return `${f.name.name}${opt}: ${this.typeExpressionToString(f.type)}`;
        }).join('; ');
        return `{ ${fields} }`;
      }

      default:
        return 'unknown';
    }
  }

  /**
   * Check if type expression is generic.
   */
  protected isGenericType(type: TypeExpression): boolean {
    return (type as { kind: string }).kind === 'GenericType';
  }

  /**
   * Check if type expression is a union.
   */
  protected isUnionType(type: TypeExpression): boolean {
    return (type as { kind: string }).kind === 'UnionType';
  }

  /**
   * Check if type expression is an array.
   */
  protected isArrayType(type: TypeExpression): boolean {
    return (type as { kind: string }).kind === 'ArrayType';
  }

  // ==========================================================================
  // Naming Utilities
  // ==========================================================================

  /**
   * Convert type/enum name to file name.
   */
  protected toFileName(
    decl: TypeDeclaration | EnumDeclaration,
    style: 'kebab' | 'snake' | 'camel' | 'pascal' = 'kebab'
  ): string {
    const name = decl.name.name;
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
 * Configuration for creating a type visitor.
 */
export interface TypeVisitorConfig {
  visitType: (type: TypeDeclaration, context: GeneratorContext) => VisitorResult;
  visitEnum: (enumDecl: EnumDeclaration, context: GeneratorContext) => VisitorResult;
  beforeTypes?: (
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
  afterTypes?: (
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
}

/**
 * Create a type visitor from configuration.
 */
export function createTypeVisitor(config: TypeVisitorConfig): TypeVisitor {
  return {
    visitType: config.visitType,
    visitEnum: config.visitEnum,
    beforeTypes: config.beforeTypes,
    afterTypes: config.afterTypes,
  };
}
