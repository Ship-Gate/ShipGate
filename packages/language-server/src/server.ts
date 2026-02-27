/**
 * ISL Language Server
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  Hover,
  Definition,
  DocumentSymbol,
  DidChangeConfigurationNotification,
  TextDocumentPositionParams,
  DocumentSymbolParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { ISLAnalyzer } from './analyzer';
import { getCompletions } from './completions';
import { getDiagnostics } from './diagnostics';
import { getHover } from './hover';
import { getDefinition } from './definitions';
import { getDocumentSymbols } from './symbols';

/**
 * ISL Language Server settings
 */
export interface ISLSettings {
  maxNumberOfProblems: number;
  enableSemanticAnalysis: boolean;
  enableAutoComplete: boolean;
  trace: {
    server: 'off' | 'messages' | 'verbose';
  };
}

const defaultSettings: ISLSettings = {
  maxNumberOfProblems: 100,
  enableSemanticAnalysis: true,
  enableAutoComplete: true,
  trace: { server: 'off' },
};

/**
 * Create and start the language server
 */
export function startServer(): void {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);
  const analyzer = new ISLAnalyzer();

  let hasConfigurationCapability = false;
  let hasWorkspaceFolderCapability = false;
  let globalSettings: ISLSettings = defaultSettings;
  const documentSettings = new Map<string, Thenable<ISLSettings>>();

  // Initialize
  connection.onInitialize((params: InitializeParams): InitializeResult => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', ':', '@', '{', '('],
        },
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        codeActionProvider: true,
        documentFormattingProvider: true,
        renameProvider: true,
        foldingRangeProvider: true,
        signatureHelpProvider: {
          triggerCharacters: ['(', ','],
        },
      },
    };

    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true,
        },
      };
    }

    return result;
  });

  connection.onInitialized(() => {
    if (hasConfigurationCapability) {
      connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined
      );
    }

    connection.console.log('ISL Language Server initialized');
  });

  // Configuration
  connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
      documentSettings.clear();
    } else {
      globalSettings = {
        ...defaultSettings,
        ...(change.settings.isl || {}),
      };
    }

    // Re-validate all documents
    documents.all().forEach((doc) => validateDocument(doc));
  });

  // Document events
  documents.onDidChangeContent((change) => {
    validateDocument(change.document);
  });

  documents.onDidClose((event) => {
    documentSettings.delete(event.document.uri);
    analyzer.removeDocument(event.document.uri);
  });

  // Validation
  async function validateDocument(document: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(document.uri);
    const diagnostics = getDiagnostics(document, analyzer, settings);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  }

  function getDocumentSettings(uri: string): Thenable<ISLSettings> {
    if (!hasConfigurationCapability) {
      return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(uri);
    if (!result) {
      result = connection.workspace.getConfiguration({
        scopeUri: uri,
        section: 'isl',
      });
      documentSettings.set(uri, result);
    }
    return result;
  }

  // Completions
  connection.onCompletion(
    async (params: TextDocumentPositionParams): Promise<CompletionItem[]> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];

      return getCompletions(document, params.position, analyzer);
    }
  );

  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // Add additional details to completion item
    return item;
  });

  // Hover
  connection.onHover(
    async (params: TextDocumentPositionParams): Promise<Hover | null> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return null;

      return getHover(document, params.position, analyzer);
    }
  );

  // Go to definition
  connection.onDefinition(
    async (params: TextDocumentPositionParams): Promise<Definition | null> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return null;

      return getDefinition(document, params.position, analyzer);
    }
  );

  // Document symbols
  connection.onDocumentSymbol(
    async (params: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];

      return getDocumentSymbols(document, analyzer);
    }
  );

  // Start listening
  documents.listen(connection);
  connection.listen();
}

// Start server when run directly
if (require.main === module) {
  startServer();
}
