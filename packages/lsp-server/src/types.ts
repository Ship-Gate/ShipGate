// ============================================================================
// ISL Language Server Types
// Re-exports types from lsp-core with LSP-specific additions
// ============================================================================

// Re-export core types
export type {
  ISLDiagnostic,
  ISLSymbolInfo,
  ISLCompletionInfo,
  ISLHoverInfo,
  ISLDefinitionInfo,
  ISLCodeAction,
  SymbolKind,
  CompletionKind,
  CodeActionKind,
  ContextType,
  CompletionContext,
} from '@isl-lang/lsp-core';

export { DiagnosticSeverity } from '@isl-lang/lsp-core';

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
