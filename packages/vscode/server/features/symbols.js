"use strict";
// ============================================================================
// ISL Document Symbol Provider
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLSymbolProvider = void 0;
class ISLSymbolProvider {
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    provideSymbols(document) {
        const parsed = this.documentManager.getDocument(document.uri);
        if (!parsed) {
            // Parse document if not already parsed
            this.documentManager.updateDocument(document);
            return this.documentManager.getDocument(document.uri)?.symbols || [];
        }
        return parsed.symbols;
    }
}
exports.ISLSymbolProvider = ISLSymbolProvider;
//# sourceMappingURL=symbols.js.map