// ============================================================================
// ISL Language Core Types
// ============================================================================

import type { SourceLocation } from '@intentos/parser';

// ============================================================================
// Diagnostic Types
// ============================================================================

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface ISLDiagnostic {
  message: string;
  severity: DiagnosticSeverity;
  location: SourceLocation;
  code?: string;
  source: string;
  relatedInfo?: Array<{
    message: string;
    location: SourceLocation;
  }>;
  // Data for quick fixes
  data?: {
    type: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Symbol Information
// ============================================================================

export type SymbolKind =
  | 'domain'
  | 'entity'
  | 'behavior'
  | 'type'
  | 'field'
  | 'input'
  | 'output'
  | 'error'
  | 'invariant'
  | 'policy'
  | 'view'
  | 'scenario'
  | 'chaos'
  | 'enum'
  | 'variant'
  | 'parameter'
  | 'lifecycle-state';

export interface ISLSymbolInfo {
  name: string;
  kind: SymbolKind;
  location: SourceLocation;
  selectionLocation: SourceLocation;
  detail?: string;
  documentation?: string;
  deprecated?: boolean;
  children?: ISLSymbolInfo[];
  parent?: string;
  type?: string;
}

// ============================================================================
// Hover Information
// ============================================================================

export interface ISLHoverInfo {
  contents: string;
  location?: SourceLocation;
}

// ============================================================================
// Completion Information
// ============================================================================

export type CompletionKind =
  | 'keyword'
  | 'type'
  | 'entity'
  | 'behavior'
  | 'field'
  | 'function'
  | 'snippet'
  | 'variable'
  | 'enum'
  | 'property';

export interface ISLCompletionInfo {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  insertTextFormat?: 'plainText' | 'snippet';
  sortText?: string;
  filterText?: string;
  deprecated?: boolean;
  preselect?: boolean;
}

// ============================================================================
// Definition Information
// ============================================================================

export interface ISLDefinitionInfo {
  uri: string;
  location: SourceLocation;
}

// ============================================================================
// Code Actions
// ============================================================================

export type CodeActionKind =
  | 'quickfix'
  | 'refactor'
  | 'refactor.extract'
  | 'refactor.inline'
  | 'source'
  | 'source.organizeImports';

export interface ISLCodeAction {
  title: string;
  kind: CodeActionKind;
  diagnostics?: ISLDiagnostic[];
  isPreferred?: boolean;
  edits?: Array<{
    location: SourceLocation;
    newText: string;
  }>;
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

// ============================================================================
// Context Types
// ============================================================================

export type ContextType =
  | 'top-level'
  | 'domain'
  | 'entity'
  | 'entity-field'
  | 'behavior'
  | 'behavior-input'
  | 'behavior-output'
  | 'behavior-pre'
  | 'behavior-post'
  | 'behavior-invariant'
  | 'behavior-temporal'
  | 'behavior-security'
  | 'invariant'
  | 'policy'
  | 'view'
  | 'scenario'
  | 'chaos'
  | 'expression'
  | 'type-annotation';

export interface CompletionContext {
  contextType: ContextType;
  triggerCharacter?: string;
  prefix: string;
  line: string;
  position: { line: number; character: number };
  parentSymbol?: string;
  inPostcondition: boolean;
}
