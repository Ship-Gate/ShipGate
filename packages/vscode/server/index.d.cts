import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range, Diagnostic, Location, CodeActionContext, CodeAction, FormattingOptions, TextEdit } from 'vscode-languageserver';
import { AnalysisResult, Domain, ISLDiagnostic, ISLSymbolInfo, IndexedSymbol, CompletionContext, SourceLocation, ISLCompletionInfo, DiagnosticSeverity } from '@isl-lang/lsp-core';
export { CompletionKind, DiagnosticSeverity, ISLCompletionInfo, ISLDiagnostic, ISLSymbolInfo, SymbolKind } from '@isl-lang/lsp-core';
import { Import, ImportItem, SourceLocation as SourceLocation$1, Domain as Domain$1 } from '@isl-lang/parser';

declare class ISLServer {
    private connection;
    private documents;
    private documentManager;
    private completionProvider;
    private hoverProvider;
    private diagnosticsProvider;
    private definitionProvider;
    private symbolProvider;
    private semanticTokensProvider;
    private codeActionProvider;
    private formattingProvider;
    private diagnosticTimers;
    constructor();
    private setupHandlers;
    private scheduleValidation;
    private validateDocument;
    private clearDiagnostics;
    private mapCompletionKind;
    private mapSymbol;
    private mapSymbolKind;
    private encodeModifiers;
    start(): void;
}

interface ParsedDocument {
    uri: string;
    version: number;
    analysisResult: AnalysisResult;
    domain?: Domain;
}
declare class ISLDocumentManager {
    private parser;
    private symbolIndex;
    private documents;
    private pendingUpdates;
    private debounceMs;
    constructor();
    /**
     * Update a document with debouncing
     */
    updateDocument(document: TextDocument, immediate?: boolean): ParsedDocument | undefined;
    /**
     * Parse document immediately
     */
    private parseDocument;
    /**
     * Get cached document
     */
    getDocument(uri: string): ParsedDocument | undefined;
    /**
     * Remove document from cache
     */
    removeDocument(uri: string): void;
    /**
     * Get diagnostics for a document
     */
    getDiagnostics(uri: string): ISLDiagnostic[];
    /**
     * Get symbols for a document (for outline view)
     */
    getSymbols(uri: string): ISLSymbolInfo[];
    /**
     * Find symbol by name
     */
    findSymbol(name: string, kind?: string): IndexedSymbol | undefined;
    /**
     * Find symbol at position
     */
    getSymbolAtPosition(uri: string, position: Position): IndexedSymbol | undefined;
    /**
     * Get all symbols across all documents
     */
    getAllSymbols(): IndexedSymbol[];
    /**
     * Get entity names
     */
    getEntityNames(): string[];
    /**
     * Get behavior names
     */
    getBehaviorNames(): string[];
    /**
     * Get type names
     */
    getTypeNames(): string[];
    /**
     * Get fields for a parent symbol
     */
    getFields(parentName: string): IndexedSymbol[];
    /**
     * Get completion context at position
     */
    getCompletionContext(document: TextDocument, position: Position): CompletionContext;
    private determineContextType;
    private findParentSymbol;
    private isInPostcondition;
    /**
     * Get word at cursor position
     */
    getWordAtPosition(document: TextDocument, position: Position): string;
    /**
     * Get word range at position
     */
    getWordRangeAtPosition(document: TextDocument, position: Position): Range | undefined;
    /**
     * Convert ISL SourceLocation to LSP Range
     */
    static toRange(loc: SourceLocation): Range;
    /**
     * Convert LSP Position to ISL line/column (1-based)
     */
    static toISLPosition(position: Position): {
        line: number;
        column: number;
    };
}

declare class ISLCompletionProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideCompletions(document: TextDocument, position: Position): ISLCompletionInfo[];
    private getCustomTypeCompletions;
    private getEntityCompletions;
    private getBehaviorCompletions;
    private getMemberCompletions;
    private getAnnotationCompletions;
}

interface HoverResult {
    contents: string;
    range?: Range;
}
declare class ISLHoverProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideHover(document: TextDocument, position: Position): HoverResult | null;
    private findSymbolByName;
    private formatSymbolHover;
    private formatSymbolInfoHover;
}

interface ResolvedImport {
    /** The import statement in the source file */
    importStatement: Import;
    /** The resolved URI of the imported file */
    resolvedUri: string;
    /** Whether the import was successfully resolved */
    resolved: boolean;
    /** The imported items with their resolution status */
    items: ResolvedImportItem[];
    /** Diagnostics related to this import */
    diagnostics: ISLDiagnostic[];
}
interface ResolvedImportItem {
    /** The import item from the AST */
    item: ImportItem;
    /** Whether the item exists in the imported file */
    exists: boolean;
    /** The kind of the exported symbol (entity, type, behavior, etc.) */
    kind?: string;
    /** Location of the definition in the source file */
    definitionLocation?: SourceLocation$1;
}
interface ExportedSymbol {
    name: string;
    kind: 'entity' | 'type' | 'behavior' | 'invariant' | 'policy' | 'view' | 'enum';
    location: SourceLocation$1;
    uri: string;
}
interface ImportResolutionResult {
    /** All resolved imports for a document */
    imports: ResolvedImport[];
    /** All diagnostics from import resolution */
    diagnostics: ISLDiagnostic[];
    /** Map of imported names to their source definitions */
    importedSymbols: Map<string, ExportedSymbol>;
}
declare class ISLImportResolver {
    /** Cache of exported symbols per file URI */
    private exportCache;
    /** File content provider - allows testing without filesystem */
    private fileProvider;
    /** Domain cache for resolved files */
    private domainCache;
    constructor(fileProvider?: (uri: string) => Promise<string | undefined>);
    /**
     * Resolve all imports in a document
     */
    resolveImports(documentUri: string, domain: Domain$1): Promise<ImportResolutionResult>;
    /**
     * Resolve a single import statement
     */
    private resolveImport;
    /**
     * Get all exported symbols from a domain
     */
    getExports(uri: string, domain: Domain$1): Map<string, ExportedSymbol>;
    /**
     * Resolve an import path relative to the importing file
     */
    resolveImportPath(documentUri: string, importPath: string): string;
    /**
     * Load and parse a domain from a URI
     */
    private loadDomain;
    /**
     * Default file provider using filesystem
     */
    private defaultFileProvider;
    /**
     * Clear caches for a specific URI or all URIs
     */
    invalidate(uri?: string): void;
    /**
     * Set a custom file provider (useful for testing)
     */
    setFileProvider(provider: (uri: string) => Promise<string | undefined>): void;
    /**
     * Pre-populate domain cache (useful for testing)
     */
    setDomainCache(uri: string, domain: Domain$1 | undefined): void;
}

interface LintRule {
    id: string;
    name: string;
    description: string;
    severity: DiagnosticSeverity;
    category: 'correctness' | 'best-practice' | 'security' | 'performance' | 'style';
}
interface LintResult {
    rule: LintRule;
    diagnostic: ISLDiagnostic;
}
interface QuickfixData {
    type: string;
    [key: string]: unknown;
}
declare const LINT_RULES: Record<string, LintRule>;
declare class ISLSemanticLinter {
    private enabledRules;
    /**
     * Enable/disable specific rules
     */
    configureRules(enabled: string[], disabled: string[]): void;
    /**
     * Lint a domain and return all diagnostics
     */
    lint(domain: Domain$1, filePath: string): ISLDiagnostic[];
    private lintBehaviors;
    private lintEntities;
    private lintTypes;
    private lintScenarios;
    private lintSecurity;
    private createDiagnostic;
    private isStateMutating;
    private returnsList;
    private hasPagination;
    private isSensitiveFieldName;
    private fieldHasConstraints;
    private suggestConstraints;
    private collectUsedTypes;
    private isUnboundedList;
}

interface DiagnosticsResult {
    /** Standard diagnostics from parser and type checker */
    diagnostics: Diagnostic[];
    /** Import resolution result with imported symbols */
    importResolution?: ImportResolutionResult;
}
interface DiagnosticsOptions {
    /** Enable import-aware diagnostics */
    resolveImports?: boolean;
    /** Enable semantic lint warnings */
    semanticLinting?: boolean;
    /** Disabled lint rules */
    disabledRules?: string[];
}
declare class ISLDiagnosticsProvider {
    private documentManager;
    private importResolver;
    private semanticLinter;
    private options;
    constructor(documentManager: ISLDocumentManager);
    /**
     * Configure diagnostics options
     */
    configure(options: Partial<DiagnosticsOptions>): void;
    /**
     * Get disabled rules
     */
    getDisabledRules(): string[];
    /**
     * Get the import resolver (for testing)
     */
    getImportResolver(): ISLImportResolver;
    /**
     * Get the semantic linter (for testing)
     */
    getSemanticLinter(): ISLSemanticLinter;
    /**
     * Get diagnostics for a document
     * This method returns LSP-compatible diagnostics
     */
    provideDiagnostics(document: TextDocument): Diagnostic[];
    /**
     * Deduplicate diagnostics, preferring ones with data field
     */
    private deduplicateDiagnostics;
    /**
     * Get diagnostics with import resolution (async)
     * Returns both diagnostics and import resolution info
     */
    provideDiagnosticsWithImports(document: TextDocument): Promise<DiagnosticsResult>;
    /**
     * Validate type references against imported symbols
     * Returns diagnostics for types that reference imported symbols
     */
    validateImportedReferences(document: TextDocument, importedSymbols: Map<string, ExportedSymbol>): Diagnostic[];
    /**
     * Check a type reference for imported symbol usage
     */
    private checkTypeReference;
    /**
     * Find the import location for a symbol name
     */
    private findImportLocation;
    /**
     * Convert ISL diagnostic to LSP diagnostic
     */
    private convertDiagnostic;
    /**
     * Convert file path to URI if needed
     */
    private toFileUri;
}

declare class ISLDefinitionProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideDefinition(document: TextDocument, position: Position): Location | null;
    private isBuiltinType;
    private findSymbolByName;
}

interface DocumentSymbol {
    name: string;
    kind: string;
    range: Range;
    selectionRange: Range;
    detail?: string;
    children?: DocumentSymbol[];
}
declare class ISLSymbolProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideSymbols(document: TextDocument): DocumentSymbol[];
    private convertSymbol;
    private toRange;
}

declare class ISLCodeActionProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[];
    private createAddPostconditionAction;
    private createDefineTypeAction;
    private createRenameToUppercaseAction;
    private createRenameToLowercaseAction;
    private createGenerateScenarioAction;
    private createAddErrorCaseAction;
    private createGenerateCrudBehaviorsAction;
    private createAddErrorCaseForPreconditionAction;
    private createRemoveUnusedTypeAction;
    private createRenameToBehaviorAction;
    private createAddDescriptionAction;
    private createAddIdFieldAction;
    private createAddTemporalAction;
    private createAddConstraintsAction;
    private createAddSecurityAction;
    private createAddMaxSizeAction;
    private createAddPaginationAction;
    private createFileAction;
    private createReplaceImportAction;
    private createRemoveImportAction;
    private extractBehaviorName;
    private extractTypeName;
    private getWordAtRange;
    private isInBehavior;
    private isInOutput;
}

declare class ISLFormattingProvider {
    format(document: TextDocument, options: FormattingOptions): TextEdit[];
    private formatSource;
    private isTopLevelDeclaration;
    private formatLine;
    private normalizeOperators;
    private normalizeColons;
    private normalizeBraces;
    private normalizeAnnotations;
}

type SemanticTokenType = 'namespace' | 'type' | 'class' | 'enum' | 'interface' | 'struct' | 'typeParameter' | 'parameter' | 'variable' | 'property' | 'enumMember' | 'function' | 'method' | 'keyword' | 'modifier' | 'comment' | 'string' | 'number' | 'regexp' | 'operator' | 'decorator';
type SemanticTokenModifier = 'declaration' | 'definition' | 'readonly' | 'static' | 'deprecated' | 'abstract' | 'async' | 'modification' | 'documentation' | 'defaultLibrary';
interface SemanticToken {
    line: number;
    startChar: number;
    length: number;
    tokenType: SemanticTokenType;
    tokenModifiers: SemanticTokenModifier[];
}

declare const TOKEN_TYPES: SemanticTokenType[];
declare const TOKEN_MODIFIERS: SemanticTokenModifier[];
declare class ISLSemanticTokensProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideTokens(document: TextDocument): SemanticToken[];
    private tokenizeLine;
    private isInString;
}

export { type DiagnosticsOptions, type DiagnosticsResult, type ExportedSymbol, ISLCodeActionProvider, ISLCompletionProvider, ISLDefinitionProvider, ISLDiagnosticsProvider, ISLDocumentManager, ISLFormattingProvider, ISLHoverProvider, ISLImportResolver, ISLSemanticLinter, ISLSemanticTokensProvider, ISLServer, ISLSymbolProvider, type ImportResolutionResult, LINT_RULES, type LintResult, type LintRule, type QuickfixData, type ResolvedImport, type ResolvedImportItem, type SemanticToken, type SemanticTokenModifier, type SemanticTokenType, TOKEN_MODIFIERS, TOKEN_TYPES };
