// ============================================================================
// Type Resolution
// ============================================================================

import type {
  ResolvedType,
  SourceLocation,
  EntityResolvedType,
  EnumResolvedType,
  StructResolvedType,
  ListResolvedType,
  MapResolvedType,
  OptionalResolvedType,
  UnionResolvedType,
} from './types';
import { createPrimitiveType, isPrimitiveTypeName, UNKNOWN_TYPE } from './types';
import type { SymbolTableBuilder } from './symbols';
import type { Diagnostic } from './errors';
import { undefinedTypeError, circularReferenceError } from './errors';

// AST types we need (minimal interface)
interface TypeDefinition {
  kind: string;
  location: SourceLocation;
}

interface ReferenceType extends TypeDefinition {
  kind: 'ReferenceType';
  name: { parts: Array<{ name: string }> };
}

interface PrimitiveType extends TypeDefinition {
  kind: 'PrimitiveType';
  name: string;
}

interface ConstrainedType extends TypeDefinition {
  kind: 'ConstrainedType';
  base: TypeDefinition;
  constraints: Array<{ name: string; value: unknown }>;
}

interface EnumType extends TypeDefinition {
  kind: 'EnumType';
  variants: Array<{ name: { name: string } }>;
}

interface StructType extends TypeDefinition {
  kind: 'StructType';
  fields: Field[];
}

interface UnionType extends TypeDefinition {
  kind: 'UnionType';
  variants: Array<{ name: { name: string }; fields: Field[] }>;
}

interface ListType extends TypeDefinition {
  kind: 'ListType';
  element: TypeDefinition;
}

interface MapType extends TypeDefinition {
  kind: 'MapType';
  key: TypeDefinition;
  value: TypeDefinition;
}

interface OptionalType extends TypeDefinition {
  kind: 'OptionalType';
  inner: TypeDefinition;
}

interface Field {
  name: { name: string };
  type: TypeDefinition;
  optional: boolean;
  location: SourceLocation;
}

export class TypeResolver {
  private symbolTable: SymbolTableBuilder;
  private diagnostics: Diagnostic[] = [];
  private typeCache: Map<string, ResolvedType> = new Map();
  private resolutionStack: Set<string> = new Set();

  constructor(symbolTable: SymbolTableBuilder) {
    this.symbolTable = symbolTable;
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  clearDiagnostics(): void {
    this.diagnostics = [];
  }

  /**
   * Resolve an AST type definition to a ResolvedType
   */
  resolve(typeNode: TypeDefinition): ResolvedType {
    switch (typeNode.kind) {
      case 'PrimitiveType':
        return this.resolvePrimitive(typeNode as PrimitiveType);
      
      case 'ReferenceType':
        return this.resolveReference(typeNode as ReferenceType);
      
      case 'ConstrainedType':
        return this.resolveConstrained(typeNode as ConstrainedType);
      
      case 'EnumType':
        return this.resolveEnum(typeNode as EnumType);
      
      case 'StructType':
        return this.resolveStruct(typeNode as StructType);
      
      case 'UnionType':
        return this.resolveUnion(typeNode as UnionType);
      
      case 'ListType':
        return this.resolveList(typeNode as ListType);
      
      case 'MapType':
        return this.resolveMap(typeNode as MapType);
      
      case 'OptionalType':
        return this.resolveOptional(typeNode as OptionalType);
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private resolvePrimitive(node: PrimitiveType): ResolvedType {
    return createPrimitiveType(node.name);
  }

  private resolveReference(node: ReferenceType): ResolvedType {
    const parts = node.name.parts.map(p => p.name);
    const fullName = parts.join('.');
    
    // Check cache first
    const cached = this.typeCache.get(fullName);
    if (cached) return cached;
    
    // Check for circular reference
    if (this.resolutionStack.has(fullName)) {
      this.diagnostics.push(circularReferenceError(
        fullName,
        Array.from(this.resolutionStack),
        node.location
      ));
      return UNKNOWN_TYPE;
    }
    
    // Look up the symbol
    const symbol = this.symbolTable.lookupQualified(parts);
    
    if (!symbol) {
      // Check if it's a primitive type
      if (parts.length === 1 && isPrimitiveTypeName(parts[0])) {
        const type = createPrimitiveType(parts[0]);
        this.typeCache.set(fullName, type);
        return type;
      }
      
      this.diagnostics.push(undefinedTypeError(fullName, node.location));
      return UNKNOWN_TYPE;
    }
    
    this.typeCache.set(fullName, symbol.type);
    return symbol.type;
  }

  private resolveConstrained(node: ConstrainedType): ResolvedType {
    const baseType = this.resolve(node.base);
    
    if (baseType.kind === 'primitive') {
      return {
        kind: 'primitive',
        name: baseType.name,
        constraints: node.constraints.map(c => ({
          name: c.name,
          value: c.value,
        })),
      };
    }
    
    return baseType;
  }

  private resolveEnum(node: EnumType): EnumResolvedType {
    return {
      kind: 'enum',
      name: '',
      variants: node.variants.map(v => v.name.name),
    };
  }

  private resolveStruct(node: StructType): StructResolvedType {
    const fields = new Map<string, ResolvedType>();
    
    for (const field of node.fields) {
      let fieldType = this.resolve(field.type);
      if (field.optional) {
        fieldType = { kind: 'optional', inner: fieldType };
      }
      fields.set(field.name.name, fieldType);
    }
    
    return {
      kind: 'struct',
      fields,
    };
  }

  private resolveUnion(node: UnionType): UnionResolvedType {
    const variants = new Map<string, ResolvedType>();
    
    for (const variant of node.variants) {
      const fields = new Map<string, ResolvedType>();
      for (const field of variant.fields) {
        let fieldType = this.resolve(field.type);
        if (field.optional) {
          fieldType = { kind: 'optional', inner: fieldType };
        }
        fields.set(field.name.name, fieldType);
      }
      variants.set(variant.name.name, { kind: 'struct', fields });
    }
    
    return {
      kind: 'union',
      variants,
    };
  }

  private resolveList(node: ListType): ListResolvedType {
    return {
      kind: 'list',
      element: this.resolve(node.element),
    };
  }

  private resolveMap(node: MapType): MapResolvedType {
    return {
      kind: 'map',
      key: this.resolve(node.key),
      value: this.resolve(node.value),
    };
  }

  private resolveOptional(node: OptionalType): OptionalResolvedType {
    return {
      kind: 'optional',
      inner: this.resolve(node.inner),
    };
  }

  /**
   * Resolve entity fields including lifecycle states
   */
  resolveEntityFields(
    fields: Field[],
    lifecycleStates?: string[]
  ): EntityResolvedType {
    const fieldMap = new Map<string, ResolvedType>();
    
    for (const field of fields) {
      let fieldType = this.resolve(field.type);
      if (field.optional) {
        fieldType = { kind: 'optional', inner: fieldType };
      }
      fieldMap.set(field.name.name, fieldType);
    }
    
    return {
      kind: 'entity',
      name: '',
      fields: fieldMap,
      lifecycleStates,
    };
  }
}
