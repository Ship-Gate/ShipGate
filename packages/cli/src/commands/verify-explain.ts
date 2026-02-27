/**
 * Verify Explain Mode
 * 
 * Generates detailed explanation reports for verification results.
 * 
 * @module @isl-lang/cli/commands/verify-explain
 */

import { join } from 'path';
import type { UnifiedVerifyResult, FileVerifyResultEntry } from './verify.js';
import type { ISLClaim } from '@isl-lang/gate/verdict-scoring';
import { scoreVerdicts, DEFAULT_SCORING_CONFIG, generateExplainReports } from '@isl-lang/gate/verdict-scoring';

// GateEvidence type definition (if not exported from gate)
type GateEvidenceSource = 'isl-spec' | 'specless-scanner' | 'static-analysis' | 'runtime-probe' | 'test-execution' | 'manual-review';

interface GateEvidence {
  source: GateEvidenceSource;
  check: string;
  result: 'pass' | 'warn' | 'fail' | 'skip';
  confidence: number;
  details?: string;
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert UnifiedVerifyResult to ISL claims
 */
function convertToClaims(result: UnifiedVerifyResult): ISLClaim[] {
  const claims: ISLClaim[] = [];
  
  for (const file of result.files) {
    // Each file result becomes a claim
    const claim: ISLClaim = {
      id: `file:${file.file}`,
      type: file.mode === 'ISL verified' ? 'postcondition' : 'scenario',
      verdict: file.status === 'PASS' ? 'pass' 
        : file.status === 'WARN' ? 'warn'
        : file.status === 'FAIL' ? 'fail'
        : 'skip',
      description: `${file.mode}: ${file.file}`,
      file: file.file,
    };
    
    claims.push(claim);
    
    // Add blockers as separate claims
    for (const blocker of file.blockers) {
      claims.push({
        id: `blocker:${file.file}:${blocker.slice(0, 50)}`,
        type: 'invariant',
        verdict: 'fail',
        description: blocker,
        file: file.file,
      });
    }
  }
  
  return claims;
}

/**
 * Convert UnifiedVerifyResult to GateEvidence
 */
function convertToEvidence(result: UnifiedVerifyResult): GateEvidence[] {
  const evidence: GateEvidence[] = [];
  
  for (const file of result.files) {
    evidence.push({
      source: (file.mode === 'ISL verified' ? 'isl-spec' : 'specless-scanner') as GateEvidenceSource,
      check: `file:${file.file}`,
      result: file.status === 'PASS' ? 'pass'
        : file.status === 'WARN' ? 'warn'
        : file.status === 'FAIL' ? 'fail'
        : 'skip',
      confidence: file.score,
      details: `${file.mode}: score ${file.score.toFixed(2)}`,
    });
    
    // Add blockers as evidence
    for (const blocker of file.blockers) {
      evidence.push({
        source: (file.mode === 'ISL verified' ? 'isl-spec' : 'specless-scanner') as GateEvidenceSource,
        check: `blocker:${file.file}`,
        result: 'fail',
        confidence: 1.0,
        details: blocker,
      });
    }
  }
  
  return evidence;
}

// ============================================================================
// Explain Mode
// ============================================================================

/**
 * Generate explain reports for a verification result
 */
export async function generateExplainReportsForVerify(
  result: UnifiedVerifyResult,
  outputDir: string = './reports'
): Promise<{ jsonPath: string; mdPath: string }> {
  // Convert to claims and evidence
  const claims = convertToClaims(result);
  const evidence = convertToEvidence(result);
  
  // Score verdicts
  const scoringResult = scoreVerdicts(claims, evidence as any, DEFAULT_SCORING_CONFIG);
  
  // Generate reports
  const reports = await generateExplainReports(scoringResult, outputDir);
  
  return reports;
}
