/**
 * Symbol Table for ISL Semantic Analysis
 * 
 * Collects and manages declared symbols (types, entities, behaviors, fields)
 * for name resolution during semantic analysis.
 */

import type { SourceLocation, Domain } from '@isl-lang/parser';

// ============================================================================
// Types
// ============================================================================

export type ResolverSymbolKind = 'type' | 'entity' | 'behavior' | 'field' | 'enum' | 'view' | 'input' | 'output' | 'domain';

export interface Symbol {
  /** Symbol name */
  name: string;
  /** Kind of symbol */
  kind: ResolverSymbolKind;
  /** Source location of the declaration */
  location: SourceLocation;
  /** Parent symbol (e.g., entity for a field) */
  parent?: string;
  /** Associated fields (for entities) */
  fields?: string[];
}

export interface SymbolTableOptions {
  /** Include built-in types */
  includeBuiltins?: boolean;
}

// ============================================================================
// Built-in Types
// ============================================================================

/**
 * ISL built-in primitive types
 */
export const BUILTIN_TYPES = new Set([
  'String',
  'Int',
  'Decimal',
  'Boolean',
  'UUID',
  'Timestamp',
  'Duration',
  'Date',
  'Time',
  'DateTime',
  'Email',
  'URL',
  'PhoneNumber',
  'Void',
  'Never',
  'Unknown',
  'Any',
]);

/**
 * ISL built-in generic types
 */
export const BUILTIN_GENERICS = new Set([
  'List',
  'Set',
  'Map',
  'Optional',
  'Result',
  'Either',
]);

// ============================================================================
// Symbol Table
// ============================================================================

/**
 * Symbol table that collects all declarations from an ISL domain.
 */
export class SymbolTable {
  private symbols: Map<string, Symbol> = new Map();
  private byKind: Map<ResolverSymbolKind, Symbol[]> = new Map();
  private options: Required<SymbolTableOptions>;

  constructor(options: SymbolTableOptions = {}) {
    this.options = {
      includeBuiltins: options.includeBuiltins ?? true,
    };

    if (this.options.includeBuiltins) {
      this.addBuiltinTypes();
    }
  }

  /**
   * Add built-in types to the symbol table
   */
  private addBuiltinTypes(): void {
    const builtinLocation: SourceLocation = {
      file: '<builtin>',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
    };

    for (const typeName of BUILTIN_TYPES) {
      this.add({
        name: typeName,
        kind: 'type',
        location: builtinLocation,
      });
    }

    for (const typeName of BUILTIN_GENERICS) {
      this.add({
        name: typeName,
        kind: 'type',
        location: builtinLocation,
      });
    }
  }

  /**
   * Add a symbol to the table
   */
  add(symbol: Symbol): void {
    // Use qualified name for fields (EntityName.fieldName)
    const key = symbol.parent 
      ? `${symbol.parent}.${symbol.name}` 
      : symbol.name;
    
    this.symbols.set(key, symbol);

    // Also index by kind for suggestions
    const kindList = this.byKind.get(symbol.kind) ?? [];
    kindList.push(symbol);
    this.byKind.set(symbol.kind, kindList);
  }

  /**
   * Get a symbol by name
   */
  get(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  /**
   * Check if a symbol exists
   */
  has(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Get all symbols of a specific kind
   */
  getByKind(kind: ResolverSymbolKind): Symbol[] {
    return this.byKind.get(kind) ?? [];
  }

  /**
   * Get all type names (for "did you mean?" suggestions)
   */
  getTypeNames(): string[] {
    return this.getByKind('type').map(s => s.name);
  }

  /**
   * Get all entity names
   */
  getEntityNames(): string[] {
    return this.getByKind('entity').map(s => s.name);
  }

  /**
   * Get all behavior names
   */
  getBehaviorNames(): string[] {
    return this.getByKind('behavior').map(s => s.name);
  }

  /**
   * Get fields for an entity
   */
  getEntityFields(entityName: string): string[] {
    const entity = this.get(entityName);
    return entity?.fields ?? [];
  }

  /**
   * Check if a type name is a built-in
   */
  isBuiltin(name: string): boolean {
    return BUILTIN_TYPES.has(name) || BUILTIN_GENERICS.has(name);
  }

  /**
   * Build symbol table from a domain AST
   */
  static fromDomain(domain: Domain, options?: SymbolTableOptions): SymbolTable {
    const table = new SymbolTable(options);

    // Add domain itself
    table.add({
      name: domain.name.name,
      kind: 'domain',
      location: domain.location,
    });

    // Add types
    for (const typeDecl of domain.types) {
      table.add({
        name: typeDecl.name.name,
        kind: 'type',
        location: typeDecl.location,
      });

      // If struct type, add fields
      if (typeDecl.definition.kind === 'StructType') {
        for (const field of typeDecl.definition.fields) {
          table.add({
            name: field.name.name,
            kind: 'field',
            location: field.location,
            parent: typeDecl.name.name,
          });
        }
      }

      // If enum type, add variants
      if (typeDecl.definition.kind === 'EnumType') {
        for (const variant of typeDecl.definition.variants) {
          table.add({
            name: variant.name.name,
            kind: 'enum',
            location: variant.location,
            parent: typeDecl.name.name,
          });
        }
      }
    }

    // Add entities
    for (const entity of domain.entities) {
      const fieldNames = entity.fields.map(f => f.name.name);
      table.add({
        name: entity.name.name,
        kind: 'entity',
        location: entity.location,
        fields: fieldNames,
      });

      // Add entity fields
      for (const field of entity.fields) {
        table.add({
          name: field.name.name,
          kind: 'field',
          location: field.location,
          parent: entity.name.name,
        });
      }
    }

    // Add behaviors
    for (const behavior of domain.behaviors) {
      table.add({
        name: behavior.name.name,
        kind: 'behavior',
        location: behavior.location,
      });

      // Add input fields
      for (const field of behavior.input.fields) {
        table.add({
          name: field.name.name,
          kind: 'input',
          location: field.location,
          parent: behavior.name.name,
        });
      }
    }

    // Add views
    for (const view of domain.views) {
      table.add({
        name: view.name.name,
        kind: 'view',
        location: view.location,
      });
    }

    return table;
  }

  /**
   * Get all symbol names (for debugging)
   */
  getAllNames(): string[] {
    return Array.from(this.symbols.keys());
  }
}
