// ============================================================================
// ISL Document Symbol Provider
// Provides document outline/symbols for the editor
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Range } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import { ISLDocumentManager as DocManager } from '../documents';
import type { ISLSymbolInfo, SourceLocation } from '@isl-lang/lsp-core';

export interface DocumentSymbol {
  name: string;
  kind: string;
  range: Range;
  selectionRange: Range;
  detail?: string;
  children?: DocumentSymbol[];
}

export class ISLSymbolProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideSymbols(document: TextDocument): DocumentSymbol[] {
    // Ensure document is parsed
    this.documentManager.updateDocument(document, true);

    // Get symbols from the analyzer
    const symbols = this.documentManager.getSymbols(document.uri);

    // Convert to document symbols
    return symbols.map(sym => this.convertSymbol(sym));
  }

  private convertSymbol(sym: ISLSymbolInfo): DocumentSymbol {
    return {
      name: sym.name,
      kind: sym.kind,
      range: this.toRange(sym.location),
      selectionRange: this.toRange(sym.selectionLocation),
      detail: sym.detail,
      children: sym.children?.map(child => this.convertSymbol(child)),
    };
  }

  private toRange(loc: { line: number; column: number; endLine: number; endColumn: number }): Range {
    return {
      start: { line: loc.line - 1, character: loc.column - 1 },
      end: { line: loc.endLine - 1, character: loc.endColumn - 1 },
    };
  }
}
