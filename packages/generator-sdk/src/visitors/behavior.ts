/**
 * Behavior Visitor
 *
 * Base implementation for visiting behavior declarations.
 */

import type {
  BehaviorDeclaration,
  FieldDeclaration,
  ErrorDeclaration,
  TypeExpression,
} from '@intentos/isl-core';

import type {
  GeneratedFile,
  GeneratorContext,
  VisitorResult,
  BehaviorVisitor,
} from '../types.js';

// ============================================================================
// Behavior Visitor Base Class
// ============================================================================

/**
 * Base class for behavior visitors.
 *
 * Provides utilities for processing behavior declarations,
 * including inputs, outputs, errors, and conditions.
 *
 * @example
 * ```typescript
 * class MyBehaviorVisitor extends BehaviorVisitorBase {
 *   visitBehavior(behavior: BehaviorDeclaration, ctx: GeneratorContext): GeneratedFile[] {
 *     const inputType = this.getInputTypeName(behavior);
 *     const outputType = this.getSuccessTypeName(behavior);
 *
 *     return [{
 *       path: `handlers/${this.toFileName(behavior)}.ts`,
 *       content: `
 *         export async function ${this.toCamelCase(behavior.name.name)}(
 *           input: ${inputType}
 *         ): Promise<${outputType}> {
 *           // Implementation
 *         }
 *       `,
 *     }];
 *   }
 * }
 * ```
 */
export abstract class BehaviorVisitorBase implements BehaviorVisitor {
  /**
   * Visit a behavior declaration.
   * Must be implemented by subclasses.
   */
  abstract visitBehavior(
    behavior: BehaviorDeclaration,
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called before visiting any behaviors.
   */
  beforeBehaviors?(
    behaviors: BehaviorDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  /**
   * Called after visiting all behaviors.
   */
  afterBehaviors?(
    behaviors: BehaviorDeclaration[],
    context: GeneratorContext
  ): VisitorResult;

  // ==========================================================================
  // Input Utilities
  // ==========================================================================

  /**
   * Check if behavior has input.
   */
  protected hasInput(behavior: BehaviorDeclaration): boolean {
    return !!behavior.input && behavior.input.fields.length > 0;
  }

  /**
   * Get input fields.
   */
  protected getInputFields(behavior: BehaviorDeclaration): FieldDeclaration[] {
    return behavior.input?.fields ?? [];
  }

  /**
   * Get required input fields.
   */
  protected getRequiredInputFields(behavior: BehaviorDeclaration): FieldDeclaration[] {
    return this.getInputFields(behavior).filter((f) => !f.optional);
  }

  /**
   * Get optional input fields.
   */
  protected getOptionalInputFields(behavior: BehaviorDeclaration): FieldDeclaration[] {
    return this.getInputFields(behavior).filter((f) => f.optional);
  }

  /**
   * Get the input type name.
   */
  protected getInputTypeName(behavior: BehaviorDeclaration): string {
    return `${behavior.name.name}Input`;
  }

  // ==========================================================================
  // Output Utilities
  // ==========================================================================

  /**
   * Check if behavior has output.
   */
  protected hasOutput(behavior: BehaviorDeclaration): boolean {
    return !!behavior.output;
  }

  /**
   * Get the success type expression.
   */
  protected getSuccessType(behavior: BehaviorDeclaration): TypeExpression | undefined {
    return behavior.output?.success;
  }

  /**
   * Get the success type name.
   */
  protected getSuccessTypeName(behavior: BehaviorDeclaration): string {
    const successType = this.getSuccessType(behavior);
    if (!successType) return 'void';

    return this.typeExpressionToString(successType);
  }

  /**
   * Get all error declarations.
   */
  protected getErrors(behavior: BehaviorDeclaration): ErrorDeclaration[] {
    return behavior.output?.errors ?? [];
  }

  /**
   * Check if behavior can fail with errors.
   */
  protected hasErrors(behavior: BehaviorDeclaration): boolean {
    return this.getErrors(behavior).length > 0;
  }

  /**
   * Get error codes as strings.
   */
  protected getErrorCodes(behavior: BehaviorDeclaration): string[] {
    return this.getErrors(behavior).map((e) => e.name.name);
  }

  /**
   * Get retriable errors.
   */
  protected getRetriableErrors(behavior: BehaviorDeclaration): ErrorDeclaration[] {
    return this.getErrors(behavior).filter((e) => e.retriable === true);
  }

  /**
   * Get non-retriable errors.
   */
  protected getNonRetriableErrors(behavior: BehaviorDeclaration): ErrorDeclaration[] {
    return this.getErrors(behavior).filter((e) => e.retriable !== true);
  }

  // ==========================================================================
  // Condition Utilities
  // ==========================================================================

  /**
   * Check if behavior has preconditions.
   */
  protected hasPreconditions(behavior: BehaviorDeclaration): boolean {
    return !!behavior.preconditions && behavior.preconditions.conditions.length > 0;
  }

  /**
   * Check if behavior has postconditions.
   */
  protected hasPostconditions(behavior: BehaviorDeclaration): boolean {
    return !!behavior.postconditions && behavior.postconditions.conditions.length > 0;
  }

  /**
   * Get precondition count.
   */
  protected getPreconditionCount(behavior: BehaviorDeclaration): number {
    return behavior.preconditions?.conditions.length ?? 0;
  }

  /**
   * Get postcondition count.
   */
  protected getPostconditionCount(behavior: BehaviorDeclaration): number {
    return behavior.postconditions?.conditions.length ?? 0;
  }

  // ==========================================================================
  // Actor Utilities
  // ==========================================================================

  /**
   * Check if behavior has actors defined.
   */
  protected hasActors(behavior: BehaviorDeclaration): boolean {
    return !!behavior.actors && behavior.actors.actors.length > 0;
  }

  /**
   * Get actor names.
   */
  protected getActorNames(behavior: BehaviorDeclaration): string[] {
    return behavior.actors?.actors.map((a) => a.name.name) ?? [];
  }

  // ==========================================================================
  // Security Utilities
  // ==========================================================================

  /**
   * Check if behavior has security requirements.
   */
  protected hasSecurity(behavior: BehaviorDeclaration): boolean {
    return !!behavior.security && behavior.security.requirements.length > 0;
  }

  /**
   * Get security requirement count.
   */
  protected getSecurityRequirementCount(behavior: BehaviorDeclaration): number {
    return behavior.security?.requirements.length ?? 0;
  }

  // ==========================================================================
  // Temporal Utilities
  // ==========================================================================

  /**
   * Check if behavior has temporal requirements.
   */
  protected hasTemporal(behavior: BehaviorDeclaration): boolean {
    return !!behavior.temporal && behavior.temporal.requirements.length > 0;
  }

  /**
   * Get temporal requirement count.
   */
  protected getTemporalRequirementCount(behavior: BehaviorDeclaration): number {
    return behavior.temporal?.requirements.length ?? 0;
  }

  // ==========================================================================
  // Naming Utilities
  // ==========================================================================

  /**
   * Convert behavior name to a file name.
   */
  protected toFileName(
    behavior: BehaviorDeclaration,
    style: 'kebab' | 'snake' | 'camel' | 'pascal' = 'kebab'
  ): string {
    const name = behavior.name.name;
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
   * Convert a type expression to a string.
   */
  protected typeExpressionToString(type: TypeExpression): string {
    const typeObj = type as { kind: string; name?: { name: string }; typeArguments?: TypeExpression[]; variants?: Array<{ name: { name: string } }>; elementType?: TypeExpression };

    switch (typeObj.kind) {
      case 'SimpleType':
        return typeObj.name?.name ?? 'unknown';
      case 'GenericType': {
        const args = typeObj.typeArguments?.map((t) => this.typeExpressionToString(t)).join(', ') ?? '';
        return `${typeObj.name?.name}<${args}>`;
      }
      case 'ArrayType':
        return `${this.typeExpressionToString(typeObj.elementType!)}[]`;
      case 'UnionType':
        return typeObj.variants?.map((v) => v.name.name).join(' | ') ?? 'unknown';
      default:
        return 'unknown';
    }
  }

  // ==========================================================================
  // Case Conversion
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
 * Configuration for creating a behavior visitor.
 */
export interface BehaviorVisitorConfig {
  visitBehavior: (
    behavior: BehaviorDeclaration,
    context: GeneratorContext
  ) => VisitorResult;
  beforeBehaviors?: (
    behaviors: BehaviorDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
  afterBehaviors?: (
    behaviors: BehaviorDeclaration[],
    context: GeneratorContext
  ) => VisitorResult;
}

/**
 * Create a behavior visitor from configuration.
 */
export function createBehaviorVisitor(config: BehaviorVisitorConfig): BehaviorVisitor {
  return {
    visitBehavior: config.visitBehavior,
    beforeBehaviors: config.beforeBehaviors,
    afterBehaviors: config.afterBehaviors,
  };
}
