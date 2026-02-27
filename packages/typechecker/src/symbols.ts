// ============================================================================
// Symbol Table Implementation
// ============================================================================

import type { Symbol, SymbolKind, ResolvedType, SourceLocation, SymbolModifier } from './types';

export interface Scope {
  name: string;
  symbols: Map<string, Symbol>;
  parent?: Scope;
  children: Scope[];
  location?: SourceLocation;
}

export interface SymbolTable {
  lookup(name: string): Symbol | undefined;
  lookupQualified(parts: string[]): Symbol | undefined;
  getScope(location: SourceLocation): Scope;
  getAllSymbols(): Symbol[];
  getRootScope(): Scope;
}

export class SymbolTableBuilder implements SymbolTable {
  private rootScope: Scope;
  private currentScope: Scope;
  private allSymbols: Symbol[] = [];

  constructor() {
    this.rootScope = {
      name: 'global',
      symbols: new Map(),
      children: [],
    };
    this.currentScope = this.rootScope;
    this.initBuiltins();
  }

  private initBuiltins(): void {
    // Add built-in types
    const builtinTypes = ['String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration'];
    const builtinLocation: SourceLocation = { file: '<builtin>', line: 0, column: 0, endLine: 0, endColumn: 0 };
    
    for (const typeName of builtinTypes) {
      const symbol: Symbol = {
        name: typeName,
        kind: 'type',
        type: { kind: 'primitive', name: typeName, constraints: [] },
        location: builtinLocation,
        modifiers: [],
      };
      this.rootScope.symbols.set(typeName, symbol);
      this.allSymbols.push(symbol);
    }

    // Add built-in stdlib functions
    const stdlibFunctions: Array<{ name: string; returns: ResolvedType }> = [
      { name: 'now', returns: { kind: 'primitive', name: 'Timestamp', constraints: [] } },
      { name: 'uuid', returns: { kind: 'primitive', name: 'UUID', constraints: [] } },
      { name: 'today', returns: { kind: 'primitive', name: 'Timestamp', constraints: [] } },
      { name: 'hash', returns: { kind: 'primitive', name: 'String', constraints: [] } },
      { name: 'random', returns: { kind: 'primitive', name: 'Decimal', constraints: [] } },
    ];

    for (const func of stdlibFunctions) {
      const symbol: Symbol = {
        name: func.name,
        kind: 'variable', // Use 'variable' for stdlib functions (callable variables)
        type: { kind: 'function', params: [], returns: func.returns },
        location: builtinLocation,
        modifiers: [],
      };
      this.rootScope.symbols.set(func.name, symbol);
      this.allSymbols.push(symbol);
    }

    // Add built-in enum values (common status enums)
    const statusEnum: ResolvedType = {
      kind: 'enum',
      name: 'Status',
      variants: ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'DELETED'],
    };
    
    // Register each enum variant
    for (const variant of (statusEnum as { variants: string[] }).variants) {
      const symbol: Symbol = {
        name: variant,
        kind: 'enum_variant',
        type: statusEnum,
        location: builtinLocation,
        modifiers: [],
      };
      this.rootScope.symbols.set(variant, symbol);
      this.allSymbols.push(symbol);
    }
  }

  /**
   * Enter a new scope
   */
  enterScope(name: string, location?: SourceLocation): Scope {
    const newScope: Scope = {
      name,
      symbols: new Map(),
      parent: this.currentScope,
      children: [],
      location,
    };
    this.currentScope.children.push(newScope);
    this.currentScope = newScope;
    return newScope;
  }

  /**
   * Exit the current scope
   */
  exitScope(): Scope {
    if (this.currentScope.parent) {
      const exitedScope = this.currentScope;
      this.currentScope = this.currentScope.parent;
      return exitedScope;
    }
    return this.currentScope;
  }

  /**
   * Define a symbol in the current scope
   */
  define(
    name: string,
    kind: SymbolKind,
    type: ResolvedType,
    location: SourceLocation,
    modifiers: SymbolModifier[] = [],
    documentation?: string
  ): Symbol | null {
    // Check for duplicates in current scope
    if (this.currentScope.symbols.has(name)) {
      return null; // Caller should report duplicate error
    }

    const symbol: Symbol = {
      name,
      kind,
      type,
      location,
      modifiers,
      documentation,
    };

    this.currentScope.symbols.set(name, symbol);
    this.allSymbols.push(symbol);
    return symbol;
  }

  /**
   * Lookup a symbol by name (searches up the scope chain)
   */
  lookup(name: string): Symbol | undefined {
    let scope: Scope | undefined = this.currentScope;
    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) return symbol;
      scope = scope.parent;
    }
    return undefined;
  }

  /**
   * Lookup in a specific scope only (no parent chain)
   */
  lookupInScope(name: string, scope: Scope): Symbol | undefined {
    return scope.symbols.get(name);
  }

  /**
   * Lookup a qualified name (e.g., Entity.field)
   */
  lookupQualified(parts: string[]): Symbol | undefined {
    if (parts.length === 0) return undefined;
    
    // Start with the first part
    let symbol = this.lookup(parts[0]);
    if (!symbol) return undefined;
    
    // Traverse the rest
    for (let i = 1; i < parts.length; i++) {
      const currentType: ResolvedType = symbol.type;
      
      // Navigate into the type to find fields
      if (currentType.kind === 'entity' || currentType.kind === 'struct') {
        const fieldType: ResolvedType | undefined = currentType.fields.get(parts[i]);
        if (!fieldType) return undefined;
        
        // Create a synthetic symbol for the field
        symbol = {
          name: parts[i],
          kind: 'field',
          type: fieldType,
          location: symbol.location,
          modifiers: [],
        };
      } else if (currentType.kind === 'enum') {
        // Check if it's an enum variant
        if (!currentType.variants.includes(parts[i])) return undefined;
        
        symbol = {
          name: parts[i],
          kind: 'enum_variant',
          type: currentType,
          location: symbol.location,
          modifiers: [],
        };
      } else {
        return undefined;
      }
    }
    
    return symbol;
  }

  /**
   * Get the scope at a given source location
   */
  getScope(location: SourceLocation): Scope {
    // Find the innermost scope containing the location
    const findScope = (scope: Scope): Scope => {
      for (const child of scope.children) {
        if (child.location && this.locationContains(child.location, location)) {
          return findScope(child);
        }
      }
      return scope;
    };
    return findScope(this.rootScope);
  }

  private locationContains(outer: SourceLocation, inner: SourceLocation): boolean {
    if (outer.file !== inner.file) return false;
    
    // Check if inner is within outer
    if (inner.line < outer.line || inner.line > outer.endLine) return false;
    if (inner.line === outer.line && inner.column < outer.column) return false;
    if (inner.line === outer.endLine && inner.column > outer.endColumn) return false;
    
    return true;
  }

  /**
   * Get all defined symbols
   */
  getAllSymbols(): Symbol[] {
    return [...this.allSymbols];
  }

  /**
   * Get the root scope
   */
  getRootScope(): Scope {
    return this.rootScope;
  }

  /**
   * Get the current scope
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Check if a name exists in the current scope (not parent)
   */
  existsInCurrentScope(name: string): boolean {
    return this.currentScope.symbols.has(name);
  }

  /**
   * Get existing symbol in current scope (for duplicate checking)
   */
  getExistingInScope(name: string): Symbol | undefined {
    return this.currentScope.symbols.get(name);
  }
}
