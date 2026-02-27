"use strict";
// ============================================================================
// ISL Language Server
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLServer = void 0;
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const documents_1 = require("./documents");
const completion_1 = require("./features/completion");
const hover_1 = require("./features/hover");
const diagnostics_1 = require("./features/diagnostics");
const definition_1 = require("./features/definition");
const symbols_1 = require("./features/symbols");
const semantic_tokens_1 = require("./features/semantic-tokens");
class ISLServer {
    connection;
    documents;
    documentManager;
    completionProvider;
    hoverProvider;
    diagnosticsProvider;
    definitionProvider;
    symbolProvider;
    semanticTokensProvider;
    constructor() {
        this.connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
        this.documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
        this.documentManager = new documents_1.ISLDocumentManager();
        this.completionProvider = new completion_1.ISLCompletionProvider(this.documentManager);
        this.hoverProvider = new hover_1.ISLHoverProvider(this.documentManager);
        this.diagnosticsProvider = new diagnostics_1.ISLDiagnosticsProvider(this.documentManager);
        this.definitionProvider = new definition_1.ISLDefinitionProvider(this.documentManager);
        this.symbolProvider = new symbols_1.ISLSymbolProvider(this.documentManager);
        this.semanticTokensProvider = new semantic_tokens_1.ISLSemanticTokensProvider(this.documentManager);
        this.setupHandlers();
    }
    setupHandlers() {
        // Initialize
        this.connection.onInitialize((params) => {
            return {
                capabilities: {
                    textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
                    completionProvider: {
                        triggerCharacters: ['.', ':', '@', '{', '<'],
                        resolveProvider: true,
                    },
                    hoverProvider: true,
                    definitionProvider: true,
                    documentSymbolProvider: true,
                    documentFormattingProvider: true,
                    semanticTokensProvider: {
                        legend: {
                            tokenTypes: semantic_tokens_1.TOKEN_TYPES,
                            tokenModifiers: semantic_tokens_1.TOKEN_MODIFIERS,
                        },
                        full: true,
                    },
                    workspace: {
                        workspaceFolders: {
                            supported: true,
                        },
                    },
                },
            };
        });
        // Document events
        this.documents.onDidChangeContent((change) => {
            this.documentManager.updateDocument(change.document);
            this.validateDocument(change.document);
        });
        this.documents.onDidClose((event) => {
            this.documentManager.removeDocument(event.document.uri);
        });
        // Completion
        this.connection.onCompletion((params) => {
            const document = this.documents.get(params.textDocument.uri);
            if (!document)
                return [];
            const items = this.completionProvider.provideCompletions(document, params.position);
            return items.map((item, index) => ({
                label: item.label,
                kind: this.mapCompletionKind(item.kind),
                detail: item.detail,
                documentation: item.documentation,
                insertText: item.insertText,
                insertTextFormat: item.insertTextFormat === 'snippet' ? 2 : 1,
                data: index,
            }));
        });
        // Hover
        this.connection.onHover((params) => {
            const document = this.documents.get(params.textDocument.uri);
            if (!document)
                return null;
            const hover = this.hoverProvider.provideHover(document, params.position);
            if (!hover)
                return null;
            return {
                contents: {
                    kind: 'markdown',
                    value: hover.contents,
                },
                range: hover.range,
            };
        });
        // Go to definition
        this.connection.onDefinition((params) => {
            const document = this.documents.get(params.textDocument.uri);
            if (!document)
                return null;
            return this.definitionProvider.provideDefinition(document, params.position);
        });
        // Document symbols
        this.connection.onDocumentSymbol((params) => {
            const document = this.documents.get(params.textDocument.uri);
            if (!document)
                return [];
            const symbols = this.symbolProvider.provideSymbols(document);
            return symbols.map((sym) => this.mapSymbol(sym));
        });
        // Semantic tokens
        this.connection.languages.semanticTokens.on((params) => {
            const document = this.documents.get(params.textDocument.uri);
            if (!document)
                return { data: [] };
            const tokens = this.semanticTokensProvider.provideTokens(document);
            const builder = new node_1.SemanticTokensBuilder();
            for (const token of tokens) {
                builder.push(token.line, token.startChar, token.length, semantic_tokens_1.TOKEN_TYPES.indexOf(token.tokenType), this.encodeModifiers(token.tokenModifiers));
            }
            return builder.build();
        });
        // Listen
        this.documents.listen(this.connection);
    }
    validateDocument(document) {
        const diagnostics = this.diagnosticsProvider.provideDiagnostics(document);
        this.connection.sendDiagnostics({
            uri: document.uri,
            diagnostics: diagnostics.map((d) => ({
                range: d.range,
                message: d.message,
                severity: this.mapSeverity(d.severity),
                code: d.code,
                source: d.source,
            })),
        });
    }
    mapCompletionKind(kind) {
        switch (kind) {
            case 'keyword': return node_1.CompletionItemKind.Keyword;
            case 'type': return node_1.CompletionItemKind.TypeParameter;
            case 'entity': return node_1.CompletionItemKind.Class;
            case 'behavior': return node_1.CompletionItemKind.Function;
            case 'field': return node_1.CompletionItemKind.Field;
            case 'snippet': return node_1.CompletionItemKind.Snippet;
            case 'function': return node_1.CompletionItemKind.Function;
            default: return node_1.CompletionItemKind.Text;
        }
    }
    mapSymbol(sym) {
        return {
            name: sym.name,
            kind: this.mapSymbolKind(sym.kind),
            range: sym.range,
            selectionRange: sym.selectionRange,
            detail: sym.detail,
            children: sym.children?.map((c) => this.mapSymbol(c)),
        };
    }
    mapSymbolKind(kind) {
        switch (kind) {
            case 'domain': return node_1.SymbolKind.Namespace;
            case 'entity': return node_1.SymbolKind.Class;
            case 'behavior': return node_1.SymbolKind.Function;
            case 'type': return node_1.SymbolKind.TypeParameter;
            case 'invariant': return node_1.SymbolKind.Interface;
            case 'policy': return node_1.SymbolKind.Interface;
            case 'field': return node_1.SymbolKind.Field;
            case 'input': return node_1.SymbolKind.Variable;
            case 'output': return node_1.SymbolKind.Variable;
            case 'error': return node_1.SymbolKind.EnumMember;
            case 'state': return node_1.SymbolKind.EnumMember;
            default: return node_1.SymbolKind.Variable;
        }
    }
    mapSeverity(severity) {
        switch (severity) {
            case 'error': return 1;
            case 'warning': return 2;
            case 'info': return 3;
            case 'hint': return 4;
            default: return 3;
        }
    }
    encodeModifiers(modifiers) {
        let result = 0;
        for (const mod of modifiers) {
            const index = semantic_tokens_1.TOKEN_MODIFIERS.indexOf(mod);
            if (index >= 0) {
                result |= (1 << index);
            }
        }
        return result;
    }
    start() {
        this.connection.listen();
    }
}
exports.ISLServer = ISLServer;
//# sourceMappingURL=server.js.map