/**
 * FixSuggestion Interface & Utilities
 *
 * Represents a concrete, actionable code fix that the autofix engine
 * produces when an ISL spec violation is detected.
 */

// ============================================================================
// Core Interface
// ============================================================================

export interface FixSuggestion {
  /** Human-readable description of what is wrong */
  violation: string;
  /** File path where the violation was detected */
  file: string;
  /** Source location of the problematic code */
  location: FixLocation;
  /** The problematic lines of code */
  currentCode: string;
  /** The suggested replacement code */
  suggestedCode: string;
  /** Why this fix resolves the violation */
  explanation: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Could this change break other things? */
  breaking: boolean;
  /** Unified diff format */
  diff: string;
  /** Which security pattern triggered this (if any) */
  patternId?: SecurityPatternId;
  /** Tags for categorisation */
  tags: FixTag[];
}

export interface FixLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export type FixTag =
  | 'security'
  | 'auth'
  | 'validation'
  | 'rate-limit'
  | 'crypto'
  | 'token'
  | 'error-message'
  | 'input'
  | 'performance'
  | 'best-practice';

export type SecurityPatternId =
  | 'different-error-messages'
  | 'missing-password-hashing'
  | 'no-rate-limiting'
  | 'missing-input-validation'
  | 'token-without-expiry'
  | 'plaintext-password-storage'
  | 'missing-auth-check';

// ============================================================================
// Builder Helpers
// ============================================================================

export interface FixSuggestionInit {
  violation: string;
  file: string;
  location: FixLocation;
  currentCode: string;
  suggestedCode: string;
  explanation: string;
  confidence?: number;
  breaking?: boolean;
  patternId?: SecurityPatternId;
  tags?: FixTag[];
}

/**
 * Build a FixSuggestion with auto-generated diff.
 */
export function createFixSuggestion(
  init: FixSuggestionInit,
  diff: string,
): FixSuggestion {
  return {
    violation: init.violation,
    file: init.file,
    location: init.location,
    currentCode: init.currentCode,
    suggestedCode: init.suggestedCode,
    explanation: init.explanation,
    confidence: init.confidence ?? 0.8,
    breaking: init.breaking ?? false,
    diff,
    patternId: init.patternId,
    tags: init.tags ?? [],
  };
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a FixSuggestion for CLI display (colourless).
 */
export function formatFixSuggestion(fix: FixSuggestion): string {
  const lines: string[] = [];

  lines.push(`Violation: ${fix.violation}`);
  lines.push(`File:      ${fix.file}:${fix.location.line}`);
  lines.push(`Confidence: ${(fix.confidence * 100).toFixed(0)}%`);
  if (fix.breaking) {
    lines.push('WARNING:   This change may break other functionality');
  }
  lines.push('');
  lines.push(fix.explanation);
  lines.push('');
  lines.push('--- Current Code ---');
  lines.push(fix.currentCode);
  lines.push('');
  lines.push('+++ Suggested Code +++');
  lines.push(fix.suggestedCode);

  return lines.join('\n');
}

/**
 * Serialise fix suggestions to JSON (for --json output).
 */
export function fixSuggestionsToJSON(fixes: FixSuggestion[]): string {
  return JSON.stringify(
    fixes.map((f) => ({
      violation: f.violation,
      file: f.file,
      location: f.location,
      currentCode: f.currentCode,
      suggestedCode: f.suggestedCode,
      explanation: f.explanation,
      confidence: f.confidence,
      breaking: f.breaking,
      diff: f.diff,
      patternId: f.patternId ?? null,
      tags: f.tags,
    })),
    null,
    2,
  );
}
