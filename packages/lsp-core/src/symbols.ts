// ============================================================================
// ISL Symbol Index
// Fast symbol lookup for go-to-definition, find references, etc.
// ============================================================================

import type { SourceLocation } from '@isl-lang/parser';
import type { ISLSymbolInfo, SymbolKind } from './types.js';

// ============================================================================
// Indexed Symbol
// ============================================================================

export interface IndexedSymbol {
  name: string;
  kind: SymbolKind;
  uri: string;
  location: SourceLocation;
  selectionLocation: SourceLocation;
  detail?: string;
  documentation?: string;
  parent?: string;
  type?: string;
}

// ============================================================================
// Symbol Query
// ============================================================================

export interface SymbolQuery {
  name?: string;
  kind?: SymbolKind | SymbolKind[];
  uri?: string;
  parent?: string;
}

// ============================================================================
// Symbol Index
// ============================================================================

export class SymbolIndex {
  // name -> symbols (multiple symbols can have same name in different scopes)
  private byName = new Map<string, IndexedSymbol[]>();
  // uri -> symbols
  private byUri = new Map<string, IndexedSymbol[]>();
  // kind -> symbols
  private byKind = new Map<SymbolKind, IndexedSymbol[]>();

  /**
   * Clear all symbols
   */
  clear(): void {
    this.byName.clear();
    this.byUri.clear();
    this.byKind.clear();
  }

  /**
   * Clear symbols for a specific document
   */
  clearDocument(uri: string): void {
    const symbols = this.byUri.get(uri) || [];
    
    for (const sym of symbols) {
      // Remove from byName
      const byName = this.byName.get(sym.name);
      if (byName) {
        const filtered = byName.filter(s => s.uri !== uri);
        if (filtered.length === 0) {
          this.byName.delete(sym.name);
        } else {
          this.byName.set(sym.name, filtered);
        }
      }

      // Remove from byKind
      const byKind = this.byKind.get(sym.kind);
      if (byKind) {
        const filtered = byKind.filter(s => s.uri !== uri);
        if (filtered.length === 0) {
          this.byKind.delete(sym.kind);
        } else {
          this.byKind.set(sym.kind, filtered);
        }
      }
    }

    // Clear byUri
    this.byUri.delete(uri);
  }

  /**
   * Index symbols from analysis result
   */
  indexSymbols(uri: string, symbols: ISLSymbolInfo[]): void {
    // Clear existing symbols for this document
    this.clearDocument(uri);

    // Index all symbols recursively
    const indexSymbol = (sym: ISLSymbolInfo, parent?: string) => {
      const indexed: IndexedSymbol = {
        name: sym.name,
        kind: sym.kind,
        uri,
        location: sym.location,
        selectionLocation: sym.selectionLocation,
        detail: sym.detail,
        documentation: sym.documentation,
        parent: parent || sym.parent,
        type: sym.type,
      };

      // Add to byName
      const byName = this.byName.get(sym.name) || [];
      byName.push(indexed);
      this.byName.set(sym.name, byName);

      // Add to byUri
      const byUri = this.byUri.get(uri) || [];
      byUri.push(indexed);
      this.byUri.set(uri, byUri);

      // Add to byKind
      const byKind = this.byKind.get(sym.kind) || [];
      byKind.push(indexed);
      this.byKind.set(sym.kind, byKind);

      // Recurse into children
      if (sym.children) {
        for (const child of sym.children) {
          indexSymbol(child, sym.name);
        }
      }
    };

    for (const sym of symbols) {
      indexSymbol(sym);
    }
  }

  /**
   * Find symbols matching a query
   */
  find(query: SymbolQuery): IndexedSymbol[] {
    let results: IndexedSymbol[] | undefined;

    // Start with most restrictive filter
    if (query.name) {
      results = this.byName.get(query.name) || [];
    } else if (query.uri) {
      results = this.byUri.get(query.uri) || [];
    } else if (query.kind) {
      if (Array.isArray(query.kind)) {
        results = query.kind.flatMap(k => this.byKind.get(k) || []);
      } else {
        results = this.byKind.get(query.kind) || [];
      }
    } else {
      // No filter, return all
      results = Array.from(this.byUri.values()).flat();
    }

    // Apply additional filters
    if (query.name && results) {
      results = results.filter(s => s.name === query.name);
    }
    if (query.kind && results) {
      const kinds = Array.isArray(query.kind) ? query.kind : [query.kind];
      results = results.filter(s => kinds.includes(s.kind));
    }
    if (query.uri && results) {
      results = results.filter(s => s.uri === query.uri);
    }
    if (query.parent && results) {
      results = results.filter(s => s.parent === query.parent);
    }

    return results || [];
  }

  /**
   * Find symbol definition by name
   */
  findDefinition(name: string, kind?: SymbolKind | SymbolKind[]): IndexedSymbol | undefined {
    const symbols = this.find({ name, kind });
    // Return the first definition (prioritize current document)
    return symbols[0];
  }

  /**
   * Get all symbols for a document
   */
  getDocumentSymbols(uri: string): IndexedSymbol[] {
    return this.byUri.get(uri) || [];
  }

  /**
   * Get all symbols of a specific kind
   */
  getSymbolsByKind(kind: SymbolKind): IndexedSymbol[] {
    return this.byKind.get(kind) || [];
  }

  /**
   * Find symbol at a specific position
   */
  findAtPosition(uri: string, line: number, character: number): IndexedSymbol | undefined {
    const symbols = this.byUri.get(uri) || [];
    
    for (const sym of symbols) {
      const loc = sym.selectionLocation;
      if (
        line >= loc.line && line <= loc.endLine &&
        (line > loc.line || character >= loc.column) &&
        (line < loc.endLine || character <= loc.endColumn)
      ) {
        return sym;
      }
    }

    return undefined;
  }

  /**
   * Get all unique symbol names (for completion)
   */
  getAllNames(): string[] {
    return Array.from(this.byName.keys());
  }

  /**
   * Get all entity names
   */
  getEntityNames(): string[] {
    return (this.byKind.get('entity') || []).map(s => s.name);
  }

  /**
   * Get all behavior names
   */
  getBehaviorNames(): string[] {
    return (this.byKind.get('behavior') || []).map(s => s.name);
  }

  /**
   * Get all type names
   */
  getTypeNames(): string[] {
    const types = this.byKind.get('type') || [];
    const enums = this.byKind.get('enum') || [];
    return [...types, ...enums].map(s => s.name);
  }

  /**
   * Get fields for an entity or behavior
   */
  getFields(parentName: string): IndexedSymbol[] {
    return this.find({ parent: parentName, kind: ['field', 'input', 'output'] });
  }
}
