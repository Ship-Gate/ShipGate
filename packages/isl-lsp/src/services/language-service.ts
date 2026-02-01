/**
 * ISL Language Service
 * 
 * Core service for parsing and analyzing ISL documents.
 */

import {
  DocumentSymbol,
  SymbolKind,
  Location,
  Position,
  Range,
  WorkspaceEdit,
} from 'vscode-languageserver/node.js';

// ============================================================================
// Types
// ============================================================================

export interface ParsedDocument {
  uri: string;
  content: string;
  ast: DocumentAST | null;
  errors: ParseError[];
  symbols: SymbolInfo[];
  version: number;
}

export interface DocumentAST {
  kind: string;
  name?: string;
  entities: ASTNode[];
  types: ASTNode[];
  enums: ASTNode[];
  behaviors: ASTNode[];
  invariants: ASTNode[];
}

export interface ASTNode {
  kind: string;
  name: string;
  range: Range;
  children?: ASTNode[];
  type?: string;
  fields?: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
  range: Range;
}

export interface ParseError {
  message: string;
  range: Range;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code?: string;
}

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  detail?: string;
  children?: SymbolInfo[];
}

// ============================================================================
// Language Service
// ============================================================================

export class ISLLanguageService {
  private documents: Map<string, ParsedDocument> = new Map();
  private globalSymbols: Map<string, SymbolInfo[]> = new Map();

  /**
   * Open a document for tracking
   */
  openDocument(uri: string, content: string): ParsedDocument {
    const parsed = this.parseDocument(uri, content);
    this.documents.set(uri, parsed);
    this.updateGlobalSymbols(uri, parsed.symbols);
    return parsed;
  }

  /**
   * Update document content
   */
  updateDocument(uri: string, content: string): ParsedDocument {
    const parsed = this.parseDocument(uri, content);
    this.documents.set(uri, parsed);
    this.updateGlobalSymbols(uri, parsed.symbols);
    return parsed;
  }

  /**
   * Close a document
   */
  closeDocument(uri: string): void {
    this.documents.delete(uri);
    this.globalSymbols.delete(uri);
  }

  /**
   * Get parsed document
   */
  getDocument(uri: string): ParsedDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Parse ISL document
   */
  private parseDocument(uri: string, content: string): ParsedDocument {
    const errors: ParseError[] = [];
    const symbols: SymbolInfo[] = [];
    let ast: DocumentAST | null = null;

    try {
      // Parse the document
      const result = this.parseContent(content);
      ast = result.ast;
      errors.push(...result.errors);
      symbols.push(...this.extractSymbols(result.ast, content));
    } catch (error) {
      errors.push({
        message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: 'error',
        code: 'ISL001',
      });
    }

    return {
      uri,
      content,
      ast,
      errors,
      symbols,
      version: Date.now(),
    };
  }

  /**
   * Parse ISL content (simplified parser for LSP)
   */
  private parseContent(content: string): { ast: DocumentAST; errors: ParseError[] } {
    const errors: ParseError[] = [];
    const lines = content.split('\n');
    
    const ast: DocumentAST = {
      kind: 'Domain',
      entities: [],
      types: [],
      enums: [],
      behaviors: [],
      invariants: [],
    };

    let currentBlock: ASTNode | null = null;
    let braceDepth = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum] || '';
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('//') || trimmed === '') continue;

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Domain declaration
      const domainMatch = trimmed.match(/^domain\s+(\w+)/);
      if (domainMatch) {
        ast.name = domainMatch[1];
        continue;
      }

      // Entity declaration
      const entityMatch = trimmed.match(/^entity\s+(\w+)/);
      if (entityMatch) {
        currentBlock = {
          kind: 'Entity',
          name: entityMatch[1] || '',
          range: this.createRange(lineNum, 0, lineNum, line.length),
          fields: [],
        };
        ast.entities.push(currentBlock);
        continue;
      }

      // Type declaration
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=/);
      if (typeMatch) {
        currentBlock = {
          kind: 'Type',
          name: typeMatch[1] || '',
          range: this.createRange(lineNum, 0, lineNum, line.length),
        };
        ast.types.push(currentBlock);
        continue;
      }

      // Enum declaration
      const enumMatch = trimmed.match(/^enum\s+(\w+)/);
      if (enumMatch) {
        currentBlock = {
          kind: 'Enum',
          name: enumMatch[1] || '',
          range: this.createRange(lineNum, 0, lineNum, line.length),
        };
        ast.enums.push(currentBlock);
        continue;
      }

      // Behavior declaration
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
      if (behaviorMatch) {
        currentBlock = {
          kind: 'Behavior',
          name: behaviorMatch[1] || '',
          range: this.createRange(lineNum, 0, lineNum, line.length),
        };
        ast.behaviors.push(currentBlock);
        continue;
      }

      // Field declaration (inside entity/behavior)
      if (currentBlock && (currentBlock.kind === 'Entity' || currentBlock.kind === 'Behavior')) {
        const fieldMatch = trimmed.match(/^(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\??/);
        if (fieldMatch && currentBlock.fields) {
          currentBlock.fields.push({
            name: fieldMatch[1] || '',
            type: fieldMatch[2] || '',
            optional: trimmed.includes('?'),
            range: this.createRange(lineNum, 0, lineNum, line.length),
          });
        }
      }

      // Check for common errors
      if (braceDepth < 0) {
        errors.push({
          message: 'Unexpected closing brace',
          range: this.createRange(lineNum, line.indexOf('}'), lineNum, line.indexOf('}') + 1),
          severity: 'error',
          code: 'ISL002',
        });
        braceDepth = 0;
      }
    }

    // Check for unclosed braces
    if (braceDepth > 0) {
      errors.push({
        message: 'Unclosed brace',
        range: this.createRange(lines.length - 1, 0, lines.length - 1, 0),
        severity: 'error',
        code: 'ISL003',
      });
    }

    return { ast, errors };
  }

  /**
   * Extract symbols from AST
   */
  private extractSymbols(ast: DocumentAST, content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // Domain symbol
    if (ast.name) {
      symbols.push({
        name: ast.name,
        kind: SymbolKind.Module,
        range: this.createRange(0, 0, content.split('\n').length, 0),
        selectionRange: this.createRange(0, 0, 0, ast.name.length),
        detail: 'domain',
      });
    }

    // Entities
    for (const entity of ast.entities) {
      const children: SymbolInfo[] = [];
      
      for (const field of entity.fields || []) {
        children.push({
          name: field.name,
          kind: SymbolKind.Field,
          range: field.range,
          selectionRange: field.range,
          detail: field.type,
        });
      }

      symbols.push({
        name: entity.name,
        kind: SymbolKind.Class,
        range: entity.range,
        selectionRange: entity.range,
        detail: 'entity',
        children,
      });
    }

    // Types
    for (const type of ast.types) {
      symbols.push({
        name: type.name,
        kind: SymbolKind.TypeParameter,
        range: type.range,
        selectionRange: type.range,
        detail: 'type',
      });
    }

    // Enums
    for (const enumNode of ast.enums) {
      symbols.push({
        name: enumNode.name,
        kind: SymbolKind.Enum,
        range: enumNode.range,
        selectionRange: enumNode.range,
        detail: 'enum',
      });
    }

    // Behaviors
    for (const behavior of ast.behaviors) {
      symbols.push({
        name: behavior.name,
        kind: SymbolKind.Function,
        range: behavior.range,
        selectionRange: behavior.range,
        detail: 'behavior',
      });
    }

    return symbols;
  }

  /**
   * Get document symbols
   */
  getDocumentSymbols(uri: string): DocumentSymbol[] {
    const doc = this.documents.get(uri);
    if (!doc) return [];

    return doc.symbols.map(s => this.symbolInfoToDocumentSymbol(s));
  }

  /**
   * Find symbol at position
   */
  getSymbolAtPosition(uri: string, position: Position): SymbolInfo | null {
    const doc = this.documents.get(uri);
    if (!doc) return null;

    return this.findSymbolAtPosition(doc.symbols, position);
  }

  /**
   * Find all references to a symbol
   */
  findReferences(uri: string, position: Position): Location[] {
    const symbol = this.getSymbolAtPosition(uri, position);
    if (!symbol) return [];

    const locations: Location[] = [];

    // Search all documents
    for (const [docUri, doc] of this.documents) {
      const content = doc.content;
      const regex = new RegExp(`\\b${symbol.name}\\b`, 'g');
      let match;

      while ((match = regex.exec(content)) !== null) {
        const pos = this.offsetToPosition(content, match.index);
        locations.push({
          uri: docUri,
          range: {
            start: pos,
            end: { line: pos.line, character: pos.character + symbol.name.length },
          },
        });
      }
    }

    return locations;
  }

  /**
   * Prepare rename
   */
  prepareRename(uri: string, position: Position): Range | null {
    const symbol = this.getSymbolAtPosition(uri, position);
    if (!symbol) return null;
    return symbol.selectionRange;
  }

  /**
   * Do rename
   */
  doRename(uri: string, position: Position, newName: string): WorkspaceEdit | null {
    const symbol = this.getSymbolAtPosition(uri, position);
    if (!symbol) return null;

    const edit: WorkspaceEdit = { changes: {} };

    // Find all references and replace
    const references = this.findReferences(uri, position);
    for (const ref of references) {
      if (!edit.changes![ref.uri]) {
        edit.changes![ref.uri] = [];
      }
      edit.changes![ref.uri]!.push({
        range: ref.range,
        newText: newName,
      });
    }

    return edit;
  }

  /**
   * Get word at position
   */
  getWordAtPosition(content: string, position: Position): string | null {
    const lines = content.split('\n');
    const line = lines[position.line];
    if (!line) return null;

    // Find word boundaries
    let start = position.character;
    let end = position.character;

    while (start > 0 && /\w/.test(line[start - 1] || '')) start--;
    while (end < line.length && /\w/.test(line[end] || '')) end++;

    return line.substring(start, end) || null;
  }

  /**
   * Get type at position
   */
  getTypeAtPosition(uri: string, position: Position): string | null {
    const doc = this.documents.get(uri);
    if (!doc || !doc.ast) return null;

    const word = this.getWordAtPosition(doc.content, position);
    if (!word) return null;

    // Search for type in AST
    for (const entity of doc.ast.entities) {
      if (entity.name === word) return 'entity';
      for (const field of entity.fields || []) {
        if (field.name === word) return field.type;
      }
    }

    for (const type of doc.ast.types) {
      if (type.name === word) return 'type';
    }

    for (const enumNode of doc.ast.enums) {
      if (enumNode.name === word) return 'enum';
    }

    for (const behavior of doc.ast.behaviors) {
      if (behavior.name === word) return 'behavior';
    }

    return null;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private createRange(startLine: number, startChar: number, endLine: number, endChar: number): Range {
    return {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };
  }

  private offsetToPosition(content: string, offset: number): Position {
    const lines = content.substring(0, offset).split('\n');
    return {
      line: lines.length - 1,
      character: lines[lines.length - 1]?.length || 0,
    };
  }

  private findSymbolAtPosition(symbols: SymbolInfo[], position: Position): SymbolInfo | null {
    for (const symbol of symbols) {
      if (this.isPositionInRange(position, symbol.range)) {
        // Check children first
        if (symbol.children) {
          const child = this.findSymbolAtPosition(symbol.children, position);
          if (child) return child;
        }
        return symbol;
      }
    }
    return null;
  }

  private isPositionInRange(position: Position, range: Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) return false;
    if (position.line === range.start.line && position.character < range.start.character) return false;
    if (position.line === range.end.line && position.character > range.end.character) return false;
    return true;
  }

  private symbolInfoToDocumentSymbol(info: SymbolInfo): DocumentSymbol {
    return {
      name: info.name,
      kind: info.kind,
      range: info.range,
      selectionRange: info.selectionRange,
      detail: info.detail,
      children: info.children?.map(c => this.symbolInfoToDocumentSymbol(c)),
    };
  }

  private updateGlobalSymbols(uri: string, symbols: SymbolInfo[]): void {
    this.globalSymbols.set(uri, symbols);
  }
}
