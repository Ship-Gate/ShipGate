/**
 * ISL Evidence - Bundle Writer
 * 
 * Writes evidence bundles to disk with tamper-resistant signing.
 * 
 * @module @isl-lang/evidence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GateResult, Finding, SeverityCounts } from '@isl-lang/gate';
import type { 
  EvidenceManifest, 
  EvidenceResults, 
  EvidenceBundle,
  EvidenceOptions,
} from './types.js';
import { generateHtmlReport } from './html-report.js';
import { 
  createSignature, 
  verifySignature, 
  deterministicSerialize,
  type EvidenceSignature,
} from './signing.js';

const EVIDENCE_VERSION = '1.0.0';
const GATE_VERSION = '0.1.0';

/**
 * Write an evidence bundle to disk
 * 
 * @param result - Gate result
 * @param findings - Detailed findings
 * @param options - Evidence options
 * @returns Path to the evidence directory
 */
export async function writeEvidenceBundle(
  result: GateResult,
  findings: Finding[],
  options: EvidenceOptions
): Promise<string> {
  const evidenceDir = path.resolve(options.outputDir);
  
  // Create evidence directory
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.mkdir(path.join(evidenceDir, 'artifacts'), { recursive: true });

  // Build manifest
  const manifest: EvidenceManifest = {
    version: EVIDENCE_VERSION,
    generatedAt: options.deterministic 
      ? '1970-01-01T00:00:00.000Z' 
      : new Date().toISOString(),
    gateVersion: GATE_VERSION,
    fingerprint: result.fingerprint,
    project: {
      root: options.projectRoot,
      name: options.projectName,
    },
    files: ['manifest.json', 'results.json'],
  };

  // Build results
  const severityCounts = countSeverities(findings);
  const results: EvidenceResults = {
    verdict: result.verdict,
    score: result.score,
    summary: {
      totalFindings: findings.length,
      ...severityCounts,
      filesScanned: 0, // Would come from gate input
      filesConsidered: 0,
    },
    findings,
    reasons: result.reasons,
    durationMs: result.durationMs,
  };

  // Write HTML report if requested
  if (options.includeHtmlReport !== false) {
    const html = generateHtmlReport(result, findings, options);
    await fs.writeFile(
      path.join(evidenceDir, 'report.html'),
      html,
      'utf-8'
    );
    manifest.files.push('report.html');
  }

  // Write artifacts if provided
  if (options.includeArtifacts !== false) {
    // Write findings as artifact
    const findingsContent = deterministicSerialize(findings, true);
    await fs.writeFile(
      path.join(evidenceDir, 'artifacts', 'findings.json'),
      findingsContent,
      'utf-8'
    );
    manifest.files.push('artifacts/findings.json');
  }

  // Add signature file to manifest
  manifest.files.push('signature.json');
  manifest.files.sort(); // Deterministic ordering

  // Serialize with deterministic ordering
  const manifestContent = deterministicSerialize(manifest, true);
  const resultsContent = deterministicSerialize(results, true);

  // Write manifest
  await fs.writeFile(
    path.join(evidenceDir, 'manifest.json'),
    manifestContent,
    'utf-8'
  );

  // Write results
  await fs.writeFile(
    path.join(evidenceDir, 'results.json'),
    resultsContent,
    'utf-8'
  );

  // Create and write signature
  const signature = createSignature(
    manifestContent,
    resultsContent,
    options.deterministic
  );
  await fs.writeFile(
    path.join(evidenceDir, 'signature.json'),
    deterministicSerialize(signature, true),
    'utf-8'
  );

  return evidenceDir;
}

/**
 * Read an evidence bundle from disk
 */
export async function readEvidenceBundle(
  evidenceDir: string
): Promise<EvidenceBundle | null> {
  try {
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    const resultsPath = path.join(evidenceDir, 'results.json');
    const reportPath = path.join(evidenceDir, 'report.html');

    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const resultsContent = await fs.readFile(resultsPath, 'utf-8');
    
    const manifest: EvidenceManifest = JSON.parse(manifestContent);
    const results: EvidenceResults = JSON.parse(resultsContent);

    let reportHtml = '';
    try {
      reportHtml = await fs.readFile(reportPath, 'utf-8');
    } catch {
      // Report might not exist
    }

    return {
      manifest,
      results,
      reportHtml,
      artifacts: {},
    };
  } catch {
    return null;
  }
}

/**
 * Validate an evidence bundle (structure only)
 */
export async function validateEvidenceBundle(
  evidenceDir: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    const resultsPath = path.join(evidenceDir, 'results.json');

    // Check manifest exists
    try {
      await fs.access(manifestPath);
    } catch {
      errors.push('Missing manifest.json');
    }

    // Check results exists
    try {
      await fs.access(resultsPath);
    } catch {
      errors.push('Missing results.json');
    }

    // Validate manifest structure
    if (errors.length === 0) {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      if (!manifest.version) errors.push('Manifest missing version');
      if (!manifest.fingerprint) errors.push('Manifest missing fingerprint');
    }

    // Validate results structure
    if (errors.length === 0) {
      const resultsContent = await fs.readFile(resultsPath, 'utf-8');
      const results = JSON.parse(resultsContent);
      
      if (!results.verdict) errors.push('Results missing verdict');
      if (typeof results.score !== 'number') errors.push('Results missing score');
    }

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify evidence bundle integrity (tamper detection)
 */
export async function verifyEvidenceBundle(
  evidenceDir: string
): Promise<{ valid: boolean; errors: string[]; signature?: EvidenceSignature }> {
  const errors: string[] = [];

  try {
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    const resultsPath = path.join(evidenceDir, 'results.json');
    const signaturePath = path.join(evidenceDir, 'signature.json');

    // Read all files
    let manifestContent: string;
    let resultsContent: string;
    let signatureContent: string;

    try {
      manifestContent = await fs.readFile(manifestPath, 'utf-8');
    } catch {
      errors.push('Missing manifest.json');
      return { valid: false, errors };
    }

    try {
      resultsContent = await fs.readFile(resultsPath, 'utf-8');
    } catch {
      errors.push('Missing results.json');
      return { valid: false, errors };
    }

    try {
      signatureContent = await fs.readFile(signaturePath, 'utf-8');
    } catch {
      errors.push('Missing signature.json - bundle may be unsigned or tampered');
      return { valid: false, errors };
    }

    // Parse signature
    const signature: EvidenceSignature = JSON.parse(signatureContent);

    // Verify signature
    const verification = verifySignature(signature, manifestContent, resultsContent);
    
    if (!verification.valid) {
      errors.push(...verification.errors);
      errors.push('⚠️ EVIDENCE TAMPERED - hashes do not match');
    }

    return {
      valid: verification.valid,
      errors,
      signature,
    };

  } catch (error) {
    errors.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return { valid: false, errors };
  }
}

/**
 * Count severities from findings
 */
function countSeverities(findings: Finding[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  for (const finding of findings) {
    if (finding.severity in counts) {
      counts[finding.severity]++;
    }
  }
  
  return counts;
}
