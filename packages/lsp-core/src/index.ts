// ============================================================================
// ISL Language Core - Public API
// ============================================================================

export { ISLAnalyzer, type AnalysisResult, type AnalysisOptions } from './analyzer.js';
export { SymbolIndex, type IndexedSymbol, type SymbolQuery } from './symbols.js';
export { IncrementalParser, type ParseCache, type IncrementalResult } from './incremental.js';
export {
  type ISLDiagnostic,
  type ISLSymbolInfo,
  type ISLHoverInfo,
  type ISLCompletionInfo,
  type ISLDefinitionInfo,
  type ISLCodeAction,
  type SourceLocation,
  type SymbolKind,
  type ContextType,
  type CompletionContext,
  type CompletionKind,
  type CodeActionKind,
  DiagnosticSeverity,
} from './types.js';

// Re-export parser types for convenience
export type { Domain, ASTNode } from '@isl-lang/parser';
