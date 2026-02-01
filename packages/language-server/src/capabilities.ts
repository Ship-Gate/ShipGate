/**
 * ISL Language Server Capabilities
 */

import {
  ServerCapabilities,
  TextDocumentSyncKind,
} from 'vscode-languageserver';

/**
 * Get server capabilities
 */
export function getCapabilities(): ServerCapabilities {
  return {
    // Document synchronization
    textDocumentSync: TextDocumentSyncKind.Incremental,

    // Completions
    completionProvider: {
      resolveProvider: true,
      triggerCharacters: ['.', ':', '@', '{', '(', '<'],
    },

    // Hover
    hoverProvider: true,

    // Go to definition
    definitionProvider: true,

    // Find references
    referencesProvider: true,

    // Document symbols (outline)
    documentSymbolProvider: true,

    // Workspace symbols
    workspaceSymbolProvider: true,

    // Code actions (quick fixes)
    codeActionProvider: {
      codeActionKinds: [
        'quickfix',
        'refactor',
        'refactor.extract',
        'refactor.inline',
        'source.organizeImports',
      ],
    },

    // Code lens
    codeLensProvider: {
      resolveProvider: true,
    },

    // Document formatting
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,

    // Rename
    renameProvider: {
      prepareProvider: true,
    },

    // Folding
    foldingRangeProvider: true,

    // Selection range
    selectionRangeProvider: true,

    // Signature help
    signatureHelpProvider: {
      triggerCharacters: ['(', ','],
      retriggerCharacters: [','],
    },

    // Semantic tokens (syntax highlighting)
    semanticTokensProvider: {
      full: true,
      legend: {
        tokenTypes: [
          'namespace',    // domain
          'type',         // type declarations
          'class',        // entity
          'function',     // behavior
          'parameter',    // input/output fields
          'property',     // fields
          'keyword',      // ISL keywords
          'string',       // string literals
          'number',       // numeric literals
          'comment',      // comments
          'operator',     // operators
          'decorator',    // annotations
          'enum',         // enums
          'enumMember',   // enum values
        ],
        tokenModifiers: [
          'declaration',
          'definition',
          'readonly',
          'deprecated',
          'modification',
          'documentation',
        ],
      },
    },

    // Inlay hints
    inlayHintProvider: true,

    // Workspace
    workspace: {
      workspaceFolders: {
        supported: true,
        changeNotifications: true,
      },
    },
  };
}

/**
 * ISL Language keywords
 */
export const ISL_KEYWORDS = [
  // Declarations
  'domain',
  'type',
  'entity',
  'behavior',
  'enum',
  'scenarios',
  'scenario',
  'invariants',
  'middleware',
  'constants',
  
  // Blocks
  'input',
  'output',
  'preconditions',
  'postconditions',
  'temporal',
  'security',
  'compliance',
  'errors',
  
  // Modifiers
  'import',
  'export',
  'extends',
  'implements',
  
  // Control
  'when',
  'then',
  'given',
  'implies',
  'requires',
  'ensures',
  
  // Operators
  'and',
  'or',
  'not',
  'in',
  'is',
  'as',
  
  // Special
  'actors',
  'for',
  'description',
  'scope',
  'always',
  'eventually',
  'within',
];

/**
 * ISL built-in types
 */
export const ISL_BUILTIN_TYPES = [
  'String',
  'Int',
  'Float',
  'Boolean',
  'UUID',
  'Timestamp',
  'Duration',
  'Date',
  'Time',
  'DateTime',
  'Decimal',
  'Bytes',
  'Any',
  'List',
  'Set',
  'Map',
  'Result',
  'Option',
  'Stream',
];

/**
 * ISL common annotations
 */
export const ISL_ANNOTATIONS = [
  'pii',
  'secret',
  'unique',
  'immutable',
  'primary_key',
  'foreign_key',
  'index',
  'never_log',
  'deprecated',
];
