/**
 * Proof Bundle Integration
 * 
 * Integrates pipeline results with the ISL proof bundle system.
 * Writes evaluation tables and verification results to proof bundles.
 * 
 * @module @isl-lang/verify-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  PipelineResult,
  EvaluationTable,
  ClauseEvidence,
  InvariantEvidence,
} from '../types.js';
import { generateEvaluationTable, formatTableAsHTML, formatTableAsJSON } from './evaluation-table.js';

// ============================================================================
// Types
// ============================================================================

export interface ProofBundleIntegrationConfig {
  /** Proof bundle directory */
  bundleDir: string;
  /** Domain name */
  domain: string;
  /** Spec version */
  specVersion: string;
  /** Spec content */
  specContent: string;
  /** Include full traces */
  includeFullTraces?: boolean;
}

export interface PostconditionVerificationResult {
  /** Verification status */
  status: 'verified' | 'partial' | 'failed';
  /** Verification score (0-100) */
  score: number;
  /** Coverage percentage */
  coverage: number;
  /** Evidence for each clause */
  evidence: Array<{
    clauseId: string;
    type: 'postcondition' | 'invariant';
    expression: string;
    status: 'proven' | 'violated' | 'not_proven' | 'skipped';
    triState: true | false | 'unknown';
    behavior?: string;
    traceId?: string;
  }>;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Integration Functions
// ============================================================================

/**
 * Write pipeline results to proof bundle
 */
export async function writeToProofBundle(
  result: PipelineResult,
  config: ProofBundleIntegrationConfig
): Promise<void> {
  const bundleDir = config.bundleDir;
  
  // Ensure directories exist
  await fs.mkdir(path.join(bundleDir, 'results'), { recursive: true });
  await fs.mkdir(path.join(bundleDir, 'reports'), { recursive: true });
  
  // Generate evaluation table
  const table = generateEvaluationTable(result, config.domain, config.specVersion);
  
  // Write evaluation table as JSON
  await fs.writeFile(
    path.join(bundleDir, 'results', 'evaluation-table.json'),
    formatTableAsJSON(table)
  );
  
  // Write evaluation table as HTML
  await fs.writeFile(
    path.join(bundleDir, 'reports', 'evaluation-table.html'),
    formatTableAsHTML(table)
  );
  
  // Generate and write postcondition verification result
  const verification = generateVerificationResult(result);
  await fs.writeFile(
    path.join(bundleDir, 'results', 'verification.json'),
    JSON.stringify(verification, null, 2)
  );
  
  // Write pipeline summary
  const summary = {
    runId: result.runId,
    verdict: result.verdict,
    score: result.score,
    timing: result.timing,
    summary: result.summary,
    errors: result.errors,
  };
  await fs.writeFile(
    path.join(bundleDir, 'results', 'pipeline-summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  // Write traces if included
  if (config.includeFullTraces && result.stages.traceCollector?.output?.traces) {
    await fs.mkdir(path.join(bundleDir, 'traces'), { recursive: true });
    
    const traces = result.stages.traceCollector.output.traces;
    const traceIndex: Array<{ id: string; name: string; behavior?: string }> = [];
    
    for (const trace of traces) {
      await fs.writeFile(
        path.join(bundleDir, 'traces', `${trace.id}.json`),
        JSON.stringify(trace, null, 2)
      );
      traceIndex.push({
        id: trace.id,
        name: trace.name,
        behavior: trace.behavior,
      });
    }
    
    await fs.writeFile(
      path.join(bundleDir, 'traces', 'index.json'),
      JSON.stringify(traceIndex, null, 2)
    );
  }
}

/**
 * Generate postcondition verification result for proof bundle manifest
 */
export function generateVerificationResult(
  result: PipelineResult
): PostconditionVerificationResult {
  const allEvidence = [
    ...result.evidence.postconditions,
    ...result.evidence.invariants,
  ];
  
  const proven = allEvidence.filter(e => e.status === 'proven').length;
  const violated = allEvidence.filter(e => e.status === 'violated').length;
  const total = allEvidence.length;
  
  // Determine status
  let status: 'verified' | 'partial' | 'failed';
  if (violated > 0) {
    status = 'failed';
  } else if (proven === total && total > 0) {
    status = 'verified';
  } else {
    status = 'partial';
  }
  
  // Calculate score
  const score = total > 0 ? Math.round((proven / total) * 100) : 0;
  
  // Calculate coverage
  const coverage = total > 0 
    ? Math.round(((proven + violated) / total) * 100) 
    : 0;
  
  // Build evidence array
  const evidence = allEvidence.map(e => ({
    clauseId: e.clauseId,
    type: e.type,
    expression: e.expression,
    status: e.status,
    triState: e.triStateResult,
    behavior: e.behavior,
    traceId: e.traceSlice?.traceId,
  }));
  
  return {
    status,
    score,
    coverage,
    evidence,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Update existing proof bundle manifest with verification results
 */
export async function updateManifest(
  bundleDir: string,
  result: PipelineResult
): Promise<void> {
  const manifestPath = path.join(bundleDir, 'manifest.json');
  
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);
    
    // Update verification fields
    manifest.postconditionVerification = generateVerificationResult(result);
    
    // Update verdict if needed
    if (result.verdict === 'FAILED' && manifest.verdict !== 'VIOLATED') {
      manifest.verdict = 'VIOLATED';
      manifest.verdictReason = 'Postcondition or invariant violation detected by verification pipeline';
    } else if (result.verdict === 'INCOMPLETE_PROOF' && manifest.verdict === 'PROVEN') {
      manifest.verdict = 'INCOMPLETE_PROOF';
      manifest.verdictReason = 'Some conditions could not be verified';
    }
    
    // Add verification timestamp
    manifest.verificationTimestamp = new Date().toISOString();
    
    // Write updated manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (error) {
    // Manifest doesn't exist or can't be read - create new one
    const verification = generateVerificationResult(result);
    const newManifest = {
      schemaVersion: '2.0.0',
      bundleId: result.runId,
      generatedAt: new Date().toISOString(),
      verdict: result.verdict === 'PROVEN' ? 'PROVEN' 
        : result.verdict === 'FAILED' ? 'VIOLATED' 
        : 'INCOMPLETE_PROOF',
      postconditionVerification: verification,
      verificationTimestamp: new Date().toISOString(),
    };
    await fs.writeFile(manifestPath, JSON.stringify(newManifest, null, 2));
  }
}

/**
 * Read existing verification results from proof bundle
 */
export async function readVerificationResults(
  bundleDir: string
): Promise<PostconditionVerificationResult | null> {
  try {
    const content = await fs.readFile(
      path.join(bundleDir, 'results', 'verification.json'),
      'utf-8'
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read evaluation table from proof bundle
 */
export async function readEvaluationTable(
  bundleDir: string
): Promise<EvaluationTable | null> {
  try {
    const content = await fs.readFile(
      path.join(bundleDir, 'results', 'evaluation-table.json'),
      'utf-8'
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}
