/**
 * ISL Verifier
 * 
 * Runs ISL verification against implementation files.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as artifact from '@actions/artifact';
import * as path from 'path';
import * as fs from 'fs/promises';

import type { ActionInputs } from './inputs.js';
import type { Diagnostic } from './reporter.js';

// ============================================================================
// Types
// ============================================================================

export type Verdict = 'verified' | 'risky' | 'unsafe' | 'unchecked' | 'checked' | 'failed';

export interface VerificationResult {
  /** Verification verdict */
  verdict: Verdict;
  /** Verification score (0-100) */
  score: number;
  /** Coverage metrics */
  coverage: CoverageMetrics;
  /** Errors found during verification */
  errors: Diagnostic[];
  /** Warnings found during verification */
  warnings: Diagnostic[];
  /** Proof bundle path (if generated) */
  proofBundlePath?: string;
  /** Verification duration in ms */
  duration: number;
}

export interface CoverageMetrics {
  /** Precondition coverage percentage */
  preconditions: number;
  /** Postcondition coverage percentage */
  postconditions: number;
  /** Invariant coverage percentage */
  invariants: number;
  /** Temporal property coverage percentage */
  temporal: number;
}

interface ISLVerifyOutput {
  verdict: Verdict;
  score: number;
  coverage: CoverageMetrics;
  errors: ISLDiagnostic[];
  warnings: ISLDiagnostic[];
  proofBundle?: string;
}

interface ISLDiagnostic {
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info';
  context?: string;
}

// ============================================================================
// ISL Verifier
// ============================================================================

export class ISLVerifier {
  private inputs: ActionInputs;

  constructor(inputs: ActionInputs) {
    this.inputs = inputs;
  }

  /**
   * Run ISL verification
   */
  async verify(): Promise<VerificationResult> {
    const startTime = Date.now();

    if (!this.inputs.implementation) {
      return {
        verdict: 'unchecked',
        score: 0,
        coverage: {
          preconditions: 0,
          postconditions: 0,
          invariants: 0,
          temporal: 0,
        },
        errors: [],
        warnings: [],
        duration: Date.now() - startTime,
      };
    }

    core.info(`Verifying implementation: ${this.inputs.implementation}`);

    let output = '';
    let errorOutput = '';

    const options: exec.ExecOptions = {
      cwd: this.inputs.workingDirectory,
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
    };

    // Build verify command
    const args = [
      'isl',
      'verify',
      '--specs', this.inputs.specs,
      '--implementation', this.inputs.implementation,
      '--format', 'json',
    ];

    if (this.inputs.uploadProofs) {
      args.push('--generate-proofs');
    }

    const exitCode = await exec.exec('npx', args, options);

    // Parse output
    const result = this.parseVerifyOutput(output, errorOutput, exitCode);
    result.duration = Date.now() - startTime;

    // Upload proof bundle if enabled
    if (this.inputs.uploadProofs && result.proofBundlePath) {
      await this.uploadProofBundle(result.proofBundlePath);
    }

    return result;
  }

  /**
   * Parse verification output
   */
  private parseVerifyOutput(
    output: string,
    errorOutput: string,
    exitCode: number
  ): VerificationResult {
    const defaultResult: VerificationResult = {
      verdict: 'unchecked',
      score: 0,
      coverage: {
        preconditions: 0,
        postconditions: 0,
        invariants: 0,
        temporal: 0,
      },
      errors: [],
      warnings: [],
      duration: 0,
    };

    if (!output) {
      if (exitCode !== 0) {
        defaultResult.verdict = 'unsafe';
        defaultResult.errors.push({
          code: 'ISL000',
          message: errorOutput || 'Verification failed with no output',
          file: this.inputs.implementation,
          line: 1,
          column: 1,
          severity: 'error',
        });
      }
      return defaultResult;
    }

    try {
      const parsed = JSON.parse(output) as ISLVerifyOutput;

      return {
        verdict: parsed.verdict,
        score: parsed.score,
        coverage: parsed.coverage || defaultResult.coverage,
        errors: parsed.errors.map(e => this.convertDiagnostic(e)),
        warnings: parsed.warnings.map(w => this.convertDiagnostic(w)),
        proofBundlePath: parsed.proofBundle,
        duration: 0,
      };
    } catch {
      // JSON parsing failed
      if (exitCode !== 0) {
        defaultResult.verdict = 'unsafe';
        defaultResult.errors.push({
          code: 'ISL000',
          message: output || errorOutput || 'Unknown verification error',
          file: this.inputs.implementation,
          line: 1,
          column: 1,
          severity: 'error',
        });
      }
      return defaultResult;
    }
  }

  /**
   * Convert ISL diagnostic to our format
   */
  private convertDiagnostic(diag: ISLDiagnostic): Diagnostic {
    return {
      code: diag.code,
      message: diag.message,
      file: diag.file,
      line: diag.line,
      column: diag.column,
      endLine: diag.endLine,
      endColumn: diag.endColumn,
      severity: diag.severity,
      context: diag.context,
    };
  }

  /**
   * Upload proof bundle as artifact
   */
  private async uploadProofBundle(bundlePath: string): Promise<void> {
    core.info(`Uploading proof bundle: ${bundlePath}`);

    try {
      const absolutePath = path.resolve(this.inputs.workingDirectory, bundlePath);
      
      // Check if path exists
      const stat = await fs.stat(absolutePath);
      
      const artifactClient = artifact.default;
      const files: string[] = [];

      if (stat.isDirectory()) {
        // Upload directory contents
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            files.push(path.join(absolutePath, entry.name));
          }
        }
      } else {
        files.push(absolutePath);
      }

      if (files.length > 0) {
        const { id, size } = await artifactClient.uploadArtifact(
          'isl-proof-bundle',
          files,
          path.dirname(absolutePath),
          {
            continueOnError: true,
          }
        );
        core.info(`Uploaded proof bundle (artifact ID: ${id}, size: ${size} bytes)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to upload proof bundle: ${message}`);
    }
  }
}

/**
 * Get verdict emoji
 */
export function getVerdictEmoji(verdict: Verdict): string {
  switch (verdict) {
    case 'verified':
      return '✅';
    case 'risky':
      return '⚠️';
    case 'unsafe':
      return '❌';
    case 'checked':
      return '✓';
    case 'failed':
      return '✗';
    default:
      return '❔';
  }
}

/**
 * Get verdict description
 */
export function getVerdictDescription(verdict: Verdict): string {
  switch (verdict) {
    case 'verified':
      return 'All specifications verified against implementation';
    case 'risky':
      return 'Some specifications could not be fully verified';
    case 'unsafe':
      return 'Verification failed - implementation does not match specification';
    case 'checked':
      return 'Specifications checked successfully (no implementation provided)';
    case 'failed':
      return 'Specification check failed';
    default:
      return 'Not checked';
  }
}
