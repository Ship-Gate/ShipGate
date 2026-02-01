#!/usr/bin/env node
/**
 * ISL Language Server
 * 
 * Language Server Protocol implementation for ISL.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind as LSPSymbolKind,
  HoverParams,
  Hover,
  DefinitionParams,
  Location,
  ReferenceParams,
  CodeActionParams,
  CodeAction,
  CodeActionKind,
  TextEdit,
  FormattingOptions,
  DocumentFormattingParams,
  FoldingRangeParams,
  FoldingRange,
  FoldingRangeKind,
  SemanticTokensParams,
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { parse, type Symbol, type ParseResult } from './parser.js';
import { getCompletions } from './completions.js';
import { getHover } from './hover.js';
import { getDiagnostics } from './diagnostics.js';

// ─────────────────────────────────────────────────────────────────────────────
// Server Setup
// ─────────────────────────────────────────────────────────────────────────────

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Document cache
const parseCache = new Map<string, ParseResult>();

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Tokens
// ─────────────────────────────────────────────────────────────────────────────

const tokenTypes = [
  'namespace',    // domain
  'type',         // entity, type
  'enum',         // enum
  'function',     // behavior
  'parameter',    // input/output params
  'property',     // fields
  'keyword',      // keywords
  'string',       // strings
  'number',       // numbers
  'comment',      // comments
  'operator',     // operators
];

const tokenModifiers = ['declaration', 'definition', 'readonly'];

const legend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers,
};

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', ':', '{', ' '],
      },
      hoverProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      codeActionProvider: {
        codeActionKinds: [
          CodeActionKind.QuickFix,
          CodeActionKind.Refactor,
        ],
      },
      documentFormattingProvider: true,
      foldingRangeProvider: true,
      semanticTokensProvider: {
        legend,
        full: true,
      },
    },
  };
});

connection.onInitialized(() => {
  console.log('ISL Language Server initialized');
});

// ─────────────────────────────────────────────────────────────────────────────
// Document Validation
// ─────────────────────────────────────────────────────────────────────────────

documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});

function validateDocument(document: TextDocument): void {
  const text = document.getText();
  const uri = document.uri;
  
  // Parse document
  const parseResult = parse(text, uri);
  parseCache.set(uri, parseResult);
  
  // Get diagnostics
  const diagnostics = getDiagnostics(parseResult, text);
  
  // Send diagnostics
  connection.sendDiagnostics({ uri, diagnostics });
}

// ─────────────────────────────────────────────────────────────────────────────
// Completions
// ─────────────────────────────────────────────────────────────────────────────

connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  
  const text = document.getText();
  const parseResult = parseCache.get(params.textDocument.uri) ?? parse(text);
  
  return getCompletions(
    text,
    params.position,
    parseResult.symbols
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Hover
// ─────────────────────────────────────────────────────────────────────────────

connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  
  const text = document.getText();
  const parseResult = parseCache.get(params.textDocument.uri) ?? parse(text);
  
  return getHover(text, params.position, parseResult.symbols);
});

// ─────────────────────────────────────────────────────────────────────────────
// Document Symbols
// ─────────────────────────────────────────────────────────────────────────────

function symbolKindToLSP(kind: Symbol['kind']): LSPSymbolKind {
  switch (kind) {
    case 'domain': return LSPSymbolKind.Namespace;
    case 'entity': return LSPSymbolKind.Class;
    case 'behavior': return LSPSymbolKind.Function;
    case 'type': return LSPSymbolKind.TypeParameter;
    case 'enum': return LSPSymbolKind.Enum;
    case 'field': return LSPSymbolKind.Property;
    case 'parameter': return LSPSymbolKind.Variable;
    case 'scenario': return LSPSymbolKind.Event;
    case 'invariant': return LSPSymbolKind.Boolean;
    default: return LSPSymbolKind.Variable;
  }
}

function convertSymbol(symbol: Symbol): DocumentSymbol {
  const children = symbol.children?.map(convertSymbol) ?? [];
  
  return {
    name: symbol.name,
    kind: symbolKindToLSP(symbol.kind),
    range: symbol.range,
    selectionRange: symbol.selectionRange,
    detail: symbol.detail,
    children: children.length > 0 ? children : undefined,
  };
}

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  
  const text = document.getText();
  const parseResult = parseCache.get(params.textDocument.uri) ?? parse(text);
  
  return parseResult.symbols.map(convertSymbol);
});

// ─────────────────────────────────────────────────────────────────────────────
// Go to Definition
// ─────────────────────────────────────────────────────────────────────────────

connection.onDefinition((params: DefinitionParams): Location | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  
  const parseResult = parseCache.get(params.textDocument.uri);
  if (!parseResult) return null;
  
  // Find reference at position
  for (const ref of parseResult.references) {
    if (
      ref.range.start.line === params.position.line &&
      ref.range.start.character <= params.position.character &&
      ref.range.end.character >= params.position.character
    ) {
      // Find definition
      for (const symbol of parseResult.symbols) {
        if (symbol.kind === 'domain' && symbol.children) {
          for (const child of symbol.children) {
            if (child.name === ref.name) {
              return {
                uri: params.textDocument.uri,
                range: child.selectionRange,
              };
            }
          }
        }
      }
    }
  }
  
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// Find References
// ─────────────────────────────────────────────────────────────────────────────

connection.onReferences((params: ReferenceParams): Location[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  
  const parseResult = parseCache.get(params.textDocument.uri);
  if (!parseResult) return [];
  
  // Find symbol at position
  let symbolName: string | null = null;
  
  for (const symbol of parseResult.symbols) {
    if (isPositionInRange(params.position, symbol.selectionRange)) {
      symbolName = symbol.name;
      break;
    }
    if (symbol.children) {
      for (const child of symbol.children) {
        if (isPositionInRange(params.position, child.selectionRange)) {
          symbolName = child.name;
          break;
        }
      }
    }
  }
  
  if (!symbolName) return [];
  
  // Find all references
  const locations: Location[] = [];
  
  for (const ref of parseResult.references) {
    if (ref.name === symbolName) {
      locations.push({
        uri: params.textDocument.uri,
        range: ref.range,
      });
    }
  }
  
  return locations;
});

function isPositionInRange(
  position: { line: number; character: number },
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
): boolean {
  if (position.line < range.start.line || position.line > range.end.line) return false;
  if (position.line === range.start.line && position.character < range.start.character) return false;
  if (position.line === range.end.line && position.character > range.end.character) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Actions
// ─────────────────────────────────────────────────────────────────────────────

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const actions: CodeAction[] = [];
  const document = documents.get(params.textDocument.uri);
  if (!document) return actions;
  
  // Quick fixes for diagnostics
  for (const diagnostic of params.context.diagnostics) {
    if (diagnostic.code === 'ISL002') {
      // Add field to empty entity
      actions.push({
        title: 'Add id field',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: {
                start: { line: diagnostic.range.end.line, character: diagnostic.range.end.character },
                end: { line: diagnostic.range.end.line, character: diagnostic.range.end.character },
              },
              newText: '\n  id: ID [immutable, unique]',
            }],
          },
        },
      });
    }
    
    if (diagnostic.code === 'ISL008') {
      // Add version to domain
      actions.push({
        title: 'Add version',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: {
                start: { line: diagnostic.range.end.line, character: diagnostic.range.end.character },
                end: { line: diagnostic.range.end.line, character: diagnostic.range.end.character },
              },
              newText: '\n  version: "1.0.0"',
            }],
          },
        },
      });
    }
  }
  
  return actions;
});

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  
  const text = document.getText();
  const formatted = formatISL(text, params.options);
  
  if (formatted === text) return [];
  
  return [{
    range: {
      start: { line: 0, character: 0 },
      end: { line: document.lineCount, character: 0 },
    },
    newText: formatted,
  }];
});

function formatISL(text: string, options: FormattingOptions): string {
  const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  const lines = text.split('\n');
  const formatted: string[] = [];
  let depth = 0;
  
  for (let line of lines) {
    const trimmed = line.trim();
    
    // Decrease depth before line with closing brace
    if (trimmed.startsWith('}')) {
      depth = Math.max(0, depth - 1);
    }
    
    // Format line
    if (trimmed.length > 0) {
      formatted.push(indent.repeat(depth) + trimmed);
    } else {
      formatted.push('');
    }
    
    // Increase depth after line with opening brace
    if (trimmed.endsWith('{') && !trimmed.includes('}')) {
      depth++;
    }
  }
  
  return formatted.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Folding Ranges
// ─────────────────────────────────────────────────────────────────────────────

connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  
  const parseResult = parseCache.get(params.textDocument.uri);
  if (!parseResult) return [];
  
  const ranges: FoldingRange[] = [];
  
  function addFoldingRanges(symbol: Symbol): void {
    if (symbol.range.start.line < symbol.range.end.line) {
      ranges.push({
        startLine: symbol.range.start.line,
        endLine: symbol.range.end.line,
        kind: FoldingRangeKind.Region,
      });
    }
    
    if (symbol.children) {
      for (const child of symbol.children) {
        addFoldingRanges(child);
      }
    }
  }
  
  for (const symbol of parseResult.symbols) {
    addFoldingRanges(symbol);
  }
  
  return ranges;
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();

console.log('ISL Language Server started');
