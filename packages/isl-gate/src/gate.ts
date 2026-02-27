/**
 * ISL Gate - Main Entry Point
 * 
 * Evaluates code against ISL specs and produces SHIP/NO_SHIP verdicts.
 * 
 * @module @isl-lang/gate
 */

import * as crypto from 'crypto';
import type {
  GateResult,
  GateOptions,
  GateInput,
  GateReason,
  GateVerdict,
  Finding,
  CriticalBlockers,
} from './types/index.js';

import {
  buildResult,
  determineVerdict,
  getCriticalBlockerReasons,
  VERDICT_THRESHOLDS,
} from './scoring/unified-scorer.js';

import {
  ISLGateError,
  GateBlockedError,
  ValidationError,
  wrapError,
} from './utils/errors.js';

// ============================================================================
// Gate Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<GateOptions, 'projectRoot'>> = {
  specPattern: '**/*.isl',
  changedOnly: false,
  baseBranch: 'main',
  outputFormat: 'json',
  verbose: false,
  evidencePath: '.isl-gate/evidence',
  policyPacks: [],
  deterministic: true,
};

// ============================================================================
// Main Gate Function
// ============================================================================

/**
 * Run the ISL Gate
 * 
 * Evaluates findings and produces a SHIP/NO_SHIP verdict with evidence.
 * 
 * @param input - Gate input data (findings, counts, etc.)
 * @param options - Gate options
 * @returns Gate result with verdict, score, and evidence path
 */
export async function runGate(
  input: GateInput,
  options: GateOptions
): Promise<GateResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate input
  validateInput(input, opts);

  try {
    // Build scores and verdict from findings
    const { counts, scores, verdict: verdictInfo } = buildResult({
      findings: input.findings,
      filesConsidered: input.filesConsidered,
      filesScanned: input.filesScanned,
      blockers: input.blockers,
    });

    // Convert CommandVerdict to GateVerdict
    const verdict: GateVerdict = verdictInfo.status === 'SHIP' ? 'SHIP' : 'NO_SHIP';

    // Build reasons
    const reasons = buildReasons(input.findings, verdictInfo.reasons, input.blockers);

    // Generate deterministic fingerprint
    const fingerprint = generateFingerprint(input, opts);

    // Build result
    const result: GateResult = {
      verdict,
      score: scores.overall,
      reasons,
      evidencePath: opts.evidencePath,
      fingerprint,
      durationMs: Date.now() - startTime,
      timestamp: opts.deterministic 
        ? '1970-01-01T00:00:00.000Z' 
        : new Date().toISOString(),
    };

    return result;

  } catch (error) {
    throw wrapError(error, { component: 'Gate', operation: 'runGate' });
  }
}

/**
 * Quick gate check - returns just verdict without evidence
 */
export function quickCheck(input: GateInput): GateVerdict {
  const { scores, verdict: verdictInfo } = buildResult({
    findings: input.findings,
    filesConsidered: input.filesConsidered,
    filesScanned: input.filesScanned,
    blockers: input.blockers,
  });

  return verdictInfo.status === 'SHIP' ? 'SHIP' : 'NO_SHIP';
}

/**
 * Check if findings would pass the gate
 */
export function wouldPass(findings: Finding[]): boolean {
  const { verdict } = buildResult({
    findings,
    filesConsidered: findings.length > 0 ? 1 : 0,
    filesScanned: findings.length > 0 ? 1 : 0,
  });

  return verdict.status === 'SHIP';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate gate input
 */
function validateInput(input: GateInput, options: GateOptions): void {
  if (!input) {
    throw new ValidationError('Gate input is required', {
      component: 'Gate',
      operation: 'validateInput',
      field: 'input',
    });
  }

  if (!options.projectRoot) {
    throw new ValidationError('Project root is required', {
      component: 'Gate',
      operation: 'validateInput',
      field: 'projectRoot',
    });
  }

  if (input.filesScanned > input.filesConsidered) {
    throw new ValidationError('filesScanned cannot exceed filesConsidered', {
      component: 'Gate',
      operation: 'validateInput',
      field: 'filesScanned',
    });
  }
}

/**
 * Build reasons from findings and verdict
 */
function buildReasons(
  findings: Finding[],
  verdictReasons: string[],
  blockers?: CriticalBlockers
): GateReason[] {
  const reasons: GateReason[] = [];

  // Add blocker reasons first
  if (blockers) {
    const blockerReasons = getCriticalBlockerReasons(blockers);
    for (const reason of blockerReasons) {
      reasons.push({
        code: 'CRITICAL_BLOCKER',
        message: reason,
        files: [],
        severity: 'critical',
      });
    }
  }

  // Group findings by type
  const findingsByType = new Map<string, Finding[]>();
  for (const finding of findings) {
    const existing = findingsByType.get(finding.type) ?? [];
    existing.push(finding);
    findingsByType.set(finding.type, existing);
  }

  // Add finding-based reasons
  for (const [type, typeFindings] of findingsByType) {
    const files = [...new Set(typeFindings.map(f => f.file).filter(Boolean))] as string[];
    const maxSeverity = getMaxSeverity(typeFindings);
    
    reasons.push({
      code: type.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      message: `${typeFindings.length} ${type} issue(s) found`,
      files,
      severity: maxSeverity,
    });
  }

  // Add verdict reasons if no other reasons
  if (reasons.length === 0) {
    for (const reason of verdictReasons) {
      reasons.push({
        code: 'VERDICT',
        message: reason,
        files: [],
      });
    }
  }

  return reasons;
}

/**
 * Get maximum severity from findings
 */
function getMaxSeverity(findings: Finding[]): 'critical' | 'high' | 'medium' | 'low' {
  const order = ['critical', 'high', 'medium', 'low'] as const;
  
  for (const level of order) {
    if (findings.some(f => f.severity === level)) {
      return level;
    }
  }
  
  return 'low';
}

/**
 * Generate deterministic fingerprint from input
 */
function generateFingerprint(input: GateInput, options: GateOptions): string {
  const data = {
    findingsHash: hashFindings(input.findings),
    filesConsidered: input.filesConsidered,
    filesScanned: input.filesScanned,
    projectRoot: options.projectRoot,
    specPattern: options.specPattern,
    policyPacks: options.policyPacks?.sort() ?? [],
  };

  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Hash findings for fingerprint
 */
function hashFindings(findings: Finding[]): string {
  const sorted = [...findings].sort((a, b) => {
    const aKey = `${a.type}:${a.file}:${a.line}:${a.message}`;
    const bKey = `${b.type}:${b.file}:${b.line}:${b.message}`;
    return aKey.localeCompare(bKey);
  });

  const json = JSON.stringify(sorted.map(f => ({
    type: f.type,
    severity: f.severity,
    file: f.file,
    line: f.line,
    message: f.message,
  })));

  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 8);
}

// ============================================================================
// Exports
// ============================================================================

export { VERDICT_THRESHOLDS };
export type { GateResult, GateOptions, GateInput, GateReason, GateVerdict, Finding };
