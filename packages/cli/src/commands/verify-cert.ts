/**
 * Verify Certificate Command
 *
 * Reads .isl-certificate.json, re-hashes files, verifies signature,
 * and prints a human-readable verification report.
 *
 * Usage:
 *   isl verify-cert
 *   isl verify-cert --cert .isl-certificate.json
 *   isl verify-cert --project-root /path/to/project
 */

import { readFile } from 'fs/promises';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { verifyCertificate, CERTIFICATE_FILENAME } from '@isl-lang/isl-certificate';
import type { ISLCertificate } from '@isl-lang/isl-certificate';
import { output } from '../output.js';
import { isJsonOutput } from '../output.js';

export interface VerifyCertOptions {
  cert?: string;
  projectRoot?: string;
  apiKey?: string;
  format?: 'pretty' | 'json' | 'quiet';
}

export interface VerifyCertResult {
  valid: boolean;
  certificate?: ISLCertificate;
  errors: string[];
  warnings: string[];
  details?: {
    signatureValid: boolean;
    filesVerified: number;
    filesMismatched: string[];
    missingFiles: string[];
  };
  error?: string;
}

/**
 * Run verify-cert command
 */
export async function verifyCert(options: VerifyCertOptions = {}): Promise<VerifyCertResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const certPath = options.cert ?? join(projectRoot, CERTIFICATE_FILENAME);

  try {
    const raw = await readFile(certPath, 'utf-8');
    const certificate = JSON.parse(raw) as ISLCertificate;

    const result = await verifyCertificate(certificate, projectRoot, options.apiKey);

    return {
      valid: result.valid,
      certificate,
      errors: result.errors,
      warnings: result.warnings,
      details: result.details,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [message],
      warnings: [],
      error: message,
    };
  }
}

/**
 * Print verification report
 */
export function printVerifyCertResult(
  result: VerifyCertResult,
  opts: { format?: 'pretty' | 'json' | 'quiet' } = {}
): void {
  const isJson = opts.format === 'json' || isJsonOutput();

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings,
          details: result.details,
          certificate: result.certificate
            ? {
                id: result.certificate.id,
                timestamp: result.certificate.timestamp,
                verdict: result.certificate.verification.verdict,
                trustScore: result.certificate.verification.trustScore,
              }
            : undefined,
        },
        null,
        2
      )
    );
    return;
  }

  if (result.error && !result.certificate) {
    console.error(chalk.red(`Error: ${result.error}`));
    return;
  }

  const cert = result.certificate;
  const d = result.details;
  if (!cert || !d) {
    console.error(chalk.red('No certificate or details available'));
    return;
  }

  console.log('');
  console.log(chalk.bold('ISL Certificate Verification'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');
  console.log(chalk.bold('Certificate:'));
  console.log(chalk.gray(`  ID:        ${cert.id}`));
  console.log(chalk.gray(`  Timestamp: ${cert.timestamp}`));
  console.log(chalk.gray(`  Verdict:   ${cert.verification.verdict}`));
  console.log(chalk.gray(`  Trust:     ${cert.verification.trustScore}/100`));
  console.log('');

  console.log(chalk.bold('Integrity:'));
  console.log(
    d.signatureValid
      ? chalk.green('  ✓ Signature valid')
      : chalk.red('  ✗ Signature invalid (tampering or wrong key)')
  );
  console.log(
    chalk.gray(`  Files verified: ${d.filesVerified}/${cert.generatedFiles.length}`)
  );
  if (d.filesMismatched.length > 0) {
    console.log(chalk.red(`  ✗ Hash mismatch: ${d.filesMismatched.join(', ')}`));
  }
  if (d.missingFiles.length > 0) {
    console.log(chalk.yellow(`  ⚠ Missing: ${d.missingFiles.join(', ')}`));
  }
  console.log('');

  if (result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    for (const e of result.errors) {
      console.log(chalk.red(`  • ${e}`));
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    for (const w of result.warnings) {
      console.log(chalk.yellow(`  • ${w}`));
    }
    console.log('');
  }

  console.log(chalk.gray('─'.repeat(50)));
  if (result.valid) {
    console.log(chalk.green.bold('✓ Certificate valid — no tampering detected'));
  } else {
    console.log(chalk.red.bold('✗ Certificate invalid — verification failed'));
  }
  console.log('');
}

/**
 * Exit code for verify-cert
 */
export function getVerifyCertExitCode(result: VerifyCertResult): number {
  return result.valid ? 0 : 1;
}
