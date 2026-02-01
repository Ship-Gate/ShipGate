// ============================================================================
// ISL Language Server Types
// ============================================================================

import type { Position, Range, Location } from 'vscode-languageserver';

// ============================================================================
// Document Symbols
// ============================================================================

export type ISLSymbolKind = 
  | 'domain'
  | 'entity'
  | 'behavior'
  | 'type'
  | 'invariant'
  | 'policy'
  | 'view'
  | 'scenario'
  | 'field'
  | 'input'
  | 'output'
  | 'error'
  | 'state'
  | 'constraint';

export interface ISLSymbol {
  name: string;
  kind: ISLSymbolKind;
  range: Range;
  selectionRange: Range;
  detail?: string;
  children?: ISLSymbol[];
  parent?: string;
}

// ============================================================================
// Parsed Document
// ============================================================================

export interface ParsedDocument {
  uri: string;
  version: number;
  domain?: DomainInfo;
  symbols: ISLSymbol[];
  references: Reference[];
  diagnostics: Diagnostic[];
}

export interface DomainInfo {
  name: string;
  version?: string;
  range: Range;
}

export interface Reference {
  name: string;
  range: Range;
  kind: 'type' | 'entity' | 'behavior' | 'field';
  definitionUri?: string;
  definitionRange?: Range;
}

export interface Diagnostic {
  range: Range;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code?: string;
  source: string;
}

// ============================================================================
// Completion
// ============================================================================

export interface CompletionContext {
  position: Position;
  line: string;
  prefix: string;
  triggerCharacter?: string;
  isInBlock: boolean;
  blockType?: ISLSymbolKind;
  parentName?: string;
}

export interface CompletionItem {
  label: string;
  kind: 'keyword' | 'type' | 'entity' | 'behavior' | 'field' | 'snippet' | 'function';
  detail?: string;
  documentation?: string;
  insertText?: string;
  insertTextFormat?: 'plainText' | 'snippet';
}

// ============================================================================
// Hover
// ============================================================================

export interface HoverInfo {
  contents: string;
  range?: Range;
}

// ============================================================================
// Semantic Tokens
// ============================================================================

export type SemanticTokenType =
  | 'namespace'
  | 'type'
  | 'class'
  | 'enum'
  | 'interface'
  | 'struct'
  | 'typeParameter'
  | 'parameter'
  | 'variable'
  | 'property'
  | 'enumMember'
  | 'function'
  | 'method'
  | 'keyword'
  | 'modifier'
  | 'comment'
  | 'string'
  | 'number'
  | 'regexp'
  | 'operator'
  | 'decorator';

export type SemanticTokenModifier =
  | 'declaration'
  | 'definition'
  | 'readonly'
  | 'static'
  | 'deprecated'
  | 'abstract'
  | 'async'
  | 'modification'
  | 'documentation'
  | 'defaultLibrary';

export interface SemanticToken {
  line: number;
  startChar: number;
  length: number;
  tokenType: SemanticTokenType;
  tokenModifiers: SemanticTokenModifier[];
}
