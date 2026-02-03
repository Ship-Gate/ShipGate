/**
 * Type Environment Implementation
 * 
 * Provides type information lookup for semantic analysis passes.
 */

import type { DomainDeclaration, EntityDeclaration, TypeDeclaration, EnumDeclaration, BehaviorDeclaration, FieldDeclaration, TypeExpression } from '@isl-lang/isl-core';
import type { TypeEnvironment, TypeInfo, SymbolEntry, SymbolKind, TypeConstraint } from './types.js';

// ============================================================================
// Type Environment Builder
// ============================================================================

/**
 * Build a TypeEnvironment from a parsed DomainDeclaration
 */
export function buildTypeEnvironment(domain: DomainDeclaration): TypeEnvironment {
  return new TypeEnvironmentImpl(domain);
}

// ============================================================================
// Implementation
// ============================================================================

class TypeEnvironmentImpl implements TypeEnvironment {
  private symbols: Map<string, SymbolEntry> = new Map();
  private scopedSymbols: Map<string, Map<string, SymbolEntry>> = new Map();
  private entities: Map<string, SymbolEntry> = new Map();
  private types: Map<string, SymbolEntry> = new Map();
  private enums: Map<string, SymbolEntry> = new Map();
  private behaviors: Map<string, SymbolEntry> = new Map();

  constructor(private domain: DomainDeclaration) {
    this.indexDomain(domain);
  }

  private indexDomain(domain: DomainDeclaration): void {
    // Index entities
    for (const entity of domain.entities || []) {
      this.indexEntity(entity);
    }

    // Index custom types
    for (const type of domain.types || []) {
      this.indexType(type);
    }

    // Index enums
    for (const enumDecl of domain.enums || []) {
      this.indexEnum(enumDecl);
    }

    // Index behaviors
    for (const behavior of domain.behaviors || []) {
      this.indexBehavior(behavior);
    }
  }

  private indexEntity(entity: EntityDeclaration): void {
    const name = entity.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'entity',
      type: {
        typeName: name,
        nullable: false,
        isArray: false,
        declaredAt: entity.span,
      },
      exported: true,
      doc: this.extractDoc(entity),
    };

    this.symbols.set(name, entry);
    this.entities.set(name, entry);
    this.types.set(name, entry);

    // Index entity fields
    const fieldScope = new Map<string, SymbolEntry>();
    for (const field of entity.fields || []) {
      const fieldEntry = this.indexField(field, name);
      fieldScope.set(field.name.name, fieldEntry);
    }
    this.scopedSymbols.set(name, fieldScope);
  }

  private indexField(field: FieldDeclaration, scope: string): SymbolEntry {
    const entry: SymbolEntry = {
      name: field.name.name,
      kind: 'field',
      type: this.resolveTypeExpression(field.type),
      scope,
      doc: this.extractDoc(field),
    };
    return entry;
  }

  private indexType(type: TypeDeclaration): void {
    const name = type.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'type',
      type: type.type 
        ? this.resolveTypeExpression(type.type)
        : { typeName: name, nullable: false, isArray: false, declaredAt: type.span },
      exported: true,
      doc: this.extractDoc(type),
    };

    this.symbols.set(name, entry);
    this.types.set(name, entry);
  }

  private indexEnum(enumDecl: EnumDeclaration): void {
    const name = enumDecl.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'enum',
      type: {
        typeName: name,
        nullable: false,
        isArray: false,
        declaredAt: enumDecl.span,
        constraints: [{
          kind: 'enum',
          value: enumDecl.values?.map(v => v.name) || [],
        }],
      },
      exported: true,
      doc: this.extractDoc(enumDecl),
    };

    this.symbols.set(name, entry);
    this.enums.set(name, entry);
    this.types.set(name, entry);
  }

  private indexBehavior(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'behavior',
      type: {
        typeName: 'Behavior',
        nullable: false,
        isArray: false,
        declaredAt: behavior.span,
      },
      exported: true,
      doc: this.extractDoc(behavior),
    };

    this.symbols.set(name, entry);
    this.behaviors.set(name, entry);

    // Index behavior parameters (input/output)
    const paramScope = new Map<string, SymbolEntry>();
    
    for (const input of behavior.input || []) {
      const paramEntry: SymbolEntry = {
        name: input.name.name,
        kind: 'parameter',
        type: this.resolveTypeExpression(input.type),
        scope: name,
      };
      paramScope.set(input.name.name, paramEntry);
    }

    for (const output of behavior.output || []) {
      const paramEntry: SymbolEntry = {
        name: output.name.name,
        kind: 'parameter',
        type: this.resolveTypeExpression(output.type),
        scope: name,
      };
      paramScope.set(output.name.name, paramEntry);
    }

    this.scopedSymbols.set(name, paramScope);
  }

  private resolveTypeExpression(typeExpr: TypeExpression): TypeInfo {
    switch (typeExpr.kind) {
      case 'SimpleType':
        return {
          typeName: typeExpr.name.name,
          nullable: typeExpr.nullable || false,
          isArray: false,
          declaredAt: typeExpr.span,
        };

      case 'GenericType':
        return {
          typeName: typeExpr.name.name,
          nullable: typeExpr.nullable || false,
          isArray: typeExpr.name.name === 'Array' || typeExpr.name.name === 'List',
          typeParams: typeExpr.params?.map(p => this.resolveTypeExpression(p)),
          declaredAt: typeExpr.span,
        };

      case 'ArrayType':
        return {
          typeName: 'Array',
          nullable: typeExpr.nullable || false,
          isArray: true,
          typeParams: [this.resolveTypeExpression(typeExpr.elementType)],
          declaredAt: typeExpr.span,
        };

      case 'UnionType':
        return {
          typeName: 'Union',
          nullable: typeExpr.types?.some(t => 
            t.kind === 'SimpleType' && t.name.name === 'null'
          ) || false,
          isArray: false,
          typeParams: typeExpr.types?.map(t => this.resolveTypeExpression(t)),
          declaredAt: typeExpr.span,
        };

      case 'ObjectType':
        return {
          typeName: 'Object',
          nullable: false,
          isArray: false,
          declaredAt: typeExpr.span,
        };

      default:
        return {
          typeName: 'unknown',
          nullable: false,
          isArray: false,
        };
    }
  }

  private extractDoc(node: { doc?: string; description?: { value: string } }): string | undefined {
    if ('doc' in node && node.doc) return node.doc;
    if ('description' in node && node.description) return node.description.value;
    return undefined;
  }

  // ============================================================================
  // TypeEnvironment Interface Implementation
  // ============================================================================

  lookup(name: string): SymbolEntry | undefined {
    return this.symbols.get(name);
  }

  lookupIn(scope: string, name: string): SymbolEntry | undefined {
    const scopeSymbols = this.scopedSymbols.get(scope);
    return scopeSymbols?.get(name);
  }

  symbolsOfKind(kind: SymbolKind): SymbolEntry[] {
    switch (kind) {
      case 'entity':
        return Array.from(this.entities.values());
      case 'type':
        return Array.from(this.types.values());
      case 'enum':
        return Array.from(this.enums.values());
      case 'behavior':
        return Array.from(this.behaviors.values());
      default:
        return Array.from(this.symbols.values()).filter(s => s.kind === kind);
    }
  }

  isAssignableTo(source: TypeInfo, target: TypeInfo): boolean {
    // Same type
    if (source.typeName === target.typeName) {
      // Check nullability
      if (source.nullable && !target.nullable) return false;
      // Check array compatibility
      if (source.isArray !== target.isArray) return false;
      return true;
    }

    // Null is assignable to nullable types
    if (source.typeName === 'null' && target.nullable) return true;

    // Any accepts everything
    if (target.typeName === 'Any') return true;

    // Union type check
    if (target.typeName === 'Union' && target.typeParams) {
      return target.typeParams.some(t => this.isAssignableTo(source, t));
    }

    // Primitive coercions (Int -> Number, etc.)
    const numericTypes = new Set(['Int', 'Float', 'Number', 'Decimal']);
    if (numericTypes.has(source.typeName) && numericTypes.has(target.typeName)) {
      return true;
    }

    return false;
  }

  getEntity(name: string): SymbolEntry | undefined {
    return this.entities.get(name);
  }

  entityNames(): string[] {
    return Array.from(this.entities.keys());
  }

  behaviorNames(): string[] {
    return Array.from(this.behaviors.keys());
  }

  typeNames(): string[] {
    return Array.from(this.types.keys());
  }

  hasType(name: string): boolean {
    return this.types.has(name) || this.isPrimitiveType(name);
  }

  fieldsOf(entityName: string): SymbolEntry[] {
    const scope = this.scopedSymbols.get(entityName);
    if (!scope) return [];
    return Array.from(scope.values()).filter(s => s.kind === 'field');
  }

  private isPrimitiveType(name: string): boolean {
    const primitives = new Set([
      'String', 'Int', 'Float', 'Number', 'Boolean', 'Bool',
      'Date', 'DateTime', 'Timestamp', 'Duration',
      'UUID', 'Email', 'URL', 'JSON', 'Any', 'Void', 'null',
    ]);
    return primitives.has(name);
  }
}

// ============================================================================
// Empty Type Environment (for testing)
// ============================================================================

/**
 * Create an empty type environment (useful for testing)
 */
export function emptyTypeEnvironment(): TypeEnvironment {
  return {
    lookup: () => undefined,
    lookupIn: () => undefined,
    symbolsOfKind: () => [],
    isAssignableTo: () => false,
    getEntity: () => undefined,
    entityNames: () => [],
    behaviorNames: () => [],
    typeNames: () => [],
    hasType: () => false,
    fieldsOf: () => [],
  };
}
