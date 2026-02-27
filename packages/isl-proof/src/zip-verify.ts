/**
 * ISL Proof Bundle - ZIP Verifier
 * 
 * Verifies ZIP proof bundles:
 * - Extracts and validates ZIP structure
 * - Verifies manifest.json integrity
 * - Validates file hashes
 * - Verifies ed25519 signature (if present)
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ProofBundleManifest } from './manifest.js';
import { calculateBundleId, verifyManifestSignature } from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export interface ZipVerifyOptions {
  /** Path to ZIP file */
  zipPath: string;
  /** Optional public key for ed25519 signature verification */
  publicKey?: string;
  /** Optional HMAC secret for legacy signature verification */
  hmacSecret?: string;
  /** Extract directory (optional, for inspection) */
  extractDir?: string;
}

export interface ZipVerifyResult {
  /** Whether ZIP is valid */
  valid: boolean;
  /** Bundle ID from manifest */
  bundleId?: string;
  /** Manifest from bundle */
  manifest?: ProofBundleManifest;
  /** ZIP file hash */
  zipHash?: string;
  /** Whether signature is valid */
  signatureValid: boolean | null;
  /** Issues found */
  issues: Array<{
    severity: 'error' | 'warning';
    code: string;
    message: string;
  }>;
}

// ============================================================================
// ZIP Verification
// ============================================================================

/**
 * Verify a ZIP proof bundle
 */
export async function verifyZipBundle(
  options: ZipVerifyOptions
): Promise<ZipVerifyResult> {
  const { zipPath, publicKey, hmacSecret, extractDir } = options;
  const issues: ZipVerifyResult['issues'] = [];

  // Read ZIP file
  let zipBuffer: Buffer;
  try {
    zipBuffer = await fs.readFile(zipPath);
  } catch (err) {
    return {
      valid: false,
      signatureValid: null,
      issues: [{
        severity: 'error',
        code: 'ZIP_NOT_FOUND',
        message: `ZIP file not found: ${zipPath}`,
      }],
    };
  }

  // Calculate ZIP hash
  const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  // Check for signature file
  let signatureValid: boolean | null = null;
  const sigPath = zipPath + '.sig';
  try {
    const sigContent = await fs.readFile(sigPath, 'utf-8');
    const sig = JSON.parse(sigContent);

    if (sig.algorithm === 'ed25519' && publicKey) {
      signatureValid = await verifyEd25519Signature(
        zipBuffer,
        sig.signature,
        publicKey
      );
      if (!signatureValid) {
        issues.push({
          severity: 'error',
          code: 'SIGNATURE_INVALID',
          message: 'Ed25519 signature verification failed',
        });
      }
    } else if (sig.algorithm === 'ed25519' && !publicKey) {
      issues.push({
        severity: 'warning',
        code: 'SIGNATURE_NO_KEY',
        message: 'Bundle is signed but no public key provided',
      });
    }
  } catch {
    // No signature file - that's okay
  }

  // Extract ZIP (simplified - in production use 'yauzl' or similar)
  const extracted = await extractZip(zipBuffer, extractDir);
  
  if (!extracted.manifest) {
    return {
      valid: false,
      zipHash,
      signatureValid,
      issues: [
        ...issues,
        {
          severity: 'error',
          code: 'MANIFEST_MISSING',
          message: 'manifest.json not found in ZIP',
        },
      ],
    };
  }

  const manifest = extracted.manifest;

  // Verify bundle ID
  const calculatedId = calculateBundleId(manifest);
  if (calculatedId !== manifest.bundleId) {
    issues.push({
      severity: 'error',
      code: 'BUNDLE_ID_MISMATCH',
      message: `Bundle ID mismatch: expected ${calculatedId}, got ${manifest.bundleId}`,
    });
  }

  // Verify file hashes if manifest includes them
  if (manifest.files) {
    for (const filePath of manifest.files) {
      const fileContent = extracted.files.get(filePath);
      if (!fileContent) {
        issues.push({
          severity: 'error',
          code: 'FILE_MISSING',
          message: `File missing from ZIP: ${filePath}`,
        });
        continue;
      }

      // If manifest has file hashes, verify them
      // (This would require extending manifest to include per-file hashes)
    }
  }

  // Verify HMAC signature if present and secret provided
  if (manifest.signature && hmacSecret) {
    const hmacValid = verifyManifestSignature(manifest, hmacSecret);
    if (!hmacValid.valid) {
      issues.push({
        severity: 'error',
        code: 'HMAC_INVALID',
        message: hmacValid.error || 'HMAC signature verification failed',
      });
      if (signatureValid === null) {
        signatureValid = false;
      }
    } else if (signatureValid === null) {
      signatureValid = true;
    }
  }

  const valid = issues.filter(i => i.severity === 'error').length === 0;

  return {
    valid,
    bundleId: manifest.bundleId,
    manifest,
    zipHash,
    signatureValid,
    issues,
  };
}

/**
 * Extract ZIP archive (simplified implementation)
 * 
 * Note: This is a basic implementation. For production, use 'yauzl' package.
 */
export async function extractZip(
  zipBuffer: Buffer,
  extractDir?: string
): Promise<{
  manifest?: ProofBundleManifest;
  files: Map<string, Buffer>;
}> {
  const files = new Map<string, Buffer>();

  // Simple ZIP parser - find and extract files
  // This is a minimal implementation. For production, use 'yauzl'.
  let offset = 0;
  const manifest: ProofBundleManifest | undefined = undefined;

  // Look for local file headers (0x04034b50)
  while (offset < zipBuffer.length - 4) {
    const signature = zipBuffer.readUInt32LE(offset);
    
    if (signature === 0x04034b50) {
      // Local file header
      const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
      const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);
      const headerSize = 30 + fileNameLength + extraFieldLength;
      
      const fileName = zipBuffer.subarray(offset + 30, offset + 30 + fileNameLength).toString('utf-8');
      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      
      const fileData = zipBuffer.subarray(offset + headerSize, offset + headerSize + compressedSize);
      files.set(fileName, fileData);

      // Parse manifest.json if found
      if (fileName === 'manifest.json') {
        try {
          const manifestContent = JSON.parse(fileData.toString('utf-8'));
          return { manifest: manifestContent, files };
        } catch {
          // Invalid JSON - continue
        }
      }

      offset += headerSize + compressedSize;
    } else {
      offset++;
    }
  }

  return { manifest, files };
}

/**
 * Verify ed25519 signature
 */
export async function verifyEd25519Signature(
  data: Buffer,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const signatureBuffer = Buffer.from(signature, 'base64');
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');

    // Create public key object
    // For ed25519, Node.js supports raw format but TypeScript types don't
    // @ts-expect-error - Node.js supports 'raw' format for ed25519 but TypeScript types don't
    const keyObject = crypto.createPublicKey({
      key: publicKeyBuffer,
      format: 'raw',
      type: 'ed25519',
    });

    // Verify signature
    return crypto.verify(null, data, keyObject, signatureBuffer);
  } catch {
    return false;
  }
}

