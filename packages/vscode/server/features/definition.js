"use strict";
// ============================================================================
// ISL Definition Provider (Go to Definition)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLDefinitionProvider = void 0;
class ISLDefinitionProvider {
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    provideDefinition(document, position) {
        const word = this.documentManager.getWordAtPosition(document, position);
        if (!word)
            return null;
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
exports.ISLDefinitionProvider = ISLDefinitionProvider;
//# sourceMappingURL=definition.js.map