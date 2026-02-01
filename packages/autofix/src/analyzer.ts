/**
 * Failure Analyzer
 * 
 * Analyzes verification failures to determine the root cause and fix strategy.
 */

import type { DomainDeclaration, BehaviorDeclaration, Expression } from '@isl-lang/isl-core';

// ============================================================================
// Types
// ============================================================================

export type FailureType = 
  | 'precondition'
  | 'postcondition'
  | 'invariant'
  | 'error_handling'
  | 'temporal'
  | 'security'
  | 'type_mismatch'
  | 'unknown';

export interface VerificationFailure {
  type: FailureType;
  predicate: string;
  expected?: unknown;
  actual?: unknown;
  message: string;
  location?: SourceLocation;
  context?: FailureContext;
}

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface FailureContext {
  behaviorName?: string;
  entityName?: string;
  inputValues?: Record<string, unknown>;
  stackTrace?: string;
}

export interface AnalysisResult {
  failure: VerificationFailure;
  rootCause: RootCause;
  suggestedStrategy: FixStrategy;
  relatedCode: CodeSegment[];
  confidence: number;
}

export interface RootCause {
  type: RootCauseType;
  description: string;
  evidence: string[];
}

export type RootCauseType =
  | 'missing_check'
  | 'wrong_value'
  | 'missing_error_handler'
  | 'state_mutation'
  | 'timeout'
  | 'race_condition'
  | 'type_error'
  | 'logic_error';

export type FixStrategy =
  | 'add_precondition_check'
  | 'fix_return_value'
  | 'add_error_handler'
  | 'fix_state_mutation'
  | 'add_timeout'
  | 'add_retry'
  | 'add_cache'
  | 'fix_type'
  | 'ai_assisted';

export interface CodeSegment {
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  relevance: number;
}

// ============================================================================
// Analyzer Class
// ============================================================================

export class FailureAnalyzer {
  constructor(
    private domain: DomainDeclaration,
    private implementation: string
  ) {}

  /**
   * Analyze a verification failure
   */
  analyze(failure: VerificationFailure): AnalysisResult {
    const rootCause = this.determineRootCause(failure);
    const strategy = this.selectStrategy(failure, rootCause);
    const relatedCode = this.findRelatedCode(failure);
    const confidence = this.calculateConfidence(failure, rootCause, relatedCode);

    return {
      failure,
      rootCause,
      suggestedStrategy: strategy,
      relatedCode,
      confidence,
    };
  }

  /**
   * Analyze multiple failures and group by root cause
   */
  analyzeMultiple(failures: VerificationFailure[]): Map<RootCauseType, AnalysisResult[]> {
    const grouped = new Map<RootCauseType, AnalysisResult[]>();

    for (const failure of failures) {
      const analysis = this.analyze(failure);
      const existing = grouped.get(analysis.rootCause.type) ?? [];
      existing.push(analysis);
      grouped.set(analysis.rootCause.type, existing);
    }

    return grouped;
  }

  /**
   * Determine the root cause of a failure
   */
  private determineRootCause(failure: VerificationFailure): RootCause {
    switch (failure.type) {
      case 'precondition':
        return this.analyzePreconditionFailure(failure);
      case 'postcondition':
        return this.analyzePostconditionFailure(failure);
      case 'invariant':
        return this.analyzeInvariantFailure(failure);
      case 'error_handling':
        return this.analyzeErrorHandlingFailure(failure);
      case 'temporal':
        return this.analyzeTemporalFailure(failure);
      default:
        return {
          type: 'logic_error',
          description: 'Unknown failure type',
          evidence: [failure.message],
        };
    }
  }

  private analyzePreconditionFailure(failure: VerificationFailure): RootCause {
    const predicate = failure.predicate;
    const evidence: string[] = [];

    // Check if it's a missing validation
    if (predicate.includes('exists') || predicate.includes('lookup')) {
      evidence.push(`Entity existence check missing: ${predicate}`);
      return {
        type: 'missing_check',
        description: `Missing entity existence validation for: ${predicate}`,
        evidence,
      };
    }

    // Check if it's a constraint violation
    if (predicate.includes('>=') || predicate.includes('<=') || 
        predicate.includes('>') || predicate.includes('<')) {
      evidence.push(`Constraint not validated: ${predicate}`);
      return {
        type: 'missing_check',
        description: `Missing constraint validation: ${predicate}`,
        evidence,
      };
    }

    // Check if it's a format validation
    if (predicate.includes('is_valid') || predicate.includes('format') ||
        predicate.includes('length')) {
      evidence.push(`Input validation missing: ${predicate}`);
      return {
        type: 'missing_check',
        description: `Missing input validation: ${predicate}`,
        evidence,
      };
    }

    return {
      type: 'missing_check',
      description: `Precondition not checked: ${predicate}`,
      evidence: [failure.message],
    };
  }

  private analyzePostconditionFailure(failure: VerificationFailure): RootCause {
    const { expected, actual, predicate } = failure;
    const evidence: string[] = [];

    // Check if it's a wrong value assignment
    if (expected !== undefined && actual !== undefined) {
      evidence.push(`Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
      
      // Check for common value mismatches
      if (typeof expected === 'string' && typeof actual === 'string') {
        return {
          type: 'wrong_value',
          description: `Wrong value assigned. Expected "${expected}" but got "${actual}"`,
          evidence,
        };
      }
    }

    // Check if it's a missing state change
    if (predicate.includes('==') && predicate.includes('old(')) {
      evidence.push(`State not properly updated: ${predicate}`);
      return {
        type: 'state_mutation',
        description: 'Required state change not applied',
        evidence,
      };
    }

    // Check if it's a missing creation
    if (predicate.includes('.exists(') && predicate.includes('result')) {
      evidence.push(`Entity not created: ${predicate}`);
      return {
        type: 'wrong_value',
        description: 'Expected entity was not created',
        evidence,
      };
    }

    return {
      type: 'wrong_value',
      description: `Postcondition failed: ${predicate}`,
      evidence: evidence.length > 0 ? evidence : [failure.message],
    };
  }

  private analyzeInvariantFailure(failure: VerificationFailure): RootCause {
    const predicate = failure.predicate;
    const evidence: string[] = [];

    // Check for balance/count invariants
    if (predicate.includes('>=') || predicate.includes('<=')) {
      const match = predicate.match(/(\w+)\s*(>=|<=|>|<)\s*(\d+)/);
      if (match) {
        evidence.push(`Boundary constraint violated: ${match[1]} must be ${match[2]} ${match[3]}`);
        return {
          type: 'state_mutation',
          description: `Invariant violated: ${predicate}. Value went out of bounds.`,
          evidence,
        };
      }
    }

    // Check for uniqueness invariants
    if (predicate.includes('unique') || predicate.includes('count') === 1) {
      evidence.push(`Uniqueness constraint violated: ${predicate}`);
      return {
        type: 'state_mutation',
        description: 'Duplicate entry created, violating uniqueness constraint',
        evidence,
      };
    }

    return {
      type: 'state_mutation',
      description: `Invariant violated: ${predicate}`,
      evidence: [failure.message],
    };
  }

  private analyzeErrorHandlingFailure(failure: VerificationFailure): RootCause {
    const predicate = failure.predicate;
    const evidence: string[] = [];

    // Extract error code from predicate
    const errorMatch = predicate.match(/(\w+_\w+|\w+ERROR|\w+_ERROR)/i);
    if (errorMatch) {
      evidence.push(`Missing error handler for: ${errorMatch[1]}`);
    }

    return {
      type: 'missing_error_handler',
      description: `Error case not handled: ${predicate}`,
      evidence: evidence.length > 0 ? evidence : [failure.message],
    };
  }

  private analyzeTemporalFailure(failure: VerificationFailure): RootCause {
    const predicate = failure.predicate;
    const evidence: string[] = [];

    // Check for timeout violations
    if (predicate.includes('within') || predicate.includes('ms') || 
        predicate.includes('seconds')) {
      const timeMatch = predicate.match(/(\d+)\s*(ms|milliseconds|seconds|s)/i);
      if (timeMatch) {
        evidence.push(`Response time exceeded: expected within ${timeMatch[1]}${timeMatch[2]}`);
        if (failure.actual !== undefined) {
          evidence.push(`Actual time: ${failure.actual}`);
        }
      }
      return {
        type: 'timeout',
        description: 'Operation exceeded time limit',
        evidence,
      };
    }

    // Check for eventual consistency issues
    if (predicate.includes('eventually')) {
      evidence.push(`Eventual action not completed: ${predicate}`);
      return {
        type: 'race_condition',
        description: 'Async operation did not complete in expected timeframe',
        evidence,
      };
    }

    return {
      type: 'timeout',
      description: `Temporal requirement not met: ${predicate}`,
      evidence: [failure.message],
    };
  }

  /**
   * Select the best fix strategy based on root cause
   */
  private selectStrategy(failure: VerificationFailure, rootCause: RootCause): FixStrategy {
    switch (rootCause.type) {
      case 'missing_check':
        return failure.type === 'precondition' 
          ? 'add_precondition_check' 
          : 'fix_state_mutation';
      
      case 'wrong_value':
        return 'fix_return_value';
      
      case 'missing_error_handler':
        return 'add_error_handler';
      
      case 'state_mutation':
        return 'fix_state_mutation';
      
      case 'timeout':
        // Determine if caching or timeout adjustment is better
        if (failure.predicate.includes('query') || failure.predicate.includes('fetch')) {
          return 'add_cache';
        }
        return 'add_timeout';
      
      case 'race_condition':
        return 'add_retry';
      
      case 'type_error':
        return 'fix_type';
      
      default:
        return 'ai_assisted';
    }
  }

  /**
   * Find code segments related to the failure
   */
  private findRelatedCode(failure: VerificationFailure): CodeSegment[] {
    const segments: CodeSegment[] = [];
    const lines = this.implementation.split('\n');

    // If we have an exact location, include that
    if (failure.location) {
      const startLine = Math.max(0, failure.location.line - 3);
      const endLine = Math.min(lines.length, (failure.location.endLine ?? failure.location.line) + 3);
      
      segments.push({
        file: failure.location.file,
        startLine,
        endLine,
        code: lines.slice(startLine, endLine).join('\n'),
        relevance: 1.0,
      });
    }

    // Search for relevant code patterns
    const searchPatterns = this.getSearchPatterns(failure);
    for (const pattern of searchPatterns) {
      const matches = this.findPattern(pattern.regex, lines);
      for (const match of matches) {
        if (!segments.some(s => s.startLine === match.startLine)) {
          segments.push({
            ...match,
            relevance: pattern.relevance,
          });
        }
      }
    }

    // Sort by relevance
    segments.sort((a, b) => b.relevance - a.relevance);

    return segments.slice(0, 5); // Return top 5 most relevant
  }

  private getSearchPatterns(failure: VerificationFailure): Array<{ regex: RegExp; relevance: number }> {
    const patterns: Array<{ regex: RegExp; relevance: number }> = [];

    // Extract identifiers from predicate
    const identifiers = failure.predicate.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
    
    for (const id of identifiers) {
      if (id.length > 2 && !['and', 'or', 'not', 'true', 'false'].includes(id.toLowerCase())) {
        patterns.push({
          regex: new RegExp(`\\b${id}\\b`, 'i'),
          relevance: 0.7,
        });
      }
    }

    // Add type-specific patterns
    switch (failure.type) {
      case 'precondition':
        patterns.push({ regex: /if\s*\(.*\)\s*{?\s*(throw|return)/, relevance: 0.8 });
        break;
      case 'postcondition':
        patterns.push({ regex: /return\s+/, relevance: 0.9 });
        patterns.push({ regex: /status\s*[:=]/, relevance: 0.85 });
        break;
      case 'error_handling':
        patterns.push({ regex: /catch\s*\(/, relevance: 0.8 });
        patterns.push({ regex: /throw\s+new/, relevance: 0.8 });
        break;
      case 'temporal':
        patterns.push({ regex: /await\s+/, relevance: 0.7 });
        patterns.push({ regex: /setTimeout|Promise/, relevance: 0.6 });
        break;
    }

    return patterns;
  }

  private findPattern(regex: RegExp, lines: string[]): Omit<CodeSegment, 'relevance'>[] {
    const matches: Omit<CodeSegment, 'relevance'>[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i]!)) {
        const startLine = Math.max(0, i - 2);
        const endLine = Math.min(lines.length, i + 3);
        
        matches.push({
          file: 'implementation',
          startLine,
          endLine,
          code: lines.slice(startLine, endLine).join('\n'),
        });
      }
    }

    return matches;
  }

  /**
   * Calculate confidence in our analysis
   */
  private calculateConfidence(
    failure: VerificationFailure,
    rootCause: RootCause,
    relatedCode: CodeSegment[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have exact location
    if (failure.location) {
      confidence += 0.2;
    }

    // Increase confidence based on evidence
    confidence += Math.min(0.15, rootCause.evidence.length * 0.05);

    // Increase confidence if we found related code
    if (relatedCode.length > 0) {
      confidence += Math.min(0.15, relatedCode[0]!.relevance * 0.15);
    }

    // Decrease confidence for complex predicates
    const predicateComplexity = (failure.predicate.match(/and|or|implies/gi) ?? []).length;
    confidence -= Math.min(0.2, predicateComplexity * 0.05);

    return Math.max(0.1, Math.min(0.95, confidence));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a verification failure from a simple error
 */
export function createFailure(
  type: FailureType,
  predicate: string,
  message: string,
  options: Partial<VerificationFailure> = {}
): VerificationFailure {
  return {
    type,
    predicate,
    message,
    ...options,
  };
}

/**
 * Parse a verification result into failures
 */
export function parseVerificationResult(result: unknown): VerificationFailure[] {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const failures: VerificationFailure[] = [];
  const obj = result as Record<string, unknown>;

  // Handle array of failures
  if (Array.isArray(obj.failures)) {
    for (const f of obj.failures) {
      if (isVerificationFailure(f)) {
        failures.push(f);
      }
    }
  }

  // Handle single failure
  if (obj.type && obj.predicate) {
    if (isVerificationFailure(obj)) {
      failures.push(obj);
    }
  }

  return failures;
}

function isVerificationFailure(obj: unknown): obj is VerificationFailure {
  if (!obj || typeof obj !== 'object') return false;
  const f = obj as Record<string, unknown>;
  return typeof f.type === 'string' && typeof f.predicate === 'string';
}
