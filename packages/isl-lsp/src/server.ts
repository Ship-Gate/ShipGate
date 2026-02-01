#!/usr/bin/env node
/**
 * ISL Language Server
 * 
 * Main entry point for the LSP server.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Hover,
  Definition,
  TextEdit,
  CodeAction,
  CodeActionKind,
  Connection,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from './services/language-service.js';
import { CompletionProvider } from './providers/completion.js';
import { DiagnosticProvider } from './providers/diagnostics.js';
import { HoverProvider } from './providers/hover.js';
import { DefinitionProvider } from './providers/definition.js';
import { FormattingProvider } from './providers/formatting.js';
import { CodeActionProvider } from './providers/code-actions.js';

// ============================================================================
// Server State
// ============================================================================

let connection: Connection;
let documents: TextDocuments<TextDocument>;
let languageService: ISLLanguageService;
let completionProvider: CompletionProvider;
let diagnosticProvider: DiagnosticProvider;
let hoverProvider: HoverProvider;
let definitionProvider: DefinitionProvider;
let formattingProvider: FormattingProvider;
let codeActionProvider: CodeActionProvider;

// ============================================================================
// Server Creation
// ============================================================================

export function createServer(): Connection {
  connection = createConnection(ProposedFeatures.all);
  documents = new TextDocuments(TextDocument);

  // Initialize providers
  languageService = new ISLLanguageService();
  completionProvider = new CompletionProvider(languageService);
  diagnosticProvider = new DiagnosticProvider(languageService);
  hoverProvider = new HoverProvider(languageService);
  definitionProvider = new DefinitionProvider(languageService);
  formattingProvider = new FormattingProvider(languageService);
  codeActionProvider = new CodeActionProvider(languageService);

  // Register handlers
  registerHandlers();

  // Start listening
  documents.listen(connection);
  
  return connection;
}

export function startServer(): void {
  const conn = createServer();
  conn.listen();
}

// ============================================================================
// Handler Registration
// ============================================================================

function registerHandlers(): void {
  // Initialize
  connection.onInitialize((params: InitializeParams): InitializeResult => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', ':', '{', '<', '@', '"'],
        },
        hoverProvider: true,
        definitionProvider: true,
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        codeActionProvider: {
          codeActionKinds: [
            CodeActionKind.QuickFix,
            CodeActionKind.Refactor,
            CodeActionKind.Source,
          ],
        },
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        referencesProvider: true,
        renameProvider: {
          prepareProvider: true,
        },
        foldingRangeProvider: true,
        semanticTokensProvider: {
          legend: {
            tokenTypes: [
              'keyword', 'type', 'class', 'enum', 'interface',
              'struct', 'typeParameter', 'parameter', 'variable',
              'property', 'enumMember', 'function', 'method',
              'macro', 'comment', 'string', 'number', 'regexp', 'operator',
            ],
            tokenModifiers: [
              'declaration', 'definition', 'readonly', 'static',
              'deprecated', 'abstract', 'async', 'modification',
              'documentation', 'defaultLibrary',
            ],
          },
          full: true,
        },
      },
    };
  });

  // Document changes
  documents.onDidChangeContent(change => {
    validateDocument(change.document);
  });

  documents.onDidOpen(event => {
    languageService.openDocument(event.document.uri, event.document.getText());
    validateDocument(event.document);
  });

  documents.onDidClose(event => {
    languageService.closeDocument(event.document.uri);
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
  });

  // Completion
  connection.onCompletion((params): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return completionProvider.provideCompletions(document, params.position);
  });

  connection.onCompletionResolve((item): CompletionItem => {
    return completionProvider.resolveCompletion(item);
  });

  // Hover
  connection.onHover((params): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return hoverProvider.provideHover(document, params.position);
  });

  // Definition
  connection.onDefinition((params): Definition | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return definitionProvider.provideDefinition(document, params.position);
  });

  // Formatting
  connection.onDocumentFormatting((params): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return formattingProvider.formatDocument(document, params.options);
  });

  connection.onDocumentRangeFormatting((params): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return formattingProvider.formatRange(document, params.range, params.options);
  });

  // Code Actions
  connection.onCodeAction((params): CodeAction[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return codeActionProvider.provideCodeActions(document, params.range, params.context);
  });

  // Document Symbols
  connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return languageService.getDocumentSymbols(document.uri);
  });

  // References
  connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return languageService.findReferences(document.uri, params.position);
  });

  // Rename
  connection.onPrepareRename((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return languageService.prepareRename(document.uri, params.position);
  });

  connection.onRenameRequest((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return languageService.doRename(document.uri, params.position, params.newName);
  });
}

// ============================================================================
// Validation
// ============================================================================

async function validateDocument(document: TextDocument): Promise<void> {
  const diagnostics = diagnosticProvider.validateDocument(document);
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

// ============================================================================
// Main
// ============================================================================

// Auto-start when run directly
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  startServer();
}
