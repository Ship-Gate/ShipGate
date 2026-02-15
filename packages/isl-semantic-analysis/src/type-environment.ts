/**
 * Type Environment Implementation
 * 
 * Provides type information lookup for semantic analysis passes.
 */

import type { 
  Domain, 
  Entity, 
  TypeDeclaration, 
  Behavior, 
  Field,
  TypeDefinition,
} from '@isl-lang/parser';
import type { TypeEnvironment, TypeInfo, SymbolEntry, SymbolKind } from './types.js';

// ============================================================================
// Type Environment Builder
// ============================================================================

/**
 * Build a TypeEnvironment from a parsed Domain
 */
export function buildTypeEnvironment(domain: Domain): TypeEnvironment {
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

  constructor(domain: Domain) {
    this.indexDomain(domain);
  }

  private indexDomain(domain: Domain): void {
    // Index entities
    for (const entity of domain.entities || []) {
      this.indexEntity(entity);
    }

    // Index custom types (includes enums in the parser AST)
    for (const type of domain.types || []) {
      this.indexType(type);
    }

    // Index behaviors
    for (const behavior of domain.behaviors || []) {
      this.indexBehavior(behavior);
    }
  }

  private indexEntity(entity: Entity): void {
    const name = entity.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'entity',
      type: {
        typeName: name,
        nullable: false,
        isArray: false,
        declaredAt: entity.location,
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

  private indexField(field: Field, scope: string): SymbolEntry {
    const entry: SymbolEntry = {
      name: field.name.name,
      kind: 'field',
      type: this.resolveTypeDefinition(field.type),
      scope,
      doc: this.extractDoc(field),
    };
    return entry;
  }

  private indexType(type: TypeDeclaration): void {
    const name = type.name.name;
    
    // Support both 'definition' (parser AST) and 'type' (isl-core/test mock) properties
    const typeAny = type as unknown as Record<string, unknown>;
    const typeDef = type.definition || (typeAny.type as TypeDefinition | undefined);
    
    // Check if this is an enum type
    if (typeDef && typeDef.kind === 'EnumType') {
      const enumDef = typeDef as unknown as { variants: Array<{ name: { name: string } }> };
      const entry: SymbolEntry = {
        name,
        kind: 'enum',
        type: {
          typeName: name,
          nullable: false,
          isArray: false,
          declaredAt: type.location,
          constraints: [{
            kind: 'enum',
            value: enumDef.variants?.map(v => v.name.name) || [],
          }],
        },
        exported: true,
        doc: this.extractDoc(type),
      };

      this.symbols.set(name, entry);
      this.enums.set(name, entry);
      this.types.set(name, entry);
      return;
    }
    
    const entry: SymbolEntry = {
      name,
      kind: 'type',
      type: typeDef 
        ? this.resolveTypeDefinition(typeDef)
        : { typeName: name, nullable: false, isArray: false, declaredAt: type.location },
      exported: true,
      doc: this.extractDoc(type),
    };

    this.symbols.set(name, entry);
    this.types.set(name, entry);
  }

  private indexBehavior(behavior: Behavior): void {
    const name = behavior.name.name;
    const entry: SymbolEntry = {
      name,
      kind: 'behavior',
      type: {
        typeName: 'Behavior',
        nullable: false,
        isArray: false,
        declaredAt: behavior.location,
      },
      exported: true,
      doc: this.extractDoc(behavior),
    };

    this.symbols.set(name, entry);
    this.behaviors.set(name, entry);

    // Index behavior parameters (input/output)
    const paramScope = new Map<string, SymbolEntry>();
    
    // Input is InputSpec with fields: Field[]
    if (behavior.input && behavior.input.fields) {
      for (const field of behavior.input.fields) {
        const paramEntry: SymbolEntry = {
          name: field.name.name,
          kind: 'parameter',
          type: this.resolveTypeDefinition(field.type),
          scope: name,
        };
        paramScope.set(field.name.name, paramEntry);
      }
    }

    // Output is OutputSpec with success: TypeDefinition and errors: ErrorSpec[]
    // We index the output type as 'result' for postcondition checks
    if (behavior.output && behavior.output.success) {
      const outputType = this.resolveTypeDefinition(behavior.output.success);
      paramScope.set('result', {
        name: 'result',
        kind: 'parameter',
        type: outputType,
        scope: name,
      });
    }

    this.scopedSymbols.set(name, paramScope);
  }

  private resolveTypeDefinition(typeDef: TypeDefinition): TypeInfo {
    switch (typeDef.kind) {
      case 'PrimitiveType':
        return {
          typeName: typeDef.name,
          nullable: false,
          isArray: false,
          declaredAt: typeDef.location,
        };

      case 'ReferenceType':
        // ReferenceType has name: QualifiedName with parts: Identifier[]
        const parts = typeDef.name.parts || [];
        const refName = parts.map(p => p.name).join('.');
        return {
          typeName: refName || 'unknown',
          nullable: false,
          isArray: false,
          declaredAt: typeDef.location,
        };

      case 'ConstrainedType':
        return this.resolveTypeDefinition(typeDef.base);

      case 'ListType':
        return {
          typeName: 'Array',
          nullable: false,
          isArray: true,
          typeParams: [this.resolveTypeDefinition(typeDef.element)],
          declaredAt: typeDef.location,
        };

      case 'MapType':
        return {
          typeName: 'Map',
          nullable: false,
          isArray: false,
          typeParams: [
            this.resolveTypeDefinition(typeDef.key),
            this.resolveTypeDefinition(typeDef.value),
          ],
          declaredAt: typeDef.location,
        };

      case 'OptionalType':
        const inner = this.resolveTypeDefinition(typeDef.inner);
        return {
          ...inner,
          nullable: true,
        };

      case 'UnionType':
        // Parser UnionType has variants: UnionVariant[] with name and fields
        const unionDef = typeDef as { variants?: Array<{ name: { name: string }; fields: unknown[] }> };
        return {
          typeName: 'Union',
          nullable: false,
          isArray: false,
          // Extract variant names as simple type info
          typeParams: unionDef.variants?.map(v => ({
            typeName: v.name?.name || 'unknown',
            nullable: false,
            isArray: false,
          })),
          declaredAt: typeDef.location,
        };

      case 'StructType':
        return {
          typeName: 'Object',
          nullable: false,
          isArray: false,
          declaredAt: typeDef.location,
        };

      case 'EnumType':
        return {
          typeName: 'Enum',
          nullable: false,
          isArray: false,
          declaredAt: typeDef.location,
        };

      default: {
        // Handle SimpleType and other shapes where name may be a string or Identifier
        const anyDef = typeDef as unknown as Record<string, unknown>;
        if (typeof anyDef.name === 'string') {
          return { typeName: anyDef.name, nullable: false, isArray: false, declaredAt: undefined };
        }
        if (anyDef.name && typeof anyDef.name === 'object' && 'name' in (anyDef.name as Record<string, unknown>)) {
          return { typeName: (anyDef.name as { name: string }).name, nullable: false, isArray: false, declaredAt: undefined };
        }
        return {
          typeName: 'unknown',
          nullable: false,
          isArray: false,
        };
      }
    }
  }

  private extractDoc(node: unknown): string | undefined {
    // Parser AST nodes may have different doc/description patterns
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if ('description' in obj && obj.description && typeof obj.description === 'object') {
        const desc = obj.description as Record<string, unknown>;
        if ('value' in desc && typeof desc.value === 'string') {
          return desc.value;
        }
      }
    }
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
