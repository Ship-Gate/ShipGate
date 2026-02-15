/**
 * Root Cause Analyzer
 *
 * Categorizes verification failures so we can apply targeted fixes
 * instead of sending entire files to the AI.
 */

import type {
  VerificationFailureInput,
  AnalyzedFailure,
  RootCauseCategory,
  HealPhase,
} from './types.js';

/** Regex patterns for categorizing failures */
const PATTERNS = {
  importError: /cannot find module|module not found|unresolved import|cannot resolve|MODULE_NOT_FOUND|import.*from.*failed/i,
  typeError: /type.*(?:mismatch|error|'[^']+' is not assignable)|ts\d{4}|Type '.*' is not assignable|Property '.*' does not exist/i,
  missingImpl: /stub|TODO|not implemented|throw new Error\(['"]Not implemented|placeholder|FIXME/i,
  authMissing: /protected route|auth required|unauthorized|401|middleware|authentication/i,
  testFailure: /test.*fail|expect.*received|assertion.*failed|AssertionError|vitest|jest|FAIL.*\.test\./i,
  specMismatch: /postcondition|precondition|invariant|does not match spec|contract violation|ISL.*mismatch/i,
};

/** Extract line number from error message like "file.ts:42:10" or "at line 42" */
function extractLocation(message: string, file: string): { line?: number; column?: number } | undefined {
  // file.ts:42:10
  const fileLineCol = message.match(/:(\d+):(\d+)/);
  if (fileLineCol) {
    return { line: parseInt(fileLineCol[1]!, 10), column: parseInt(fileLineCol[2]!, 10) };
  }
  // line 42
  const lineMatch = message.match(/line\s+(\d+)/i);
  if (lineMatch) {
    return { line: parseInt(lineMatch[1]!, 10) };
  }
  // (42, 10)
  const parenMatch = message.match(/\((\d+),\s*(\d+)\)/);
  if (parenMatch) {
    return { line: parseInt(parenMatch[1]!, 10), column: parseInt(parenMatch[2]!, 10) };
  }
  return undefined;
}

/** Extract unresolved import path from message */
function extractUnresolvedImport(message: string): string | undefined {
  const match = message.match(/['"]([^'"]+)['"].*cannot find|cannot find.*['"]([^'"]+)['"]/i);
  return match?.[1] ?? match?.[2];
}

/** Get phase for a category (structural first, then types/impl, then tests) */
function categoryToPhase(category: RootCauseCategory): HealPhase {
  switch (category) {
    case 'IMPORT_ERROR':
      return 'structural';
    case 'TYPE_ERROR':
    case 'MISSING_IMPLEMENTATION':
    case 'AUTH_MISSING':
    case 'SPEC_MISMATCH':
      return 'types_impl';
    case 'TEST_FAILURE':
      return 'tests';
    default:
      return 'types_impl';
  }
}

/**
 * Root Cause Analyzer
 *
 * Categorizes verification failures for targeted healing.
 */
export class RootCauseAnalyzer {
  /**
   * Analyze a single failure entry (file + blockers + errors)
   */
  analyzeEntry(entry: VerificationFailureInput): AnalyzedFailure[] {
    const results: AnalyzedFailure[] = [];
    const allMessages = [...entry.blockers, ...entry.errors];

    for (const msg of allMessages) {
      const category = this.categorizeMessage(msg);
      const location = extractLocation(msg, entry.file);

      const analyzed: AnalyzedFailure = {
        file: entry.file,
        category,
        phase: categoryToPhase(category),
        message: msg,
        location,
      };

      if (category === 'IMPORT_ERROR') {
        analyzed.unresolvedImport = extractUnresolvedImport(msg);
      }

      if (entry.sourceCode && location?.line) {
        analyzed.contextSnippet = this.extractContextSnippet(entry.sourceCode, location.line);
      }

      results.push(analyzed);
    }

    // If we got no specific messages, create one UNKNOWN from blockers
    if (results.length === 0 && entry.blockers.length > 0) {
      results.push({
        file: entry.file,
        category: 'UNKNOWN',
        phase: 'types_impl',
        message: entry.blockers[0]!,
      });
    }

    return results;
  }

  /**
   * Analyze multiple entries and return flat list of analyzed failures
   */
  analyzeAll(entries: VerificationFailureInput[]): AnalyzedFailure[] {
    const all: AnalyzedFailure[] = [];
    for (const entry of entries) {
      all.push(...this.analyzeEntry(entry));
    }
    return all;
  }

  /**
   * Categorize a single error message
   */
  categorizeMessage(message: string): RootCauseCategory {
    if (PATTERNS.importError.test(message)) return 'IMPORT_ERROR';
    if (PATTERNS.typeError.test(message)) return 'TYPE_ERROR';
    if (PATTERNS.missingImpl.test(message)) return 'MISSING_IMPLEMENTATION';
    if (PATTERNS.authMissing.test(message)) return 'AUTH_MISSING';
    if (PATTERNS.testFailure.test(message)) return 'TEST_FAILURE';
    if (PATTERNS.specMismatch.test(message)) return 'SPEC_MISMATCH';
    return 'UNKNOWN';
  }

  /**
   * Extract a small context snippet around a line (e.g. ±5 lines)
   */
  extractContextSnippet(source: string, line: number, contextLines = 5): string {
    const lines = source.split('\n');
    const start = Math.max(0, line - contextLines - 1);
    const end = Math.min(lines.length, line + contextLines);
    return lines.slice(start, end).join('\n');
  }
}
