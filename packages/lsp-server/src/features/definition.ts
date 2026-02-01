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

    // Find symbol definition
    const symbol = this.documentManager.findSymbol(word);
    if (symbol) {
      // Find which document contains this symbol
      const parsed = this.documentManager.getDocument(document.uri);
      if (parsed) {
        const found = parsed.symbols.find(s => s.name === word);
        if (found) {
          return {
            uri: document.uri,
            range: found.selectionRange,
          };
        }
      }
    }

    // Check references in current document
    const parsed = this.documentManager.getDocument(document.uri);
    if (parsed) {
      for (const ref of parsed.references) {
        if (ref.name === word && ref.definitionUri && ref.definitionRange) {
          return {
            uri: ref.definitionUri,
            range: ref.definitionRange,
          };
        }
      }
    }

    return null;
  }
}
