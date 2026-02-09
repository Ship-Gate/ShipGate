/**
 * Proof Command
 * 
 * Verify proof bundles and check their validity.
 * 
 * Usage:
 *   isl proof verify <bundle-path>        # Verify a proof bundle
 *   isl proof verify <bundle-path> --sign-secret <secret>  # Verify signature
 */

import { existsSync } from 'fs';
import { resolve, extname } from 'path';
import chalk from 'chalk';
import { 
  verifyProofBundle, 
  formatVerificationResult, 
  verifyZipBundle,
  type VerifyOptions as ProofVerifyOptions,
  type ZipVerifyOptions,
} from '@isl-lang/proof';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput, isQuietOutput } from '../output.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofVerifyCommandOptions {
  /** Secret for signature verification */
  signSecret?: string;
  /** Skip file completeness check */
  skipFileCheck?: boolean;
  /** Skip signature verification */
  skipSignatureCheck?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
}

export interface ProofVerifyResult {
  success: boolean;
  valid: boolean;
  verdict: string;
  complete: boolean;
  signatureValid: boolean | null;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    details?: string;
  }>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warnings: number;
  };
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof Verify Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a proof bundle
 */
export async function verifyProof(bundlePath: string, options: ProofVerifyCommandOptions = {}): Promise<ProofVerifyResult> {
  const isJson = options.format === 'json' || isJsonOutput();
  const errors: string[] = [];

  try {
    // Resolve bundle path
    const resolvedPath = resolve(bundlePath);
    
    if (!existsSync(resolvedPath)) {
      const error = `Proof bundle not found: ${bundlePath}`;
      errors.push(error);
      return {
        success: false,
        valid: false,
        verdict: 'UNPROVEN',
        complete: false,
        signatureValid: null,
        issues: [{
          severity: 'error',
          code: 'BUNDLE_NOT_FOUND',
          message: error,
        }],
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 1,
          warnings: 0,
        },
        errors,
      };
    }

    // Check if it's a ZIP file
    const isZip = extname(resolvedPath).toLowerCase() === '.zip';
    
    let result;
    if (isZip) {
      // Verify ZIP bundle
      const zipOptions: ZipVerifyOptions = {
        zipPath: resolvedPath,
        publicKey: options.signSecret, // For ed25519, signSecret is the public key
        hmacSecret: options.signSecret, // For HMAC
      };
      
      const zipResult = await verifyZipBundle(zipOptions);
      
      // Convert ZIP result to ProofVerifyResult format
      result = {
        valid: zipResult.valid,
        verdict: zipResult.manifest?.verdict || 'UNPROVEN',
        complete: zipResult.manifest ? true : false,
        signatureValid: zipResult.signatureValid,
        issues: zipResult.issues.map(i => ({
          severity: i.severity,
          code: i.code,
          message: i.message,
        })),
        summary: {
          totalChecks: zipResult.issues.length,
          passedChecks: zipResult.issues.filter(i => i.severity !== 'error').length,
          failedChecks: zipResult.issues.filter(i => i.severity === 'error').length,
          warnings: zipResult.issues.filter(i => i.severity === 'warning').length,
        },
      };
    } else {
      // Verify directory bundle
      const verifyOptions: ProofVerifyOptions = {
        signSecret: options.signSecret,
        skipFileCheck: options.skipFileCheck,
        skipSignatureCheck: options.skipSignatureCheck,
        verbose: options.verbose ?? !isJson,
      };

      result = await verifyProofBundle(resolvedPath, verifyOptions);
    }

    return {
      success: result.valid,
      valid: result.valid,
      verdict: result.verdict,
      complete: result.complete,
      signatureValid: result.signatureValid,
      issues: result.issues,
      summary: result.summary,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    return {
      success: false,
      valid: false,
      verdict: 'UNPROVEN',
      complete: false,
      signatureValid: null,
      issues: [{
        severity: 'error',
        code: 'VERIFICATION_ERROR',
        message: message,
      }],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 1,
        warnings: 0,
      },
      errors,
    };
  }
}

/**
 * Print proof verify result
 */
export function printProofVerifyResult(result: ProofVerifyResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  const isQuiet = options.format === 'quiet' || isQuietOutput();

  if (isJson) {
    console.log(JSON.stringify({
      success: result.success,
      valid: result.valid,
      verdict: result.verdict,
      complete: result.complete,
      signatureValid: result.signatureValid,
      issues: result.issues,
      summary: result.summary,
      errors: result.errors,
    }, null, 2));
    return;
  }

  if (isQuiet) {
    return;
  }

  // Use the formatted output from the proof verifier
  const formatted = formatVerificationResult({
    valid: result.valid,
    verdict: result.verdict as any,
    complete: result.complete,
    signatureValid: result.signatureValid,
    issues: result.issues.map(i => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
      details: i.details,
    })),
    summary: result.summary,
  });

  console.log(formatted);

  // Next steps
  if (!result.success) {
    console.log('');
    console.log(chalk.yellow('  Next Steps:'));
    const errorIssues = result.issues.filter(i => i.severity === 'error');
    if (errorIssues.length > 0) {
      console.log('    • Fix the errors listed above');
      if (errorIssues.some(i => i.code === 'SIGNATURE_INVALID')) {
        console.log('    • Provide correct --sign-secret if bundle is signed');
      }
      if (errorIssues.some(i => i.code === 'FILE_MISSING')) {
        console.log('    • Ensure all files listed in manifest are present');
      }
    }
    console.log('');
  } else {
    console.log('');
    console.log(chalk.green('  ✓ Proof bundle is valid and verified!'));
    console.log('');
  }

  // Output verdict in the required format: PROVEN / INCOMPLETE_PROOF / FAILED
  if (!isQuiet) {
    let verdictOutput: string;
    if (!result.valid) {
      verdictOutput = 'FAILED';
    } else if (result.verdict === 'PROVEN') {
      verdictOutput = 'PROVEN';
    } else if (result.verdict === 'INCOMPLETE_PROOF') {
      verdictOutput = 'INCOMPLETE_PROOF';
    } else {
      // VIOLATED or UNPROVEN
      verdictOutput = 'FAILED';
    }
    
    if (!isJson) {
      console.log(verdictOutput);
    }
  }
}

/**
 * Get exit code for proof verify result
 */
export function getProofVerifyExitCode(result: ProofVerifyResult): number {
  if (!result.valid) {
    return ExitCode.ISL_ERROR; // FAILED
  }
  
  if (result.verdict === 'PROVEN') {
    return ExitCode.SUCCESS; // 0
  }
  
  if (result.verdict === 'INCOMPLETE_PROOF') {
    return ExitCode.SUCCESS; // 0 (but can be overridden by --require-tests)
  }
  
  // VIOLATED or UNPROVEN
  return ExitCode.ISL_ERROR; // 1
}
