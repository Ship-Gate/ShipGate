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
import { ISLDocumentManager } from './documents';
import { ISLCompletionProvider } from './features/completion';
import { ISLHoverProvider } from './features/hover';
import { ISLDiagnosticsProvider } from './features/diagnostics';
import { ISLDefinitionProvider } from './features/definition';
import { ISLSymbolProvider } from './features/symbols';
import { ISLSemanticTokensProvider, TOKEN_TYPES, TOKEN_MODIFIERS } from './features/semantic-tokens';
import { ISLCodeActionProvider } from './features/actions';
import { ISLFormattingProvider } from './features/formatting';
import { ScannerDiagnosticsProvider, SOURCE_HOST, SOURCE_REALITY_GAP } from './features/scanner-diagnostics';
import { DiagnosticSeverity } from '@isl-lang/lsp-core';

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
  private scannerDiagnosticsProvider: ScannerDiagnosticsProvider;
  private diagnosticTimers = new Map<string, NodeJS.Timeout>();
  private lastScannerDiagnostics = new Map<string, import('vscode-languageserver/node').Diagnostic[]>();

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
    this.scannerDiagnosticsProvider = new ScannerDiagnosticsProvider();

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

      // Check for scanner diagnostic hover first
      const scannerHover = this.getScannerHover(params.textDocument.uri, params.position);
      if (scannerHover) return scannerHover;

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

      const actions = this.codeActionProvider.provideCodeActions(document, params.range, params.context);

      // Append scanner-specific code actions
      for (const diag of params.context.diagnostics) {
        if (diag.source !== SOURCE_HOST && diag.source !== SOURCE_REALITY_GAP) continue;

        const data = diag.data as { suggestion?: string; tier?: string; quickFixes?: Array<{ title: string; edit: string }> } | undefined;

        // Suppress-line action: insert a comment above the offending line
        const suppressComment = diag.source === SOURCE_HOST
          ? `// vibecheck-ignore`
          : `// islstudio-ignore ${diag.code}`;

        actions.push({
          title: `Suppress ${diag.code} for this line`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [document.uri]: [
                TextEdit.insert(
                  { line: diag.range.start.line, character: 0 },
                  suppressComment + '\n'
                ),
              ],
            },
          },
        });

        // Surface quickFixes from scanner data if present
        if (data?.quickFixes) {
          for (const fix of data.quickFixes) {
            actions.push({
              title: fix.title,
              kind: CodeActionKind.QuickFix,
              diagnostics: [diag],
              edit: {
                changes: {
                  [document.uri]: [
                    TextEdit.replace(diag.range, fix.edit),
                  ],
                },
              },
            });
          }
        }
      }

      return actions;
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

    // Get diagnostics from document manager (parser + semantic)
    const islDiagnostics = this.documentManager.getDiagnostics(document.uri);

    const parserDiagnostics = islDiagnostics.map((d) => ({
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
    }));

    // Send parser diagnostics immediately for fast feedback
    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: parserDiagnostics,
    });

    // Run scanner diagnostics asynchronously, then merge and re-send
    this.runScannerDiagnostics(document, parserDiagnostics);
  }

  /**
   * Run Host + Reality-Gap scanners async and merge with parser diagnostics.
   * Suppressions and safelists are applied inside the firewall.
   */
  private async runScannerDiagnostics(
    document: TextDocument,
    parserDiagnostics: import('vscode-languageserver/node').Diagnostic[]
  ): Promise<void> {
    try {
      if (!this.scannerDiagnosticsProvider.isSupported(document)) {
        // Clear any stale scanner diagnostics for non-supported files
        this.lastScannerDiagnostics.delete(document.uri);
        return;
      }

      const scannerDiags = await this.scannerDiagnosticsProvider.provideDiagnostics(document);
      this.lastScannerDiagnostics.set(document.uri, scannerDiags);

      // Merge parser + scanner, deduplicate by code:line:char
      const merged = this.deduplicateDiagnostics([...parserDiagnostics, ...scannerDiags]);

      // Re-send with merged results
      this.connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: merged,
      });
    } catch (err) {
      // Scanner failure should not break the LSP — log and continue
      console.error('[scanner-diagnostics] Error:', err);
    }
  }

  /**
   * Deduplicate diagnostics by code + start position.
   * Prefers entries with richer data (e.g. scanner entries with suggestions).
   */
  private deduplicateDiagnostics(
    diagnostics: import('vscode-languageserver/node').Diagnostic[]
  ): import('vscode-languageserver/node').Diagnostic[] {
    const byKey = new Map<string, import('vscode-languageserver/node').Diagnostic>();
    for (const d of diagnostics) {
      const key = `${d.code}:${d.range.start.line}:${d.range.start.character}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, d);
      } else if (d.data && !existing.data) {
        byKey.set(key, d);
      }
    }
    return Array.from(byKey.values());
  }

  private clearDiagnostics(uri: string): void {
    this.lastScannerDiagnostics.delete(uri);
    this.connection.sendDiagnostics({ uri, diagnostics: [] });
  }

  /**
   * Return hover info for scanner diagnostics at the given position.
   * Shows tier, source, and suggestion if available.
   */
  private getScannerHover(uri: string, position: { line: number; character: number }): Hover | null {
    const scannerDiags = this.lastScannerDiagnostics.get(uri);
    if (!scannerDiags || scannerDiags.length === 0) return null;

    // Find scanner diagnostics whose range contains the position
    const matching = scannerDiags.filter(d => {
      const r = d.range;
      if (position.line < r.start.line || position.line > r.end.line) return false;
      if (position.line === r.start.line && position.character < r.start.character) return false;
      if (position.line === r.end.line && position.character > r.end.character) return false;
      return true;
    });

    if (matching.length === 0) return null;

    const parts: string[] = [];
    for (const d of matching) {
      const data = d.data as { suggestion?: string; tier?: string; quickFixes?: unknown[] } | undefined;
      const tierLabel = data?.tier === 'hard_block' ? '🔴 Hard Block'
        : data?.tier === 'soft_block' ? '🟡 Soft Block'
        : '🔵 Warning';
      const sourceLabel = d.source === SOURCE_HOST ? 'Host Scanner' : 'Reality-Gap Scanner';

      let md = `**${sourceLabel}** — ${tierLabel}\n\n`;
      md += `**\`${d.code}\`**: ${d.message}\n`;
      if (data?.suggestion) {
        md += `\n💡 **Suggestion:** ${data.suggestion}\n`;
      }
      parts.push(md);
    }

    return {
      contents: {
        kind: 'markdown',
        value: parts.join('\n---\n'),
      },
      range: matching[0]!.range,
    };
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
