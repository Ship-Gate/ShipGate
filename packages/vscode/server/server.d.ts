export declare class ISLServer {
    private connection;
    private documents;
    private documentManager;
    private completionProvider;
    private hoverProvider;
    private diagnosticsProvider;
    private definitionProvider;
    private symbolProvider;
    private semanticTokensProvider;
    constructor();
    private setupHandlers;
    private validateDocument;
    private mapCompletionKind;
    private mapSymbol;
    private mapSymbolKind;
    private mapSeverity;
    private encodeModifiers;
    start(): void;
}
//# sourceMappingURL=server.d.ts.map