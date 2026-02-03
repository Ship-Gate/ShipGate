/**
 * Security Verifier
 * 
 * Main verification logic for security invariants including
 * session token entropy requirements.
 * 
 * Combines static analysis and runtime verification.
 */

import type {
  SecurityRuleConfig,
  SecurityViolation,
  SecurityTraceEvent,
  RuntimeTokenCheckResult,
  SecurityVerifyResult,
  SecurityVerdict,
  SecurityCoverageInfo,
  SecurityTimingInfo,
  SecurityClause,
  ClauseEvaluationResult,
} from './types.js';
import { runSecurityRules, SECURITY_RULES } from './static-rules.js';
import {
  verifyAllTraceEvents,
  evaluateSecurityClause,
  createStandardSecurityClauses,
  createSafeLogEntry,
  assertNoTokenValue,
} from './runtime-checks.js';

// ============================================================================
// VERIFICATION OPTIONS
// ============================================================================

export interface VerifyOptions {
  /** Configuration for security rules */
  config?: SecurityRuleConfig;
  /** Whether to continue on first failure */
  continueOnFailure?: boolean;
  /** Verbose logging (safe - no tokens) */
  verbose?: boolean;
  /** Custom security clauses to evaluate */
  clauses?: SecurityClause[];
}

// ============================================================================
// MAIN VERIFIER CLASS
// ============================================================================

/**
 * Security Verifier for token entropy and cryptographic requirements
 */
export class SecurityVerifier {
  private config: SecurityRuleConfig;
  private clauses: SecurityClause[];

  constructor(options: VerifyOptions = {}) {
    this.config = options.config || {};
    this.clauses = options.clauses || createStandardSecurityClauses();
  }

  /**
   * Run static analysis on source code
   */
  analyzeStatic(codeMap: Map<string, string>): SecurityViolation[] {
    return runSecurityRules(codeMap, this.config);
  }

  /**
   * Verify runtime trace events
   */
  verifyRuntime(events: SecurityTraceEvent[]): RuntimeTokenCheckResult[] {
    return verifyAllTraceEvents(events, {
      minLength: this.config.minTokenLength,
      minEntropyBits: this.config.minEntropyBits,
    });
  }

  /**
   * Evaluate security clauses against evidence
   */
  evaluateClauses(evidence: { 
    tokenLength?: number; 
    encoding?: 'hex' | 'base64' | 'base64url' | 'unknown' 
  }): ClauseEvaluationResult[] {
    return this.clauses.map(clause => evaluateSecurityClause(clause, evidence));
  }

  /**
   * Run full verification combining static and runtime checks
   */
  verify(
    codeMap: Map<string, string>,
    traceEvents: SecurityTraceEvent[] = []
  ): SecurityVerifyResult {
    const startTime = performance.now();

    // Phase 1: Static Analysis
    const staticStart = performance.now();
    const staticViolations = this.analyzeStatic(codeMap);
    const staticTime = performance.now() - staticStart;

    // Phase 2: Runtime Verification
    const runtimeStart = performance.now();
    const runtimeChecks = this.verifyRuntime(traceEvents);
    const runtimeTime = performance.now() - runtimeStart;

    // Calculate results
    const totalTime = performance.now() - startTime;
    const timing = this.calculateTiming(staticTime, runtimeTime, totalTime);
    const coverage = this.calculateCoverage(staticViolations, runtimeChecks, codeMap.size, traceEvents.length);
    const { success, verdict, score } = this.calculateVerdict(staticViolations, runtimeChecks);

    return {
      success,
      verdict,
      score,
      staticViolations,
      runtimeChecks,
      coverage,
      timing,
    };
  }

  private calculateVerdict(
    staticViolations: SecurityViolation[],
    runtimeChecks: RuntimeTokenCheckResult[]
  ): { success: boolean; verdict: SecurityVerdict; score: number } {
    const criticalStatic = staticViolations.filter(v => v.severity === 'critical').length;
    const highStatic = staticViolations.filter(v => v.severity === 'high').length;
    const mediumStatic = staticViolations.filter(v => v.severity === 'medium').length;
    
    const failedRuntime = runtimeChecks.filter(r => !r.passed).length;
    const criticalRuntime = runtimeChecks.filter(r => !r.passed && r.severity === 'critical').length;

    // Calculate score
    let score = 100;
    score -= criticalStatic * 30;
    score -= highStatic * 15;
    score -= mediumStatic * 5;
    score -= criticalRuntime * 25;
    score -= failedRuntime * 10;
    score = Math.max(0, Math.min(100, score));

    // Determine verdict
    let verdict: SecurityVerdict;
    if (criticalStatic > 0 || criticalRuntime > 0) {
      verdict = 'insecure';
    } else if (highStatic > 0 || failedRuntime > 0) {
      verdict = 'risky';
    } else {
      verdict = 'secure';
    }

    const success = verdict === 'secure';

    return { success, verdict, score };
  }

  private calculateTiming(
    staticTime: number,
    runtimeTime: number,
    totalTime: number
  ): SecurityTimingInfo {
    return {
      total: Math.round(totalTime * 100) / 100,
      staticAnalysis: Math.round(staticTime * 100) / 100,
      runtimeVerification: Math.round(runtimeTime * 100) / 100,
    };
  }

  private calculateCoverage(
    staticViolations: SecurityViolation[],
    runtimeChecks: RuntimeTokenCheckResult[],
    filesAnalyzed: number,
    traceEventsProcessed: number
  ): SecurityCoverageInfo {
    const staticPassed = SECURITY_RULES.length - new Set(staticViolations.map(v => v.ruleId)).size;
    const runtimePassed = runtimeChecks.filter(r => r.passed).length;
    const runtimeFailed = runtimeChecks.filter(r => !r.passed).length;

    return {
      staticRules: {
        total: SECURITY_RULES.length,
        passed: Math.max(0, staticPassed),
        failed: new Set(staticViolations.map(v => v.ruleId)).size,
      },
      runtimeChecks: {
        total: runtimeChecks.length,
        passed: runtimePassed,
        failed: runtimeFailed,
      },
      filesAnalyzed,
      traceEventsProcessed,
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a new security verifier
 */
export function createVerifier(options?: VerifyOptions): SecurityVerifier {
  return new SecurityVerifier(options);
}

/**
 * Quick verification of code and trace
 */
export function verify(
  codeMap: Map<string, string>,
  traceEvents: SecurityTraceEvent[] = [],
  options?: VerifyOptions
): SecurityVerifyResult {
  const verifier = createVerifier(options);
  return verifier.verify(codeMap, traceEvents);
}

/**
 * Static-only verification (no runtime trace)
 */
export function verifyStatic(
  codeMap: Map<string, string>,
  options?: VerifyOptions
): SecurityViolation[] {
  const verifier = createVerifier(options);
  return verifier.analyzeStatic(codeMap);
}

/**
 * Runtime-only verification from trace events
 */
export function verifyRuntime(
  traceEvents: SecurityTraceEvent[],
  options?: VerifyOptions
): RuntimeTokenCheckResult[] {
  const verifier = createVerifier(options);
  return verifier.verifyRuntime(traceEvents);
}

/**
 * Verify a single file's token generation
 */
export function verifyFile(
  code: string,
  file: string,
  options?: VerifyOptions
): SecurityVerifyResult {
  const codeMap = new Map([[file, code]]);
  return verify(codeMap, [], options);
}

// ============================================================================
// CLAUSE VERIFICATION FOR ISL INTEGRATION
// ============================================================================

/**
 * Verify security clauses against evidence
 * 
 * This function is designed to integrate with the ISL verification engine.
 * It evaluates security-specific clauses like token entropy requirements.
 */
export function verifySecurityClauses(
  clauses: SecurityClause[],
  evidence: {
    tokenLength?: number;
    encoding?: 'hex' | 'base64' | 'base64url' | 'unknown';
    entropySource?: string;
  }
): ClauseEvaluationResult[] {
  return clauses.map(clause => evaluateSecurityClause(clause, evidence));
}

/**
 * Create the standard 256-bit entropy clause
 */
export function create256BitEntropyClause(): SecurityClause {
  return {
    id: 'security/token-entropy-256',
    type: 'token_entropy',
    expression: 'session_token.entropy >= 256 bits',
    requiredValue: 256,
    unit: 'bits',
  };
}

/**
 * Create the standard 64-char minimum length clause
 */
export function create64CharLengthClause(): SecurityClause {
  return {
    id: 'security/token-length-64',
    type: 'token_length',
    expression: 'session_token.length >= 64 characters',
    requiredValue: 64,
    unit: 'characters',
  };
}

// ============================================================================
// SAFE REPORTING
// ============================================================================

/**
 * Generate a safe verification report that can be logged
 * NEVER includes actual token values
 */
export function generateSafeReport(result: SecurityVerifyResult): Record<string, unknown> {
  const report = {
    success: result.success,
    verdict: result.verdict,
    score: result.score,
    staticAnalysis: {
      violationCount: result.staticViolations.length,
      criticalCount: result.staticViolations.filter(v => v.severity === 'critical').length,
      highCount: result.staticViolations.filter(v => v.severity === 'high').length,
      violations: result.staticViolations.map(v => ({
        ruleId: v.ruleId,
        file: v.file,
        line: v.line,
        severity: v.severity,
        message: v.message,
        // Evidence may contain code but NOT token values
        evidenceLength: v.evidence.length,
      })),
    },
    runtimeChecks: {
      total: result.runtimeChecks.length,
      passed: result.runtimeChecks.filter(r => r.passed).length,
      failed: result.runtimeChecks.filter(r => !r.passed).length,
      checks: result.runtimeChecks.map(r => createSafeLogEntry(r)),
    },
    coverage: result.coverage,
    timing: result.timing,
    tokenValuesLogged: false, // Explicit attestation
  };

  // Validate no token values leaked
  assertNoTokenValue(report);

  return report;
}
