/**
 * ISL Semantic Analysis
 * 
 * Provides semantic analysis passes that go beyond type checking:
 * - Consistency Checking:
 *   - Unsatisfiable preconditions detection (e.g., x > 5 && x < 2)
 *   - Output referenced in preconditions detection
 *   - Postconditions referencing undefined result fields
 *   - Invariants referencing missing variables
 * - Symbol resolution (undefined types, entities, behaviors, fields)
 * - Unreachable clauses detection
 * - Unused inputs/outputs
 * - Refinement sanity checks
 * - Implies structure validation
 */

// Core types (new framework)
export * from './types.js';

// Type environment
export { buildTypeEnvironment, emptyTypeEnvironment } from './type-environment.js';

// Pass runner (new framework)
export { PassRunner, createPassRunner } from './pass-runner.js';

// CLI formatter
export { 
  CLIFormatter, 
  createFormatter, 
  formatResult, 
  formatSingleDiagnostic,
  type OutputFormat,
  type FormatterOptions,
} from './cli-formatter.js';

// Legacy framework (for backwards compatibility)
export {
  SemanticAnalyzer,
  type SemanticPass as LegacySemanticPass,
  type SemanticAnalysisResult as LegacySemanticAnalysisResult,
  type SemanticAnalyzerOptions,
} from './framework.js';

// Built-in passes
export * from './passes/index.js';

// Re-export common types for convenience
export type { Domain, Behavior, Entity, PostconditionBlock, Expression } from '@isl-lang/parser';
export type { Diagnostic, SourceLocation } from '@isl-lang/errors';
