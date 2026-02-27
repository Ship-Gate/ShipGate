// ============================================================================
// ISL Document Manager
// Manages document state and integrates with the ISL analyzer
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Range, Position } from 'vscode-languageserver';
import {
  IncrementalParser,
  SymbolIndex,
  type AnalysisResult,
  type ISLSymbolInfo,
  type ISLDiagnostic,
  type IndexedSymbol,
  type CompletionContext,
  type ContextType,
  type SourceLocation,
  type Domain,
} from '@isl-lang/lsp-core';

// ============================================================================
// Types
// ============================================================================

export interface ParsedDocument {
  uri: string;
  version: number;
  analysisResult: AnalysisResult;
  domain?: Domain;
}

// ============================================================================
// Document Manager
// ============================================================================

export class ISLDocumentManager {
  private parser: IncrementalParser;
  private symbolIndex: SymbolIndex;
  private documents = new Map<string, ParsedDocument>();
  private pendingUpdates = new Map<string, NodeJS.Timeout>();
  private debounceMs = 150;

  constructor() {
    this.parser = new IncrementalParser();
    this.symbolIndex = new SymbolIndex();
  }

  /**
   * Update a document with debouncing
   */
  updateDocument(document: TextDocument, immediate = false): ParsedDocument | undefined {
    const uri = document.uri;

    // Clear any pending update
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }

    if (immediate) {
      return this.parseDocument(document);
    }

    // Schedule debounced update
    const timeout = setTimeout(() => {
      this.pendingUpdates.delete(uri);
      this.parseDocument(document);
    }, this.debounceMs);

    this.pendingUpdates.set(uri, timeout);
    return this.documents.get(uri);
  }

  /**
   * Parse document immediately
   */
  private parseDocument(document: TextDocument): ParsedDocument {
    const uri = document.uri;
    const source = document.getText();

    // Parse and analyze
    const { result } = this.parser.parse(uri, source, document.version, {
      typeCheck: true,
    });

    // Update symbol index
    this.symbolIndex.indexSymbols(uri, result.symbols);

    // Create parsed document
    const parsed: ParsedDocument = {
      uri,
      version: document.version,
      analysisResult: result,
      domain: result.domain,
    };

    this.documents.set(uri, parsed);
    return parsed;
  }

  /**
   * Get cached document
   */
  getDocument(uri: string): ParsedDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Remove document from cache
   */
  removeDocument(uri: string): void {
    // Clear pending update
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }

    // Remove from caches
    this.documents.delete(uri);
    this.parser.invalidate(uri);
    this.symbolIndex.clearDocument(uri);
  }

  /**
   * Get diagnostics for a document
   */
  getDiagnostics(uri: string): ISLDiagnostic[] {
    const doc = this.documents.get(uri);
    return doc?.analysisResult.diagnostics || [];
  }

  /**
   * Get symbols for a document (for outline view)
   */
  getSymbols(uri: string): ISLSymbolInfo[] {
    const doc = this.documents.get(uri);
    return doc?.analysisResult.symbols || [];
  }

  // ============================================================================
  // Symbol Lookup
  // ============================================================================

  /**
   * Find symbol by name
   */
  findSymbol(name: string, kind?: string): IndexedSymbol | undefined {
    return this.symbolIndex.findDefinition(name, kind as IndexedSymbol['kind']);
  }

  /**
   * Find symbol at position
   */
  getSymbolAtPosition(uri: string, position: Position): IndexedSymbol | undefined {
    // First check the symbol index
    const indexedSym = this.symbolIndex.findAtPosition(uri, position.line + 1, position.character + 1);
    if (indexedSym) return indexedSym;

    // Fallback: find by word at position
    const doc = this.documents.get(uri);
    if (!doc) return undefined;

    return undefined;
  }

  /**
   * Get all symbols across all documents
   */
  getAllSymbols(): IndexedSymbol[] {
    return this.symbolIndex.find({});
  }

  /**
   * Get entity names
   */
  getEntityNames(): string[] {
    return this.symbolIndex.getEntityNames();
  }

  /**
   * Get behavior names
   */
  getBehaviorNames(): string[] {
    return this.symbolIndex.getBehaviorNames();
  }

  /**
   * Get type names
   */
  getTypeNames(): string[] {
    return this.symbolIndex.getTypeNames();
  }

  /**
   * Get fields for a parent symbol
   */
  getFields(parentName: string): IndexedSymbol[] {
    return this.symbolIndex.getFields(parentName);
  }

  // ============================================================================
  // Context Analysis
  // ============================================================================

  /**
   * Get completion context at position
   */
  getCompletionContext(document: TextDocument, position: Position): CompletionContext {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const linePrefix = line.substring(0, position.character);

    // Find word prefix
    const prefixMatch = linePrefix.match(/[\w@.]*$/);
    const prefix = prefixMatch ? prefixMatch[0] : '';

    // Find trigger character
    const triggerChar = prefix.length > 0 ? undefined : 
      linePrefix.length > 0 ? linePrefix[linePrefix.length - 1] : undefined;

    // Determine context type
    const contextType = this.determineContextType(lines, position);

    return {
      contextType,
      triggerCharacter: triggerChar,
      prefix,
      line,
      position: { line: position.line, character: position.character },
      parentSymbol: this.findParentSymbol(lines, position),
      inPostcondition: this.isInPostcondition(lines, position.line),
    };
  }

  private determineContextType(lines: string[], position: Position): ContextType {
    let braceDepth = 0;
    let currentBlock = '';
    let currentSection = '';

    for (let i = 0; i <= position.line; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();

      // Track brace depth
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      // Track current block
      if (trimmed.match(/^domain\s+\w+/)) {
        currentBlock = 'domain';
        currentSection = '';
      } else if (trimmed.match(/^entity\s+\w+/)) {
        currentBlock = 'entity';
        currentSection = '';
      } else if (trimmed.match(/^behavior\s+\w+/)) {
        currentBlock = 'behavior';
        currentSection = '';
      } else if (trimmed.match(/^invariant\s+\w+/)) {
        currentBlock = 'invariant';
        currentSection = '';
      } else if (trimmed.match(/^policy\s+\w+/)) {
        currentBlock = 'policy';
        currentSection = '';
      } else if (trimmed.match(/^view\s+\w+/)) {
        currentBlock = 'view';
        currentSection = '';
      } else if (trimmed.match(/^scenarios?\s+\w+/)) {
        currentBlock = 'scenario';
        currentSection = '';
      } else if (trimmed.match(/^chaos\s+\w+/)) {
        currentBlock = 'chaos';
        currentSection = '';
      } else if (trimmed.match(/^type\s+\w+\s*=\s*\w+\s*\{/)) {
        currentBlock = 'type-constraint';
        currentSection = 'constraint';
      }

      // Track actor/endpoint blocks
      if (trimmed === 'actors {') currentSection = 'actors';
      else if (trimmed.startsWith('api {') || trimmed === 'endpoint {') currentSection = 'endpoint';
      // Track sections within blocks
      if (trimmed === 'input {') currentSection = 'input';
      else if (trimmed === 'output {') currentSection = 'output';
      else if (trimmed.startsWith('preconditions {') || trimmed === 'pre {') currentSection = 'pre';
      else if (trimmed.startsWith('postconditions {') || trimmed === 'post {') currentSection = 'post';
      else if (trimmed === 'invariants {') currentSection = 'invariant';
      else if (trimmed === 'temporal {') currentSection = 'temporal';
      else if (trimmed === 'security {') currentSection = 'security';
      else if (trimmed === 'lifecycle {') currentSection = 'lifecycle';
    }

    // Check current line for type annotation context
    const currentLine = lines[position.line] || '';
    const beforeCursor = currentLine.substring(0, position.character);
    if (beforeCursor.match(/:\s*$/)) {
      return 'type-annotation';
    }

    // Return context based on tracking
    if (braceDepth === 0) return 'top-level';
    if (braceDepth === 1 && !currentBlock) return 'domain';

    switch (currentBlock) {
      case 'entity':
        if (currentSection === 'invariant') return 'expression';
        if (currentSection === 'lifecycle') return 'entity-field';
        return 'entity-field';
      case 'behavior':
        switch (currentSection) {
          case 'input': return 'behavior-input';
          case 'output': return 'behavior-output';
          case 'pre': return 'behavior-pre';
          case 'post': return 'behavior-post';
          case 'invariant': return 'behavior-invariant';
          case 'temporal': return 'behavior-temporal';
          case 'security': return 'behavior-security';
          case 'actors': return 'actor-block';
          case 'endpoint': return 'endpoint-block';
          default: return 'behavior';
        }
      case 'invariant':
        return 'invariant';
      case 'policy':
        return 'policy';
      case 'view':
        return 'view';
      case 'scenario':
        return 'scenario';
      case 'chaos':
        return 'chaos';
      case 'type-constraint':
        return currentSection === 'constraint' ? 'constraint-block' : 'domain';
      default:
        return 'domain';
    }
  }

  private findParentSymbol(lines: string[], position: Position): string | undefined {
    for (let i = position.line; i >= 0; i--) {
      const line = lines[i] || '';
      const trimmed = line.trim();

      const entityMatch = trimmed.match(/^entity\s+(\w+)/);
      if (entityMatch) return entityMatch[1];

      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
      if (behaviorMatch) return behaviorMatch[1];

      const domainMatch = trimmed.match(/^domain\s+(\w+)/);
      if (domainMatch) return domainMatch[1];
    }

    return undefined;
  }

  private isInPostcondition(lines: string[], lineNum: number): boolean {
    let braceDepth = 0;

    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i]?.trim() || '';
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;

      if ((line.startsWith('postconditions {') || line === 'post {') && braceDepth <= 0) {
        return true;
      }
      if ((line.startsWith('preconditions {') || line === 'pre {') && braceDepth <= 0) {
        return false;
      }
    }

    return false;
  }

  // ============================================================================
  // Word at Position
  // ============================================================================

  /**
   * Get word at cursor position
   */
  getWordAtPosition(document: TextDocument, position: Position): string {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line];
    if (!line) return '';

    // Find word boundaries
    let start = position.character;
    let end = position.character;

    while (start > 0 && /[\w]/.test(line[start - 1] || '')) {
      start--;
    }
    while (end < line.length && /[\w]/.test(line[end] || '')) {
      end++;
    }

    return line.substring(start, end);
  }

  /**
   * Get word range at position
   */
  getWordRangeAtPosition(document: TextDocument, position: Position): Range | undefined {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line];
    if (!line) return undefined;

    let start = position.character;
    let end = position.character;

    while (start > 0 && /[\w]/.test(line[start - 1] || '')) {
      start--;
    }
    while (end < line.length && /[\w]/.test(line[end] || '')) {
      end++;
    }

    if (start === end) return undefined;

    return {
      start: { line: position.line, character: start },
      end: { line: position.line, character: end },
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Convert ISL SourceLocation to LSP Range
   */
  static toRange(loc: SourceLocation): Range {
    return {
      start: { line: loc.line - 1, character: loc.column - 1 },
      end: { line: loc.endLine - 1, character: loc.endColumn - 1 },
    };
  }

  /**
   * Convert LSP Position to ISL line/column (1-based)
   */
  static toISLPosition(position: Position): { line: number; column: number } {
    return {
      line: position.line + 1,
      column: position.character + 1,
    };
  }
}
