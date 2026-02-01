// ============================================================================
// ISL Definition Provider (Go to Definition)
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position, Location } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';

export class ISLDefinitionProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideDefinition(document: TextDocument, position: Position): Location | null {
    const word = this.documentManager.getWordAtPosition(document, position);
    if (!word) return null;

    // Skip built-in types
    if (this.isBuiltinType(word)) {
      return null;
    }

    // Find symbol definition in the index
    const symbol = this.documentManager.findSymbol(word);
    if (symbol) {
      return {
        uri: symbol.uri,
        range: {
          start: {
            line: symbol.selectionLocation.line - 1,
            character: symbol.selectionLocation.column - 1,
          },
          end: {
            line: symbol.selectionLocation.endLine - 1,
            character: symbol.selectionLocation.endColumn - 1,
          },
        },
      };
    }

    // Try to find in current document's symbols
    const docSymbols = this.documentManager.getSymbols(document.uri);
    const found = this.findSymbolByName(docSymbols, word);
    if (found) {
      return {
        uri: document.uri,
        range: {
          start: {
            line: found.selectionLocation.line - 1,
            character: found.selectionLocation.column - 1,
          },
          end: {
            line: found.selectionLocation.endLine - 1,
            character: found.selectionLocation.endColumn - 1,
          },
        },
      };
    }

    return null;
  }

  private isBuiltinType(name: string): boolean {
    const builtins = new Set([
      'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp',
      'Duration', 'Date', 'Time', 'List', 'Map', 'Set', 'Optional', 'Any',
    ]);
    return builtins.has(name);
  }

  private findSymbolByName(
    symbols: Array<{
      name: string;
      location: { line: number; column: number; endLine: number; endColumn: number };
      selectionLocation: { line: number; column: number; endLine: number; endColumn: number };
      children?: unknown[];
    }>,
    name: string
  ): { selectionLocation: { line: number; column: number; endLine: number; endColumn: number } } | undefined {
    for (const sym of symbols) {
      if (sym.name === name) return sym;
      if (sym.children) {
        const found = this.findSymbolByName(sym.children as typeof symbols, name);
        if (found) return found;
      }
    }
    return undefined;
  }
}
