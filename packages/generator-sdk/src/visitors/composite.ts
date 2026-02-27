/**
 * Composite Visitor
 *
 * Combines multiple visitors into a single visitor that delegates to all.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
} from '@isl-lang/isl-core';

import type {
  GeneratedFile,
  GeneratorContext,
  VisitorResult,
  EntityVisitor,
  BehaviorVisitor,
  TypeVisitor,
  DomainVisitor,
} from '../types.js';

// ============================================================================
// Composite Visitor Class
// ============================================================================

/**
 * A visitor that delegates to multiple sub-visitors.
 *
 * Useful for combining separate generators into a single pass.
 *
 * @example
 * ```typescript
 * const compositeVisitor = new CompositeVisitor();
 * compositeVisitor.addEntityVisitor(myEntityVisitor);
 * compositeVisitor.addBehaviorVisitor(myBehaviorVisitor);
 * compositeVisitor.addTypeVisitor(myTypeVisitor);
 *
 * // Or use the factory:
 * const visitor = composeVisitors({
 *   entities: [entityVisitor1, entityVisitor2],
 *   behaviors: [behaviorVisitor],
 * });
 * ```
 */
export class CompositeVisitor implements EntityVisitor, BehaviorVisitor, TypeVisitor, DomainVisitor {
  private entityVisitors: EntityVisitor[] = [];
  private behaviorVisitors: BehaviorVisitor[] = [];
  private typeVisitors: TypeVisitor[] = [];
  private domainVisitors: DomainVisitor[] = [];

  /**
   * Add an entity visitor.
   */
  addEntityVisitor(visitor: EntityVisitor): this {
    this.entityVisitors.push(visitor);
    return this;
  }

  /**
   * Add a behavior visitor.
   */
  addBehaviorVisitor(visitor: BehaviorVisitor): this {
    this.behaviorVisitors.push(visitor);
    return this;
  }

  /**
   * Add a type visitor.
   */
  addTypeVisitor(visitor: TypeVisitor): this {
    this.typeVisitors.push(visitor);
    return this;
  }

  /**
   * Add a domain visitor.
   */
  addDomainVisitor(visitor: DomainVisitor): this {
    this.domainVisitors.push(visitor);
    return this;
  }

  // ==========================================================================
  // Entity Visitor Implementation
  // ==========================================================================

  visitEntity(entity: EntityDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.entityVisitors.map((v) => v.visitEntity(entity, context))
    );
  }

  beforeEntities(entities: EntityDeclaration[], context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.entityVisitors.map((v) => v.beforeEntities?.(entities, context))
    );
  }

  afterEntities(entities: EntityDeclaration[], context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.entityVisitors.map((v) => v.afterEntities?.(entities, context))
    );
  }

  // ==========================================================================
  // Behavior Visitor Implementation
  // ==========================================================================

  visitBehavior(behavior: BehaviorDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.behaviorVisitors.map((v) => v.visitBehavior(behavior, context))
    );
  }

  beforeBehaviors(behaviors: BehaviorDeclaration[], context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.behaviorVisitors.map((v) => v.beforeBehaviors?.(behaviors, context))
    );
  }

  afterBehaviors(behaviors: BehaviorDeclaration[], context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.behaviorVisitors.map((v) => v.afterBehaviors?.(behaviors, context))
    );
  }

  // ==========================================================================
  // Type Visitor Implementation
  // ==========================================================================

  visitType(type: TypeDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.typeVisitors.map((v) => v.visitType(type, context))
    );
  }

  visitEnum(enumDecl: EnumDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.typeVisitors.map((v) => v.visitEnum(enumDecl, context))
    );
  }

  beforeTypes(
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ): VisitorResult {
    return this.collectResults(
      this.typeVisitors.map((v) => v.beforeTypes?.(types, enums, context))
    );
  }

  afterTypes(
    types: TypeDeclaration[],
    enums: EnumDeclaration[],
    context: GeneratorContext
  ): VisitorResult {
    return this.collectResults(
      this.typeVisitors.map((v) => v.afterTypes?.(types, enums, context))
    );
  }

  // ==========================================================================
  // Domain Visitor Implementation
  // ==========================================================================

  visitDomain(domain: DomainDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.domainVisitors.map((v) => v.visitDomain(domain, context))
    );
  }

  beforeDomain(domain: DomainDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.domainVisitors.map((v) => v.beforeDomain?.(domain, context))
    );
  }

  afterDomain(domain: DomainDeclaration, context: GeneratorContext): VisitorResult {
    return this.collectResults(
      this.domainVisitors.map((v) => v.afterDomain?.(domain, context))
    );
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private collectResults(results: VisitorResult[]): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    for (const result of results) {
      if (!result) continue;
      if (Array.isArray(result)) {
        files.push(...result);
      } else {
        files.push(result);
      }
    }

    return files;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Configuration for composing visitors.
 */
export interface ComposeVisitorsConfig {
  entities?: EntityVisitor[];
  behaviors?: BehaviorVisitor[];
  types?: TypeVisitor[];
  domain?: DomainVisitor[];
}

/**
 * Create a composite visitor from configuration.
 */
export function composeVisitors(config: ComposeVisitorsConfig): CompositeVisitor {
  const composite = new CompositeVisitor();

  for (const visitor of config.entities ?? []) {
    composite.addEntityVisitor(visitor);
  }

  for (const visitor of config.behaviors ?? []) {
    composite.addBehaviorVisitor(visitor);
  }

  for (const visitor of config.types ?? []) {
    composite.addTypeVisitor(visitor);
  }

  for (const visitor of config.domain ?? []) {
    composite.addDomainVisitor(visitor);
  }

  return composite;
}
