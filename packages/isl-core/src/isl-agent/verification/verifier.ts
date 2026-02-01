// ============================================================================
// ISL Agent Verifier - Main verification entry point
// ============================================================================

import type {
  ClauseResult,
  ClauseStatus,
  HeuristicMatch,
  ParsedBindings,
  VerificationResult,
  VerificationNote,
  VerifyOptions,
} from './types.js';
import { parseBindings, getClauseBindings } from './parseBindings.js';
import {
  verifyClauseFromBindings,
  buildVerificationContext,
  calculateHeuristicConfidence,
  type ClauseInfo,
  type BindingVerificationContext,
} from './verifyFromBindings.js';

/**
 * Specification information for verification
 */
export interface SpecInfo {
  /** All clauses from the spec */
  clauses: ClauseInfo[];
  /** Spec file path */
  specFile?: string;
}

/**
 * Heuristic patterns for finding guards/asserts/tests
 */
const HEURISTIC_PATTERNS = {
  guard: [
    /if\s*\(!?\s*([^)]+)\)\s*(?:throw|return)/g,
    /assert\s*\(\s*([^)]+)\)/g,
    /expect\s*\(\s*([^)]+)\)\s*\.to(?:Be|Equal|Throw)/g,
    /guard\s*\(\s*([^)]+)\)/g,
  ],
  assert: [
    /assert\s*\(\s*([^)]+)\)/g,
    /expect\s*\(\s*([^)]+)\)/g,
    /\.should\s*\.\s*(?:equal|be|have)/g,
  ],
  test: [
    /(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\.test\s*\(/g,
    /@test/g,
  ],
};

/**
 * Main verification function
 * 
 * If @isl-bindings exists, uses it as primary evidence.
 * Otherwise falls back to heuristic matching with evidence = "heuristic".
 */
export function verify(
  sourceCode: string,
  spec: SpecInfo,
  options: VerifyOptions = {}
): VerificationResult {
  const {
    requireBindings = false,
    heuristicConfidenceThreshold = 0.5,
    verbose = false,
  } = options;

  // Try to parse bindings from source
  const parsedBindings = parseBindings(sourceCode);
  const hasBindings = parsedBindings !== null;

  // Build verification context
  const context = buildVerificationContext(sourceCode);

  // If bindings required but not found, fail all clauses
  if (requireBindings && !hasBindings) {
    const clauseResults: ClauseResult[] = spec.clauses.map(clause => ({
      clauseId: clause.id,
      status: 'FAIL' as ClauseStatus,
      evidence: 'bindings' as const,
      notes: [{
        level: 'error' as const,
        message: '@isl-bindings block required but not found',
      }],
    }));

    return buildResult(clauseResults, false, undefined);
  }

  // Verify each clause
  const clauseResults: ClauseResult[] = [];

  for (const clause of spec.clauses) {
    let result: ClauseResult;

    if (hasBindings) {
      // Use bindings as primary evidence
      const bindings = getClauseBindings(parsedBindings!, clause.id);
      
      if (bindings.length > 0) {
        result = verifyClauseFromBindings(clause, bindings, context);
      } else {
        // No binding for this specific clause - fallback to heuristic
        result = verifyClauseHeuristically(
          clause,
          context,
          heuristicConfidenceThreshold,
          verbose
        );
        
        // Add note about missing binding
        result.notes.unshift({
          level: 'warning',
          message: `No explicit binding found for ${clause.id}, using heuristic`,
        });
      }
    } else {
      // No bindings at all - use heuristic
      result = verifyClauseHeuristically(
        clause,
        context,
        heuristicConfidenceThreshold,
        verbose
      );
    }

    clauseResults.push(result);
  }

  return buildResult(clauseResults, hasBindings, parsedBindings || undefined);
}

/**
 * Verify a clause using heuristic pattern matching
 */
function verifyClauseHeuristically(
  clause: ClauseInfo,
  context: BindingVerificationContext,
  confidenceThreshold: number,
  verbose: boolean
): ClauseResult {
  const notes: VerificationNote[] = [];
  const matches: HeuristicMatch[] = [];

  // Determine which patterns to use based on clause type
  const patternTypes = getPatternTypesForClause(clause.type);

  for (const patternType of patternTypes) {
    const patterns = HEURISTIC_PATTERNS[patternType];
    
    for (const pattern of patterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(context.sourceCode)) !== null) {
        // Find line number
        const beforeMatch = context.sourceCode.substring(0, match.index);
        const line = (beforeMatch.match(/\n/g) || []).length + 1;
        
        // Get code context
        const codeLine = context.sourceLines[line - 1] || '';

        const heuristicMatch: HeuristicMatch = {
          type: patternType,
          line,
          code: codeLine.trim(),
          confidence: 0,
        };

        // Calculate confidence
        heuristicMatch.confidence = calculateHeuristicConfidence(
          heuristicMatch,
          clause
        );

        if (heuristicMatch.confidence >= confidenceThreshold) {
          matches.push(heuristicMatch);
          
          if (verbose) {
            notes.push({
              level: 'info',
              message: `Heuristic match: ${patternType} at L${line} (${(heuristicMatch.confidence * 100).toFixed(0)}% confidence)`,
              location: `L${line}`,
            });
          }
        }
      }
    }
  }

  // Determine status based on matches
  let status: ClauseStatus;
  
  if (matches.length === 0) {
    status = 'FAIL';
    notes.push({
      level: 'warning',
      message: `No heuristic matches found for ${clause.id}`,
    });
  } else {
    // Check if we have high-confidence matches
    const highConfidenceMatches = matches.filter(m => m.confidence >= 0.7);
    
    if (highConfidenceMatches.length > 0) {
      status = 'PASS';
      notes.push({
        level: 'info',
        message: `Found ${highConfidenceMatches.length} high-confidence heuristic match(es)`,
      });
    } else {
      status = 'PARTIAL';
      notes.push({
        level: 'info',
        message: `Found ${matches.length} low-confidence heuristic match(es)`,
      });
    }
  }

  return {
    clauseId: clause.id,
    status,
    evidence: 'heuristic',
    notes,
    heuristicMatches: matches,
  };
}

/**
 * Get pattern types to search for based on clause type
 */
function getPatternTypesForClause(
  clauseType: ClauseInfo['type']
): Array<'guard' | 'assert' | 'test'> {
  switch (clauseType) {
    case 'precondition':
      return ['guard', 'assert'];
    case 'postcondition':
      return ['assert', 'test'];
    case 'invariant':
      return ['assert', 'guard'];
    default:
      return ['guard', 'assert', 'test'];
  }
}

/**
 * Build the final verification result
 */
function buildResult(
  clauseResults: ClauseResult[],
  hasBindings: boolean,
  parsedBindings?: ParsedBindings
): VerificationResult {
  const passed = clauseResults.filter(r => r.status === 'PASS').length;
  const partial = clauseResults.filter(r => r.status === 'PARTIAL').length;
  const failed = clauseResults.filter(r => r.status === 'FAIL').length;
  const boundClauses = clauseResults.filter(r => r.evidence === 'bindings').length;
  const heuristicClauses = clauseResults.filter(r => r.evidence === 'heuristic').length;

  // Overall success: no failures (empty is also success)
  const success = failed === 0;

  return {
    success,
    clauseResults,
    hasBindings,
    parsedBindings,
    summary: {
      total: clauseResults.length,
      passed,
      partial,
      failed,
      boundClauses,
      heuristicClauses,
    },
  };
}

/**
 * Convenience function to verify with spec clauses from strings
 */
export function verifyWithClauses(
  sourceCode: string,
  clauses: Array<{
    id: string;
    type: 'precondition' | 'postcondition' | 'invariant';
    expression: string;
  }>,
  options?: VerifyOptions
): VerificationResult {
  return verify(sourceCode, { clauses }, options);
}

/**
 * Quick check if source has explicit bindings
 */
export function hasExplicitBindings(sourceCode: string): boolean {
  return parseBindings(sourceCode) !== null;
}

/**
 * Get summary of verification for logging
 */
export function formatVerificationSummary(result: VerificationResult): string {
  const lines: string[] = [];
  
  lines.push(`Verification ${result.success ? 'PASSED' : 'FAILED'}`);
  lines.push(`  Evidence: ${result.hasBindings ? 'bindings' : 'heuristic'}`);
  lines.push(`  Clauses: ${result.summary.total} total`);
  lines.push(`    PASS: ${result.summary.passed}`);
  lines.push(`    PARTIAL: ${result.summary.partial}`);
  lines.push(`    FAIL: ${result.summary.failed}`);
  
  if (result.hasBindings) {
    lines.push(`  Bound: ${result.summary.boundClauses}`);
    lines.push(`  Heuristic: ${result.summary.heuristicClauses}`);
  }

  return lines.join('\n');
}
