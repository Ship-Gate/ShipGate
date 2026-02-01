/**
 * ISL Language Support
 * 
 * Provides diagnostics, quick fixes, and utilities for ISL files in VS Code.
 * 
 * @example
 * ```typescript
 * import { 
 *   createDiagnosticsProvider,
 *   createQuickFixesProvider,
 *   registerQuickFixCommands,
 *   ISL_SELECTOR
 * } from './isl-language';
 * 
 * export function activate(context: vscode.ExtensionContext) {
 *   // Register diagnostics
 *   const diagnostics = createDiagnosticsProvider();
 *   diagnostics.register(context);
 * 
 *   // Register quick fixes
 *   const quickFixes = createQuickFixesProvider();
 *   quickFixes.register(context);
 * 
 *   // Register commands (optional)
 *   registerQuickFixCommands(context);
 * }
 * ```
 */

// ============================================================================
// Document Selector
// ============================================================================

export {
  ISL_LANGUAGE_ID,
  ISL_FILE_EXTENSION,
  ISL_SELECTOR,
  ISL_SELECTOR_ALL,
  ISL_FILTER,
  isISLDocument,
  isISLUri,
  getISLSelector,
  createISLSelector,
} from './islSelector';

// ============================================================================
// Diagnostics
// ============================================================================

export {
  ISLDiagnosticsProvider,
  createDiagnosticsProvider,
  isParserAvailable,
  ISL_DIAGNOSTIC_SOURCE,
  ISLDiagnosticCode,
  type ParsedDiagnostic,
  type LintWarning,
} from './diagnostics';

// ============================================================================
// Quick Fixes
// ============================================================================

export {
  ISLQuickFixesProvider,
  createQuickFixesProvider,
  registerQuickFixCommands,
  isCanonicalPrinterAvailable,
  ISL_QUICK_FIX_KIND,
  ISL_REFACTOR_KIND,
  type ISLQuickFixesOptions,
} from './quickFixes';
