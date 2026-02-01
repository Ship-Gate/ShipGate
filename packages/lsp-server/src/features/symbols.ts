// ============================================================================
// ISL Document Symbol Provider
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ISLDocumentManager } from '../documents';
import type { ISLSymbol } from '../types';

export class ISLSymbolProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideSymbols(document: TextDocument): ISLSymbol[] {
    const parsed = this.documentManager.getDocument(document.uri);
    if (!parsed) {
      // Parse document if not already parsed
      this.documentManager.updateDocument(document);
      return this.documentManager.getDocument(document.uri)?.symbols || [];
    }
    return parsed.symbols;
  }
}
