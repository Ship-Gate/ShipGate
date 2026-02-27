// ============================================================================
// ISL Language Server - Public API
// ============================================================================

export { ISLServer } from './server';
export { ISLDocumentManager } from './documents';

// Feature providers
export { ISLCompletionProvider } from './features/completion';
export { ISLHoverProvider } from './features/hover';
export { ISLDiagnosticsProvider, type DiagnosticsResult, type DiagnosticsOptions } from './features/diagnostics';
export { ISLDefinitionProvider } from './features/definition';
export { ISLSymbolProvider } from './features/symbols';
export { ISLCodeActionProvider } from './features/actions';
export { ISLFormattingProvider } from './features/formatting';
export { ISLSemanticTokensProvider, TOKEN_TYPES, TOKEN_MODIFIERS } from './features/semantic-tokens';

// Import resolution
export {
  ISLImportResolver,
  type ResolvedImport,
  type ResolvedImportItem,
  type ExportedSymbol,
  type ImportResolutionResult,
} from './features/import-resolver';

// Scanner diagnostics (Host + Reality-Gap)
export {
  ScannerDiagnosticsProvider,
  SOURCE_HOST,
  SOURCE_REALITY_GAP,
  type ScannerDiagnosticsOptions,
} from './features/scanner-diagnostics';

// Semantic linting
export {
  ISLSemanticLinter,
  LINT_RULES,
  type LintRule,
  type LintResult,
  type QuickfixData,
} from './features/semantic-linter';

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
