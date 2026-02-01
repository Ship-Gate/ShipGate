// ============================================================================
// ISL Language Server - Public API
// ============================================================================

export { ISLServer } from './server';
export { ISLDocumentManager } from './documents';

// Feature providers
export { ISLCompletionProvider } from './features/completion';
export { ISLHoverProvider } from './features/hover';
export { ISLDiagnosticsProvider } from './features/diagnostics';
export { ISLDefinitionProvider } from './features/definition';
export { ISLSymbolProvider } from './features/symbols';
export { ISLCodeActionProvider } from './features/actions';
export { ISLFormattingProvider } from './features/formatting';
export { ISLSemanticTokensProvider, TOKEN_TYPES, TOKEN_MODIFIERS } from './features/semantic-tokens';

// Types
export type {
  ISLDiagnostic,
  ISLSymbolInfo,
  ISLCompletionInfo,
  SymbolKind,
  CompletionKind,
  SemanticToken,
  SemanticTokenType,
  SemanticTokenModifier,
} from './types';

export { DiagnosticSeverity } from './types';
