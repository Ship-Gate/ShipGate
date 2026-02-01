/**
 * ISL Document Manager
 * 
 * Manages parsed ISL documents and provides access to AST nodes.
 */

import {
  parseISL,
  type DomainDeclaration,
  type EntityDeclaration,
  type BehaviorDeclaration,
  type TypeDeclaration,
  type EnumDeclaration,
  type FieldDeclaration,
  type Identifier,
  type ASTNode,
  type SourceSpan,
} from '@intentos/isl-core';

export interface ISLDocument {
  uri: string;
  version: number;
  content: string;
  ast: DomainDeclaration | null;
  errors: Array<{ message: string; line: number; column: number }>;
}

export interface SymbolInfo {
  name: string;
  kind: 'domain' | 'entity' | 'behavior' | 'type' | 'enum' | 'field' | 'error';
  span: SourceSpan;
  detail?: string;
  parent?: string;
}

export class DocumentManager {
  private documents = new Map<string, ISLDocument>();

  /**
   * Update or create a document
   */
  updateDocument(uri: string, content: string, version: number): ISLDocument {
    const result = parseISL(content, uri);
    
    // Normalize errors to have line/column
    const errors = result.errors.map((err) => {
      if ('span' in err) {
        return {
          message: err.message,
          line: err.span.start.line,
          column: err.span.start.column,
        };
      }
      return {
        message: err.message,
        line: err.line,
        column: err.column,
      };
    });

    const document: ISLDocument = {
      uri,
      version,
      content,
      ast: result.ast,
      errors,
    };

    this.documents.set(uri, document);
    return document;
  }

  /**
   * Get a document by URI
   */
  getDocument(uri: string): ISLDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Remove a document
   */
  removeDocument(uri: string): void {
    this.documents.delete(uri);
  }

  /**
   * Get all symbols from a document
   */
  getSymbols(uri: string): SymbolInfo[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];

    const symbols: SymbolInfo[] = [];
    const ast = doc.ast;

    // Domain
    symbols.push({
      name: ast.name.name,
      kind: 'domain',
      span: ast.span,
      detail: 'Domain',
    });

    // Entities
    for (const entity of ast.entities) {
      symbols.push({
        name: entity.name.name,
        kind: 'entity',
        span: entity.span,
        detail: `Entity with ${entity.fields.length} fields`,
        parent: ast.name.name,
      });

      // Entity fields
      for (const field of entity.fields) {
        symbols.push({
          name: field.name.name,
          kind: 'field',
          span: field.span,
          detail: getTypeString(field.type),
          parent: entity.name.name,
        });
      }
    }

    // Behaviors
    for (const behavior of ast.behaviors) {
      symbols.push({
        name: behavior.name.name,
        kind: 'behavior',
        span: behavior.span,
        detail: behavior.description?.value ?? 'Behavior',
        parent: ast.name.name,
      });

      // Behavior input fields
      if (behavior.input) {
        for (const field of behavior.input.fields) {
          symbols.push({
            name: field.name.name,
            kind: 'field',
            span: field.span,
            detail: `Input: ${getTypeString(field.type)}`,
            parent: behavior.name.name,
          });
        }
      }

      // Behavior errors
      if (behavior.output) {
        for (const error of behavior.output.errors) {
          symbols.push({
            name: error.name.name,
            kind: 'error',
            span: error.span,
            detail: error.when?.value ?? 'Error',
            parent: behavior.name.name,
          });
        }
      }
    }

    // Types
    for (const type of ast.types) {
      symbols.push({
        name: type.name.name,
        kind: 'type',
        span: type.span,
        detail: 'Type alias',
        parent: ast.name.name,
      });
    }

    // Enums
    for (const enumDecl of ast.enums) {
      symbols.push({
        name: enumDecl.name.name,
        kind: 'enum',
        span: enumDecl.span,
        detail: `Enum: ${enumDecl.variants.map(v => v.name).join(', ')}`,
        parent: ast.name.name,
      });
    }

    return symbols;
  }

  /**
   * Find a symbol by name
   */
  findSymbol(uri: string, name: string): SymbolInfo | undefined {
    const symbols = this.getSymbols(uri);
    return symbols.find((s) => s.name === name);
  }

  /**
   * Find symbol at position
   */
  findSymbolAtPosition(uri: string, line: number, column: number): SymbolInfo | undefined {
    const symbols = this.getSymbols(uri);
    return symbols.find((s) => isPositionInSpan(line, column, s.span));
  }

  /**
   * Get all entity names
   */
  getEntityNames(uri: string): string[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];
    return doc.ast.entities.map((e) => e.name.name);
  }

  /**
   * Get all behavior names
   */
  getBehaviorNames(uri: string): string[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];
    return doc.ast.behaviors.map((b) => b.name.name);
  }

  /**
   * Get all type names (including enums)
   */
  getTypeNames(uri: string): string[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];
    
    const types = doc.ast.types.map((t) => t.name.name);
    const enums = doc.ast.enums.map((e) => e.name.name);
    const entities = doc.ast.entities.map((e) => e.name.name);
    
    return [...types, ...enums, ...entities];
  }

  /**
   * Get fields for an entity
   */
  getEntityFields(uri: string, entityName: string): FieldDeclaration[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];
    
    const entity = doc.ast.entities.find((e) => e.name.name === entityName);
    return entity?.fields ?? [];
  }

  /**
   * Get an entity by name
   */
  getEntity(uri: string, name: string): EntityDeclaration | undefined {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return undefined;
    return doc.ast.entities.find((e) => e.name.name === name);
  }

  /**
   * Get a behavior by name
   */
  getBehavior(uri: string, name: string): BehaviorDeclaration | undefined {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return undefined;
    return doc.ast.behaviors.find((b) => b.name.name === name);
  }

  /**
   * Get enum variants
   */
  getEnumVariants(uri: string, enumName: string): string[] {
    const doc = this.documents.get(uri);
    if (!doc?.ast) return [];
    
    const enumDecl = doc.ast.enums.find((e) => e.name.name === enumName);
    return enumDecl?.variants.map((v) => v.name) ?? [];
  }
}

/**
 * Get a string representation of a type
 */
function getTypeString(type: ASTNode): string {
  if (!type || !('kind' in type)) return 'unknown';
  
  switch (type.kind) {
    case 'SimpleType':
      return (type as { name: Identifier }).name.name;
    case 'GenericType': {
      const gt = type as { name: Identifier; typeArguments: ASTNode[] };
      const args = gt.typeArguments.map(getTypeString).join(', ');
      return `${gt.name.name}<${args}>`;
    }
    case 'UnionType':
      return 'Union';
    case 'ArrayType': {
      const at = type as { elementType: ASTNode };
      return `${getTypeString(at.elementType)}[]`;
    }
    default:
      return 'unknown';
  }
}

/**
 * Check if a position is within a source span
 */
function isPositionInSpan(line: number, column: number, span: SourceSpan): boolean {
  if (line < span.start.line || line > span.end.line) {
    return false;
  }
  if (line === span.start.line && column < span.start.column) {
    return false;
  }
  if (line === span.end.line && column > span.end.column) {
    return false;
  }
  return true;
}
