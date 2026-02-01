// ============================================================================
// ISL Language Server
// ============================================================================

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem as VSCompletionItem,
  CompletionItemKind,
  Hover,
  Definition,
  DocumentSymbol,
  SymbolKind,
  SemanticTokensBuilder,
  Connection,
  TextDocumentPositionParams,
  DocumentSymbolParams,
  SemanticTokensParams,
  TextDocumentChangeEvent,
  CodeActionParams,
  CodeAction,
  CodeActionKind,
  DocumentFormattingParams,
  TextEdit,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from './documents.js';
import { ISLCompletionProvider } from './features/completion.js';
import { ISLHoverProvider } from './features/hover.js';
import { ISLDiagnosticsProvider } from './features/diagnostics.js';
import { ISLDefinitionProvider } from './features/definition.js';
import { ISLSymbolProvider } from './features/symbols.js';
import { ISLSemanticTokensProvider, TOKEN_TYPES, TOKEN_MODIFIERS } from './features/semantic-tokens.js';
import { ISLCodeActionProvider } from './features/actions.js';
import { ISLFormattingProvider } from './features/formatting.js';
import { DiagnosticSeverity } from '@intentos/lsp-core';

export class ISLServer {
  private connection: Connection;
  private documents: TextDocuments<TextDocument>;
  private documentManager: ISLDocumentManager;
  private completionProvider: ISLCompletionProvider;
  private hoverProvider: ISLHoverProvider;
  private diagnosticsProvider: ISLDiagnosticsProvider;
  private definitionProvider: ISLDefinitionProvider;
  private symbolProvider: ISLSymbolProvider;
  private semanticTokensProvider: ISLSemanticTokensProvider;
  private codeActionProvider: ISLCodeActionProvider;
  private formattingProvider: ISLFormattingProvider;
  private diagnosticTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.documentManager = new ISLDocumentManager();
    this.completionProvider = new ISLCompletionProvider(this.documentManager);
    this.hoverProvider = new ISLHoverProvider(this.documentManager);
    this.diagnosticsProvider = new ISLDiagnosticsProvider(this.documentManager);
    this.definitionProvider = new ISLDefinitionProvider(this.documentManager);
    this.symbolProvider = new ISLSymbolProvider(this.documentManager);
    this.semanticTokensProvider = new ISLSemanticTokensProvider(this.documentManager);
    this.codeActionProvider = new ISLCodeActionProvider(this.documentManager);
    this.formattingProvider = new ISLFormattingProvider();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Initialize
    this.connection.onInitialize((params: InitializeParams): InitializeResult => {
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            triggerCharacters: ['.', ':', '@', '{', '<'],
            resolveProvider: true,
          },
          hoverProvider: true,
          definitionProvider: true,
          documentSymbolProvider: true,
          documentFormattingProvider: true,
          codeActionProvider: {
            codeActionKinds: [
              CodeActionKind.QuickFix,
              CodeActionKind.Refactor,
              CodeActionKind.Source,
            ],
          },
          semanticTokensProvider: {
            legend: {
              tokenTypes: TOKEN_TYPES,
              tokenModifiers: TOKEN_MODIFIERS,
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

    // Document open - parse immediately
    this.documents.onDidOpen((event) => {
      this.documentManager.updateDocument(event.document, true);
      this.validateDocument(event.document);
    });

    // Document change - debounced parse
    this.documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
      this.documentManager.updateDocument(change.document, false);
      this.scheduleValidation(change.document);
    });

    // Document save - parse immediately and validate
    this.documents.onDidSave((event) => {
      const doc = this.documents.get(event.document.uri);
      if (doc) {
        this.documentManager.updateDocument(doc, true);
        this.validateDocument(doc);
      }
    });

    // Document close
    this.documents.onDidClose((event) => {
      this.documentManager.removeDocument(event.document.uri);
      this.clearDiagnostics(event.document.uri);
    });

    // Completion
    this.connection.onCompletion((params: TextDocumentPositionParams): VSCompletionItem[] => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];

      const items = this.completionProvider.provideCompletions(document, params.position);
      return items.map((item, index) => ({
        label: item.label,
        kind: this.mapCompletionKind(item.kind),
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.insertText,
        insertTextFormat: item.insertTextFormat === 'snippet' ? 2 : 1,
        sortText: item.sortText,
        filterText: item.filterText,
        preselect: item.preselect,
        deprecated: item.deprecated,
        data: index,
      }));
    });

    // Hover
    this.connection.onHover((params: TextDocumentPositionParams): Hover | null => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return null;

      const hover = this.hoverProvider.provideHover(document, params.position);
      if (!hover) return null;

      return {
        contents: {
          kind: 'markdown',
          value: hover.contents,
        },
        range: hover.range,
      };
    });

    // Go to definition
    this.connection.onDefinition((params: TextDocumentPositionParams): Definition | null => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return null;

      return this.definitionProvider.provideDefinition(document, params.position);
    });

    // Document symbols
    this.connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];

      const symbols = this.symbolProvider.provideSymbols(document);
      return symbols.map((sym) => this.mapSymbol(sym));
    });

    // Code actions
    this.connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];

      return this.codeActionProvider.provideCodeActions(document, params.range, params.context);
    });

    // Document formatting
    this.connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];

      return this.formattingProvider.format(document, params.options);
    });

    // Semantic tokens
    this.connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return { data: [] };

      const tokens = this.semanticTokensProvider.provideTokens(document);
      const builder = new SemanticTokensBuilder();

      for (const token of tokens) {
        builder.push(
          token.line,
          token.startChar,
          token.length,
          TOKEN_TYPES.indexOf(token.tokenType),
          this.encodeModifiers(token.tokenModifiers)
        );
      }

      return builder.build();
    });

    // Custom requests
    this.connection.onRequest('isl/validate', (params: { uri: string }) => {
      const document = this.documents.get(params.uri);
      if (!document) {
        return { valid: false, errors: ['Document not found'] };
      }

      // Force immediate parse
      this.documentManager.updateDocument(document, true);
      const diagnostics = this.documentManager.getDiagnostics(params.uri);
      const errors = diagnostics
        .filter(d => d.severity === DiagnosticSeverity.Error)
        .map(d => d.message);

      return { valid: errors.length === 0, errors };
    });

    // Listen
    this.documents.listen(this.connection);
  }

  private scheduleValidation(document: TextDocument): void {
    const uri = document.uri;

    // Clear existing timer
    const existing = this.diagnosticTimers.get(uri);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new validation after debounce
    const timer = setTimeout(() => {
      this.diagnosticTimers.delete(uri);
      const doc = this.documents.get(uri);
      if (doc) {
        this.validateDocument(doc);
      }
    }, 150); // 150ms debounce

    this.diagnosticTimers.set(uri, timer);
  }

  private validateDocument(document: TextDocument): void {
    // Ensure document is parsed
    this.documentManager.updateDocument(document, true);

    // Get diagnostics from document manager
    const diagnostics = this.documentManager.getDiagnostics(document.uri);

    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnostics.map((d) => ({
        range: ISLDocumentManager.toRange(d.location),
        message: d.message,
        severity: d.severity as 1 | 2 | 3 | 4,
        code: d.code,
        source: d.source,
        relatedInformation: d.relatedInfo?.map(r => ({
          location: {
            uri: document.uri,
            range: ISLDocumentManager.toRange(r.location),
          },
          message: r.message,
        })),
      })),
    });
  }

  private clearDiagnostics(uri: string): void {
    this.connection.sendDiagnostics({ uri, diagnostics: [] });
  }

  private mapCompletionKind(kind: string): CompletionItemKind {
    switch (kind) {
      case 'keyword': return CompletionItemKind.Keyword;
      case 'type': return CompletionItemKind.TypeParameter;
      case 'entity': return CompletionItemKind.Class;
      case 'behavior': return CompletionItemKind.Function;
      case 'field': return CompletionItemKind.Field;
      case 'snippet': return CompletionItemKind.Snippet;
      case 'function': return CompletionItemKind.Function;
      case 'variable': return CompletionItemKind.Variable;
      case 'enum': return CompletionItemKind.Enum;
      case 'property': return CompletionItemKind.Property;
      default: return CompletionItemKind.Text;
    }
  }

  private mapSymbol(sym: { name: string; kind: string; range: { start: { line: number; character: number }; end: { line: number; character: number } }; selectionRange: { start: { line: number; character: number }; end: { line: number; character: number } }; detail?: string; children?: unknown[] }): DocumentSymbol {
    return {
      name: sym.name,
      kind: this.mapSymbolKind(sym.kind),
      range: sym.range,
      selectionRange: sym.selectionRange,
      detail: sym.detail,
      children: sym.children?.map((c) => this.mapSymbol(c as typeof sym)),
    };
  }

  private mapSymbolKind(kind: string): SymbolKind {
    switch (kind) {
      case 'domain': return SymbolKind.Namespace;
      case 'entity': return SymbolKind.Class;
      case 'behavior': return SymbolKind.Function;
      case 'type': return SymbolKind.TypeParameter;
      case 'enum': return SymbolKind.Enum;
      case 'invariant': return SymbolKind.Interface;
      case 'policy': return SymbolKind.Interface;
      case 'view': return SymbolKind.Struct;
      case 'field': return SymbolKind.Field;
      case 'input': return SymbolKind.Variable;
      case 'output': return SymbolKind.Variable;
      case 'error': return SymbolKind.EnumMember;
      case 'lifecycle-state': return SymbolKind.EnumMember;
      case 'scenario': return SymbolKind.Event;
      case 'chaos': return SymbolKind.Event;
      case 'variant': return SymbolKind.EnumMember;
      default: return SymbolKind.Variable;
    }
  }

  private encodeModifiers(modifiers: string[]): number {
    let result = 0;
    for (const mod of modifiers) {
      const index = TOKEN_MODIFIERS.indexOf(mod as typeof TOKEN_MODIFIERS[number]);
      if (index >= 0) {
        result |= (1 << index);
      }
    }
    return result;
  }

  start(): void {
    this.connection.listen();
  }
}
