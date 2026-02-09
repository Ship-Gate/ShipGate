/**
 * Signature verification hook.
 *
 * Computes a SHA-256 digest of the contract source submitted during publish
 * and optionally verifies a detached signature if the author has a public key.
 */

import crypto from 'node:crypto';
import type { MarketplaceStore } from '../db/store.js';
import type { Author } from '../types.js';

export interface SignatureInput {
  contract: string;
  signature?: string | null; // base64-encoded detached signature
}

export interface SignatureResult {
  algorithm: string;
  digest: string;
  verified: boolean;
}

/**
 * Compute a SHA-256 hex digest of the given content.
 */
export function computeDigest(content: string, algorithm = 'sha256'): string {
  return crypto.createHash(algorithm).update(content, 'utf8').digest('hex');
}

/**
 * Verify a detached signature using the author's public key.
 * Returns true if the signature is valid, false otherwise.
 * If no public key or signature is provided, returns false (unverified).
 */
export function verifyDetachedSignature(
  content: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(content, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Process a publish request's signature metadata.
 *
 * 1. Always computes a SHA-256 digest of the contract.
 * 2. If the author has a public key and a detached signature is provided,
 *    attempts cryptographic verification.
 * 3. Stores the signature row in the store.
 */
export function processSignature(
  store: MarketplaceStore,
  versionId: string,
  author: Author,
  input: SignatureInput,
): SignatureResult {
  const algorithm = 'sha256';
  const digest = computeDigest(input.contract, algorithm);

  let verified = false;

  if (input.signature && author.publicKey) {
    verified = verifyDetachedSignature(input.contract, input.signature, author.publicKey);
  }

  store.addSignature({
    versionId,
    algorithm,
    digest,
    signature: input.signature ?? null,
    signerId: author.id,
    verified,
  });

  return { algorithm, digest, verified };
}
