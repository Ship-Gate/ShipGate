/**
 * ISL Certificate Verifier
 *
 * Verifies certificate integrity: file hashes and HMAC signature.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ISLCertificate } from './types.js';
import { sha256, hmacSha256, getSignableContent } from './hash.js';

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    signatureValid: boolean;
    filesVerified: number;
    filesMismatched: string[];
    missingFiles: string[];
  };
}

/**
 * Verify ISL Certificate
 *
 * - Re-hashes all referenced files and verifies hashes match
 * - Verifies HMAC signature
 *
 * @param cert - The certificate to verify
 * @param projectRoot - Project root for resolving file paths
 * @param apiKey - API key for signature verification (optional; uses env if not provided)
 */
export async function verifyCertificate(
  cert: ISLCertificate,
  projectRoot: string,
  apiKey?: string
): Promise<VerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filesMismatched: string[] = [];
  const missingFiles: string[] = [];

  // 1. Verify signature
  const signable = getSignableContent(cert as unknown as Record<string, unknown>);
  const secret = apiKey ?? process.env['ISL_API_KEY'] ?? process.env['SHIPGATE_API_KEY'] ?? 'no-key';
  const expectedSig = hmacSha256(signable, secret);
  const signatureValid = expectedSig === cert.signature;

  if (!signatureValid) {
    errors.push('Signature verification failed: certificate may have been tampered with or signed with a different key');
  }

  // 2. Verify file hashes
  let filesVerified = 0;
  for (const file of cert.generatedFiles) {
    const fullPath = join(projectRoot, file.path);
    try {
      const content = await readFile(fullPath, 'utf-8');
      const actualHash = sha256(content);
      if (actualHash !== file.hash) {
        filesMismatched.push(file.path);
        errors.push(`File hash mismatch: ${file.path} (expected ${file.hash.slice(0, 16)}..., got ${actualHash.slice(0, 16)}...)`);
      } else {
        filesVerified++;
      }
    } catch (err) {
      missingFiles.push(file.path);
      errors.push(`File not found or unreadable: ${file.path}`);
    }
  }

  if (missingFiles.length > 0 && cert.generatedFiles.length > 0) {
    warnings.push(`${missingFiles.length} referenced file(s) not found - they may have been moved or deleted`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      signatureValid,
      filesVerified,
      filesMismatched,
      missingFiles,
    },
  };
}
